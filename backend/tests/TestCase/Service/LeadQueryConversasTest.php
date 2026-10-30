<?php
declare(strict_types=1);

namespace App\Test\TestCase\Service;

use App\Service\LeadQueryService;
use Cake\Database\Connection;
use Cake\Datasource\ConnectionManager;
use Cake\TestSuite\TestCase;

class LeadQueryConversasTest extends TestCase
{
    private Connection $connection;
    private LeadQueryService $service;
    private array $ids = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->connection = ConnectionManager::get('default');
        $this->connection->begin();
        $this->service = new LeadQueryService();

        $etapas = [
            ['id' => 'et_test_proposta', 'nome' => 'Proposta', 'tipo' => 'aberto'],
            ['id' => 'et_test_novo', 'nome' => 'Novo', 'tipo' => 'aberto'],
            ['id' => 'et_test_ganho', 'nome' => 'Proposta', 'tipo' => 'ganho'],
        ];
        foreach ($etapas as $etapa) {
            $this->connection->insert('stages', $etapa);
        }

        $cenarios = [
            ['etapa_id' => 'et_test_proposta'],
            ['etapa_id' => 'et_test_proposta', 'mensagens_recebidas' => 1],
            ['etapa_id' => 'et_test_novo', 'mensagens_recebidas' => 1],
            ['etapa_id' => 'et_test_novo'],
            ['etapa_id' => 'et_test_proposta', 'nao_contatar' => true],
            ['etapa_id' => 'et_test_proposta', 'deleted_at' => '2026-10-28 10:00:00'],
            ['etapa_id' => 'et_test_ganho'],
            ['etapa_id' => 'et_test_proposta', 'responsavel' => 'Outro consultor'],
        ];
        foreach ($cenarios as $index => $cenario) {
            $id = 'ld_test_conversa_' . $index;
            $this->ids[] = $id;
            $this->connection->insert('leads', array_merge([
                'id' => $id,
                'nome' => 'Lead de teste ' . $index,
                'telefone' => '551199990000' . $index,
                'responsavel' => 'Consultor Teste',
                'mensagens_enviadas' => 0,
                'mensagens_recebidas' => 0,
                'nao_contatar' => false,
            ], $cenario), [
                'mensagens_enviadas' => 'integer',
                'mensagens_recebidas' => 'integer',
                'nao_contatar' => 'boolean',
            ]);
        }
    }

    protected function tearDown(): void
    {
        $this->connection->rollback();
        parent::tearDown();
    }

    public function testContadorEListaIncluemPropostaSemDuplicarRespostas(): void
    {
        $filtros = ['ids' => implode(',', $this->ids)];
        $identidade = ['role' => 'admin'];
        $contagens = $this->service->contagensConversas($filtros, $identidade);
        $lista = $this->service->baseQuery($filtros + ['tipo' => 'abertas'], $identidade)
            ->all()->extract('id')->toList();

        $this->assertSame(4, $contagens['conversasAbertas']);
        $this->assertEqualsCanonicalizing([
            'ld_test_conversa_0',
            'ld_test_conversa_1',
            'ld_test_conversa_2',
            'ld_test_conversa_7',
        ], $lista);
        $this->assertCount($contagens['conversasAbertas'], $lista);
    }

    public function testFiltroPorResponsavelPermaneceValido(): void
    {
        $filtros = ['ids' => implode(',', $this->ids), 'responsavel' => 'Outro consultor'];
        $identidade = ['role' => 'admin'];
        $contagens = $this->service->contagensConversas($filtros, $identidade);
        $lista = $this->service->baseQuery($filtros + ['tipo' => 'abertas'], $identidade)
            ->all()->extract('id')->toList();

        $this->assertSame(1, $contagens['conversasAbertas']);
        $this->assertSame(['ld_test_conversa_7'], $lista);
    }

    public function testIndicadoresAgregadosRespeitamEtapasEExclusaoLogica(): void
    {
        $filtros = ['ids' => implode(',', $this->ids)];
        $stats = $this->service->stats($filtros, ['role' => 'admin']);
        $conversas = $this->service->contagensConversas($filtros, ['role' => 'admin']);

        $this->assertSame(7, $stats['total']);
        $this->assertSame(6, $stats['abertos']);
        $this->assertSame(1, $stats['ganhos']);
        $this->assertSame(1, $stats['naoContatar']);
        $this->assertSame(3, $conversas['semMensagem']);
        $this->assertSame(4, $conversas['conversasAbertas']);
        $this->assertSame(1, $conversas['clientes']);
        $this->assertSame(1, $conversas['recusados']);

        $restrito = $this->service->stats($filtros, ['role' => 'consultor', 'nome' => 'Consultor Teste']);
        $this->assertSame(6, $restrito['total']);
    }
}
