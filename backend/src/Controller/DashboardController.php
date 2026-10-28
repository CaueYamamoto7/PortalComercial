<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\DashboardMetricsService;
use Cake\Http\Response;
use Cake\I18n\DateTime;

class DashboardController extends AppController
{
    /** Retorna os indicadores e a agenda operacional do painel. */
    public function index(): Response
    {
        $identidade = $this->identidade();
        $periodo = (int)($this->request->getQuery('periodo') ?? 30);
        if (!in_array($periodo, [7, 30, 90], true)) {
            $periodo = 30;
        }
        $filtros = ['periodo' => $periodo];
        $tasksTable = $this->fetchTable('Tasks');
        $taskQuery = $tasksTable->find()
            ->innerJoin(['LeadTarefa' => 'leads'], [
                'LeadTarefa.id = Tasks.lead_id',
                'LeadTarefa.deleted_at IS' => null,
            ])
            ->innerJoin(['EtapaTarefa' => 'stages'], [
                'EtapaTarefa.id = LeadTarefa.etapa_id',
                'EtapaTarefa.tipo' => 'aberto',
            ])
            ->where($this->access()->canSeeAllLeads($identidade)
                ? [] : ['LeadTarefa.responsavel' => $this->usuarioNome()])
            ->where(['Tasks.status' => 'pendente']);
        $this->access()->scopeTasks($taskQuery, $identidade);

        $tarefasTotal = (clone $taskQuery)->count();
        $acoesHojeTotal = (clone $taskQuery)
            ->where(['Tasks.data <' => new DateTime('tomorrow')])->count();
        $hojeRows = (clone $taskQuery)
            ->where(['Tasks.data <' => new DateTime('tomorrow')])
            ->orderBy(['Tasks.data' => 'ASC'])
            ->limit(8)->all()->toList();
        $proximasRows = (clone $taskQuery)
            ->where(['Tasks.data >=' => new DateTime('tomorrow')])
            ->orderBy(['Tasks.data' => 'ASC'])
            ->limit(5)->all()->toList();
        $tarefasRows = (clone $taskQuery)
            ->orderBy(['Tasks.data' => 'ASC'])
            ->limit(6)
            ->all()
            ->toList();

        $leads = $this->carregarLeads(array_map(
            fn($row) => (string)$row->get('lead_id'),
            array_merge($tarefasRows, $hojeRows, $proximasRows),
        ), $identidade);

        $tarefas = [];
        foreach ($tarefasRows as $row) {
            $tarefas[] = $this->tarefaEnriquecida(
                $row,
                $leads[(string)$row->get('lead_id')] ?? null,
            );
        }

        $campanhasQuery = $this->fetchTable('Campaigns')->find();
        $campanhasQuery->where([
            'criada_em >=' => (new DateTime('today'))->subDays($periodo - 1),
            'criada_em <' => new DateTime('tomorrow'),
        ]);
        if (!$this->access()->canSeeAllLeads($identidade)) {
            $campanhasQuery->where(['responsavel' => $this->usuarioNome()]);
        }
        $campanhas = $campanhasQuery
            ->orderBy(['criada_em' => 'DESC'])
            ->limit(5)
            ->all()
            ->toList();

        return $this->respond([
            'periodo' => (string)$periodo,
            'stats' => $this->queryService()->stats($filtros, $identidade),
            'conversas' => $this->queryService()->contagensConversas($filtros, $identidade),
            'pendencias' => $this->queryService()->baseQuery(['tipo' => 'responder'], $identidade)->count(),
            'metricas' => (new DashboardMetricsService())->obter($periodo, $identidade),
            'acoesHoje' => array_map(fn($row) => $this->tarefaEnriquecida(
                $row,
                $leads[(string)$row->get('lead_id')] ?? null,
            ), $hojeRows),
            'proximasAcoes' => array_map(fn($row) => $this->tarefaEnriquecida(
                $row,
                $leads[(string)$row->get('lead_id')] ?? null,
            ), $proximasRows),
            'tarefas' => $tarefas,
            'tarefasTotal' => $tarefasTotal,
            'acoesHojeTotal' => $acoesHojeTotal,
            'campanhas' => array_map(fn($row) => $this->campanhaOut($row), $campanhas),
        ]);
    }

    /** Lista os contatos elegíveis para cada indicador. */
    public function conversas(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $tipo = (string)($params['tipo'] ?? '');

        $filtros = $params;
        unset($filtros['tipo'], $filtros['page'], $filtros['perPage'], $filtros['sort'], $filtros['direction']);

        if (in_array($tipo, ['responder', 'sem_mensagem'], true)) {
            $params['sort'] = 'ultimaMensagemEm';
            $params['direction'] = 'asc';
        }
        if ($tipo !== '') {
            $params['tipo'] = $tipo;
        }

        $pagina = $this->queryService()->paginar($params, $this->identidade());

        return $this->respond([
            'tipo' => $tipo,
            'data' => $pagina['data'],
            'meta' => $pagina['meta'],
            'total' => $pagina['meta']['total'],
            'conversas' => $this->queryService()->contagensConversas($filtros, $this->identidade()),
        ]);
    }

    /** @param array<int, string> $ids @param array<string, mixed> $identidade */
    private function carregarLeads(array $ids, array $identidade): array
    {
        $ids = array_values(array_unique(array_filter($ids)));
        if (!$ids) {
            return [];
        }

        $query = $this->fetchTable('Leads')->find()
            ->where(['Leads.id IN' => $ids, 'Leads.deleted_at IS' => null]);
        $this->access()->scopeLeads($query, $identidade);

        $resultado = [];
        foreach ($query->all() as $row) {
            $lead = $this->service()->leadOut(
                $this->service()->enriquecer($this->service()->leadBaseOut($row)),
            );
            $resultado[(string)$row->get('id')] = $lead;
        }

        return $resultado;
    }
}
