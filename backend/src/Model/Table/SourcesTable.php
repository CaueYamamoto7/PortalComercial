<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Table\AppTable;

class SourcesTable extends AppTable
{

    protected string $idPrefix = 'org_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('sources');
        $this->setPrimaryKey('id');
        $this->setDisplayField('nome');
    }
}
