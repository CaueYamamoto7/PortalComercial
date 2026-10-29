<?php
declare(strict_types=1);

namespace App\Service;

use Cake\Datasource\ConnectionManager;
use Cake\ORM\Locator\LocatorAwareTrait;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;

class OutreachService
{
    use LocatorAwareTrait;

    /** Inject the transport to keep scheduling independently testable. */
    public function __construct(private readonly WhatsAppGateway $gateway = new WhatsAppGateway())
    {
    }

    /** Load current lead data, including the current commercial stage. */
    public function lead(string $id): ?array
    {
        $row = $this->fetchTable('Leads')->find()->where(['id' => $id, 'deleted_at IS' => null])->first();
        $service = new LeadService();

        return $row ? $service->enriquecer($service->leadBaseOut($row)) : null;
    }

    /** Whether the lead is no longer eligible for automated contact. */
    public function manual(array $lead): bool
    {
        $stages = (new LeadService())->catalogo()['etapas'];
        $proposal = null;
        foreach ($stages as $stage) {
            if ((new LeadService())->etapaProposta($stage)) {
                $order = (int)$stage['ordem'];
                $proposal = $proposal === null ? $order : min($proposal, $order);
            }
        }

        return $lead['naoContatar'] || ($lead['etapa']['tipo'] ?? '') !== 'aberto'
            || ($proposal !== null && (int)($lead['etapa']['ordem'] ?? 0) >= $proposal);
    }

    /** Persist a transition with its audit timestamp. */
    public function update(string $id, array $values): void
    {
        $values['updated_at'] = time();
        ConnectionManager::get('default')->update('wa_outreach', $values, ['id' => $id]);
    }

    /** Process inbound events and at most one outgoing job under a database lease. */
    public function tick(): void
    {
        $db = ConnectionManager::get('default');
        $now = time();
        $db->execute("INSERT INTO wa_runtime (id, lease_until, heartbeat) VALUES ('worker', 0, 0) "
            . 'ON CONFLICT DO NOTHING');
        $claimed = $db->execute(
            'UPDATE wa_runtime SET lease_until = :lease, heartbeat = :now WHERE id = :id AND lease_until < :now',
            ['lease' => $now + 300, 'now' => $now, 'id' => 'worker'],
        )->rowCount();
        if (!$claimed) {
            return;
        }
        try {
            $config = (new SettingsService())->whatsapp();
            $propostaId = (new SettingsService())->papelId('proposta');
            $db->execute("UPDATE wa_outreach SET status = 'manual', updated_at = :now "
                . "WHERE status IN ('queued', 'waiting', 'scheduled') AND EXISTS ("
                . 'SELECT 1 FROM leads l LEFT JOIN stages s ON s.id = l.etapa_id WHERE l.id = wa_outreach.lead_id AND ('
                . "l.deleted_at IS NOT NULL OR l.nao_contatar = TRUE OR s.tipo <> 'aberto' OR "
                . 's.ordem >= COALESCE((SELECT ordem FROM stages WHERE id = :proposta), 2147483647) OR '
                . "(wa_outreach.status <> 'queued' AND l.mensagens_enviadas > 1)))", [
                    'now' => time(),
                    'proposta' => $propostaId,
                ]);
            $events = $this->gateway->request('/events')['events'] ?? [];
            foreach ($events as $event) {
                if (($event['kind'] ?? '') === 'receipt') {
                    $this->receipt($event);
                } else {
                    $this->event($event);
                }
            }
            if ($events) {
                $this->gateway->request('/events/ack', ['ids' => array_column($events, 'id')]);
            }
            if (count($events) >= 100) {
                return;
            }
            if (($this->gateway->request('/status')['status'] ?? '') !== 'connected') {
                return;
            }
            // One job per tick: a single bounded worker lease and no browser timers.
            $row = $db->execute(
                "SELECT * FROM wa_outreach WHERE status = 'queued' "
                . "OR (status = 'scheduled' AND (due_at <= :now OR message = '')) "
                . "ORDER BY CASE WHEN status = 'scheduled' THEN 0 ELSE 1 END, created_at LIMIT 1",
                ['now' => time()],
            )->fetch('assoc');
            if ($row && $this->withinSendLimits()) {
                $this->send($row);

                return;
            }
            // Reconcile jobs whose HTTP response was lost, never blindly resend.
            $uncertain = $db->execute(
                "SELECT * FROM wa_outreach WHERE status = 'uncertain' ORDER BY updated_at LIMIT 1",
            )->fetch('assoc');
            if ($uncertain) {
                $phase = $uncertain['sent_at'] ? 'context' : 'greeting';
                $result = $this->gateway->request('/result/' . $uncertain['id'] . '-' . $phase);
                if (($result['status'] ?? '') === 'sent') {
                    $this->complete($uncertain, $phase, $result);
                } elseif (($result['error'] ?? '') === 'legacy_unconfirmed') {
                    $this->update($uncertain['id'], [
                        'status' => 'manual',
                        'error' => 'Envio anterior não confirmado. Verifique no aplicativo antes de novo contato.',
                    ]);
                } elseif (($result['status'] ?? '') === 'failed') {
                    $this->update($uncertain['id'], [
                        'status' => 'manual',
                        'error' => 'O WhatsApp recusou a mensagem (' . (string)($result['error'] ?? 'erro') . ').',
                    ]);
                } elseif (time() - (int)$uncertain['updated_at'] > (int)($config['staleSeconds'] ?? 900)) {
                    $this->update($uncertain['id'], [
                        'status' => 'manual',
                        'error' => 'Envio anterior sem confirmação. Verifique no aplicativo antes de novo contato.',
                    ]);
                }
            }
        } finally {
            $db->update('wa_runtime', ['lease_until' => 0, 'heartbeat' => time()], ['id' => 'worker']);
        }
    }

