<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Core\Configure;
use Cake\Database\Connection;
use Cake\Datasource\ConnectionManager;
use Cake\I18n\DateTime;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

class DashboardTest extends TestCase
{
    use IntegrationTestTrait;

    private Connection $connection;

    protected function setUp(): void
    {
        parent::setUp();
        Configure::write('debug', true);
        Configure::write('App.fullBaseUrl', 'http://localhost');
        $this->connection = ConnectionManager::get('default');
        $this->connection->begin();
        $this->connection->insert('users', [
            'id' => 'us_dashboard_test', 'nome' => 'Painel Teste', 'email' => 'dashboard.test@example.com',
            'senha_hash' => password_hash('teste-dashboard', PASSWORD_DEFAULT),
            'role' => 'consultor', 'status' => 'ativo', 'auth_version' => 1,
        ]);
        $this->session(['Auth' => [
            'id' => 'us_dashboard_test', 'nome' => 'Painel Teste', 'email' => 'dashboard.test@example.com',
            'role' => 'consultor', 'status' => 'ativo', 'authVersion' => 1,
        ]]);
        $this->connection->insert('stages', ['id' => 'et_dashboard_test', 'nome' => 'Novo', 'tipo' => 'aberto']);
        foreach (['atual' => 0, 'antigo' => 20, 'privado' => 0] as $id => $dias) {
            $this->connection->insert('leads', [
                'id' => 'ld_dashboard_' . $id, 'nome' => 'Contato ' . $id, 'telefone' => 'dashboard_' . $id,
                'etapa_id' => 'et_dashboard_test', 'responsavel' => $id === 'privado' ? 'Outro' : 'Painel Teste',
                'criado_em' => (new DateTime('today'))->subDays($dias)->format('Y-m-d H:i:s'),
                'mensagens_recebidas' => $id === 'antigo' ? 1 : 0,
                'ultima_mensagem_direcao' => $id === 'antigo' ? 'entrada' : null,
            ]);
        }
        foreach (['hoje' => 'today', 'proxima' => 'tomorrow'] as $id => $data) {
            $this->connection->insert('tasks', [
                'id' => 'tk_dashboard_' . $id, 'lead_id' => 'ld_dashboard_antigo', 'titulo' => 'Follow-up ' . $id,
                'responsavel' => 'Painel Teste', 'data' => (new DateTime($data))->format('Y-m-d H:i:s'),
            ]);
        }
        foreach (['atual' => 0, 'antiga' => 20, 'privada' => 0] as $id => $dias) {
            $this->connection->insert('campaigns', [
                'id' => 'cp_dashboard_' . $id, 'nome' => 'Campanha ' . $id, 'mensagem' => 'Teste',
                'status' => 'registrada', 'responsavel' => $id === 'privada' ? 'Outro' : 'Painel Teste',
                'criada_em' => (new DateTime('today'))->subDays($dias)->format('Y-m-d H:i:s'),
            ]);
        }
    }

    protected function tearDown(): void
    {
        $this->connection->rollback();
        parent::tearDown();
    }

    public function testPeriodoFiltraIndicadoresSemEsconderAgendaEPendencias(): void
    {
        $this->get('/api/dashboard?periodo=7');
        $this->assertResponseOk();
        $dados = json_decode((string)$this->_response->getBody(), true)['data'];
        $this->assertSame('7', $dados['periodo']);
        $this->assertSame(1, $dados['stats']['total']);
        $this->assertSame(0, $dados['conversas']['precisoResponder']);
        $this->assertSame(1, $dados['pendencias']);
        $this->assertCount(7, $dados['metricas']['serie']);
        $this->assertSame(1, array_sum($dados['metricas']['distribuicao']));
        $this->assertSame('tk_dashboard_hoje', $dados['acoesHoje'][0]['id']);
        $this->assertSame('Contato antigo', $dados['acoesHoje'][0]['lead']['nome']);
        $this->assertSame('tk_dashboard_proxima', $dados['proximasAcoes'][0]['id']);
        $this->assertSame(1, $dados['acoesHojeTotal']);
        $this->assertCount(1, $dados['campanhas']);
        $this->assertSame('cp_dashboard_atual', $dados['campanhas'][0]['id']);
    }

    public function testPeriodoInvalidoUsaPadraoLimitado(): void
    {
        $this->get('/api/dashboard?periodo=99999');
        $this->assertResponseOk();
        $dados = json_decode((string)$this->_response->getBody(), true)['data'];
        $this->assertSame('30', $dados['periodo']);
        $this->assertSame(2, $dados['stats']['total']);
        $this->assertCount(30, $dados['metricas']['serie']);
    }
}
