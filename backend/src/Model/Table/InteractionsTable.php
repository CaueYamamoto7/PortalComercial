<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Table\AppTable;

class InteractionsTable extends AppTable
{

    protected string $idPrefix = 'it_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('interactions');
        $this->setPrimaryKey('id');
        $this->setDisplayField('titulo');
    }
}
