<?php
declare(strict_types=1);

namespace App\Command;

use Cake\Command\Command;
use Cake\Console\Arguments;
use Cake\Console\ConsoleIo;
use Cake\Console\ConsoleOptionParser;
use Cake\I18n\DateTime;

/**
 * Redefine a senha de um usuário diretamente pelo terminal.
 *
 * A senha definida é temporária: o usuário é obrigado a trocá-la no próximo
 * acesso e todas as sessões abertas são revogadas.
 *
 * Uso: bin/cake users:reset-password --email=usuario@empresa.com
 */
class ResetPasswordCommand extends Command
{
    /**
     * Nome do comando.
     */
    public static function defaultName(): string
    {
        return 'users:reset-password';
    }

    /**
     * Opções do comando.
     */
    public function getOptionParser(): ConsoleOptionParser
    {
        return parent::getOptionParser()
            ->setDescription('Redefine a senha de um usuário e revoga as sessões ativas.')
            ->addOption('email', [
                'help' => 'E-mail do usuário.',
                'required' => true,
            ])
            ->addOption('password', [
                'help' => 'Nova senha temporária (mínimo 8 caracteres). Se omitida, será solicitada.',
            ]);
    }

    /**
     * Aplica a senha temporária e revoga as sessões do usuário.
     */
    public function execute(Arguments $args, ConsoleIo $io): int
    {
        $email = mb_strtolower(trim((string)$args->getOption('email')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $io->error('Informe um e-mail válido em --email.');

            return static::CODE_ERROR;
        }

        $senha = (string)$args->getOption('password');
        if ($senha === '') {
            $senha = (string)$io->ask('Nova senha temporária', '', function (string $valor): bool {
                return mb_strlen($valor) >= 8;
            });
        }
        if (mb_strlen($senha) < 8) {
            $io->error('A senha deve ter pelo menos 8 caracteres.');

            return static::CODE_ERROR;
        }

        $table = $this->fetchTable('Users');
        $usuario = $table->find()->where(['email' => $email])->first();
        if (!$usuario) {
            $io->error('Usuário não encontrado: ' . $email);

            return static::CODE_ERROR;
        }

        $versao = (int)($usuario->get('auth_version') ?? 0);
        $usuario->set('senha_hash', password_hash($senha, PASSWORD_DEFAULT));
        $usuario->set('must_change_password', true);
        $usuario->set('status', 'ativo');
        $usuario->set('auth_version', $versao + 1);
        $usuario->set('atualizado_em', DateTime::now());
        $table->saveOrFail($usuario);

        $io->success('Senha redefinida para ' . $email . '. Troca obrigatória no próximo acesso.');

        return static::CODE_SUCCESS;
    }
}
