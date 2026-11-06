<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class LeadCaptureIdempotency extends BaseMigration
{
    public function change(): void
    {
        $this->table('leads')
            ->addColumn('capture_request_id', 'string', ['limit' => 36, 'null' => true])
            ->addColumn('capture_user_id', 'string', ['limit' => 40, 'null' => true])
            ->addIndex(['capture_request_id'], ['unique' => true, 'name' => 'leads_capture_request_unique'])
            ->update();
    }
}
