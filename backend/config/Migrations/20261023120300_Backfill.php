<?php
declare(strict_types=1);

use Cake\Datasource\ConnectionManager;
use Migrations\BaseMigration;

/**
 * Copia dados existentes para as novas estruturas.
 *
 * O backfill é idempotente: pode ser executado novamente sem duplicar
 * relações nem campanhas. As colunas JSON originais não são alteradas.
 */
class Backfill extends BaseMigration
{
    public function up(): void
    {
        $conn = ConnectionManager::get('default');
        $isPostgres = $conn->getDriver() instanceof \Cake\Database\Driver\Postgres;
        $agora = date('Y-m-d H:i:s');

        // Papéis derivados do perfil exibido.
        $conn->execute("UPDATE users SET role = 'admin' WHERE LOWER(perfil) LIKE '%admin%'");
        $conn->execute("UPDATE users SET role = 'gestor' WHERE LOWER(perfil) LIKE '%gestor%' AND role <> 'admin'");
        $conn->execute("UPDATE users SET role = 'consultor' WHERE role IS NULL OR role = ''");

        $sistemas = [];
        foreach ($conn->execute('SELECT id, nome FROM systems')->fetchAll('assoc') as $row) {
            $sistemas[(string)$row['id']] = (string)$row['nome'];
        }

        $offset = 0;
        $limite = 500;
        do {
            $rows = $conn->execute(
                'SELECT id, nome, empresa, cargo, telefone, email, cidade, uf, origem_detalhe, '
                . 'responsavel, observacoes, tags, sistema_ids FROM leads '
                . 'ORDER BY id LIMIT ' . $limite . ' OFFSET ' . $offset
            )->fetchAll('assoc');

            foreach ($rows as $row) {
                $leadId = (string)$row['id'];
                $tags = $this->listaJson($row['tags'] ?? null);
                $sistemaIds = $this->listaJson($row['sistema_ids'] ?? null);
                $nomesSistemas = [];
                foreach ($sistemaIds as $sid) {
                    if (isset($sistemas[$sid])) {
                        $nomesSistemas[] = $sistemas[$sid];
                    }
                }

                $busca = $this->normalizar(implode(' ', [
                    (string)($row['nome'] ?? ''),
                    (string)($row['empresa'] ?? ''),
                    (string)($row['cargo'] ?? ''),
                    (string)($row['telefone'] ?? ''),
                    preg_replace('/\D+/', '', (string)($row['telefone'] ?? '')) ?? '',
                    (string)($row['email'] ?? ''),
                    (string)($row['cidade'] ?? ''),
                    (string)($row['uf'] ?? ''),
                    (string)($row['responsavel'] ?? ''),
                    (string)($row['observacoes'] ?? ''),
                    (string)($row['origem_detalhe'] ?? ''),
                    implode(' ', $tags),
                    implode(' ', $nomesSistemas),
                ]));
                $conn->execute('UPDATE leads SET busca = :busca WHERE id = :id', [
                    'busca' => $busca,
                    'id' => $leadId,
                ]);

                $conn->execute("DELETE FROM lead_systems WHERE lead_id = :id", ['id' => $leadId]);
                foreach (array_unique($sistemaIds) as $sid) {
                    if ($sid === '') {
                        continue;
                    }
                    $this->insertIgnore($conn, $isPostgres, 'lead_systems', [
                        'lead_id' => $leadId,
                        'system_id' => $sid,
                    ]);
                }

                $conn->execute("DELETE FROM lead_tags WHERE lead_id = :id", ['id' => $leadId]);
                foreach (array_unique($tags) as $tag) {
                    if ($tag === '') {
                        continue;
                    }
                    $this->insertIgnore($conn, $isPostgres, 'lead_tags', [
                        'lead_id' => $leadId,
                        'tag' => mb_substr($tag, 0, 60),
                    ]);
                }
            }

            $offset += count($rows);
        } while (count($rows) === $limite);

        // Contadores de conversa por lead.
        $mensagens = $conn->execute(
            "SELECT lead_id, "
            . "SUM(CASE WHEN direcao = 'entrada' THEN 1 ELSE 0 END) AS recebidas, "
            . "SUM(CASE WHEN direcao = 'entrada' THEN 0 ELSE 1 END) AS enviadas, "
            . "MAX(data) AS ultima "
            . "FROM interactions WHERE tipo = 'mensagem' GROUP BY lead_id"
        )->fetchAll('assoc');

        foreach ($mensagens as $row) {
            $leadId = (string)$row['lead_id'];
            $ultima = $row['ultima'] ?? null;
            $direcao = null;
            if ($ultima) {
                $ultimaRow = $conn->execute(
                    'SELECT direcao FROM interactions WHERE tipo = :tipo AND lead_id = :lead ORDER BY data DESC LIMIT 1',
                    ['tipo' => 'mensagem', 'lead' => $leadId]
                )->fetch('assoc');
                $direcao = $ultimaRow['direcao'] ?? null;
            }
            $conn->execute(
                'UPDATE leads SET mensagens_enviadas = :enviadas, mensagens_recebidas = :recebidas, '
                . 'ultima_mensagem_em = :ultima, ultima_mensagem_direcao = :direcao WHERE id = :id',
                [
                    'enviadas' => (int)$row['enviadas'],
                    'recebidas' => (int)$row['recebidas'],
                    'ultima' => $ultima,
                    'direcao' => $direcao,
                    'id' => $leadId,
                ]
            );
        }

        // Destinatários das campanhas existentes.
        $campanhas = $conn->execute('SELECT id, status, lead_ids FROM campaigns')->fetchAll('assoc');
        foreach ($campanhas as $campanha) {
            $campaignId = (string)$campanha['id'];
            $status = (string)$campanha['status'];
            $statusRecipient = $status === 'concluida' ? 'enviado' : ($status === 'falha' ? 'falha' : 'pendente');
            foreach ($this->listaJson($campanha['lead_ids'] ?? null) as $leadId) {
                $this->insertIgnore($conn, $isPostgres, 'campaign_recipients', [
                    'id' => 'rc_' . substr(hash('sha256', $campaignId . ':' . $leadId), 0, 24),
                    'campaign_id' => $campaignId,
                    'lead_id' => $leadId,
                    'status' => $statusRecipient,
                    'mensagem' => null,
                    'erro' => null,
                    'enviado_em' => null,
                    'criado_em' => $agora,
                ]);
            }
        }
    }

