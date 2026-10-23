<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class DashboardController extends AppController
{
    public function index(): Response
    {
        $identidade = $this->identidade();
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
            ->where(['Tasks.status' => 'pendente']);
        $this->access()->scopeTasks($taskQuery, $identidade);

        $tarefasTotal = (clone $taskQuery)->count();
        $tarefasRows = $taskQuery
            ->orderBy(['Tasks.data' => 'ASC'])
            ->limit(6)
            ->all()
            ->toList();

        $leads = $this->carregarLeads(array_map(
            fn ($row) => (string)$row->get('lead_id'),
            $tarefasRows
        ), $identidade);

        $tarefas = [];
        foreach ($tarefasRows as $row) {
            $tarefas[] = $this->tarefaEnriquecida(
                $row,
                $leads[(string)$row->get('lead_id')] ?? null
            );
        }

        $campanhasQuery = $this->fetchTable('Campaigns')->find();
        if (!$this->access()->canSeeAllLeads($identidade)) {
            $campanhasQuery->where(['responsavel' => $this->usuarioNome()]);
        }
        $campanhas = $campanhasQuery
            ->orderBy(['criada_em' => 'DESC'])
            ->limit(4)
            ->all()
            ->toList();

        return $this->respond([
            'periodo' => (string)($this->request->getQuery('periodo') ?? '30'),
            'stats' => $this->queryService()->stats([], $identidade),
            'conversas' => $this->queryService()->contagensConversas([], $identidade),
            'tarefas' => $tarefas,
            'tarefasTotal' => $tarefasTotal,
            'campanhas' => array_map(fn ($row) => $this->campanhaOut($row), $campanhas),
        ]);
    }

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
                $this->service()->enriquecer($this->service()->leadBaseOut($row))
            );
            $resultado[(string)$row->get('id')] = $lead;
        }

        return $resultado;
    }
}
