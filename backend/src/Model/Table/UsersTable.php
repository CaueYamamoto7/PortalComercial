<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Table\AppTable;

class UsersTable extends AppTable
{

    protected string $idPrefix = 'us_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('users');
        $this->setPrimaryKey('id');
        $this->setDisplayField('nome');
    }
}
