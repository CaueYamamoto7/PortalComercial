<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class AuthController extends AppController
{
    public function login(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $email = mb_strtolower($this->texto($dados['email'] ?? ''));
        $senha = (string)($dados['senha'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->erro('Informe um e-mail válido.');
        }
        if (mb_strlen($senha) < 6) {
            $this->erro('A senha deve ter pelo menos 6 caracteres.');
        }

        $usuario = $this->fetchTable('Users')->find()
            ->where(['email' => $email, 'status' => 'ativo'])
            ->first();

        if (!$usuario || !password_verify($senha, (string)$usuario->get('senha_hash'))) {
            $this->erro('E-mail ou senha inválidos.', null, 401);
        }

        $identidade = [
            'id' => (string)$usuario->get('id'),
            'nome' => (string)$usuario->get('nome'),
            'email' => (string)$usuario->get('email'),
            'cargo' => (string)$usuario->get('cargo'),
            'perfil' => (string)$usuario->get('perfil'),
            'iniciais' => (string)$usuario->get('iniciais'),
            'status' => (string)$usuario->get('status'),
        ];

        $session = $this->request->getSession();
        $session->renew();
        $session->write('Auth', $identidade);

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
        return [
            'nome' => (string)($identidade['nome'] ?? ''),
            'email' => (string)($identidade['email'] ?? ''),
            'cargo' => (string)($identidade['cargo'] ?? ''),
            'empresa' => $this->empresa(),
            'iniciais' => (string)($identidade['iniciais'] ?? ''),
            'lembrar' => false,
            'desde' => $this->agora()->format('c'),
        ];
    }

    private function empresa(): string
    {
        $setting = $this->fetchTable('Settings')->find()->where(['id' => 'empresa'])->first();
        $valor = $setting ? (array)$setting->get('valor') : [];

        return (string)($valor['nome'] ?? '');
    }
}
