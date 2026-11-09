<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Core\Configure;
use Cake\Datasource\ConnectionManager;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

class LeadCaptureTest extends TestCase
{
    use IntegrationTestTrait;

    protected function setUp(): void
    {
        parent::setUp();
        Configure::write('App.fullBaseUrl', 'http://localhost');
        $db = ConnectionManager::get('default');
        $db->delete('users', ['id' => 'us_captura']);
        $db->insert('users', [
            'id' => 'us_captura', 'nome' => 'Consultora Captura',
            'email' => 'captura@example.com', 'senha_hash' => password_hash('senha-teste', PASSWORD_DEFAULT),
            'cargo' => 'Consultora', 'perfil' => 'Consultor comercial', 'role' => 'consultor',
            'status' => 'ativo', 'iniciais' => 'CC', 'auth_version' => 1,
            'criado_em' => date('Y-m-d H:i:s'), 'atualizado_em' => date('Y-m-d H:i:s'),
        ]);
        $db->delete('systems', ['id' => 'sys_captura']);
        $db->insert('systems', [
            'id' => 'sys_captura', 'nome' => 'Sistema Captura', 'ativo' => true,
            'cor' => '#0B6B57', 'criado_em' => date('Y-m-d H:i:s'),
        ]);
        $db->delete('stages', ['id' => 'et_novo']);
        $db->insert('stages', [
            'id' => 'et_novo', 'nome' => 'Novo', 'cor' => '#0B6B57',
            'tipo' => 'aberto', 'ordem' => 0,
        ]);
        $this->session(['Auth' => [
            'id' => 'us_captura', 'nome' => 'Consultora Captura', 'email' => 'captura@example.com',
            'perfil' => 'Consultor comercial', 'role' => 'consultor', 'status' => 'ativo',
            'authVersion' => 1,
        ]]);
        $this->enableCsrfToken();
    }

    public function testCadastroAceitaEmailSemTelefoneEIgnoraCamposAutomaticos(): void
    {
        $db = ConnectionManager::get('default');
        $system = ['id' => 'sys_captura'];

        foreach ([1, 2] as $number) {
            $this->post('/api/leads', [
                'nome' => 'Lead Email ' . $number, 'email' => 'lead' . $number . '@example.com',
                'sistemaIds' => [$system['id']], 'etapaId' => 'et_proposta',
                'prioridade' => 'alta', 'responsavel' => 'Outra pessoa',
            ]);
            $this->assertResponseCode(201);
        }

        $rows = $db->execute("SELECT telefone, etapa_id, prioridade, responsavel FROM leads WHERE nome LIKE 'Lead Email %' ORDER BY nome")->fetchAll('assoc');
        $this->assertCount(2, $rows);
        foreach ($rows as $row) {
            $this->assertNull($row['telefone']);
            $this->assertSame('et_novo', $row['etapa_id']);
            $this->assertSame('media', $row['prioridade']);
            $this->assertSame('Consultora Captura', $row['responsavel']);
        }
    }

    public function testOrigemCriadaNoFormularioFicaNoCatalogo(): void
    {
        $this->post('/api/leads/origens', ['nome' => 'Evento de captura']);
        $this->assertResponseCode(201);
        $this->get('/api/leads/catalogos');
        $this->assertResponseOk();
        $this->assertResponseContains('Evento de captura');
    }

    public function testContatoESistemaSaoObrigatorios(): void
    {
        $this->post('/api/leads', ['nome' => 'Sem contato', 'sistemaIds' => ['sys_captura']]);
        $this->assertResponseCode(422);
        $this->assertResponseContains('WhatsApp ou o e-mail');

        $this->post('/api/leads', ['nome' => 'Sem sistema', 'email' => 'sem-sistema@example.com']);
        $this->assertResponseCode(422);
        $this->assertResponseContains('sistema de interesse');
    }

    public function testCadastroRapidoAceitaApenasNomeEUmContato(): void
    {
        $this->post('/api/leads/cadastro', ['nome' => 'Lead rápido por email', 'email' => 'rapido@example.com']);
        $this->assertResponseCode(201);

        $this->post('/api/leads/cadastro', ['nome' => 'Lead rápido por telefone', 'telefone' => '11987654321']);
        $this->assertResponseCode(201);

        $rows = ConnectionManager::get('default')->execute(
            "SELECT telefone, email, sistema_ids FROM leads WHERE nome LIKE 'Lead rápido %' ORDER BY nome"
        )->fetchAll('assoc');
        $this->assertCount(2, $rows);
        foreach ($rows as $row) {
            $this->assertSame([], json_decode((string)$row['sistema_ids'], true));
        }
    }

    public function testCadastroRapidoExigeContato(): void
    {
        $this->post('/api/leads/cadastro', ['nome' => 'Lead sem contato']);
        $this->assertResponseCode(422);
    }

    public function testReenvioDaCapturaConfirmaMesmoLeadSemDuplicar(): void
    {
        $hex = bin2hex(random_bytes(16));
        $id = substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3) . '-8' . substr($hex, 17, 3) . '-' . substr($hex, 20);
        $dados = ['captureRequestId' => $id, 'nome' => 'Lead do evento', 'email' => $hex . '@example.com'];
        $this->assertTrue($this->getTableLocator()->get('Leads')->getSchema()->hasColumn('capture_request_id'));
        $this->post('/api/leads/cadastro', $dados);
        $this->assertResponseCode(201);
        $first = ConnectionManager::get('default')->execute(
            'SELECT capture_request_id FROM leads WHERE email = :email', ['email' => $dados['email']]
        )->fetch('assoc');
        $this->assertSame($id, $first['capture_request_id'] ?? null);
        $this->post('/api/leads/cadastro', $dados);
        $this->assertResponseCode(200);
        $count = ConnectionManager::get('default')->execute(
            'SELECT COUNT(*) AS total FROM leads WHERE capture_request_id = :id', ['id' => $id]
        )->fetch('assoc');
        $this->assertSame(1, (int)$count['total']);
    }

    public function testCapturaRecusaIdentificadorInvalido(): void
    {
        $this->post('/api/leads/cadastro', [
            'captureRequestId' => 'invalido', 'nome' => 'Lead invalido', 'email' => 'invalido@example.com',
        ]);
        $this->assertResponseCode(422);
    }
}
