<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\SettingsService;
use Cake\Datasource\ConnectionManager;
use Cake\Http\Response;

class CampaignsController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $table = $this->fetchTable('Campaigns');

        $base = $table->find();
        if (!$this->access()->canSeeAllLeads($this->identidade())) {
            $base->where(['responsavel' => $this->usuarioNome()]);
        }
        $query = clone $base;
        $status = (string)($params['status'] ?? '');
        if ($status !== '') {
            $query->where(['status' => $status]);
        }
        $q = trim((string)($params['q'] ?? ''));
        if ($q !== '') {
            $query->where(['OR' => [
                'nome LIKE' => '%' . $q . '%',
                'mensagem LIKE' => '%' . $q . '%',
            ]]);
        }

        $total = (clone $query)->count();
        $perPage = $this->perPage($params['perPage'] ?? 10, 10);
        $page = max(1, (int)($params['page'] ?? 1));
        $paginas = max(1, (int)ceil($total / $perPage));
        $page = min($page, $paginas);

        $rows = $query
            ->orderBy(['criada_em' => 'DESC'])
            ->limit($perPage)
            ->offset(($page - 1) * $perPage)
            ->all()
            ->toList();

        $contagens = ['todas' => (clone $base)->count()];
        $grupos = (clone $base)
            ->select(['status', 'total' => $table->find()->func()->count('id')])
            ->groupBy(['status'])
            ->all();
        foreach ($grupos as $grupo) {
            $contagens[(string)$grupo->get('status')] = (int)$grupo->get('total');
        }

        return $this->respond([
            'data' => array_map(fn ($row) => $this->campanhaOut($row), $rows),
            'meta' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'paginas' => $paginas,
            ],
            'contagens' => $contagens,
            'total' => $total,
        ]);
    }

    /** Prévia do público, sem carregar todos os leads. */
    public function publico(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();
        $filtros = (array)($dados['filtros'] ?? []);
        $leadIds = $this->lista($dados['leadIds'] ?? []);
        if ($leadIds) {
            $filtros['ids'] = implode(',', $leadIds);
        }

        $audiencia = $this->queryService()->audienciaQuery($filtros, $this->identidade());
        $total = (clone $audiencia)->count();
        $limite = (int)((new SettingsService())->mensagens()['maxCampanha'] ?? 5000);
        $limitado = $total > $limite;
        $totalFiltrado = $this->queryService()->baseQuery($filtros, $this->identidade())->count();
        $amostra = (clone $audiencia)->orderBy(['Leads.id' => 'ASC'])->limit(20)->all()->toList();
        $leads = [];
        foreach ($amostra as $row) {
            $lead = $this->service()->enriquecer($this->service()->leadBaseOut($row));
            $leads[] = [
                'id' => $lead['id'],
                'nome' => $lead['nome'],
                'empresa' => $lead['empresa'],
                'telefone' => $lead['telefone'],
                'sistemasNomes' => $lead['sistemasNomes'],
            ];
        }

        return $this->respond([
            'total' => $total,
            'limitado' => $limitado,
            'limite' => $limite,
            'bloqueados' => $limitado ? null : max(0, $totalFiltrado - $total),
            'amostra' => $leads,
        ]);
    }

    public function view(string $id): Response
    {
        $query = $this->fetchTable('Campaigns')->find()->where(['id' => $id]);
        if (!$this->access()->canSeeAllLeads($this->identidade())) {
            $query->where(['responsavel' => (string)($this->identidade()['nome'] ?? '')]);
        }
        $entity = $query->first();
        if (!$entity) {
            $this->erro('Campanha não encontrada.', null, 404);
        }

        return $this->respond($this->campanhaOut($entity));
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

        $filtros = (array)($dados['filtros'] ?? []);
        $leadIds = $this->lista($dados['leadIds'] ?? []);
        if ($leadIds) {
            $filtros['ids'] = implode(',', $leadIds);
        } elseif (!$filtros) {
            $this->erro('Selecione o público da campanha.', 'leads');
        }

        $limite = (int)((new SettingsService())->mensagens()['maxCampanha'] ?? 5000);
        $linhas = $this->queryService()->audiencia($filtros, $this->identidade(), $limite + 1);
        if (!$linhas) {
            $this->erro('Nenhum lead elegível para esta campanha.', 'leads');
        }
        if (count($linhas) > $limite) {
            $this->erro('O público máximo por campanha é ' . $limite . ' leads.', 'leads');
        }

        $templateId = $this->texto($dados['templateId'] ?? '') ?: null;
        if ($templateId) {
            $template = $this->fetchTable('Templates')->find()->where(['id' => $templateId])->first();
            if (!$template) {
                $this->erro('Template inválido.', 'templateId');
            }
        }

        $agora = $this->agora();
        $agendada = $this->data($dados['agendadaPara'] ?? null);
        $table = $this->fetchTable('Campaigns');
        $entity = $table->newEntity([
            'nome' => $nome,
            'template_id' => $templateId,
            'mensagem' => $mensagem,
            // Sem integração real de WhatsApp, o status honesto é "registrada".
            'status' => 'registrada',
            'canal' => 'WhatsApp',
            'lead_ids' => array_values(array_map(fn ($row) => (string)$row->get('id'), $linhas)),
            'publico' => count($linhas),
            'enviados' => 0,
            'entregues' => 0,
            'falhas' => 0,
            'criada_em' => $agora,
            'agendada_para' => $agendada,
            'responsavel' => $this->usuarioNome(),
        ]);

        $conn = ConnectionManager::get('default');
        $conn->begin();
        try {
            $table->saveOrFail($entity);
            $campaignId = (string)$entity->get('id');

            foreach ($linhas as $row) {
                $lead = $this->service()->enriquecer($this->service()->leadBaseOut($row));
                $texto = $this->renderizarMensagem($mensagem, $lead);
                $conn->execute(
                    'INSERT INTO campaign_recipients '
                    . '(id, campaign_id, lead_id, status, mensagem, erro, enviado_em, criado_em) '
                    . 'VALUES (:id, :campaign_id, :lead_id, :status, :mensagem, NULL, NULL, :criado_em)',
                    [
                        'id' => 'rc_' . bin2hex(random_bytes(8)),
                        'campaign_id' => $campaignId,
                        'lead_id' => (string)$lead['id'],
                        'status' => 'pendente',
                        'mensagem' => $texto,
                        'criado_em' => $agora->format('Y-m-d H:i:s'),
                    ]
                );
            }

            $conn->commit();
        } catch (\Throwable $e) {
            $conn->rollback();
            throw $e;
        }

        $this->registroAuditoria('campanha.criar', 'campaign', (string)$entity->get('id'), [
            'publico' => count($linhas),
            'status' => 'registrada',
        ]);

        return $this->respond($this->campanhaOut($entity), 201);
    }

    public function individual(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $leadId = $this->texto($dados['leadId'] ?? '');
        $lead = $this->queryService()->findLead($leadId, $this->identidade());
        if (!$lead) {
            $this->erro('Lead não encontrado.', null, 404);
        }
        if ($lead['naoContatar']) {
            $this->erro('Este lead está marcado como “não contatar”.', 'lead');
        }
        if (($lead['etapa']['tipo'] ?? 'aberto') === 'perdido') {
            $this->erro('Esta oportunidade foi encerrada como perdida. Reative o contato antes de enviar mensagens.', 'lead');
        }

        $mensagem = $this->texto($dados['mensagem'] ?? '');
        if ($mensagem === '') {
            $this->erro('Escreva a mensagem.', 'mensagem');
        }

        $phone = \App\Service\OutreachPolicy::phone($lead['telefone']);
        if (!preg_match('/^[1-9]\d{9,14}$/', $phone)) {
            $this->erro('Telefone inválido.', 'telefone');
        }
        ConnectionManager::get('default')->execute(
            "UPDATE wa_outreach SET status = 'manual', updated_at = :now "
                . "WHERE lead_id = :id AND status IN ('queued', 'waiting', 'scheduled', 'uncertain')",
            ['now' => time(), 'id' => $leadId]
        );
        try {
            (new \App\Service\WhatsAppGateway())->request('/cancel', ['phone' => $phone]);
        } catch (\Throwable) {
            // Manual use of the official app remains available while disconnected.
        }
        $this->registroAuditoria('mensagem.abrir_whatsapp', 'lead', $leadId);

        return $this->respond([
            'url' => 'https://wa.me/' . $phone . '?text=' . rawurlencode($this->renderizarMensagem($mensagem, $lead)),
            'status' => 'manual',
        ]);
    }

    public function cancelar(string $id): Response
    {
        $this->request->allowMethod(['post']);
        $table = $this->fetchTable('Campaigns');
        $query = $table->find()->where(['id' => $id]);
        if (!$this->access()->canSeeAllLeads($this->identidade())) {
            $query->where(['responsavel' => $this->usuarioNome()]);
        }
        $entity = $query->first();
        if (!$entity) {
            $this->erro('Campanha não encontrada.', null, 404);
        }
        if (!in_array((string)$entity->get('status'), ['registrada', 'agendada', 'em_andamento'], true)) {
            $this->erro('Esta campanha não pode mais ser cancelada.');
        }

        $entity->set('status', 'cancelada');
        $table->saveOrFail($entity);
        ConnectionManager::get('default')->execute(
            "UPDATE campaign_recipients SET status = 'cancelado' WHERE campaign_id = :id AND status = 'pendente'",
            ['id' => $id]
        );
        $this->registroAuditoria('campanha.cancelar', 'campaign', $id);

        return $this->respond($this->campanhaOut($entity));
    }

    /** @param array<string, mixed> $lead */
    private function renderizarMensagem(string $conteudo, array $lead): string
    {
        return (string)preg_replace_callback(
            '/\{\{\s*([a-z_]+)\s*\}\}/i',
            function (array $m) use ($lead): string {
                $chave = mb_strtolower($m[1]);
                $valor = match ($chave) {
                    'primeiro_nome' => explode(' ', trim((string)$lead['nome']))[0] ?? '',
                    'sistema_interesse' => implode(', ', $lead['sistemasNomes'] ?? []) ?: 'nossos sistemas',
                    'telefone' => (string)$lead['telefone'],
                    'nome' => (string)$lead['nome'],
                    'empresa' => (string)$lead['empresa'],
                    'cargo' => (string)$lead['cargo'],
                    'cidade' => (string)$lead['cidade'],
                    'email' => (string)$lead['email'],
                    'responsavel' => (string)$lead['responsavel'],
                    default => '',
                };

                return $valor !== '' ? $valor : $m[0];
            },
            $conteudo
        );
    }
}
