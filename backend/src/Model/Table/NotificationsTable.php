<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Table\AppTable;

class NotificationsTable extends AppTable
{

    protected string $idPrefix = 'nt_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('notifications');
        $this->setPrimaryKey('id');
        $this->setDisplayField('texto');
    }
}
