<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\SettingsService;
use Cake\Http\Response;

class PipelineController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        unset($params['etapa']);
        $identidade = $this->identidade();
        $limite = (int)((new SettingsService())->mensagens()['maxPipeline'] ?? 2000);

        $query = $this->queryService()->baseQuery($params, $identidade);
        $total = (clone $query)->count();
        $rows = $query
            ->orderBy(['Leads.atualizado_em' => 'DESC'])
            ->limit($limite)
            ->all()
            ->toList();

        $leads = [];
        foreach ($rows as $row) {
            $lead = $this->service()->leadOut(
                $this->service()->enriquecer($this->service()->leadBaseOut($row))
            );
            $leads[$lead['id']] = $lead;
        }

        $ordemPrioridade = ['alta' => 0, 'media' => 1, 'baixa' => 2];
        $etapas = [];
        $carregados = 0;
        foreach ($this->service()->catalogo()['etapas'] as $etapa) {
            $daEtapa = array_values(array_filter($leads, fn ($lead) => $lead['etapaId'] === $etapa['id']));
            usort($daEtapa, fn ($a, $b) => ($ordemPrioridade[$a['prioridade']] ?? 9) <=> ($ordemPrioridade[$b['prioridade']] ?? 9));
            $etapa['leads'] = $daEtapa;
            $etapa['total'] = count($daEtapa);
            $carregados += $etapa['total'];
            $etapas[] = $etapa;
        }

        return $this->respond([
            'etapas' => $etapas,
            'total' => $total,
            'carregados' => $carregados,
            'truncado' => $total > $limite,
            'facets' => $this->queryService()->facets($params, $identidade),
        ]);
    }
}
