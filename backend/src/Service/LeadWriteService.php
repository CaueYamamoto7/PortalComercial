<?php
declare(strict_types=1);

namespace App\Service;

use Cake\Datasource\ConnectionManager;
use Cake\I18n\DateTime;
use Cake\ORM\Locator\LocatorAwareTrait;

/**
 * Escritas de leads com escrita dupla nas relações e manutenção dos
 * contadores denormalizados de conversa.
 */
class LeadWriteService
{
    use LocatorAwareTrait;

    public function __construct(
        private readonly AccessControl $access = new AccessControl()
    ) {
    }

    /** @param array<string, mixed> $campos @param array<string, mixed> $identidade */
    public function criar(array $campos, array $identidade): object
    {
        $table = $this->fetchTable('Leads');
        $entity = $table->newEntity($campos);
        $table->saveOrFail($entity);

        $this->sincronizarRelacoes(
            (string)$entity->get('id'),
            (array)($entity->get('sistema_ids') ?? []),
            (array)($entity->get('tags') ?? [])
        );

        return $entity;
    }

    /** @param array<string, mixed> $campos @param array<string, mixed> $identidade */
    public function atualizar(object $entity, array $campos, array $identidade): object
    {
        $table = $this->fetchTable('Leads');
        $table->patchEntity($entity, $campos);
        $table->saveOrFail($entity);

        $this->sincronizarRelacoes(
            (string)$entity->get('id'),
            (array)($entity->get('sistema_ids') ?? []),
            (array)($entity->get('tags') ?? [])
        );

        return $entity;
    }

    public function softDelete(string $id, array $identidade): void
    {
        $this->fetchTable('Leads')->updateAll(
            ['deleted_at' => new DateTime(), 'atualizado_em' => new DateTime()],
            ['id' => $id, 'deleted_at IS' => null]
        );
    }

    /** @param array<int, mixed> $sistemaIds @param array<int, mixed> $tags */
    public function sincronizarRelacoes(string $leadId, array $sistemaIds, array $tags): void
    {
        try {
            $conn = ConnectionManager::get('default');
            $conn->execute('DELETE FROM lead_systems WHERE lead_id = :id', ['id' => $leadId]);
            $conn->execute('DELETE FROM lead_tags WHERE lead_id = :id', ['id' => $leadId]);

            $vistos = [];
            foreach ($sistemaIds as $sistemaId) {
                $sistemaId = trim((string)$sistemaId);
                if ($sistemaId === '' || isset($vistos[$sistemaId])) {
                    continue;
                }
                $vistos[$sistemaId] = true;
                $conn->execute(
                    'INSERT INTO lead_systems (lead_id, system_id) VALUES (:lead_id, :system_id)',
                    ['lead_id' => $leadId, 'system_id' => $sistemaId]
                );
            }

            $vistos = [];
            foreach ($tags as $tag) {
                $tag = mb_substr(trim((string)$tag), 0, 60);
                if ($tag === '' || isset($vistos[$tag])) {
                    continue;
                }
                $vistos[$tag] = true;
                $conn->execute(
                    'INSERT INTO lead_tags (lead_id, tag) VALUES (:lead_id, :tag)',
                    ['lead_id' => $leadId, 'tag' => $tag]
                );
            }
        } catch (\Throwable) {
            // A escrita principal (JSON) não deve falhar por causa da cópia.
        }
    }

    /**
     * Recalcula contadores a partir das interações. Chamado após registrar
     * mensagens; mantém o JSON legado intacto.
     */
    public function atualizarContadores(string $leadId): void
    {
        try {
            $conn = ConnectionManager::get('default');
            $resumo = $conn->execute(
                "SELECT COUNT(*) AS total, "
                . "SUM(CASE WHEN direcao = 'entrada' THEN 1 ELSE 0 END) AS recebidas, "
                . "SUM(CASE WHEN direcao = 'entrada' THEN 0 ELSE 1 END) AS enviadas, "
                . "MAX(data) AS ultima "
                . "FROM interactions WHERE lead_id = :lead_id AND tipo = 'mensagem'",
                ['lead_id' => $leadId]
            )->fetch('assoc');

            $ultima = $resumo['ultima'] ?? null;
            $direcao = null;
            if ($ultima) {
                $linha = $conn->execute(
                    "SELECT direcao FROM interactions WHERE lead_id = :lead_id AND tipo = 'mensagem' "
                    . 'ORDER BY data DESC, id DESC LIMIT 1',
                    ['lead_id' => $leadId]
                )->fetch('assoc');
                $direcao = $linha['direcao'] ?? null;
            }

            $conn->execute(
                'UPDATE leads SET mensagens_enviadas = :enviadas, mensagens_recebidas = :recebidas, '
                . 'ultima_mensagem_em = :ultima, ultima_mensagem_direcao = :direcao WHERE id = :id',
                [
                    'enviadas' => (int)($resumo['enviadas'] ?? 0),
                    'recebidas' => (int)($resumo['recebidas'] ?? 0),
                    'ultima' => $ultima,
                    'direcao' => $direcao,
                    'id' => $leadId,
                ]
            );
        } catch (\Throwable) {
            // Contadores são derivados; não interrompem o fluxo principal.
        }
    }
}
