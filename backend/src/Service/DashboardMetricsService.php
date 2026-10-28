<?php
declare(strict_types=1);

namespace App\Service;

use Cake\Datasource\ConnectionManager;
use Cake\I18n\DateTime;

/** Agregações do painel: eventos reais e distribuição sem dupla contagem. */
class DashboardMetricsService
{
    /**
     * @param int $periodo Quantidade de dias, validada pelo controller.
     * @param array<string, mixed> $identidade Identidade autenticada.
     * @return array<string, mixed>
     */
    public function obter(int $periodo, array $identidade): array
    {
        $access = new AccessControl();
        $leads = new LeadService();
        $connection = ConnectionManager::get('default');
        $inicio = (new DateTime('today'))->subDays($periodo - 1);
        $fim = new DateTime('tomorrow');
        $params = ['inicio' => $inicio->format('Y-m-d H:i:s'), 'fim' => $fim->format('Y-m-d H:i:s')];
        $escopo = '';
        if (!$access->canSeeAllLeads($identidade)) {
            $escopo = ' AND l.responsavel = :responsavel';
            $params['responsavel'] = (string)($identidade['nome'] ?? '');
        }

        $serie = [];
        for ($dia = $inicio; $dia < $fim; $dia = $dia->addDays(1)) {
            $serie[$dia->format('Y-m-d')] = [
                'data' => $dia->format('Y-m-d'), 'novos' => 0, 'enviadas' => 0, 'recebidas' => 0,
            ];
        }
        $novos = $connection->execute(
            'SELECT DATE(l.criado_em) AS dia, COUNT(*) AS total FROM leads l '
            . 'WHERE l.deleted_at IS NULL AND l.criado_em >= :inicio AND l.criado_em < :fim'
            . $escopo . ' GROUP BY DATE(l.criado_em)',
            $params,
        )->fetchAll('assoc');
        foreach ($novos as $row) {
            if (isset($serie[$row['dia']])) {
                $serie[$row['dia']]['novos'] = (int)$row['total'];
            }
        }
        $mensagens = $connection->execute(
            'SELECT DATE(i.data) AS dia, '
            . "SUM(CASE WHEN i.direcao = 'entrada' THEN 0 ELSE 1 END) AS enviadas, "
            . "SUM(CASE WHEN i.direcao = 'entrada' THEN 1 ELSE 0 END) AS recebidas "
            . 'FROM interactions i INNER JOIN leads l ON l.id = i.lead_id '
            . "WHERE l.deleted_at IS NULL AND i.tipo = 'mensagem' AND i.data >= :inicio AND i.data < :fim"
            . $escopo . ' GROUP BY DATE(i.data)',
            $params,
        )->fetchAll('assoc');
        foreach ($mensagens as $row) {
            if (isset($serie[$row['dia']])) {
                $serie[$row['dia']]['enviadas'] = (int)$row['enviadas'];
                $serie[$row['dia']]['recebidas'] = (int)$row['recebidas'];
            }
        }

        // Agrupa combinações de estado no banco, sem carregar a base inteira.
        $enviadas = 'CASE WHEN l.mensagens_enviadas > 0 THEN 1 ELSE 0 END';
        $recebidas = 'CASE WHEN l.mensagens_recebidas > 0 THEN 1 ELSE 0 END';
        $grupos = $connection->execute(
            'SELECT s.id, s.nome, s.tipo, l.nao_contatar, l.ultima_mensagem_direcao, '
            . "$enviadas AS enviadas, $recebidas AS recebidas, COUNT(*) AS total "
            . 'FROM leads l LEFT JOIN stages s ON s.id = l.etapa_id '
            . 'WHERE l.deleted_at IS NULL AND l.criado_em >= :inicio AND l.criado_em < :fim' . $escopo
            . " GROUP BY s.id, s.nome, s.tipo, l.nao_contatar, l.ultima_mensagem_direcao, $enviadas, $recebidas",
            $params,
        )->fetchAll('assoc');
        $distribuicao = array_fill_keys(
            ['sem_mensagem', 'aguardando', 'responder', 'em_conversa', 'cliente', 'recusado'],
            0,
        );
        foreach ($grupos as $row) {
            $estado = $leads->conversa([
                'naoContatar' => in_array($row['nao_contatar'], [true, 1, '1', 't'], true),
                'mensagensEnviadas' => (int)$row['enviadas'],
                'mensagensRecebidas' => (int)$row['recebidas'],
                'ultimaMensagemDirecao' => $row['ultima_mensagem_direcao'],
            ], ['id' => $row['id'] ?? '', 'nome' => $row['nome'] ?? '', 'tipo' => $row['tipo'] ?? 'aberto']);
            $distribuicao[$estado['status']] += (int)$row['total'];
        }

        return ['serie' => array_values($serie), 'distribuicao' => $distribuicao];
    }
}
