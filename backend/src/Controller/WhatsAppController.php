<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\OutreachPolicy;
use App\Service\OutreachService;
use App\Service\SettingsService;
use App\Service\WhatsAppGateway;
use Cake\Datasource\ConnectionManager;
use Cake\Http\Response;
use Throwable;

class WhatsAppController extends AppController
{
    /** Report transport health; expose pairing codes only to administrators. */
    public function status(): Response
    {
        $admin = $this->access()->canManageTeam($this->identidade());
        try {
            $state = (new WhatsAppGateway())->request('/status');
            if (!$admin) {
                unset($state['qr']);
            }
        } catch (Throwable $error) {
            $state = ['status' => 'unavailable', 'message' => $error->getMessage()];
        }
        $runtime = ConnectionManager::get('default')->execute(
            "SELECT heartbeat FROM wa_runtime WHERE id = 'worker'",
        )->fetch('assoc');
        $state['workerOnline'] = time() - (int)($runtime['heartbeat'] ?? 0) < 90;
        $state['admin'] = $admin;

        return $this->respond($state);
    }

    /** Configuração não sensível usada pela tela de mensagens. */
    public function options(): Response
    {
        $settings = new SettingsService();
        $whatsapp = $settings->whatsapp();
        $contatadaId = $settings->papelId('contatado');
        $propostaId = $settings->papelId('proposta');
        $etapas = $this->fetchTable('Stages')->find()
            ->select(['id', 'nome', 'ordem', 'tipo'])
            ->orderBy(['ordem' => 'ASC'])
            ->all()
            ->toList();
        $nomes = [];
        foreach ($etapas as $etapa) {
            $nomes[(string)$etapa->get('id')] = (string)$etapa->get('nome');
        }

        return $this->respond([
            'greetingTemplate' => $whatsapp['greetingTemplate'],
            'greetingTemplateSemNome' => $whatsapp['greetingTemplateSemNome'],
            'objectiveDefault' => $whatsapp['objectiveDefault'],
            'delayMinSeconds' => (int)$whatsapp['delayMinSeconds'],
            'delayMaxSeconds' => (int)$whatsapp['delayMaxSeconds'],
            'maxLeadsPerBatch' => (int)$whatsapp['maxLeadsPerBatch'],
            'maxObjectiveLength' => (int)$whatsapp['maxObjectiveLength'],
            'maxMessageLength' => (int)$whatsapp['maxMessageLength'],
            'etapaContatadaId' => $contatadaId,
            'etapaPropostaId' => $propostaId,
            'etapaContatada' => $nomes[$contatadaId] ?? '',
            'etapaProposta' => $nomes[$propostaId] ?? '',
        ]);
    }

    /** Link or unlink the shared business account. */
    public function connect(): Response
    {
        $this->exigirAdmin();
        $this->request->allowMethod(['post']);
        $action = $this->request->getData('action') === 'disconnect' ? '/disconnect' : '/connect';
        $result = (new WhatsAppGateway())->request($action, []);
        $this->registroAuditoria('whatsapp' . str_replace('/', '.', $action), 'connection');

        return $this->respond($result);
    }

    /** Paginated operational queues, scoped to the current lead owner. */
    public function index(): Response
    {
        $params = [];
        $where = 'l.deleted_at IS NULL';
        if (!$this->access()->canSeeAllLeads($this->identidade())) {
            $where .= ' AND l.responsavel = :owner';
            $params['owner'] = $this->usuarioNome();
        }
        $status = (string)$this->request->getQuery('status', '');
        if ($status !== '') {
            if ($status === 'manual') {
                $params['proposta'] = (new SettingsService())->papelId('proposta');
                $where .= " AND (o.status = 'manual' OR (o.id IS NULL AND (l.mensagens_recebidas > 0 OR s.ordem >= "
                    . 'COALESCE((SELECT ordem FROM stages WHERE id = :proposta), 2147483647))))'
                    . " AND l.nao_contatar = FALSE AND s.tipo = 'aberto'";
            } else {
                $where .= ' AND o.status = :status';
                $params['status'] = $status;
            }
        }
        $page = max(1, (int)$this->request->getQuery('page', 1));
        $db = ConnectionManager::get('default');
        $base = $status === 'manual'
            ? ' FROM leads l LEFT JOIN wa_outreach o ON l.id = o.lead_id '
                . 'JOIN stages s ON s.id = l.etapa_id WHERE ' . $where
            : ' FROM wa_outreach o JOIN leads l ON l.id = o.lead_id WHERE ' . $where;
        $total = (int)$db->execute('SELECT COUNT(*) AS total' . $base, $params)->fetch('assoc')['total'];
        $rows = [];
        if ($status === 'manual') {
            $rows = $db->execute('SELECT o.*, l.id AS contact_id, l.telefone AS contact_phone, '
                . 'l.nome, l.empresa, l.responsavel' . $base
                . ' ORDER BY l.ultima_mensagem_em DESC, l.id LIMIT 50 OFFSET ' . (($page - 1) * 50), $params)
                ->fetchAll('assoc');
            foreach ($rows as &$row) {
                $row['status'] = 'manual';
                $row['phone'] = OutreachPolicy::phone($row['contact_phone']);
                $row['lead_id'] = $row['contact_id'];
            }
            unset($row);
        } else {
            $rows = $db->execute('SELECT o.*, l.nome, l.empresa, l.responsavel' . $base
                . ' ORDER BY o.updated_at DESC LIMIT 50 OFFSET ' . (($page - 1) * 50), $params)->fetchAll('assoc');
        }

        return $this->respond(['rows' => $rows, 'total' => $total, 'page' => $page]);
    }

