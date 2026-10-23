<?php
declare(strict_types=1);

namespace App\Service;

use Cake\I18n\DateTime;
use Cake\ORM\Locator\LocatorAwareTrait;
use Cake\ORM\Query\SelectQuery;

/**
 * Consultas paginadas e agregadas de leads feitas no banco.
 *
 * Substitui o padrão antigo de carregar todos os leads e filtrar em memória.
 */
class LeadQueryService
{
    use LocatorAwareTrait;

    public const PER_PAGE_MAX = 100;

    private LeadService $leads;
    private AccessControl $access;

    public function __construct(?LeadService $leads = null, ?AccessControl $access = null)
    {
        $this->leads = $leads ?? new LeadService();
        $this->access = $access ?? new AccessControl();
    }

    public function service(): LeadService
    {
        return $this->leads;
    }

    public function access(): AccessControl
    {
        return $this->access;
    }

    /** @param array<string, mixed> $filtros @param array<string, mixed> $identidade */
    public function baseQuery(array $filtros, array $identidade): SelectQuery
    {
        $query = $this->fetchTable('Leads')->find()
            ->where(['Leads.deleted_at IS' => null]);
        $this->access->scopeLeads($query, $identidade);

        $q = $this->leads->normalizar((string)($filtros['q'] ?? ''));
        if ($q !== '') {
            $q = str_replace(['%', '_'], ' ', $q);
            $termo = '%' . $q . '%';
            $digitos = preg_replace('/\D+/', '', $q) ?? '';
            $condicoes = ['Leads.busca LIKE' => $termo];
            if ($digitos !== '') {
                $condicoes['Leads.telefone LIKE'] = '%' . $digitos . '%';
            }
            $query->where(['OR' => $condicoes]);
        }

        $etapa = (string)($filtros['etapa'] ?? '');
        if ($etapa === 'abertos') {
            $query->innerJoin(
                ['EtapaFiltro' => 'stages'],
                ['EtapaFiltro.id = Leads.etapa_id', 'EtapaFiltro.tipo' => 'aberto']
            );
        } elseif ($etapa !== '') {
            $query->where(['Leads.etapa_id' => $etapa]);
        }

        $sistema = (string)($filtros['sistema'] ?? '');
        if ($sistema !== '') {
            $query->innerJoin(
                ['SistemaFiltro' => 'lead_systems'],
                ['SistemaFiltro.lead_id = Leads.id', 'SistemaFiltro.system_id' => $sistema]
            );
        }

        $tag = (string)($filtros['tag'] ?? '');
        if ($tag !== '') {
            $query->innerJoin(
                ['TagFiltro' => 'lead_tags'],
                ['TagFiltro.lead_id = Leads.id', 'TagFiltro.tag' => $tag]
            );
        }

        $origem = (string)($filtros['origem'] ?? '');
        if ($origem !== '') {
            $query->where(['Leads.origem_id' => $origem]);
        }

        $responsavel = (string)($filtros['responsavel'] ?? '');
        if ($responsavel !== '') {
            $query->where(['Leads.responsavel' => $responsavel]);
        }

        $prioridade = (string)($filtros['prioridade'] ?? '');
        if ($prioridade !== '') {
            $query->where(['Leads.prioridade' => $prioridade]);
        }

        $possui = (string)($filtros['possuiSistema'] ?? '');
        if ($possui !== '') {
            $query->where(['Leads.possui_sistema' => $possui]);
        }

        $naoContatar = (string)($filtros['naoContatar'] ?? '');
        if (in_array($naoContatar, ['0', '1'], true)) {
            $query->where(['Leads.nao_contatar' => $naoContatar === '1']);
        }

        $atrasados = (string)($filtros['atrasados'] ?? '');
        if ($atrasados === '1') {
            $query->innerJoin(
                ['EtapaAtraso' => 'stages'],
                ['EtapaAtraso.id = Leads.etapa_id', 'EtapaAtraso.tipo' => 'aberto']
            )->where(['Leads.proximo_contato <' => new DateTime()]);
        }

        $tipoConversa = (string)($filtros['tipo'] ?? '');
        if ($tipoConversa !== '') {
            $query->innerJoin(
                ['ConversaEtapa' => 'stages'],
                ['ConversaEtapa.id = Leads.etapa_id']
            );
            if (in_array($tipoConversa, ['sem_mensagem', 'aguardando', 'responder', 'abertas', 'em_conversa'], true)) {
                $query->where(['ConversaEtapa.tipo' => 'aberto', 'Leads.nao_contatar' => false]);
            }
            if ($tipoConversa === 'sem_mensagem') {
                $query->where(['Leads.mensagens_enviadas' => 0]);
            } elseif ($tipoConversa === 'aguardando') {
                $query->where(['Leads.mensagens_enviadas >' => 0, 'Leads.mensagens_recebidas' => 0]);
            } elseif ($tipoConversa === 'responder') {
                $query->where([
                    'Leads.mensagens_enviadas >' => 0,
                    'Leads.ultima_mensagem_direcao' => 'entrada',
                ]);
            } elseif ($tipoConversa === 'abertas') {
                $query->where(['Leads.mensagens_recebidas >' => 0]);
            } elseif ($tipoConversa === 'em_conversa') {
                $query->where([
                    'Leads.mensagens_enviadas >' => 0,
                    'Leads.mensagens_recebidas >' => 0,
                    'Leads.ultima_mensagem_direcao !=' => 'entrada',
                ]);
            } elseif ($tipoConversa === 'clientes') {
                $query->where(['ConversaEtapa.tipo' => 'ganho']);
            } elseif ($tipoConversa === 'recusados') {
                $perdidos = $this->etapasPorTipo('perdido');
                $condicoes = ['Leads.nao_contatar' => true];
                if ($perdidos) {
                    $condicoes = ['OR' => [
                        'Leads.nao_contatar' => true,
                        'Leads.etapa_id IN' => $perdidos,
                    ]];
                }
                $query->where($condicoes);
            }
        }

        $ids = array_values(array_filter(array_map('trim', explode(',', (string)($filtros['ids'] ?? '')))));
        if ($ids) {
            $query->where(['Leads.id IN' => $ids]);
        }

        $periodo = (int)($filtros['periodo'] ?? 0);
        if ($periodo > 0) {
            $query->where(['Leads.criado_em >=' => (new DateTime('today'))->subDays($periodo - 1)]);
        }

        return $query;
    }