    /** Fail closed outside the configured window or when the attempt budget is exhausted. */
    private function withinSendLimits(): bool
    {
        $config = (new SettingsService())->mensagens();
        try {
            $zone = new DateTimeZone((string)($config['fusoHorario'] ?? 'America/Sao_Paulo'));
            $now = new DateTimeImmutable('now', $zone);
            $start = (string)($config['inicio'] ?? '08:00');
            $end = (string)($config['fim'] ?? '18:00');
            if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $start)
                || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $end)
                || $start >= $end || $now->format('H:i') < $start || $now->format('H:i') >= $end) {
                return false;
            }
            $dayStart = $now->setTime(0, 0)->getTimestamp();
            $db = ConnectionManager::get('default');
            $stats = $db->execute(
                'SELECT COUNT(*) AS total FROM wa_send_attempts WHERE attempted_at >= :start',
                ['start' => $dayStart],
            )->fetch('assoc');
            $last = $db->execute('SELECT MAX(attempted_at) AS last_at FROM wa_send_attempts')->fetch('assoc');
            $limit = max(1, min(2000, (int)($config['limiteDiario'] ?? 300)));
            $interval = max(1, min(120, (int)($config['intervalo'] ?? 10)));

            return (int)$stats['total'] < $limit
                && (!$last['last_at'] || time() - (int)$last['last_at'] >= $interval);
        } catch (Throwable) {
            return false;
        }
    }

    /** Apply a provider receipt only to the exact job and phase it belongs to. */
    public function receipt(array $event): void
    {
        $job = (string)($event['job'] ?? '');
        if (!preg_match('/^(wa_[a-f0-9]{24})-(greeting|context)$/', $job, $match)) {
            return;
        }
        $db = ConnectionManager::get('default');
        $row = $db->execute('SELECT * FROM wa_outreach WHERE id = :id', ['id' => $match[1]])->fetch('assoc');
        if (!$row) {
            return;
        }
        $delivery = (string)($event['delivery'] ?? 'unconfirmed');
        if (($event['error'] ?? '') === 'legacy_unconfirmed') {
            $this->update($row['id'], [
                'status' => 'manual',
                'error' => 'Envio anterior não confirmado. Verifique no aplicativo antes de novo contato.',
            ]);
        } elseif (
            ($event['status'] ?? '') === 'sent'
            && in_array($delivery, ['server_ack', 'delivered', 'read'], true)
        ) {
            $this->complete($row, $match[2], [
                'timestamp' => (int)($event['timestamp'] ?? time()),
                'delivery' => $delivery,
            ]);
        } elseif (($event['status'] ?? '') === 'failed') {
            $this->update($row['id'], [
                'status' => 'manual',
                'error' => 'O WhatsApp recusou a mensagem (' . (string)($event['error'] ?? 'erro') . ').',
            ]);
        }
    }

    /** Record each provider event once and schedule only replies to this approach. */
    public function event(array $event): void
    {
        $db = ConnectionManager::get('default');
        $config = (new SettingsService())->whatsapp();
        $db->transactional(function () use ($db, $event, $config): void {
            $id = hash('sha256', (string)$event['id']);
            if ($db->execute('SELECT id FROM wa_events WHERE id = :id', ['id' => $id])->fetch('assoc')) {
                return;
            }
            $db->insert('wa_events', ['id' => $id, 'created_at' => time()]);
            $row = $db->execute('SELECT * FROM wa_outreach WHERE phone = :phone', [
                'phone' => $event['phone'],
            ])->fetch('assoc');
            $leadRow = $this->fetchTable('Leads')->find()
                ->where(['telefone' => $event['phone'], 'deleted_at IS' => null])->first();
            $leadId = $row['lead_id'] ?? ($leadRow ? (string)$leadRow->get('id') : null);
            if (!$leadId || !empty($event['automated'])) {
                return;
            }
            $text = mb_substr((string)($event['text'] ?? ''), 0, 10000);
            $outgoing = !empty($event['fromMe']);
            $this->interaction(
                $leadId,
                $id,
                $text ?: '[Mídia recebida — atendimento manual]',
                $outgoing ? 'saida' : 'entrada',
                (int)$event['timestamp'],
            );
            if (!$outgoing && OutreachPolicy::refusal($text)) {
                $db->update('leads', ['nao_contatar' => true], ['id' => $leadId], ['nao_contatar' => 'boolean']);
                if ($row) {
                    $this->update($row['id'], ['status' => 'blocked', 'reply' => $text]);
                }

                return;
            }
            if (!$row || in_array($row['status'], ['manual', 'cancelled', 'blocked'], true)) {
                return;
            }
            $lead = $this->lead($leadId);
            if (!$lead || $this->manual($lead)) {
                $this->update($row['id'], ['status' => 'manual']);

                return;
            }
            if (
                $outgoing || $text === '' || empty($row['sent_at'])
                || (int)$event['timestamp'] < (int)$row['sent_at']
            ) {
                $this->update($row['id'], ['status' => 'manual']);

                return;
            }
            if (in_array($row['status'], ['waiting', 'scheduled'], true)) {
                $this->update($row['id'], [
                    'status' => 'scheduled',
                    'reply' => mb_substr(trim($row['reply'] . "\n" . $text), -6000),
                    'message' => '',
                    'due_at' => $row['due_at'] ?: time() + random_int(
                        (int)($config['delayMinSeconds'] ?? 60),
                        (int)($config['delayMaxSeconds'] ?? 360),
                    ),
                    'last_reply_at' => max((int)($row['last_reply_at'] ?? 0), (int)$event['timestamp']),
                ]);
            }
        });
    }

    /** Claim an eligible job before contacting the provider. */
    private function send(array $row): void
    {
        $config = (new SettingsService())->whatsapp();
        $lead = $this->lead($row['lead_id']);
        if (
            !$lead || $this->manual($lead)
            || ($row['status'] === 'queued' && ($lead['mensagensRecebidas'] > 0 || $lead['mensagensEnviadas'] > 0))
        ) {
            $this->update($row['id'], ['status' => 'manual']);

            return;
        }
        if ($row['status'] === 'scheduled' && time() - (int)$row['due_at'] > (int)($config['staleSeconds'] ?? 900)) {
            $this->update($row['id'], [
                'status' => 'manual', 'error' => 'Agendamento vencido durante indisponibilidade.',
            ]);

            return;
        }
        $phase = $row['status'] === 'queued' ? 'greeting' : 'context';
        $text = $row['greeting'];
        if ($phase === 'context') {
            $text = $row['message'] ?: (new MessageGenerationService())->generate(
                $lead,
                $row['objective'],
                $row['reply'],
            );
            if ($text === (trim((string)($config['humanToken'] ?? '')) ?: 'HUMANO')) {
                $this->update($row['id'], ['status' => 'manual', 'error' => 'Resposta requer avaliação do operador.']);

                return;
            }
            $saved = ConnectionManager::get('default')->update('wa_outreach', [
                'message' => $text, 'updated_at' => time(),
            ], [
                'id' => $row['id'], 'status' => 'scheduled', 'reply' => $row['reply'], 'message' => $row['message'],
            ])->rowCount();
            if (!$saved || (int)$row['due_at'] > time()) {
                return;
            }
            $row['message'] = $text;
        }
        // Recheck operator cancellation and stage changes after inference.
        $db = ConnectionManager::get('default');
        $fresh = $this->lead($row['lead_id']);
        if (!$fresh || $this->manual($fresh)) {
            $this->update($row['id'], ['status' => 'manual']);

            return;
        }
        $claim = $db->transactional(function () use ($db, $row): int {
            $claim = $db->execute(
            "UPDATE wa_outreach SET status = 'uncertain', updated_at = :now "
                . 'WHERE id = :id AND status = :status AND reply = :reply AND message = :message',
            [
                'now' => time(), 'id' => $row['id'], 'status' => $row['status'],
                'reply' => $row['reply'], 'message' => $row['message'],
            ],
            )->rowCount();
            if ($claim) {
                $db->insert('wa_send_attempts', ['id' => bin2hex(random_bytes(24)), 'attempted_at' => time()]);
            }

            return $claim;
        });
        if (!$claim) {
            return;
        }
        try {
            $result = $this->gateway->request('/send', [
                'id' => $row['id'] . '-' . $phase,
                'phone' => $row['phone'], 'text' => $text,
                'since' => $row['created_at'],
                'context' => $phase === 'context',
                'lastReplyAt' => (int)($row['last_reply_at'] ?? 0),
            ]);
            if (($result['status'] ?? '') === 'sent') {
                $this->complete($row, $phase, $result);
            } elseif (($result['status'] ?? '') === 'manual') {
                $this->update($row['id'], [
                    'status' => 'manual', 'error' => 'Atividade manual ou recusa detectada no WhatsApp.',
                ]);
            } elseif (($result['status'] ?? '') === 'failed') {
                $this->update($row['id'], [
                    'status' => 'manual',
                    'error' => 'O WhatsApp recusou a mensagem (' . (string)($result['error'] ?? 'erro') . ').',
                ]);
            } elseif (($result['status'] ?? '') === 'changed') {
                $db->update('wa_outreach', [
                    'status' => 'scheduled', 'message' => '', 'due_at' => time() + (int)($config['retrySeconds'] ?? 60),
                ], ['id' => $row['id'], 'status' => 'uncertain']);
            }
        } catch (Throwable) {
            $this->update($row['id'], ['error' => 'Resultado incerto. Aguardando reconciliação; não reenviar.']);
        }
    }

    /** Apply a confirmed send without resurrecting cancelled jobs. */
    private function complete(array $row, string $phase, array $result): void
    {
        $db = ConnectionManager::get('default');
        $db->transactional(function () use ($db, $row, $phase, $result): void {
            $at = (int)($result['timestamp'] ?? time());
            $this->interaction(
                $row['lead_id'],
                hash('sha256', $row['id'] . '-' . $phase),
                $phase === 'greeting' ? $row['greeting'] : $row['message'],
                'saida',
                $at,
            );
            $values = ['status' => $phase === 'greeting' ? 'waiting' : 'manual', 'error' => ''];
            if ($phase === 'greeting') {
                $values['sent_at'] = $at;
                $stages = (new LeadService())->catalogo()['etapas'];
                $lead = $this->lead($row['lead_id']);
                foreach ($stages as $stage) {
                    if ((new LeadService())->etapaContatada($stage) && $lead && !$this->manual($lead)) {
                        $db->update('leads', ['etapa_id' => $stage['id']], ['id' => $row['lead_id']]);
                        break;
                    }
                }
            }
            // A simultaneous cancellation must never be undone by a late receipt.
            $db->update('wa_outreach', $values + ['updated_at' => time()], [
                'id' => $row['id'], 'status' => 'uncertain',
            ]);
        });
    }

    /** Store provider-confirmed messages and refresh the dashboard counters. */
    private function interaction(string $leadId, string $key, string $text, string $direction, int $at): void
    {
        $db = ConnectionManager::get('default');
        $id = 'wa_' . substr($key, 0, 32);
        if ($db->execute('SELECT id FROM interactions WHERE id = :id', ['id' => $id])->fetch('assoc')) {
            return;
        }
        $db->insert('interactions', [
            'id' => $id, 'lead_id' => $leadId, 'tipo' => 'mensagem',
            'titulo' => $direction === 'entrada' ? 'WhatsApp recebido' : 'WhatsApp enviado',
            'descricao' => $text, 'data' => date('Y-m-d H:i:s', $at),
            'usuario' => 'WhatsApp', 'canal' => 'WhatsApp', 'direcao' => $direction,
        ]);
        (new LeadWriteService())->atualizarContadores($leadId);
        $db->update('leads', ['ultimo_contato' => date('Y-m-d H:i:s', $at)], ['id' => $leadId]);
    }
}
