<?php
declare(strict_types=1);

namespace App\Test\TestCase\Service;

use App\Service\OutreachPolicy;
use App\Service\OutreachService;
use App\Service\WhatsAppGateway;
use Cake\Datasource\ConnectionManager;
use Cake\TestSuite\TestCase;
use RuntimeException;

class OutreachServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $db = ConnectionManager::get('default');
        $db->begin();
        $db->execute("DELETE FROM wa_send_attempts");
        $db->execute("DELETE FROM settings WHERE id = 'mensagens'");
        $db->insert('settings', ['id' => 'mensagens', 'valor' => json_encode([
            'inicio' => '00:00', 'fim' => '23:59', 'fusoHorario' => 'America/Sao_Paulo',
            'intervalo' => 1, 'limiteDiario' => 300,
        ])]);
        foreach (['novo' => 0, 'contatado' => 1, 'proposta' => 3] as $name => $order) {
            $db->execute('INSERT INTO stages (id, nome, tipo, ordem) VALUES (:id, :name, :type, :position) '
                . 'ON CONFLICT DO NOTHING', [
                    'id' => 'et_' . $name, 'name' => ucfirst($name), 'type' => 'aberto', 'position' => $order,
                ]);
        }
        $db->insert('leads', [
            'id' => 'ld_wa_test', 'nome' => 'Maria Silva', 'telefone' => '5511999998765',
            'etapa_id' => 'et_novo', 'responsavel' => 'Operador',
        ]);
        $db->insert('wa_outreach', [
            'id' => 'wa_123456789012345678901234', 'lead_id' => 'ld_wa_test', 'phone' => '5511999998765',
            'owner' => 'Operador', 'status' => 'queued', 'objective' => 'Podemos conversar sobre o produto?',
            'consent_source' => 'Formulário de demonstração', 'greeting' => 'Olá Maria, tudo bem?',
            'reply' => '', 'message' => '', 'error' => '', 'created_at' => time() - 10, 'updated_at' => time(),
        ]);
        $db->update('wa_runtime', ['lease_until' => 0], ['id' => 'worker']);
    }

    protected function tearDown(): void
    {
        ConnectionManager::get('default')->rollback();
        parent::tearDown();
    }

    private function row(): array
    {
        return ConnectionManager::get('default')->execute("SELECT * FROM wa_outreach WHERE lead_id = 'ld_wa_test'")->fetch('assoc');
    }

    private function event(string $id, string $text, bool $fromMe = false): array
    {
        return ['id' => $id, 'phone' => '5511999998765', 'timestamp' => time(), 'text' => $text, 'fromMe' => $fromMe];
    }

    public function testGreetingReplyAndContextOnlySendOnce(): void
    {
        $gateway = $this->createStub(WhatsAppGateway::class);
        $sends = [];
        $gateway->method('request')->willReturnCallback(function (string $path, ?array $body = null) use (&$sends): array {
            if ($path === '/send') {
                $sends[] = $body;

                return ['status' => 'sent', 'timestamp' => time()];
            }

            return $path === '/events' ? ['events' => []] : ['status' => 'connected'];
        });
        $service = new OutreachService($gateway);
        $service->tick();
        $this->assertSame('waiting', $this->row()['status']);
        $this->assertSame('et_contatado', $service->lead('ld_wa_test')['etapaId']);
        $event = $this->event('reply-1', 'Tudo bem, pode falar');
        $service->event($event);
        $scheduled = $this->row();
        $this->assertSame('scheduled', $scheduled['status']);
        $this->assertGreaterThanOrEqual(time() + 59, (int)$scheduled['due_at']);
        $this->assertLessThanOrEqual(time() + 360, (int)$scheduled['due_at']);
        $service->event($event);
        $this->assertSame($scheduled['due_at'], $this->row()['due_at']);
        $this->assertSame(1, $service->lead('ld_wa_test')['mensagensRecebidas']);
        $service->update($scheduled['id'], ['due_at' => time() - 1]);
        ConnectionManager::get('default')->execute('UPDATE wa_send_attempts SET attempted_at = :at', ['at' => time() - 2]);
        $service->tick();
        $this->assertSame('manual', $this->row()['status']);
        $service->tick();
        $this->assertCount(2, $sends);
        $this->assertSame(2, $service->lead('ld_wa_test')['mensagensEnviadas']);
    }

    public function testRefusalBlocksAndManualReplyCancelsTimer(): void
    {
        $service = new OutreachService();
        $service->update($this->row()['id'], ['status' => 'waiting', 'sent_at' => time() - 5]);
        $service->event($this->event('reply-2', 'Tudo bem'));
        $service->event($this->event('operator', 'Aqui é a equipe', true));
        $this->assertSame('manual', $this->row()['status']);
        $service->event($this->event('refusal', 'Não quero receber mensagens'));
        $this->assertSame('blocked', $this->row()['status']);
        $this->assertTrue($service->lead('ld_wa_test')['naoContatar']);
    }

    public function testUnknownSendIsNotRetried(): void
    {
        $gateway = $this->createStub(WhatsAppGateway::class);
        $sends = 0;
        $gateway->method('request')->willReturnCallback(function (string $path) use (&$sends): array {
            if ($path === '/send') {
                $sends++;
                throw new RuntimeException('timeout');
            }
            if (str_starts_with($path, '/result/')) {
                return ['status' => 'uncertain'];
            }

            return $path === '/events' ? ['events' => []] : ['status' => 'connected'];
        });
        $service = new OutreachService($gateway);
        $service->tick();
        $service->tick();
        $this->assertSame('uncertain', $this->row()['status']);
        $this->assertSame(1, $sends);
        $this->assertSame(0, $service->lead('ld_wa_test')['mensagensEnviadas']);
    }

    public function testProposalAndExpiredJobsBecomeManual(): void
    {
        $gateway = $this->createStub(WhatsAppGateway::class);
        $gateway->method('request')->willReturnCallback(fn(string $path): array => $path === '/events' ? ['events' => []] : ['status' => 'connected']);
        $service = new OutreachService($gateway);
        ConnectionManager::get('default')->update('leads', ['etapa_id' => 'et_proposta'], ['id' => 'ld_wa_test']);
        $service->tick();
        $this->assertSame('manual', $this->row()['status']);
        $service->update($this->row()['id'], ['status' => 'scheduled', 'due_at' => time() - 1000]);
        ConnectionManager::get('default')->update('leads', ['etapa_id' => 'et_contatado'], ['id' => 'ld_wa_test']);
        $service->tick();
        $this->assertSame('manual', $this->row()['status']);
        $this->assertStringContainsString('vencido', $this->row()['error']);
    }

    public function testSubmittedMessageWaitsForReceipt(): void
    {
        $gateway = $this->createStub(WhatsAppGateway::class);
        $gateway->method('request')->willReturnCallback(function (string $path): array {
            if ($path === '/send') {
                return ['status' => 'uncertain', 'delivery' => 'submitted', 'error' => ''];
            }

            return $path === '/events' ? ['events' => []] : ['status' => 'connected'];
        });
        $service = new OutreachService($gateway);
        $service->tick();
        $this->assertSame('uncertain', $this->row()['status']);
        $this->assertSame(0, $service->lead('ld_wa_test')['mensagensEnviadas']);
        $service->receipt([
            'kind' => 'receipt', 'job' => $this->row()['id'] . '-greeting',
            'status' => 'sent', 'delivery' => 'server_ack', 'timestamp' => time(),
        ]);
        $this->assertSame('waiting', $this->row()['status']);
        $this->assertSame(1, $service->lead('ld_wa_test')['mensagensEnviadas']);
        $this->assertSame('et_contatado', $service->lead('ld_wa_test')['etapaId']);
    }

    public function testUnconfirmedLegacyMessageGoesToManualWithoutResend(): void
    {
        $gateway = $this->createStub(WhatsAppGateway::class);
        $gateway->method('request')->willReturnCallback(
            fn(string $path): array => str_starts_with($path, '/result/')
                ? ['status' => 'uncertain', 'delivery' => 'unconfirmed', 'error' => 'legacy_unconfirmed']
                : ['status' => 'connected'],
        );
        $service = new OutreachService($gateway);
        $service->update($this->row()['id'], ['status' => 'uncertain']);
        $service->tick();
        $this->assertSame('manual', $this->row()['status']);
        $this->assertStringContainsString('não confirmado', $this->row()['error']);
    }

    public function testFailedReceiptExplainsRefusal(): void
    {
        $service = new OutreachService();
        $service->update($this->row()['id'], ['status' => 'uncertain']);
        $service->receipt([
            'kind' => 'receipt', 'job' => $this->row()['id'] . '-greeting',
            'status' => 'failed', 'error' => 'number_not_registered',
        ]);
        $this->assertSame('manual', $this->row()['status']);
        $this->assertStringContainsString('number_not_registered', $this->row()['error']);
    }

    public function testGreetingAndRefusalRules(): void
    {
        $this->assertSame('Olá Maria, tudo bem?', OutreachPolicy::greeting(' Maria Silva '));
        $this->assertSame('Olá, tudo bem?', OutreachPolicy::greeting(''));
        $this->assertTrue(OutreachPolicy::refusal('Não tenho interesse'));
        $this->assertFalse(OutreachPolicy::refusal('Tudo bem, obrigado'));
    }

    public function testSendLimitsCountUnconfirmedAttempts(): void
    {
        $db = ConnectionManager::get('default');
        $gateway = $this->createStub(WhatsAppGateway::class);
        $sends = 0;
        $gateway->method('request')->willReturnCallback(function (string $path) use (&$sends): array {
            if ($path === '/send') {
                $sends++;
                return ['status' => 'uncertain'];
            }
            return $path === '/events' ? ['events' => []] : ['status' => 'connected'];
        });
        $db->execute('UPDATE settings SET valor = :valor WHERE id = :id', [
            'id' => 'mensagens', 'valor' => json_encode([
                'inicio' => '00:00', 'fim' => '23:59', 'fusoHorario' => 'America/Sao_Paulo',
                'intervalo' => 10, 'limiteDiario' => 1,
            ]),
        ]);
        $service = new OutreachService($gateway);
        $service->tick();
        $this->assertSame(1, $sends);
        $this->assertSame('uncertain', $this->row()['status']);
        $this->assertSame(1, (int)$db->execute('SELECT COUNT(*) AS n FROM wa_send_attempts')->fetch('assoc')['n']);
        // A different queued lead cannot bypass the daily limit after an uncertain send.
        $service->update($this->row()['id'], ['status' => 'queued']);
        $service->tick();
        $this->assertSame(1, $sends);
    }

    public function testSendWindowAndIntervalFailClosed(): void
    {
        $db = ConnectionManager::get('default');
        $gateway = $this->createStub(WhatsAppGateway::class);
        $sends = 0;
        $gateway->method('request')->willReturnCallback(function (string $path) use (&$sends): array {
            if ($path === '/send') {
                $sends++;
                return ['status' => 'uncertain'];
            }
            return $path === '/events' ? ['events' => []] : ['status' => 'connected'];
        });
        $service = new OutreachService($gateway);
        $db->execute('UPDATE settings SET valor = :valor WHERE id = :id', [
            'id' => 'mensagens', 'valor' => json_encode([
                'inicio' => '12:00', 'fim' => '12:00', 'fusoHorario' => 'America/Sao_Paulo',
            ]),
        ]);
        $service->tick();
        $this->assertSame(0, $sends);
        $db->execute('UPDATE settings SET valor = :valor WHERE id = :id', [
            'id' => 'mensagens', 'valor' => json_encode([
                'inicio' => '00:00', 'fim' => '23:59', 'fusoHorario' => 'America/Sao_Paulo',
                'intervalo' => 120, 'limiteDiario' => 300,
            ]),
        ]);
        $db->insert('wa_send_attempts', ['id' => 'recent', 'attempted_at' => time()]);
        $service->tick();
        $this->assertSame(0, $sends);
        $this->assertSame('queued', $this->row()['status']);
    }
}
