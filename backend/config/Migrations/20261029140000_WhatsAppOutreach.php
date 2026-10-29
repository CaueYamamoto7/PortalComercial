<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class WhatsAppOutreach extends BaseMigration
{
    public function change(): void
    {
        $this->table('wa_outreach', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('lead_id', 'string', ['limit' => 40])
            ->addColumn('phone', 'string', ['limit' => 20])
            ->addColumn('owner', 'string', ['limit' => 160])
            ->addColumn('status', 'string', ['limit' => 30])
            ->addColumn('objective', 'text')
            ->addColumn('consent_source', 'text')
            ->addColumn('greeting', 'text')
            ->addColumn('reply', 'text', ['default' => ''])
            ->addColumn('message', 'text', ['default' => ''])
            ->addColumn('error', 'text', ['default' => ''])
            ->addColumn('created_at', 'biginteger')
            ->addColumn('sent_at', 'biginteger', ['null' => true])
            ->addColumn('due_at', 'biginteger', ['null' => true])
            ->addColumn('last_reply_at', 'biginteger', ['null' => true])
            ->addColumn('updated_at', 'biginteger')
            ->addIndex(['lead_id'], ['unique' => true])
            ->addIndex(['phone'], ['unique' => true])
            ->addIndex(['status', 'due_at'])
            ->create();
        $this->table('wa_events', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 64])
            ->addColumn('created_at', 'biginteger')
            ->create();
        $this->table('wa_runtime', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('lease_until', 'biginteger', ['default' => 0])
            ->addColumn('heartbeat', 'biginteger', ['default' => 0])
            ->create();
        $this->table('wa_runtime')->insert(['id' => 'worker', 'lease_until' => 0, 'heartbeat' => 0])->saveData();
    }
}