    /** @param array<string, mixed> $filtros @param array<string, mixed> $identidade */
    public function paginar(array $filtros, array $identidade): array
    {
        $page = max(1, (int)($filtros['page'] ?? 1));
        $perPage = (int)($filtros['perPage'] ?? 12);
        $perPage = max(1, min(self::PER_PAGE_MAX, $perPage));

        $query = $this->baseQuery($filtros, $identidade);
        $total = (clone $query)->count();
        $paginas = max(1, (int)ceil($total / $perPage));
        $page = min($page, $paginas);

        $sort = $this->campoOrdenacao((string)($filtros['sort'] ?? 'atualizadoEm'));
        $direction = strtolower((string)($filtros['direction'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';

        $rows = $query
            ->orderBy([$sort => $direction])
            ->limit($perPage)
            ->offset(($page - 1) * $perPage)
            ->all()
            ->toList();

        $leads = [];
        foreach ($rows as $row) {
            $leads[] = $this->leads->enriquecer($this->leads->leadBaseOut($row));
        }

        return [
            'data' => $this->leads->leadsOut($leads),
            'meta' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'paginas' => $paginas,
            ],
        ];
    }

    /** @param array<string, mixed> $filtros @param array<string, mixed> $identidade */
    public function stats(array $filtros, array $identidade): array
    {
        $total = (clone $this->baseQuery($filtros, $identidade))->count();
        $abertos = $this->comEtapa($filtros, $identidade, 'aberto')->count();
        $ganhos = $this->comEtapa($filtros, $identidade, 'ganho')->count();
        $perdidos = $this->comEtapa($filtros, $identidade, 'perdido')->count();

        $atrasadosQuery = $this->comEtapa($filtros, $identidade, 'aberto')
            ->where(['Leads.proximo_contato <' => new DateTime()]);
        $atrasados = $atrasadosQuery->count();

        $hojeQuery = $this->comEtapa($filtros, $identidade, 'aberto')
            ->where([
                'Leads.proximo_contato >=' => (new DateTime('today')),
                'Leads.proximo_contato <' => (new DateTime('today +1 day')),
            ]);
        $hoje = $hojeQuery->count();

        $emNegociacao = (clone $this->baseQuery($filtros, $identidade))
            ->where(['Leads.etapa_id' => 'et_negociacao'])->count();
        $emProposta = (clone $this->baseQuery($filtros, $identidade))
            ->where(['Leads.etapa_id' => 'et_proposta'])->count();
        $naoContatar = (clone $this->baseQuery($filtros, $identidade))
            ->where(['Leads.nao_contatar' => true])->count();

        $decididos = $ganhos + $perdidos;

        return [
            'total' => $total,
            'abertos' => $abertos,
            'ganhos' => $ganhos,
            'perdidos' => $perdidos,
            'taxaConversao' => $decididos > 0 ? round($ganhos / $decididos * 100, 1) : 0,
            'emNegociacao' => $emNegociacao,
            'emProposta' => $emProposta,
            'atrasados' => $atrasados,
            'followupsHoje' => $hoje,
            'naoContatar' => $naoContatar,
        ];
    }

    /** @param array<string, mixed> $filtros @param array<string, mixed> $identidade */
    public function contagensConversas(array $filtros, array $identidade): array
    {
        $aberto = fn () => $this->comEtapa($filtros, $identidade, 'aberto');

        $semMensagem = $aberto()
            ->where(['Leads.mensagens_enviadas' => 0, 'Leads.nao_contatar' => false])
            ->count();
        $responder = $aberto()
            ->where([
                'Leads.mensagens_enviadas >' => 0,
                'Leads.ultima_mensagem_direcao' => 'entrada',
                'Leads.nao_contatar' => false,
            ])->count();
        $emConversa = $aberto()
            ->where([
                'Leads.mensagens_enviadas >' => 0,
                'Leads.mensagens_recebidas >' => 0,
                'Leads.ultima_mensagem_direcao !=' => 'entrada',
                'Leads.nao_contatar' => false,
            ])->count();
        $aguardando = $aberto()
            ->where([
                'Leads.mensagens_enviadas >' => 0,
                'Leads.mensagens_recebidas' => 0,
                'Leads.nao_contatar' => false,
            ])->count();
        $abertas = $aberto()
            ->where([
                'Leads.mensagens_recebidas >' => 0,
                'Leads.nao_contatar' => false,
            ])->count();

        $perdidos = $this->etapasPorTipo('perdido');
        $clientes = $this->comEtapa($filtros, $identidade, 'ganho')->count();
        $base = $this->baseQuery($filtros, $identidade);
        $condicoesRecusado = ['Leads.nao_contatar' => true];
        if ($perdidos) {
            $condicoesRecusado = ['OR' => [
                'Leads.nao_contatar' => true,
                'Leads.etapa_id IN' => $perdidos,
            ]];
        }
        $recusados = $base->where($condicoesRecusado)->count();
        $total = (clone $this->baseQuery($filtros, $identidade))->count();

        return [
            'total' => $total,
            'semMensagem' => $semMensagem,
            'aguardando' => $aguardando,
            'precisoResponder' => $responder,
            'emConversa' => $emConversa,
            'conversasAbertas' => $abertas,
            'clientes' => $clientes,
            'recusados' => $recusados,
        ];
    }

    /** @param array<string, mixed> $filtros @param array<string, mixed> $identidade */
    public function facets(array $filtros, array $identidade): array
    {
        $cat = $this->leads->facets();
        if (!$this->access->canSeeAllLeads($identidade)) {
            $nome = (string)($identidade['nome'] ?? '');
            $cat['responsaveis'] = array_values(array_filter(
                $cat['responsaveis'],
                fn ($membro) => $membro['nome'] === $nome
            ));
        }

        return $cat;
    }

    /** @param array<string, mixed> $identidade */
    public function findLead(string $id, array $identidade): ?array
    {
        $query = $this->fetchTable('Leads')->find()
            ->where(['Leads.id' => $id, 'Leads.deleted_at IS' => null]);
        $this->access->scopeLeads($query, $identidade);
        $row = $query->first();
        if (!$row) {
            return null;
        }

        return $this->leads->enriquecer($this->leads->leadBaseOut($row));
    }

    /**
     * Público elegível para campanha: etapa aberta e sem "não contatar".
     *
     * @param array<string, mixed> $filtros
     * @param array<string, mixed> $identidade
     * @return array<int, object>
     */
    public function audiencia(array $filtros, array $identidade, int $limite = 5000): array
    {
        return $this->audienciaQuery($filtros, $identidade)
            ->orderBy(['Leads.id' => 'ASC'])
            ->limit(max(1, min(5000, $limite)))
            ->all()
            ->toList();
    }

    /** Query base do público de campanha, reutilizável para contagem e amostra. */
    public function audienciaQuery(array $filtros, array $identidade): SelectQuery
    {
        return $this->baseQuery($filtros, $identidade)
            ->innerJoin(
                ['AudienciaEtapa' => 'stages'],
                ['AudienciaEtapa.id = Leads.etapa_id', 'AudienciaEtapa.tipo' => 'aberto']
            )
            ->where(['Leads.nao_contatar' => false]);
    }

    /** @param array<string, mixed> $filtros @param array<string, mixed> $identidade */
    private function comEtapa(array $filtros, array $identidade, string $tipo): SelectQuery
    {
        return $this->baseQuery($filtros, $identidade)
            ->innerJoin(
                ['StatsEtapa' => 'stages'],
                ['StatsEtapa.id = Leads.etapa_id', 'StatsEtapa.tipo' => $tipo]
            );
    }

    private function campoOrdenacao(string $sort): string
    {
        $mapa = [
            'atualizadoEm' => 'Leads.atualizado_em',
            'atualizado_em' => 'Leads.atualizado_em',
            'criadoEm' => 'Leads.criado_em',
            'criado_em' => 'Leads.criado_em',
            'nome' => 'Leads.nome',
            'empresa' => 'Leads.empresa',
            'prioridade' => 'Leads.prioridade',
            'proximoContato' => 'Leads.proximo_contato',
            'proximo_contato' => 'Leads.proximo_contato',
            'ultimoContato' => 'Leads.ultimo_contato',
            'ultimaMensagemEm' => 'Leads.ultima_mensagem_em',
            'etapa' => 'Leads.etapa_id',
        ];

        return $mapa[$sort] ?? 'Leads.atualizado_em';
    }

    /** @return array<int, string> */
    private function etapasPorTipo(string $tipo): array
    {
        $cat = $this->leads->catalogo();

        return array_values(array_filter(array_map(
            fn ($etapa) => $etapa['tipo'] === $tipo ? $etapa['id'] : null,
            $cat['etapas']
        )));
    }
}
