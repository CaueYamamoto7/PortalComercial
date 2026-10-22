<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Table\AppTable;

class SystemsTable extends AppTable
{

    protected string $idPrefix = 'sis_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('systems');
        $this->setPrimaryKey('id');
        $this->setDisplayField('nome');
    }
}
