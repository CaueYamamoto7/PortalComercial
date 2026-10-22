<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class PipelineController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $service = $this->service();
        $leads = $service->filtrar($service->todosEnriquecidos(), $params);

        $ordemPrioridade = ['alta' => 0, 'media' => 1, 'baixa' => 2];
        $etapas = [];
        $total = 0;
        foreach ($service->catalogo()['etapas'] as $etapa) {
            $daEtapa = array_values(array_filter($leads, fn ($lead) => $lead['etapaId'] === $etapa['id']));
            usort($daEtapa, fn ($a, $b) => ($ordemPrioridade[$a['prioridade']] ?? 9) <=> ($ordemPrioridade[$b['prioridade']] ?? 9));
            $etapa['leads'] = $service->leadsOut($daEtapa);
            $etapa['total'] = count($daEtapa);
            $total += $etapa['total'];
            $etapas[] = $etapa;
        }

        return $this->respond([
            'etapas' => $etapas,
            'total' => $total,
            'facets' => $service->facets(),
        ]);
    }
}
