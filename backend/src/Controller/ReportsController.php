<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;
use Cake\I18n\DateTime;

class ReportsController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $service = $this->service();
        $periodo = (int)($params['periodo'] ?? 0);
        $inicio = $this->inicioPeriodo($periodo);

        $todos = $service->todosEnriquecidos();
        $leads = array_values(array_filter($todos, function (array $lead) use ($inicio): bool {
            if ($lead['criadoEm'] === null) {
                return false;
            }
            $criado = new DateTime($lead['criadoEm']->format('Y-m-d H:i:s'));

            return $criado >= $inicio;
        }));

        $cat = $service->catalogo();

        $porSistema = [];
        foreach ($cat['sistemas'] as $sistema) {
            if (!$sistema['ativo']) {
                continue;
            }
            $doSistema = array_values(array_filter(
                $leads,
                fn (array $lead) => in_array($sistema['id'], $lead['sistemaIds'], true)
            ));
            $ganhos = 0;
            $decididos = 0;
            foreach ($doSistema as $lead) {
                $tipo = $lead['etapa']['tipo'] ?? 'aberto';
                if ($tipo === 'ganho') {
                    $ganhos++;
                }
                if (in_array($tipo, ['ganho', 'perdido'], true)) {
                    $decididos++;
                }
            }
            $porSistema[] = [
                'id' => $sistema['id'],
                'nome' => $sistema['nome'],
                'cor' => $sistema['cor'],
                'total' => count($doSistema),
                'ganhos' => $ganhos,
                'taxa' => $decididos > 0 ? round($ganhos / $decididos * 100, 1) : 0,
            ];
        }
        usort($porSistema, fn ($a, $b) => $b['total'] <=> $a['total']);

        $porOrigem = [];
        foreach ($cat['origens'] as $origem) {
            if (!$origem['ativo']) {
                continue;
            }
            $daOrigem = array_values(array_filter(
                $leads,
                fn (array $lead) => $lead['origemId'] === $origem['id']
            ));
            $porOrigem[] = [
                'nome' => $origem['nome'],
                'total' => count($daOrigem),
                'ganhos' => count(array_filter(
                    $daOrigem,
                    fn (array $lead) => ($lead['etapa']['tipo'] ?? 'aberto') === 'ganho'
                )),
            ];
        }
        $porOrigem = array_values(array_filter($porOrigem, fn ($item) => $item['total'] > 0));
        usort($porOrigem, fn ($a, $b) => $b['total'] <=> $a['total']);

        $porResponsavel = [];
        foreach ($cat['equipe'] as $membro) {
            if ($membro['status'] !== 'ativo') {
                continue;
            }
            $doResponsavel = array_values(array_filter(
                $leads,
                fn (array $lead) => $lead['responsavel'] === $membro['nome']
            ));
            $ganhos = 0;
            $decididos = 0;
            foreach ($doResponsavel as $lead) {
                $tipo = $lead['etapa']['tipo'] ?? 'aberto';
                if ($tipo === 'ganho') {
                    $ganhos++;
                }
                if (in_array($tipo, ['ganho', 'perdido'], true)) {
                    $decididos++;
                }
            }
            $porResponsavel[] = [
                'nome' => $membro['nome'],
                'iniciais' => $membro['iniciais'],
                'total' => count($doResponsavel),
                'ganhos' => $ganhos,
                'taxa' => $decididos > 0 ? round($ganhos / $decididos * 100, 1) : 0,
            ];
        }
        usort($porResponsavel, fn ($a, $b) => $b['total'] <=> $a['total']);

        $motivos = [];
        foreach ($leads as $lead) {
            if (($lead['etapa']['tipo'] ?? 'aberto') !== 'perdido') {
                continue;
            }
            $motivo = $lead['motivoPerda'] !== '' ? $lead['motivoPerda'] : 'Não informado';
            $motivos[$motivo] = ($motivos[$motivo] ?? 0) + 1;
        }
        $motivosLista = [];
        foreach ($motivos as $label => $valor) {
            $motivosLista[] = ['label' => $label, 'valor' => $valor];
        }
        usort($motivosLista, fn ($a, $b) => $b['valor'] <=> $a['valor']);

        $porEtapa = [];
        foreach ($cat['etapas'] as $etapa) {
            $porEtapa[] = [
                'id' => $etapa['id'],
                'nome' => $etapa['nome'],
                'cor' => $etapa['cor'],
                'valor' => count(array_filter($leads, fn (array $lead) => $lead['etapaId'] === $etapa['id'])),
            ];
        }

        $campanhasRows = $this->fetchTable('Campaigns')->find()->all()->toList();
        $mensagens = ['publico' => 0, 'enviados' => 0, 'entregues' => 0, 'falhas' => 0];
        $campanhas = 0;
        foreach ($campanhasRows as $campanha) {
            $criada = $campanha->get('criada_em');
            if (!$criada) {
                continue;
            }
            $data = new DateTime($criada->format('Y-m-d H:i:s'));
            if ($data < $inicio) {
                continue;
            }
            $campanhas++;
            $mensagens['publico'] += (int)$campanha->get('publico');
            $mensagens['enviados'] += (int)$campanha->get('enviados');
            $mensagens['entregues'] += (int)$campanha->get('entregues');
            $mensagens['falhas'] += (int)$campanha->get('falhas');
        }

        return $this->respond([
            'stats' => $service->stats($leads),
            'porSistema' => $porSistema,
            'porOrigem' => $porOrigem,
            'porResponsavel' => $porResponsavel,
            'motivos' => $motivosLista,
            'porEtapa' => $porEtapa,
            'mensagens' => $mensagens,
            'campanhas' => $campanhas,
        ]);
    }

    private function inicioPeriodo(int $periodo): DateTime
    {
        $dias = $periodo > 0 ? $periodo : 10000;
        $inicio = new DateTime('today');
        if ($dias < 10000) {
            $inicio = $inicio->subDays($dias - 1);
        }

        return $inicio->startOfDay();
    }
}
