<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Table\AppTable;

class TemplatesTable extends AppTable
{

    protected string $idPrefix = 'tp_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('templates');
        $this->setPrimaryKey('id');
        $this->setDisplayField('nome');
    }
}
