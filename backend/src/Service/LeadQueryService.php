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
    private array $contagensCache = [];

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
                $query->where([
                    'Leads.mensagens_enviadas' => 0,
                    'Leads.mensagens_recebidas' => 0,
                ]);
                $contatadas = $this->leads->etapasContatadas();
                if ($contatadas) {
                    $query->where(['Leads.etapa_id NOT IN' => $contatadas]);
                }
            } elseif ($tipoConversa === 'aguardando') {
                $condicoes = ['Leads.mensagens_recebidas' => 0];
                $origem = [['Leads.mensagens_enviadas >' => 0]];
                $contatadas = $this->leads->etapasContatadas();
                if ($contatadas) {
                    $origem[] = ['Leads.etapa_id IN' => $contatadas];
                }
                $condicoes['OR'] = $origem;
                $query->where($condicoes);
            } elseif ($tipoConversa === 'responder') {
                $query->where([
                    'Leads.mensagens_recebidas >' => 0,
                    'Leads.ultima_mensagem_direcao' => 'entrada',
                ]);
            } elseif ($tipoConversa === 'abertas') {
                $query->where($this->condicoesConversasAbertas());
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
        $c = $this->contagensAgregadas($filtros, $identidade);
        $total = $c['total'];
        $abertos = $c['abertos'];
        $ganhos = $c['ganhos'];
        $perdidos = $c['perdidos'];
        $atrasados = $c['atrasados'];
        $hoje = $c['hoje'];
        $emNegociacao = $c['emNegociacao'];
        $emProposta = $c['emProposta'];
        $naoContatar = $c['naoContatar'];

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

    /** @return array<string, mixed> */
    private function condicoesConversasAbertas(): array
    {
        $condicoes = [['Leads.mensagens_recebidas >' => 0]];
        $propostas = $this->leads->etapasProposta();
        if ($propostas) {
            $condicoes[] = ['Leads.etapa_id IN' => $propostas];
        }

        return ['OR' => $condicoes];
    }

    /** @param array<string, mixed> $filtros @param array<string, mixed> $identidade */
    public function contagensConversas(array $filtros, array $identidade): array
    {
        $c = $this->contagensAgregadas($filtros, $identidade);

        return [
            'total' => $c['total'],
            'semMensagem' => $c['semMensagem'],
            'aguardando' => $c['aguardando'],
            'precisoResponder' => $c['precisoResponder'],
            'emConversa' => $c['emConversa'],
            'conversasAbertas' => $c['conversasAbertas'],
            'clientes' => $c['ganhos'],
            'recusados' => $c['recusados'],
        ];
    }

    /** Uma única leitura agrega os indicadores usados pelo painel e pela barra lateral. */
    private function contagensAgregadas(array $filtros, array $identidade): array
    {
        $chave = json_encode([$filtros, $identidade]);
        if (isset($this->contagensCache[$chave])) {
            return $this->contagensCache[$chave];
        }

        $query = $this->baseQuery($filtros, $identidade)
            ->leftJoin(['ContagemEtapa' => 'stages'], ['ContagemEtapa.id = Leads.etapa_id']);
        $agora = (new DateTime())->format('Y-m-d H:i:s');
        $inicioHoje = (new DateTime('today'))->format('Y-m-d H:i:s');
        $fimHoje = (new DateTime('today +1 day'))->format('Y-m-d H:i:s');
        $aberto = "ContagemEtapa.tipo = 'aberto'";
        $elegivel = "$aberto AND Leads.nao_contatar = FALSE";
        $contatadas = $this->idsSql($this->leads->etapasContatadas());
        $propostas = $this->idsSql($this->leads->etapasProposta());
        $perdidos = $this->idsSql($this->etapasPorTipo('perdido'));
        $contatada = $contatadas ? "Leads.etapa_id IN ($contatadas)" : 'FALSE';
        $proposta = $propostas ? "Leads.etapa_id IN ($propostas)" : 'FALSE';
        $perdida = $perdidos ? "Leads.etapa_id IN ($perdidos)" : 'FALSE';
        $condicoes = [
            'abertos' => $aberto,
            'ganhos' => "ContagemEtapa.tipo = 'ganho'",
            'perdidos' => "ContagemEtapa.tipo = 'perdido'",
            'atrasados' => "$aberto AND Leads.proximo_contato < '$agora'",
            'hoje' => "$aberto AND Leads.proximo_contato >= '$inicioHoje' AND Leads.proximo_contato < '$fimHoje'",
            'emNegociacao' => "Leads.etapa_id = 'et_negociacao'",
            'emProposta' => "Leads.etapa_id = 'et_proposta'",
            'naoContatar' => 'Leads.nao_contatar = TRUE',
            'semMensagem' => "$elegivel AND Leads.mensagens_enviadas = 0 AND Leads.mensagens_recebidas = 0 AND NOT ($contatada)",
            'aguardando' => "$elegivel AND Leads.mensagens_recebidas = 0 AND (Leads.mensagens_enviadas > 0 OR $contatada)",
            'precisoResponder' => "$elegivel AND Leads.mensagens_recebidas > 0 AND Leads.ultima_mensagem_direcao = 'entrada'",
            'emConversa' => "$elegivel AND Leads.mensagens_enviadas > 0 AND Leads.mensagens_recebidas > 0 AND Leads.ultima_mensagem_direcao != 'entrada'",
            'conversasAbertas' => "$elegivel AND (Leads.mensagens_recebidas > 0 OR $proposta)",
            'recusados' => "Leads.nao_contatar = TRUE OR $perdida",
        ];
        $campos = ['total' => $query->expr('COUNT(*)')];
        foreach ($condicoes as $nome => $condicao) {
            $campos[$nome] = $query->expr("SUM(CASE WHEN $condicao THEN 1 ELSE 0 END)");
        }
        $row = $query->select($campos, true)->disableHydration()->first() ?: [];
        $resultado = ['total' => (int)($row['total'] ?? 0)];
        foreach (array_keys($condicoes) as $nome) {
            $resultado[$nome] = (int)($row[$nome] ?? 0);
        }

        return $this->contagensCache[$chave] = $resultado;
    }

    /** IDs de etapas vindos do banco, escapados como literais SQL. */
    private function idsSql(array $ids): string
    {
        return implode(', ', array_map(
            fn ($id) => "'" . str_replace("'", "''", (string)$id) . "'",
            $ids
        ));
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
