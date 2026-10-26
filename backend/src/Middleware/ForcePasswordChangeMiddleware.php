<?php
declare(strict_types=1);

namespace App\Middleware;

use Cake\Http\Response;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Bloqueia a API enquanto o usuário não trocar a senha temporária.
 *
 * A tela de conta e o bootstrap continuam acessíveis para que o front-end
 * consiga exibir o formulário de troca sem entrar em laço de redirecionamento.
 */
class ForcePasswordChangeMiddleware implements MiddlewareInterface
{
    private const ALLOWED_PATHS = [
        '/api/health',
        '/api/auth/login',
        '/api/auth/logout',
        '/api/auth/session',
        '/api/bootstrap',
    ];

    /**
     * Interrompe a requisição enquanto a troca estiver pendente.
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $identity = (array)($request->getAttribute('identity') ?? []);
        if (!$identity || empty($identity['mustChangePassword'])) {
            return $handler->handle($request);
        }

        $path = rtrim($request->getUri()->getPath(), '/') ?: '/';
        $method = strtoupper($request->getMethod());
        if (in_array($path, self::ALLOWED_PATHS, true)) {
            return $handler->handle($request);
        }
        if ($method === 'PUT' && $path === '/api/senha') {
            return $handler->handle($request);
        }

        return (new Response())
            ->withStatus(428)
            ->withType('application/json')
            ->withStringBody((string)json_encode([
                'message' => 'Troque sua senha temporária para continuar.',
                'campo' => null,
            ], JSON_UNESCAPED_UNICODE));
    }
}
