<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class CampaignsController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $service = $this->service();
        $todas = $this->fetchTable('Campaigns')->find()->orderBy(['criada_em' => 'DESC'])->all()->toList();

        $q = $service->normalizar((string)($params['q'] ?? ''));
        $status = (string)($params['status'] ?? '');

        $filtradas = array_values(array_filter($todas, function ($row) use ($q, $status, $service): bool {
            if ($status !== '' && (string)$row->get('status') !== $status) {
                return false;
            }
            if ($q !== '') {
                $alvo = $service->normalizar($row->get('nome') . ' ' . $row->get('mensagem'));
                if (!str_contains($alvo, $q)) {
                    return false;
                }
            }

            return true;
        }));

        $contagens = ['todas' => count($todas), 'concluida' => 0, 'em_andamento' => 0, 'agendada' => 0, 'falha' => 0];
        foreach ($todas as $row) {
            $s = (string)$row->get('status');
            if (array_key_exists($s, $contagens)) {
                $contagens[$s]++;
            }
        }

        $total = count($filtradas);
        $pagina = $service->paginar($filtradas, (int)($params['page'] ?? 1), (int)($params['perPage'] ?? 10));

        return $this->respond([
            'data' => array_map(fn ($row) => $this->campanhaOut($row), $pagina['data']),
            'meta' => $pagina['meta'],
            'contagens' => $contagens,
            'total' => $total,
        ]);
    }

    public function add(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $nome = $this->texto($dados['nome'] ?? '');
        if ($nome === '') {
            $this->erro('Dê um nome para a campanha.', 'nome');
        }
        $mensagem = $this->texto($dados['mensagem'] ?? '');
        if ($mensagem === '') {
            $this->erro('Escreva a mensagem.', 'mensagem');
        }

        $service = $this->service();
        $leads = [];
        foreach ($service->todosEnriquecidos() as $lead) {
            $leads[$lead['id']] = $lead;
        }

        $leadIds = [];
        foreach ($this->lista($dados['leadIds'] ?? []) as $id) {
            $lead = $leads[$id] ?? null;
            if (!$lead || $lead['naoContatar'] || ($lead['etapa']['tipo'] ?? 'aberto') !== 'aberto') {
                continue;
            }
            $leadIds[] = $id;
        }
        if (!$leadIds) {
            $this->erro('Selecione pelo menos um lead que aceite receber mensagens.', 'leads');
        }

        $agora = $this->agora();
        $agendada = $this->data($dados['agendadaPara'] ?? null);
        $status = $agendada && $agendada > $agora ? 'agendada' : 'concluida';
        $falhas = $status === 'concluida' ? min(1, (int)floor(count($leadIds) * 0.03)) : 0;
        $enviados = $status === 'concluida' ? count($leadIds) : 0;

        $table = $this->fetchTable('Campaigns');
        $entity = $table->newEntity([
            'nome' => $nome,
            'template_id' => $this->texto($dados['templateId'] ?? '') ?: null,
            'mensagem' => $mensagem,
            'status' => $status,
            'canal' => 'WhatsApp',
            'lead_ids' => array_values($leadIds),
            'publico' => count($leadIds),
            'enviados' => $enviados,
            'entregues' => $status === 'concluida' ? count($leadIds) - $falhas : 0,
            'falhas' => $falhas,
            'criada_em' => $agora,
            'agendada_para' => $status === 'agendada' ? $agendada : null,
            'responsavel' => $this->usuarioNome(),
        ]);
        $table->saveOrFail($entity);

        if ($status === 'concluida') {
            $leadsTable = $this->fetchTable('Leads');
            foreach ($leadIds as $leadId) {
                $lead = $leadsTable->find()->where(['id' => $leadId])->first();
                if (!$lead) {
                    continue;
                }
                $lead->set('ultimo_contato', $agora);
                $lead->set('atualizado_em', $agora);
                $leadsTable->saveOrFail($lead);
                $this->registrarInteracao(
                    $leadId,
                    'mensagem',
                    'Mensagem enviada — ' . $nome,
                    'Mensagem enviada por WhatsApp na campanha “' . $nome . '”.',
                    (string)$entity->get('responsavel'),
                    $agora,
                    'WhatsApp',
                    'saida'
                );
            }
            $service->invalidar();
        }

        return $this->respond($this->campanhaOut($entity), 201);
    }

    public function individual(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $leadId = $this->texto($dados['leadId'] ?? '');
        $lead = $this->fetchTable('Leads')->find()->where(['id' => $leadId])->first();
        if (!$lead) {
            $this->erro('Lead não encontrado.', null, 404);
        }
        if ($lead->get('nao_contatar')) {
            $this->erro('Este lead está marcado como “não contatar”.', 'lead');
        }

        $etapa = $this->fetchTable('Stages')->find()->where(['id' => $lead->get('etapa_id')])->first();
        if ($etapa && $etapa->get('tipo') === 'perdido') {
            $this->erro('Esta oportunidade foi encerrada como perdida. Reative o contato antes de enviar mensagens.', 'lead');
        }

        $mensagem = $this->texto($dados['mensagem'] ?? '');
        if ($mensagem === '') {
            $this->erro('Escreva a mensagem.', 'mensagem');
        }

        $agora = $this->agora();
        $interacao = $this->registrarInteracao(
            $leadId,
            'mensagem',
            'Mensagem individual enviada',
            $mensagem,
            $this->usuarioNome(),
            $agora,
            'WhatsApp',
            'saida'
        );

        $lead->set('ultimo_contato', $agora);
        $lead->set('atualizado_em', $agora);
        $this->fetchTable('Leads')->saveOrFail($lead);
        $this->service()->invalidar();

        return $this->respond($interacao, 201);
    }

    public function cancelar(string $id): Response
    {
        $this->request->allowMethod(['post']);
        $table = $this->fetchTable('Campaigns');
        $entity = $table->find()->where(['id' => $id])->first();
        if (!$entity) {
            $this->erro('Campanha não encontrada.', null, 404);
        }
        if (!in_array((string)$entity->get('status'), ['agendada', 'em_andamento'], true)) {
            $this->erro('Esta campanha não pode mais ser cancelada.');
        }

        $entity->set('status', 'cancelada');
        $table->saveOrFail($entity);

        return $this->respond($this->campanhaOut($entity));
    }
}
