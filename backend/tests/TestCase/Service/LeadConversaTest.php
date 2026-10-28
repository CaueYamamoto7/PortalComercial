<?php
declare(strict_types=1);

namespace App\Test\TestCase\Service;

use App\Service\LeadService;
use Cake\TestSuite\TestCase;

/**
 * Regras de status de conversa do lead.
 *
 * O card "Aguardando" deve considerar tanto mensagens enviadas pelo sistema
 * quanto o contato manual representado pela etapa Contatado.
 */
class LeadConversaTest extends TestCase
{
    private LeadService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new LeadService();
    }

    /** @param array<string, mixed> $overrides */
    private function lead(array $overrides = []): array
    {
        return array_merge([
            'mensagensEnviadas' => 0,
            'mensagensRecebidas' => 0,
            'ultimaMensagemDirecao' => null,
            'ultimaMensagemEm' => null,
            'ultimaMensagemTexto' => '',
            'naoContatar' => false,
        ], $overrides);
    }

    /** @return array<string, mixed> */
    private function etapa(string $id, string $nome, string $tipo = 'aberto'): array
    {
        return ['id' => $id, 'nome' => $nome, 'tipo' => $tipo];
    }

    public function testLeadNovoSemMensagemFicaSemMensagem(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(),
            $this->etapa('et_novo', 'Novo'),
        );

        $this->assertSame('sem_mensagem', $conversa['status']);
    }

    public function testContatadoSemMensagemFicaAguardando(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(),
            $this->etapa('et_contatado', 'Contatado'),
        );

        $this->assertSame('aguardando', $conversa['status']);
        $this->assertTrue($conversa['podeEnviar']);
    }

    public function testEtapaContatadaPorNomeAlternativo(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(),
            $this->etapa('et_personalizada', 'Contatado'),
        );

        $this->assertSame('aguardando', $conversa['status']);
    }

    public function testMensagemEnviadaSemRespostaFicaAguardando(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(['mensagensEnviadas' => 1, 'ultimaMensagemDirecao' => 'saida']),
            $this->etapa('et_novo', 'Novo'),
        );

        $this->assertSame('aguardando', $conversa['status']);
    }

    public function testRespostaRecebidaSemEnvioFicaPrecisoResponder(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(['mensagensRecebidas' => 1, 'ultimaMensagemDirecao' => 'entrada']),
            $this->etapa('et_novo', 'Novo'),
        );

        $this->assertSame('responder', $conversa['status']);
        $this->assertTrue($conversa['conversaAberta']);
    }

    public function testUltimaMensagemDeSaidaComRespostaFicaEmConversa(): void
    {
        $conversa = $this->service->conversa(
            $this->lead([
                'mensagensEnviadas' => 2,
                'mensagensRecebidas' => 1,
                'ultimaMensagemDirecao' => 'saida',
            ]),
            $this->etapa('et_novo', 'Novo'),
        );

        $this->assertSame('em_conversa', $conversa['status']);
    }

    public function testEtapaGanhaFicaCliente(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(['mensagensEnviadas' => 2]),
            $this->etapa('et_ganho', 'Ganho', 'ganho'),
        );

        $this->assertSame('cliente', $conversa['status']);
    }

    public function testNaoContatarFicaRecusadoMesmoEmContatado(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(['naoContatar' => true]),
            $this->etapa('et_contatado', 'Contatado'),
        );

        $this->assertSame('recusado', $conversa['status']);
        $this->assertFalse($conversa['podeEnviar']);
    }

    public function testEtapaPerdidaFicaRecusado(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(),
            $this->etapa('et_perdido', 'Perdido', 'perdido'),
        );

        $this->assertSame('recusado', $conversa['status']);
    }

    public function testUltimaMensagemEhRetornadaComTexto(): void
    {
        $conversa = $this->service->conversa(
            $this->lead([
                'mensagensEnviadas' => 1,
                'ultimaMensagemDirecao' => 'saida',
                'ultimaMensagemEm' => '2026-10-26 10:00:00',
                'ultimaMensagemTexto' => 'Olá, tudo bem?',
            ]),
            $this->etapa('et_novo', 'Novo'),
        );

        $this->assertSame('Olá, tudo bem?', $conversa['ultimaMensagem']['texto']);
        $this->assertSame('saida', $conversa['ultimaMensagem']['direcao']);
        $this->assertNotNull($conversa['ultimaMensagem']['data']);
    }

    public function testSemMensagemNaoRetornaPrevia(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(),
            $this->etapa('et_novo', 'Novo'),
        );

        $this->assertNull($conversa['ultimaMensagem']);
    }

    public function testEtapaContatadaReconheceIdENome(): void
    {
        $this->assertTrue($this->service->etapaContatada($this->etapa('et_contatado', 'Qualquer')));
        $this->assertTrue($this->service->etapaContatada($this->etapa('et_x', ' CONTATADO ')));
        $this->assertTrue($this->service->etapaContatada($this->etapa('et_x', 'Contatádo')));
        $this->assertFalse($this->service->etapaContatada($this->etapa('et_novo', 'Novo')));
        $this->assertFalse($this->service->etapaContatada(null));
    }

    public function testPropostaSemMensagemEntraEmConversasAbertas(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(),
            $this->etapa('et_proposta', 'Proposta'),
        );

        $this->assertTrue($conversa['conversaAberta']);
        $this->assertSame('sem_mensagem', $conversa['status']);
    }

    public function testPropostaPersonalizadaEntraEmConversasAbertas(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(),
            $this->etapa('et_personalizada', ' PROPOSTA '),
        );

        $this->assertTrue($conversa['conversaAberta']);
    }

    public function testPropostaNaoContatarNaoEntraEmConversasAbertas(): void
    {
        $conversa = $this->service->conversa(
            $this->lead(['naoContatar' => true, 'mensagensRecebidas' => 1]),
            $this->etapa('et_proposta', 'Proposta'),
        );

        $this->assertFalse($conversa['conversaAberta']);
        $this->assertSame('recusado', $conversa['status']);
    }

    public function testPropostaEncerradaNaoEntraEmConversasAbertas(): void
    {
        foreach (['ganho', 'perdido'] as $tipo) {
            $conversa = $this->service->conversa(
                $this->lead(),
                $this->etapa('et_proposta', 'Proposta', $tipo),
            );

            $this->assertFalse($conversa['conversaAberta']);
        }
    }

    public function testEtapaPropostaReconheceIdENome(): void
    {
        $this->assertTrue($this->service->etapaProposta($this->etapa('et_proposta', 'Personalizada')));
        $this->assertTrue($this->service->etapaProposta($this->etapa('et_x', ' PROPOSTA ')));
        $this->assertFalse($this->service->etapaProposta($this->etapa('et_novo', 'Novo')));
        $this->assertFalse($this->service->etapaProposta(null));
    }
}
