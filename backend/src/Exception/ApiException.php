<?php
declare(strict_types=1);

namespace App\Exception;

use RuntimeException;

/**
 * Erro de negócio da API. O middleware converte em JSON com "campo".
 */
class ApiException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly ?string $campo = null,
        public readonly int $status = 422
    ) {
        parent::__construct($message);
    }
}
