<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Exception\ApiException;
use Cake\Http\Exception\HttpException;
use Cake\Http\Exception\InvalidCsrfTokenException;
use Cake\Http\Response;
use Cake\Log\Log;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Throwable;

/**
 * Converte exceções em respostas JSON no formato esperado pelo front-end:
 * { "message": "...", "campo": "..." | null }
 */
class JsonErrorMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        try {
            return $handler->handle($request);
        } catch (ApiException $e) {
            return $this->json($e->getMessage(), $e->campo, $e->status);
        } catch (InvalidCsrfTokenException $e) {
            return $this->json('Sessão expirada. Recarregue a página e tente novamente.', null, 419);
        } catch (HttpException $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            $message = $e->getMessage() ?: 'Não foi possível concluir a operação.';

            return $this->json($message, null, $status);
        } catch (Throwable $e) {
            Log::error($e->getMessage() . "\n" . $e->getTraceAsString());
            $message = env('DEBUG', false)
                ? $e->getMessage()
                : 'Erro interno. Tente novamente em instantes.';

            return $this->json($message, null, 500);
        }
    }

    private function json(string $message, ?string $campo, int $status): ResponseInterface
    {
        return (new Response())
            ->withStatus($status)
            ->withType('application/json')
            ->withStringBody((string)json_encode([
                'message' => $message,
                'campo' => $campo,
            ], JSON_UNESCAPED_UNICODE));
    }
}
