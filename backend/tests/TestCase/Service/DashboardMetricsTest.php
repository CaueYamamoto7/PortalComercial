<?php
declare(strict_types=1);

namespace App\Test\TestCase\Service;

use App\Service\DashboardMetricsService;
use Cake\Database\Connection;
use Cake\Datasource\ConnectionManager;
use Cake\I18n\DateTime;
use Cake\TestSuite\TestCase;

class DashboardMetricsTest extends TestCase
{
    private Connection $connection;
    private array $identity = ['role' => 'consultor', 'nome' => 'Dashboard Teste'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->connection = ConnectionManager::get('default');
        $this->connection->begin();
        foreach (['novo' => 'aberto', 'contatado' => 'aberto', 'ganho' => 'ganho', 'perdido' => 'perdido'] as $id => $tipo) {
            $this->connection->insert('stages', ['id' => 'dash_' . $id, 'nome' => ucfirst($id), 'tipo' => $tipo]);
        }
    }

    protected function tearDown(): void
    {
        $this->connection->rollback();
        parent::tearDown();
    }

    private function lead(string $id, array $values = []): void
    {
        $this->connection->insert('leads', $values + [
            'id' => $id, 'nome' => $id, 'telefone' => $id,
            'responsavel' => 'Dashboard Teste', 'etapa_id' => 'dash_novo',
            'criado_em' => (new DateTime('today'))->format('Y-m-d H:i:s'),
            'mensagens_enviadas' => 0, 'mensagens_recebidas' => 0, 'nao_contatar' => false,
        ], ['nao_contatar' => 'boolean']);
    }

    public function testDistribuicaoExclusivaRespeitaPrecedenciaPermissoesEPeriodo(): void
    {
        $this->lead('dash_sem');
        $this->lead('dash_aguarda', ['etapa_id' => 'dash_contatado']);
        $this->lead('dash_responder', ['mensagens_recebidas' => 1, 'ultima_mensagem_direcao' => 'entrada']);
        $this->lead('dash_conversa', ['mensagens_recebidas' => 2, 'ultima_mensagem_direcao' => 'saida']);
        $this->lead('dash_cliente', ['etapa_id' => 'dash_ganho']);
        $this->lead('dash_recusa', ['etapa_id' => 'dash_ganho', 'nao_contatar' => true]);
        $this->lead('dash_perdido', ['etapa_id' => 'dash_perdido']);
        $this->lead('dash_outro', ['responsavel' => 'Outro']);
        $this->lead('dash_excluido', ['deleted_at' => (new DateTime())->format('Y-m-d H:i:s')]);
        $this->lead('dash_antigo', ['criado_em' => (new DateTime('today'))->subDays(12)->format('Y-m-d H:i:s')]);

        $service = new DashboardMetricsService();
        $metrics = $service->obter(7, $this->identity);
        $this->assertSame([
            'sem_mensagem' => 1, 'aguardando' => 1, 'responder' => 1,
            'em_conversa' => 1, 'cliente' => 1, 'recusado' => 2,
        ], $metrics['distribuicao']);
        $this->assertSame(7, array_sum($metrics['distribuicao']));
        $this->assertSame(8, array_sum($service->obter(30, $this->identity)['distribuicao']));
    }

    public function testSerieContaEventosReaisInclusiveDeContatosAntigos(): void
    {
        $this->lead('dash_antigo', ['criado_em' => (new DateTime('today'))->subDays(40)->format('Y-m-d H:i:s')]);
        $this->lead('dash_novo');
        $this->lead('dash_privado', ['responsavel' => 'Outro']);
        $this->lead('dash_excluido', ['deleted_at' => (new DateTime())->format('Y-m-d H:i:s')]);
        foreach (
            [
                ['dash_antigo', 'mensagem', 'entrada', 0],
                ['dash_antigo', 'mensagem', 'saida', 0],
                ['dash_novo', 'mensagem', null, 0],
                ['dash_novo', 'nota', null, 0],
                ['dash_privado', 'mensagem', 'entrada', 0],
                ['dash_excluido', 'mensagem', 'entrada', 0],
                ['dash_antigo', 'mensagem', 'entrada', 10],
            ] as $index => [$lead, $tipo, $direcao, $dias]
        ) {
            $this->connection->insert('interactions', [
                'id' => 'dash_msg_' . $index, 'lead_id' => $lead, 'tipo' => $tipo, 'direcao' => $direcao,
                'data' => (new DateTime('today'))->subDays($dias)->format('Y-m-d H:i:s'),
            ]);
        }
        $metrics = (new DashboardMetricsService())->obter(7, $this->identity);
        $this->assertCount(7, $metrics['serie']);
        $this->assertSame([
            'data' => (new DateTime('today'))->format('Y-m-d'), 'novos' => 1, 'enviadas' => 2, 'recebidas' => 1,
        ], $metrics['serie'][6]);
        $this->assertSame(0, $metrics['serie'][0]['enviadas']);
    }
}
