<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;
use Cake\I18n\DateTime;

class TasksController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $table = $this->fetchTable('Tasks');

        $query = $table->find();
        $this->access()->scopeTasks($query, $this->identidade());
        if (!empty($params['status'])) {
            $query->where(['Tasks.status' => (string)$params['status']]);
        }
        if (!empty($params['responsavel'])) {
            $query->where(['Tasks.responsavel' => (string)$params['responsavel']]);
        }
        if (!empty($params['leadId'])) {
            $query->where(['Tasks.lead_id' => (string)$params['leadId']]);
        }

        $agora = $this->agora();
        $total = (clone $query)->count();
        $perPage = $this->perPage($params['perPage'] ?? 50, 50);
        $page = max(1, (int)($params['page'] ?? 1));
        $paginas = max(1, (int)ceil($total / $perPage));
        $page = min($page, $paginas);

        $rows = $query
            ->orderBy(['Tasks.data' => 'ASC'])
            ->limit($perPage)
            ->offset(($page - 1) * $perPage)
            ->all()
            ->toList();

        $leadIds = array_values(array_unique(array_map(
            fn ($row) => (string)$row->get('lead_id'),
            $rows
        )));
        $leads = [];
        if ($leadIds) {
            $leadQuery = $this->fetchTable('Leads')->find()
                ->where(['Leads.id IN' => $leadIds, 'Leads.deleted_at IS' => null]);
            $this->access()->scopeLeads($leadQuery, $this->identidade());
            foreach ($leadQuery->all() as $leadRow) {
                $lead = $this->service()->leadOut(
                    $this->service()->enriquecer($this->service()->leadBaseOut($leadRow))
                );
                $leads[(string)$leadRow->get('id')] = $lead;
            }
        }

        $tarefas = [];
        foreach ($rows as $row) {
            $tarefas[] = $this->tarefaEnriquecida($row, $leads[(string)$row->get('lead_id')] ?? null);
        }

        $baseStats = $table->find();
        $this->access()->scopeTasks($baseStats, $this->identidade());

        $atrasadas = (clone $baseStats)
            ->where(['status' => 'pendente', 'data <' => $agora])->count();
        $hoje = (clone $baseStats)
            ->where([
                'status' => 'pendente',
                'data >=' => new DateTime('today'),
                'data <' => new DateTime('today +1 day'),
            ])->count();
        $semana = (clone $baseStats)
            ->where([
                'status' => 'pendente',
                'data >=' => new DateTime('today +1 day'),
                'data <' => new DateTime('today +8 day'),
            ])->count();
        $concluidas = (clone $baseStats)->where(['status' => 'concluida'])->count();

        return $this->respond([
            'data' => $tarefas,
            'meta' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'paginas' => $paginas,
            ],
            'stats' => [
                'atrasadas' => $atrasadas,
                'hoje' => $hoje,
                'semana' => $semana,
                'concluidas' => $concluidas,
                'total' => $total,
            ],
        ]);
    }

    public function add(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $leadId = $this->texto($dados['leadId'] ?? '');
        $lead = $this->queryService()->findLead($leadId, $this->identidade());
        if (!$lead) {
            $this->erro('Selecione um lead.', 'leadId');
        }
        $titulo = $this->texto($dados['titulo'] ?? '');
        if ($titulo === '') {
            $this->erro('Informe o título da tarefa.', 'titulo');
        }
        $data = $this->data($dados['data'] ?? null);
        if (!$data) {
            $this->erro('Informe a data da tarefa.', 'data');
        }

        $responsavel = $this->texto($dados['responsavel'] ?? '') ?: (string)$lead['responsavel'];
        if (!$this->access()->canSeeAllLeads($this->identidade())) {
            $responsavel = $this->usuarioNome();
        }

        $table = $this->fetchTable('Tasks');
        $entity = $table->newEntity([
            'lead_id' => $leadId,
            'titulo' => $titulo,
            'tipo' => $this->texto($dados['tipo'] ?? '') ?: 'ligacao',
            'data' => $data,
            'prioridade' => $this->texto($dados['prioridade'] ?? '') ?: (string)$lead['prioridade'],
            'status' => 'pendente',
            'responsavel' => $responsavel,
        ]);
        $table->saveOrFail($entity);

        $leadsTable = $this->fetchTable('Leads');
        $leadEntity = $leadsTable->find()->where(['id' => $leadId])->first();
        if ($leadEntity) {
            $leadEntity->set('proximo_contato', $data);
            $leadEntity->set('atualizado_em', $this->agora());
            $leadsTable->saveOrFail($leadEntity);
        }

        $this->registroAuditoria('tarefa.criar', 'task', (string)$entity->get('id'), ['leadId' => $leadId]);

        return $this->respond($this->tarefaEnriquecida($entity, $lead), 201);
    }

    public function concluir(string $id): Response
    {
        $this->request->allowMethod(['post']);
        $table = $this->fetchTable('Tasks');
        $query = $table->find()->where(['Tasks.id' => $id]);
        $this->access()->scopeTasks($query, $this->identidade());
        $entity = $query->first();
        if (!$entity) {
            $this->erro('Tarefa não encontrada.', null, 404);
        }

        $dados = (array)$this->request->getData();
        $entity->set('status', !empty($dados['concluida']) ? 'concluida' : 'pendente');
        $table->saveOrFail($entity);

        $lead = $this->queryService()->findLead((string)$entity->get('lead_id'), $this->identidade());
        $this->registroAuditoria('tarefa.concluir', 'task', $id, [
            'status' => (string)$entity->get('status'),
        ]);

        return $this->respond($this->tarefaEnriquecida(
            $entity,
            $lead ? $this->service()->leadOut($lead) : null
        ));
    }

    public function delete(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $table = $this->fetchTable('Tasks');
        $query = $table->find()->where(['Tasks.id' => $id]);
        $this->access()->scopeTasks($query, $this->identidade());
        $entity = $query->first();
        if (!$entity) {
            $this->erro('Tarefa não encontrada.', null, 404);
        }
        $table->delete($entity);
        $this->registroAuditoria('tarefa.excluir', 'task', $id);

        return $this->respond(['removido' => true]);
    }
}
