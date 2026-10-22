<?php
declare(strict_types=1);

namespace App\Middleware;

use Cake\Http\Response;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Exige sessão autenticada nas rotas da API e disponibiliza o usuário
 * em $request->getAttribute('identity').
 */
class AuthMiddleware implements MiddlewareInterface
{
    private const PUBLIC_PATHS = [
        '/api/health',
        '/api/auth/login',
        '/api/auth/session',
    ];

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = rtrim($request->getUri()->getPath(), '/') ?: '/';
        $session = $request->getSession();
        $identity = $session->read('Auth');

        if ($identity) {
            $request = $request->withAttribute('identity', $identity);
        }

        if (!$identity && !in_array($path, self::PUBLIC_PATHS, true)) {
            return (new Response())
                ->withStatus(401)
                ->withType('application/json')
                ->withStringBody((string)json_encode([
                    'message' => 'Sessão expirada. Entre novamente.',
                    'campo' => null,
                ], JSON_UNESCAPED_UNICODE));
        }

        return $handler->handle($request);
    }
}
