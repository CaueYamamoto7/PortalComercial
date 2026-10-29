<?php
declare(strict_types=1);

use Migrations\BaseMigration;

/** Registra tentativas antes do transporte para limitar inclusive envios incertos. */
class WhatsAppSendAttempts extends BaseMigration
{
    public function change(): void
    {
        $this->table('wa_send_attempts', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 50])
            ->addColumn('attempted_at', 'biginteger')
            ->addIndex(['attempted_at'])
            ->create();
    }
}
