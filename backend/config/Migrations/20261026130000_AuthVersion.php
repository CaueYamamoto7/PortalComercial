<?php
declare(strict_types=1);

use Migrations\BaseMigration;

/**
 * Versão de autenticação por usuário.
 *
 * A cada troca de senha (ou redefinição administrativa) a versão é
 * incrementada. Sessões que carregam uma versão antiga são descartadas.
 */
class AuthVersion extends BaseMigration
{
    public function change(): void
    {
        $this->table('users')
            ->addColumn('auth_version', 'integer', ['default' => 1, 'null' => false])
            ->update();
    }
}
