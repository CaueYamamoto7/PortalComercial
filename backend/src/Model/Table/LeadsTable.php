<?php
declare(strict_types=1);

namespace App\Model\Table;

class LeadsTable extends AppTable
{
    protected string $idPrefix = 'ld_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('leads');
        $this->setPrimaryKey('id');
        $this->setDisplayField('nome');
        $this->getSchema()->setColumnType('sistema_ids', 'json');
        $this->getSchema()->setColumnType('tags', 'json');
    }
}
