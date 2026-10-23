<?php
declare(strict_types=1);

use Migrations\BaseMigration;

/**
 * Relações consultáveis para leads e destinatários de campanha.
 *
 * As colunas JSON originais continuam existindo e sendo escritas durante a
 * transição. Estas tabelas são cópias indexadas, não substituições destrutivas.
 */
class LeadRelations extends BaseMigration
{
    public function change(): void
    {
        $this->table('lead_systems', ['id' => false, 'primary_key' => ['lead_id', 'system_id']])
            ->addColumn('lead_id', 'string', ['limit' => 40])
            ->addColumn('system_id', 'string', ['limit' => 40])
            ->addIndex(['system_id'], ['name' => 'lead_systems_system_idx'])
            ->create();

        $this->table('lead_tags', ['id' => false, 'primary_key' => ['lead_id', 'tag']])
            ->addColumn('lead_id', 'string', ['limit' => 40])
            ->addColumn('tag', 'string', ['limit' => 60])
            ->addIndex(['tag'], ['name' => 'lead_tags_tag_idx'])
            ->create();

        $this->table('campaign_recipients', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('campaign_id', 'string', ['limit' => 40])
            ->addColumn('lead_id', 'string', ['limit' => 40])
            ->addColumn('status', 'string', ['limit' => 20, 'default' => 'pendente'])
            ->addColumn('mensagem', 'text', ['null' => true])
            ->addColumn('erro', 'string', ['limit' => 255, 'null' => true])
            ->addColumn('enviado_em', 'datetime', ['null' => true])
            ->addColumn('criado_em', 'datetime')
            ->addIndex(['campaign_id', 'lead_id'], ['unique' => true, 'name' => 'campaign_recipients_unique'])
            ->addIndex(['lead_id'], ['name' => 'campaign_recipients_lead_idx'])
            ->addIndex(['status'], ['name' => 'campaign_recipients_status_idx'])
            ->create();
    }
}
