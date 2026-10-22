<?php
declare(strict_types=1);

namespace App\Model\Table;

class CampaignsTable extends AppTable
{
    protected string $idPrefix = 'cp_';

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('campaigns');
        $this->setPrimaryKey('id');
        $this->setDisplayField('nome');
        $this->getSchema()->setColumnType('lead_ids', 'json');
    }
}
