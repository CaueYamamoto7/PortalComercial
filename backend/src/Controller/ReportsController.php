<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Datasource\ConnectionManager;
use Cake\Http\Response;
use Cake\I18n\DateTime;

class ReportsController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $periodo = (int)($params['periodo'] ?? 0);
        $inicio = $this->inicioPeriodo($periodo);
        $identidade = $this->identidade();
        $escopo = $this->access()->canSeeAllLeads($identidade)
            ? ''
            : ' AND l.responsavel = :responsavel ';
        $paramsEscopo = $this->access()->canSeeAllLeads($identidade)
            ? []
            : ['responsavel' => (string)($identidade['nome'] ?? '')];

        $conn = ConnectionManager::get('default');
        $parametros = ['inicio' => $inicio->format('Y-m-d H:i:s')] + $paramsEscopo;

        $porSistema = $conn->execute(
            'SELECT s.id, s.nome, s.cor, '
            . 'COUNT(DISTINCT l.id) AS total, '
            . "COALESCE(SUM(CASE WHEN st.tipo = 'ganho' THEN 1 ELSE 0 END), 0) AS ganhos, "
            . "COALESCE(SUM(CASE WHEN st.tipo IN ('ganho', 'perdido') THEN 1 ELSE 0 END), 0) AS decididos "
            . 'FROM systems s '
            . 'LEFT JOIN lead_systems ls ON ls.system_id = s.id '
            . 'LEFT JOIN leads l ON l.id = ls.lead_id AND l.deleted_at IS NULL '
            . 'AND l.criado_em >= :inicio ' . $escopo
            . 'LEFT JOIN stages st ON st.id = l.etapa_id '
            . 'WHERE s.ativo = TRUE '
            . 'GROUP BY s.id, s.nome, s.cor '
            . 'HAVING COUNT(DISTINCT l.id) > 0 '
            . 'ORDER BY total DESC',
            $parametros
        )->fetchAll('assoc');

        $porOrigem = $conn->execute(
            'SELECT o.nome, COUNT(DISTINCT l.id) AS total, '
            . "COALESCE(SUM(CASE WHEN st.tipo = 'ganho' THEN 1 ELSE 0 END), 0) AS ganhos "
            . 'FROM sources o '
            . 'INNER JOIN leads l ON l.origem_id = o.id AND l.deleted_at IS NULL '
            . 'AND l.criado_em >= :inicio ' . $escopo
            . 'LEFT JOIN stages st ON st.id = l.etapa_id '
            . 'WHERE o.ativo = TRUE '
            . 'GROUP BY o.id, o.nome '
            . 'HAVING COUNT(DISTINCT l.id) > 0 '
            . 'ORDER BY total DESC',
            $parametros
        )->fetchAll('assoc');

        $porResponsavel = $conn->execute(
            'SELECT l.responsavel AS nome, COUNT(DISTINCT l.id) AS total, '
            . "COALESCE(SUM(CASE WHEN st.tipo = 'ganho' THEN 1 ELSE 0 END), 0) AS ganhos, "
            . "COALESCE(SUM(CASE WHEN st.tipo IN ('ganho', 'perdido') THEN 1 ELSE 0 END), 0) AS decididos "
            . 'FROM leads l '
            . 'LEFT JOIN stages st ON st.id = l.etapa_id '
            . 'WHERE l.deleted_at IS NULL AND l.criado_em >= :inicio ' . $escopo
            . 'GROUP BY l.responsavel '
            . 'HAVING COUNT(DISTINCT l.id) > 0 '
            . 'ORDER BY total DESC',
            $parametros
        )->fetchAll('assoc');

        $motivos = $conn->execute(
            "SELECT COALESCE(NULLIF(l.motivo_perda, ''), 'Não informado') AS label, "
            . 'COUNT(*) AS valor '
            . 'FROM leads l '
            . 'INNER JOIN stages st ON st.id = l.etapa_id AND st.tipo = :tipo '
            . 'WHERE l.deleted_at IS NULL AND l.criado_em >= :inicio ' . $escopo
            . 'GROUP BY COALESCE(NULLIF(l.motivo_perda, \'\'), \'Não informado\') '
            . 'ORDER BY valor DESC',
            $parametros + ['tipo' => 'perdido']
        )->fetchAll('assoc');

        $porEtapa = $conn->execute(
            'SELECT st.id, st.nome, st.cor, COUNT(l.id) AS valor '
            . 'FROM stages st '
            . 'LEFT JOIN leads l ON l.etapa_id = st.id AND l.deleted_at IS NULL '
            . 'AND l.criado_em >= :inicio ' . $escopo
            . 'GROUP BY st.id, st.nome, st.cor, st.ordem '
            . 'ORDER BY st.ordem ASC',
            $parametros
        )->fetchAll('assoc');

        $campanhaEscopo = $this->access()->canSeeAllLeads($identidade)
            ? ''
            : ' AND responsavel = :responsavel ';
        $campanhasRows = $conn->execute(
            'SELECT COUNT(*) AS campanhas, '
            . 'COALESCE(SUM(publico), 0) AS publico, '
            . 'COALESCE(SUM(enviados), 0) AS enviados, '
            . 'COALESCE(SUM(entregues), 0) AS entregues, '
            . 'COALESCE(SUM(falhas), 0) AS falhas '
            . 'FROM campaigns WHERE criada_em >= :inicio ' . $campanhaEscopo,
            $parametros
        )->fetch('assoc');

        $stats = $this->queryService()->stats(['periodo' => $periodo], $identidade);

        return $this->respond([
            'stats' => $stats,
            'porSistema' => array_map(fn ($row) => [
                'id' => (string)$row['id'],
                'nome' => (string)$row['nome'],
                'cor' => (string)$row['cor'],
                'total' => (int)$row['total'],
                'ganhos' => (int)$row['ganhos'],
                'taxa' => (int)$row['decididos'] > 0
                    ? round((int)$row['ganhos'] / (int)$row['decididos'] * 100, 1)
                    : 0,
            ], $porSistema),
            'porOrigem' => array_map(fn ($row) => [
                'nome' => (string)$row['nome'],
                'total' => (int)$row['total'],
                'ganhos' => (int)$row['ganhos'],
            ], $porOrigem),
            'porResponsavel' => array_map(fn ($row) => [
                'nome' => (string)$row['nome'],
                'iniciais' => $this->iniciais((string)$row['nome']),
                'total' => (int)$row['total'],
                'ganhos' => (int)$row['ganhos'],
                'taxa' => (int)$row['decididos'] > 0
                    ? round((int)$row['ganhos'] / (int)$row['decididos'] * 100, 1)
                    : 0,
            ], $porResponsavel),
            'motivos' => array_map(fn ($row) => [
                'label' => (string)$row['label'],
                'valor' => (int)$row['valor'],
            ], $motivos),
            'porEtapa' => array_map(fn ($row) => [
                'id' => (string)$row['id'],
                'nome' => (string)$row['nome'],
                'cor' => (string)$row['cor'],
                'valor' => (int)$row['valor'],
            ], $porEtapa),
            'mensagens' => [
                'publico' => (int)($campanhasRows['publico'] ?? 0),
                'enviados' => (int)($campanhasRows['enviados'] ?? 0),
                'entregues' => (int)($campanhasRows['entregues'] ?? 0),
                'falhas' => (int)($campanhasRows['falhas'] ?? 0),
            ],
            'campanhas' => (int)($campanhasRows['campanhas'] ?? 0),
        ]);
    }

    private function inicioPeriodo(int $periodo): DateTime
    {
        $inicio = new DateTime('today');
        if ($periodo > 0) {
            $inicio = $inicio->subDays($periodo - 1);
        } else {
            $inicio = new DateTime('2000-01-01');
        }

        return $inicio->startOfDay();
    }
}
