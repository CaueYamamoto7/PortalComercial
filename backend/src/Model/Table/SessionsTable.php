<?php
declare(strict_types=1);

namespace App\Model\Table;

use Cake\ORM\Table;

class SessionsTable extends Table
{

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('sessions');
        $this->setPrimaryKey('id');
        $this->setDisplayField('id');
    }
}
