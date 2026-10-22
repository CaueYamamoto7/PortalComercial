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
        $service = $this->service();
        $leads = [];
        foreach ($service->todosEnriquecidos() as $lead) {
            $leads[$lead['id']] = $lead;
        }

        $query = $this->fetchTable('Tasks')->find();
        if (!empty($params['status'])) {
            $query->where(['status' => (string)$params['status']]);
        }
        if (!empty($params['responsavel'])) {
            $query->where(['responsavel' => (string)$params['responsavel']]);
        }
        if (!empty($params['leadId'])) {
            $query->where(['lead_id' => (string)$params['leadId']]);
        }
        $rows = $query->orderBy(['data' => 'ASC'])->all()->toList();

        $tarefas = [];
        foreach ($rows as $row) {
            $lead = $leads[(string)$row->get('lead_id')] ?? null;
            $tarefas[] = $this->tarefaEnriquecida($row, $lead);
        }

        $agora = $this->agora();
        $fimHoje = new DateTime('today +1 day');
        $fimSemana = new DateTime('today +8 day');
        $stats = ['atrasadas' => 0, 'hoje' => 0, 'semana' => 0, 'concluidas' => 0, 'total' => count($tarefas)];
        foreach ($rows as $row) {
            $data = $row->get('data');
            $status = (string)$row->get('status');
            if ($status === 'concluida') {
                $stats['concluidas']++;
                continue;
            }
            if (!$data) {
                continue;
            }
            if ($data < $agora) {
                $stats['atrasadas']++;
            } elseif ($data < $fimHoje) {
                $stats['hoje']++;
            } elseif ($data < $fimSemana) {
                $stats['semana']++;
            }
        }

        return $this->respond(['data' => $tarefas, 'stats' => $stats]);
    }

    public function add(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $leadId = $this->texto($dados['leadId'] ?? '');
        $lead = $this->fetchTable('Leads')->find()->where(['id' => $leadId])->first();
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

        $table = $this->fetchTable('Tasks');
        $entity = $table->newEntity([
            'lead_id' => $leadId,
            'titulo' => $titulo,
            'tipo' => $this->texto($dados['tipo'] ?? '') ?: 'ligacao',
            'data' => $data,
            'prioridade' => $this->texto($dados['prioridade'] ?? '') ?: (string)$lead->get('prioridade'),
            'status' => 'pendente',
            'responsavel' => $this->texto($dados['responsavel'] ?? '') ?: (string)$lead->get('responsavel'),
        ]);
        $table->saveOrFail($entity);

        $lead->set('proximo_contato', $data);
        $lead->set('atualizado_em', $this->agora());
        $this->fetchTable('Leads')->saveOrFail($lead);
        $this->service()->invalidar();

        $completo = $this->service()->leadCompleto($leadId);

        return $this->respond($this->tarefaEnriquecida($entity, $completo), 201);
    }

    public function concluir(string $id): Response
    {
        $this->request->allowMethod(['post']);
        $table = $this->fetchTable('Tasks');
        $entity = $table->find()->where(['id' => $id])->first();
        if (!$entity) {
            $this->erro('Tarefa não encontrada.', null, 404);
        }

        $dados = (array)$this->request->getData();
        $entity->set('status', !empty($dados['concluida']) ? 'concluida' : 'pendente');
        $table->saveOrFail($entity);

        $lead = $this->service()->leadCompleto((string)$entity->get('lead_id'));

        return $this->respond($this->tarefaEnriquecida($entity, $lead));
    }

    public function delete(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $table = $this->fetchTable('Tasks');
        $entity = $table->find()->where(['id' => $id])->first();
        if (!$entity) {
            $this->erro('Tarefa não encontrada.', null, 404);
        }
        $table->delete($entity);

        return $this->respond(['removido' => true]);
    }
}
