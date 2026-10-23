<?php
declare(strict_types=1);

namespace App\Service;

use Cake\Datasource\ConnectionManager;
use Cake\I18n\DateTime;

/**
 * Registro de ações sensíveis. Nunca lança exceção para não quebrar o fluxo
 * principal por causa de auditoria.
 */
class AuditLogger
{
    /** @param array<string, mixed> $identidade @param array<string, mixed> $meta */
    public function log(
        array $identidade,
        string $acao,
        string $entidade,
        ?string $entidadeId = null,
        array $meta = [],
        ?string $ip = null
    ): void {
        try {
            $conn = ConnectionManager::get('default');
            $agora = new DateTime();
            $conn->execute(
                'INSERT INTO audit_log (id, user_id, user_nome, acao, entidade, entidade_id, meta, ip, criado_em) '
                . 'VALUES (:id, :user_id, :user_nome, :acao, :entidade, :entidade_id, :meta, :ip, :criado_em)',
                [
                    'id' => 'au_' . bin2hex(random_bytes(8)),
                    'user_id' => (string)($identidade['id'] ?? ''),
                    'user_nome' => (string)($identidade['nome'] ?? ''),
                    'acao' => mb_substr($acao, 0, 60),
                    'entidade' => mb_substr($entidade, 0, 60),
                    'entidade_id' => $entidadeId ? mb_substr($entidadeId, 0, 40) : null,
                    'meta' => $meta ? (string)json_encode($meta, JSON_UNESCAPED_UNICODE) : null,
                    'ip' => $ip ? mb_substr($ip, 0, 45) : null,
                    'criado_em' => $agora->format('Y-m-d H:i:s'),
                ]
            );
        } catch (\Throwable) {
            // Auditoria não deve derrubar a operação principal.
        }
    }
}
