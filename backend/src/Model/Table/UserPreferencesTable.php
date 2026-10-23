<?php
declare(strict_types=1);

namespace App\Model\Table;

use Cake\ORM\Table;

class UserPreferencesTable extends Table
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('user_preferences');
        $this->setPrimaryKey('user_id');
        $this->getSchema()->setColumnType('valor', 'json');
    }
}