    public function down(): void
    {
        // O backfill não remove dados originais; não há o que desfazer.
    }

    private function insertIgnore($conn, bool $isPostgres, string $table, array $data): void
    {
        $colunas = array_keys($data);
        $placeholders = [];
        foreach ($colunas as $indice => $coluna) {
            $placeholders[] = ':' . $coluna;
        }
        $sql = 'INSERT INTO ' . $table . ' (' . implode(', ', $colunas) . ') VALUES ('
            . implode(', ', $placeholders) . ')';
        if ($isPostgres) {
            $sql .= ' ON CONFLICT DO NOTHING';
        } else {
            $sql = str_replace('INSERT INTO', 'INSERT OR IGNORE INTO', $sql);
        }
        $conn->execute($sql, $data);
    }

    /** @return array<int, string> */
    private function listaJson(mixed $valor): array
    {
        if (is_string($valor)) {
            $decodificado = json_decode($valor, true);
            $valor = is_array($decodificado) ? $decodificado : preg_split('/\s*[,;|]\s*/', $valor);
        }
        if (!is_array($valor)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn ($item) => trim((string)$item),
            $valor
        ), fn ($item) => $item !== ''));
    }

    private function normalizar(string $valor): string
    {
        $valor = trim(mb_strtolower($valor));
        if ($valor === '') {
            return '';
        }
        if (class_exists('Normalizer')) {
            $norm = \Normalizer::normalize($valor, \Normalizer::FORM_D);
            if ($norm !== false) {
                $valor = preg_replace('/\p{Mn}+/u', '', $norm) ?? $valor;
            }
        }
        $valor = preg_replace('/\s+/', ' ', $valor) ?? $valor;

        return $valor;
    }
}
