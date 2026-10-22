<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Table\AppTable;

class TasksTable extends AppTable
{

    protected string $idPrefix = 'tk_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('tasks');
        $this->setPrimaryKey('id');
        $this->setDisplayField('titulo');
    }
}
