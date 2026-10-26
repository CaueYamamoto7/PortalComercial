<?php
declare(strict_types=1);

use Cake\Datasource\ConnectionManager;
use Migrations\BaseMigration;

/**
 * Guarda o texto da última mensagem do lead para exibir a prévia no painel.
 *
 * A coluna é aditiva e nullable. O backfill percorre os leads em lotes para
 * não bloquear a tabela por muito tempo em produção e usa a interação de
 * mensagem mais recente de cada lead, sem alterar as interações existentes.
 */
class UltimaMensagemTexto extends BaseMigration
{
    private const LOTE = 500;

    /**
     * Adiciona a coluna e preenche os leads existentes com a última mensagem.
     */
    public function up(): void
    {
        $this->table('leads')
            ->addColumn('ultima_mensagem_texto', 'text', ['null' => true])
            ->update();

        $conn = ConnectionManager::get('default');
        $ultimoId = '';

        do {
            $rows = $conn->execute(
                'SELECT DISTINCT lead_id FROM interactions '
                . "WHERE tipo = 'mensagem' AND lead_id > :ultimo "
                . 'ORDER BY lead_id LIMIT ' . self::LOTE,
                ['ultimo' => $ultimoId],
            )->fetchAll('assoc');

            $processados = count($rows);

            foreach ($rows as $row) {
                $leadId = (string)($row['lead_id'] ?? '');
                if ($leadId === '') {
                    continue;
                }

                $conn->execute(
                    'UPDATE leads SET ultima_mensagem_texto = ('
                    . 'SELECT COALESCE(NULLIF(i.descricao, \'\'), i.titulo) '
                    . 'FROM interactions i '
                    . "WHERE i.lead_id = :lead_id AND i.tipo = 'mensagem' "
                    . 'ORDER BY i.data DESC, i.id DESC LIMIT 1'
                    . ') WHERE id = :id',
                    ['lead_id' => $leadId, 'id' => $leadId],
                );

                $ultimoId = $leadId;
            }
        } while ($processados === self::LOTE);
    }

    /**
     * Remove a coluna de prévia da última mensagem.
     */
    public function down(): void
    {
        $this->table('leads')
            ->removeColumn('ultima_mensagem_texto')
            ->update();
    }
}
