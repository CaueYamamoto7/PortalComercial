<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\AccessControl;
use App\Service\RateLimiter;
use Cake\Http\Response;

class AuthController extends AppController
{
    private const HASH_FICTICIO = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    public function login(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $email = mb_strtolower($this->texto($dados['email'] ?? ''));
        $senha = (string)($dados['senha'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->erro('Informe um e-mail válido.');
        }
        if (mb_strlen($senha) < 8) {
            $this->erro('A senha deve ter pelo menos 8 caracteres.');
        }

        $limiter = new RateLimiter();
        $chave = 'login:' . sha1($email . '|' . $this->request->clientIp());
        $limite = $limiter->attempt($chave, 5, 900);
        if (!$limite['allowed']) {
            $this->erro(
                'Muitas tentativas. Tente novamente em ' . (int)ceil($limite['retryAfter'] / 60) . ' minuto(s).',
                null,
                429
            );
        }

        $usuario = $this->fetchTable('Users')->find()
            ->where(['email' => $email])
            ->first();

        $hash = $usuario ? (string)$usuario->get('senha_hash') : self::HASH_FICTICIO;
        $senhaConfere = password_verify($senha, $hash);

        if (!$usuario || !$senhaConfere || (string)$usuario->get('status') !== 'ativo') {
            $this->erro('E-mail ou senha inválidos.', null, 401);
        }

        $role = $this->access()->roleFromIdentity([
            'perfil' => (string)$usuario->get('perfil'),
            'role' => $usuario->get('role'),
        ]);

        $identidade = [
            'id' => (string)$usuario->get('id'),
            'nome' => (string)$usuario->get('nome'),
            'email' => (string)$usuario->get('email'),
            'cargo' => (string)$usuario->get('cargo'),
            'telefone' => (string)($usuario->get('telefone') ?? ''),
            'perfil' => (string)$usuario->get('perfil'),
            'role' => $role,
            'iniciais' => (string)$usuario->get('iniciais'),
            'status' => (string)$usuario->get('status'),
            'mustChangePassword' => (bool)$usuario->get('must_change_password'),
            'authVersion' => (int)($usuario->get('auth_version') ?? 1),
        ];

        $usuario->set('ultimo_login_em', $this->agora());
        $this->fetchTable('Users')->saveOrFail($usuario);

        $session = $this->request->getSession();
        $session->renew();
        $session->write('Auth', $identidade);

        $limiter->clear($chave);
        $this->audit()->log($identidade, 'auth.login', 'user', (string)$usuario->get('id'), [], $this->request->clientIp());

        return $this->respond($this->sessaoPublica($identidade));
    }

    public function logout(): Response
    {
        $this->request->allowMethod(['post']);
        $session = $this->request->getSession();
        $session->destroy();

        return $this->respond(['ok' => true]);
    }

    public function session(): Response
    {
        $this->request->allowMethod(['get']);
        $identidade = $this->request->getAttribute('identity');

        return $this->respond([
            'autenticado' => (bool)$identidade,
            'usuario' => $identidade ? $this->sessaoPublica((array)$identidade) : null,
            'empresa' => $this->empresa(),
        ]);
    }

    /** @param array<string, mixed> $identidade */
    private function sessaoPublica(array $identidade): array
    {
        $access = new AccessControl();

        return [
            'nome' => (string)($identidade['nome'] ?? ''),
            'email' => (string)($identidade['email'] ?? ''),
            'cargo' => (string)($identidade['cargo'] ?? ''),
            'telefone' => (string)($identidade['telefone'] ?? ''),
            'empresa' => $this->empresa(),
            'iniciais' => (string)($identidade['iniciais'] ?? ''),
            'role' => $access->roleFromIdentity($identidade),
            'permissoes' => [
                'gerenciarEquipe' => $access->canManageTeam($identidade),
                'gerenciarEmpresa' => $access->canManageCompany($identidade),
                'gerenciarCatalogo' => $access->canManageCatalog($identidade),
                'excluirLeads' => $access->canDeleteLead($identidade),
                'verTodosLeads' => $access->canSeeAllLeads($identidade),
            ],
            'lembrar' => false,
            'desde' => $this->agora()->format('c'),
            'mustChangePassword' => (bool)($identidade['mustChangePassword'] ?? false),
        ];
    }

    private function empresa(): string
    {
        $setting = $this->fetchTable('Settings')->find()->where(['id' => 'empresa'])->first();
        $valor = $setting ? (array)$setting->get('valor') : [];

        return (string)($valor['nome'] ?? '');
    }
}
