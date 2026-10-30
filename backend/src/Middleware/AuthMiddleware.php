<?php
declare(strict_types=1);

namespace App\Middleware;

use Cake\Datasource\ConnectionManager;
use Cake\Http\Response;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Throwable;

/**
 * Exige sessão autenticada nas rotas da API e disponibiliza o usuário
 * em $request->getAttribute('identity').
 *
 * A cada requisição a versão de autenticação gravada na sessão é comparada
 * com a do banco. Assim, trocar a senha (ou redefini-la pelo terminal)
 * revoga imediatamente todas as outras sessões do usuário.
 */
class AuthMiddleware implements MiddlewareInterface
{
    private const IDLE_SECONDS = 1800;
    private const PUBLIC_PATHS = [
        '/api/health',
        '/api/auth/login',
        '/api/auth/session',
    ];

    /**
     * Valida a sessão e propaga a identidade para os controllers.
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = rtrim($request->getUri()->getPath(), '/') ?: '/';
        $session = $request->getSession();
        $identity = $session->read('Auth');

        if ($identity && !$this->sessaoValida((array)$identity)) {
            $session->destroy();
            $identity = null;
        }

        if ($identity) {
            $now = time();
            $lastActivity = (int)$session->read('AuthLastActivity');
            $leadPage = $request->getHeaderLine('X-Page-Context') === 'cadastro-lead';
            $resumingLead = $request->getHeaderLine('X-Idle-Resume') === '1';
            if (!$leadPage && !$resumingLead && $lastActivity > 0 && $now - $lastActivity >= self::IDLE_SECONDS) {
                $session->destroy();
                $identity = null;
            } elseif ($leadPage || $resumingLead || $lastActivity === 0 || $request->getHeaderLine('X-User-Activity') === '1') {
                $session->write('AuthLastActivity', $now);
            }
        }

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

    /** @param array<string, mixed> $identity */
    private function sessaoValida(array $identity): bool
    {
        $id = (string)($identity['id'] ?? '');
        if ($id === '') {
            return false;
        }

        try {
            $row = ConnectionManager::get('default')->execute(
                'SELECT auth_version, status FROM users WHERE id = :id',
                ['id' => $id],
            )->fetch('assoc');
        } catch (Throwable $e) {
            return false;
        }

        if (!$row || (string)($row['status'] ?? '') !== 'ativo') {
            return false;
        }

        return (int)($row['auth_version'] ?? 0) === (int)($identity['authVersion'] ?? -1);
    }
}
