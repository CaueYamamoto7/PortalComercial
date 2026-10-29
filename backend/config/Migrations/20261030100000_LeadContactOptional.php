<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class LeadContactOptional extends BaseMigration
{
    public function up(): void
    {
        $this->table('leads')->changeColumn('telefone', 'string', ['limit' => 20, 'null' => true])->update();
        $this->execute("UPDATE leads SET telefone = NULL WHERE telefone = ''");
    }

    public function down(): void
    {
        throw new RuntimeException('Há leads sem telefone; a reversão exige tratar esses dados manualmente.');
    }
}