    /** Register new approaches with explicit consent provenance and deduplication. */
    public function add(): Response
    {
        $this->request->allowMethod(['post']);
        $data = (array)$this->request->getData();
        $config = (new SettingsService())->whatsapp();
        $maxLeads = (int)($config['maxLeadsPerBatch'] ?? 200);
        $maxObjetivo = (int)($config['maxObjectiveLength'] ?? 1500);
        $ids = $this->lista($data['leadIds'] ?? []);
        $objective = trim((string)($data['objective'] ?? ''));
        $source = trim((string)($data['consentSource'] ?? ''));
        if (
            !$ids || count($ids) > $maxLeads || $objective === '' || mb_strlen($objective) > $maxObjetivo
            || $source === '' || mb_strlen($source) > 1000
        ) {
            $this->erro('Selecione até ' . $maxLeads . ' leads e informe a mensagem contextual '
                . '(até ' . $maxObjetivo . ' caracteres) e a origem da autorização.');
        }
        $service = new OutreachService();
        $db = ConnectionManager::get('default');
        $accepted = 0;
        $excluded = [];
        foreach ($ids as $id) {
            $lead = $this->queryService()->findLead($id, $this->identidade());
            if (!$lead) {
                $excluded[] = ['id' => $id, 'reason' => 'Lead indisponível'];
                continue;
            }
            $phone = OutreachPolicy::phone($lead['telefone']);
            if (
                $service->manual($lead) || $lead['mensagensRecebidas'] > 0 || $lead['mensagensEnviadas'] > 0
                || $this->service()->etapaContatada($lead['etapa']) || !preg_match('/^[1-9]\d{9,14}$/', $phone)
            ) {
                $excluded[] = [
                    'id' => $id, 'reason' => 'Já contatado, atendimento manual, bloqueado ou telefone inválido',
                ];
                continue;
            }
            $row = [
                'id' => 'wa_' . bin2hex(random_bytes(12)), 'lead_id' => $id, 'phone' => $phone,
                'owner' => $this->usuarioNome(), 'status' => 'queued', 'objective' => $objective,
                'consent_source' => $source, 'greeting' => OutreachPolicy::greeting($lead['nome']),
                'reply' => '', 'message' => '', 'error' => '', 'created_at' => time(), 'updated_at' => time(),
            ];
            // Both PostgreSQL and SQLite support ON CONFLICT; simultaneous submissions deduplicate too.
            $columns = array_keys($row);
            $insert = $db->execute('INSERT INTO wa_outreach (' . implode(',', $columns) . ') VALUES (:'
                . implode(',:', $columns) . ') ON CONFLICT DO NOTHING', $row);
            if ($insert->rowCount()) {
                $accepted++;
            } else {
                $excluded[] = ['id' => $id, 'reason' => 'Contato já possui abordagem registrada'];
            }
        }
        $this->registroAuditoria('whatsapp.abordagem', 'outreach', null, [
            'accepted' => $accepted, 'selected' => count($ids),
        ]);

        return $this->respond(['accepted' => $accepted, 'excluded' => $excluded], 201);
    }

    /** Transfer or stop an approach without re-enabling automated contact. */
    public function action(string $id): Response
    {
        $this->request->allowMethod(['post']);
        $db = ConnectionManager::get('default');
        $row = $db->execute('SELECT * FROM wa_outreach WHERE id = :id', ['id' => $id])->fetch('assoc');
        if (!$row || !$this->queryService()->findLead($row['lead_id'], $this->identidade())) {
            $this->erro('Abordagem não encontrada.', null, 404);
        }
        $action = (string)$this->request->getData('action');
        if ($action === 'edit') {
            $text = trim((string)$this->request->getData('message'));
            $max = (int)((new SettingsService())->whatsapp()['maxMessageLength'] ?? 2000);
            if ($text === '' || mb_strlen($text) > $max) {
                $this->erro('A mensagem deve ter entre 1 e ' . $max . ' caracteres.');
            }
            $saved = $db->update('wa_outreach', ['message' => $text, 'updated_at' => time()], [
                'id' => $id, 'status' => 'scheduled',
            ])->rowCount();
            if (!$saved) {
                $this->erro('O envio já saiu da espera. Atualize a fila.', null, 409);
            }
            $this->registroAuditoria('whatsapp.editar', 'lead', $row['lead_id']);

            return $this->respond(['status' => 'scheduled']);
        }
        if (!in_array($action, ['manual', 'cancelled', 'blocked'], true)) {
            $this->erro('Ação inválida.');
        }
        (new OutreachService())->update($id, ['status' => $action]);
        try {
            (new WhatsAppGateway())->request('/cancel', ['phone' => $row['phone']]);
        } catch (Throwable) {
            // Database cancellation remains authoritative when the connector is offline.
        }
        if ($action === 'blocked') {
            $db->update('leads', ['nao_contatar' => true], ['id' => $row['lead_id']], ['nao_contatar' => 'boolean']);
        }
        $this->registroAuditoria('whatsapp.' . $action, 'lead', $row['lead_id']);

        return $this->respond(['status' => $action]);
    }
}
