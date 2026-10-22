<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Table\AppTable;

class StagesTable extends AppTable
{

    protected string $idPrefix = 'et_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('stages');
        $this->setPrimaryKey('id');
        $this->setDisplayField('nome');
    }
}
