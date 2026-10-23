<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class DashboardController extends AppController
{
    public function index(): Response
    {
        $service = $this->service();
        $leads = $service->todosEnriquecidos();
        $porId = [];
        foreach ($leads as $lead) {
            $porId[$lead['id']] = $lead;
        }

        $tarefas = $this->fetchTable('Tasks')->find()
            ->where(['status' => 'pendente'])
            ->orderBy(['data' => 'ASC'])
            ->all()
            ->toList();

        $abertas = [];
        foreach ($tarefas as $tarefa) {
            $lead = $porId[(string)$tarefa->get('lead_id')] ?? null;
            if (!$lead || ($lead['etapa']['tipo'] ?? 'aberto') !== 'aberto') {
                continue;
            }
            $abertas[] = $this->tarefaEnriquecida($tarefa, $lead);
        }

        $campanhas = $this->fetchTable('Campaigns')->find()
            ->orderBy(['criada_em' => 'DESC'])
            ->limit(4)
            ->all()
            ->toList();

        return $this->respond([
            'periodo' => (string)($this->request->getQuery('periodo') ?? '30'),
            'stats' => $service->stats($leads),
            'conversas' => $service->contagensConversas($leads),
            'tarefas' => array_slice($abertas, 0, 6),
            'tarefasTotal' => count($abertas),
            'campanhas' => array_map(fn ($row) => $this->campanhaOut($row), $campanhas),
        ]);
    }

    public function conversas(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $service = $this->service();
        $todos = $service->todosEnriquecidos();

        $tipo = (string)($params['tipo'] ?? '');
        $filtros = $params;
        unset($filtros['tipo'], $filtros['page'], $filtros['perPage']);
        $leads = $service->filtrar($todos, $filtros);

        $mapa = [
            'sem_mensagem' => fn ($lead) => $lead['conversa']['status'] === 'sem_mensagem',
            'aguardando' => fn ($lead) => $lead['conversa']['status'] === 'aguardando',
            'responder' => fn ($lead) => $lead['conversa']['status'] === 'responder',
            'abertas' => fn ($lead) => $lead['conversa']['conversaAberta'],
            'clientes' => fn ($lead) => $lead['conversa']['status'] === 'cliente',
            'recusados' => fn ($lead) => $lead['conversa']['status'] === 'recusado',
        ];
        if (isset($mapa[$tipo])) {
            $leads = array_values(array_filter($leads, $mapa[$tipo]));
        }

        $ascendente = in_array($tipo, ['responder', 'sem_mensagem'], true);
        usort($leads, function (array $a, array $b) use ($ascendente): int {
            $da = $this->timestampConversa($a);
            $db = $this->timestampConversa($b);

            return $ascendente ? $da <=> $db : $db <=> $da;
        });

        $total = count($leads);
        $pagina = $service->paginar($leads, (int)($params['page'] ?? 1), (int)($params['perPage'] ?? 100));

        return $this->respond([
            'tipo' => $tipo,
            'data' => $service->leadsOut($pagina['data']),
            'meta' => $pagina['meta'],
            'total' => $total,
            'conversas' => $service->contagensConversas($todos),
        ]);
    }

    private function timestampConversa(array $lead): int
    {
        $valor = $lead['conversa']['ultimaMensagemEm'] ?? null;
        if (!$valor) {
            $valor = $lead['criadoEm'] ?? null;
        }

        if ($valor instanceof \DateTimeInterface) {
            return $valor->getTimestamp();
        }

        if (!$valor) {
            return 0;
        }

        $timestamp = strtotime((string)$valor);

        return $timestamp === false ? 0 : $timestamp;
    }
}
