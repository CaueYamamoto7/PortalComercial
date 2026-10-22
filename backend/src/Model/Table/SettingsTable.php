<?php
declare(strict_types=1);

namespace App\Model\Table;

class SettingsTable extends AppTable
{
    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('settings');
        $this->setPrimaryKey('id');
        $this->setDisplayField('id');
        $this->getSchema()->setColumnType('valor', 'json');
    }
}
