<?php
declare(strict_types=1);

namespace App\Service;

use Cake\Datasource\ConnectionManager;
use Cake\I18n\DateTime;

/**
 * Rate limit persistido em banco para funcionar entre instâncias serverless.
 */
class RateLimiter
{
    public function __construct(
        private readonly string $connection = 'default'
    ) {
    }

    /**
     * Registra uma tentativa.
     *
     * @return array{allowed: bool, tentativas: int, retryAfter: int}
     */
    public function attempt(string $chave, int $max = 5, int $janelaSegundos = 900): array
    {
        $conn = ConnectionManager::get($this->connection);
        $agora = new DateTime();
        $linha = $conn->execute(
            'SELECT tentativas, janela_inicio, bloqueado_ate FROM rate_limits WHERE chave = :chave',
            ['chave' => $chave]
        )->fetch('assoc');

        if ($linha) {
            $bloqueadoAte = $linha['bloqueado_ate'] ? new DateTime((string)$linha['bloqueado_ate']) : null;
            if ($bloqueadoAte && $bloqueadoAte > $agora) {
                return [
                    'allowed' => false,
                    'tentativas' => (int)$linha['tentativas'],
                    'retryAfter' => max(1, $bloqueadoAte->getTimestamp() - $agora->getTimestamp()),
                ];
            }

            $janela = new DateTime((string)$linha['janela_inicio']);
            if ($janela->getTimestamp() + $janelaSegundos < $agora->getTimestamp()) {
                $tentativas = 0;
                $janela = $agora;
            } else {
                $tentativas = (int)$linha['tentativas'];
            }

            $tentativas++;
            $bloqueado = $tentativas >= $max ? $agora->addSeconds($janelaSegundos) : null;
            $conn->execute(
                'UPDATE rate_limits SET tentativas = :tentativas, janela_inicio = :janela, '
                . 'bloqueado_ate = :bloqueado, atualizado_em = :agora WHERE chave = :chave',
                [
                    'tentativas' => $tentativas,
                    'janela' => $janela->format('Y-m-d H:i:s'),
                    'bloqueado' => $bloqueado?->format('Y-m-d H:i:s'),
                    'agora' => $agora->format('Y-m-d H:i:s'),
                    'chave' => $chave,
                ]
            );

            return [
                'allowed' => !$bloqueado,
                'tentativas' => $tentativas,
                'retryAfter' => $bloqueado ? $janelaSegundos : 0,
            ];
        }

        $bloqueado = $max <= 1 ? $agora->addSeconds($janelaSegundos) : null;
        $conn->execute(
            'INSERT INTO rate_limits (chave, tentativas, janela_inicio, bloqueado_ate, atualizado_em) '
            . 'VALUES (:chave, :tentativas, :janela, :bloqueado, :agora)',
            [
                'chave' => $chave,
                'tentativas' => 1,
                'janela' => $agora->format('Y-m-d H:i:s'),
                'bloqueado' => $bloqueado?->format('Y-m-d H:i:s'),
                'agora' => $agora->format('Y-m-d H:i:s'),
            ]
        );

        return [
            'allowed' => !$bloqueado,
            'tentativas' => 1,
            'retryAfter' => $bloqueado ? $janelaSegundos : 0,
        ];
    }

    public function clear(string $chave): void
    {
        ConnectionManager::get($this->connection)
            ->execute('DELETE FROM rate_limits WHERE chave = :chave', ['chave' => $chave]);
    }
}
