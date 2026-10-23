<?php
declare(strict_types=1);

use Migrations\BaseMigration;

/**
 * Índices de leitura. Não alteram nenhum dado.
 */
class Indexes extends BaseMigration
{
    public function change(): void
    {
        $this->table('leads')
            ->addIndex(['deleted_at'], ['name' => 'leads_deleted_idx'])
            ->addIndex(['proximo_contato'], ['name' => 'leads_proximo_idx'])
            ->addIndex(['criado_em'], ['name' => 'leads_criado_idx'])
            ->addIndex(['atualizado_em'], ['name' => 'leads_atualizado_idx'])
            ->addIndex(['nao_contatar'], ['name' => 'leads_nao_contatar_idx'])
            ->addIndex(['origem_id'], ['name' => 'leads_origem_idx'])
            ->addIndex(['etapa_id', 'deleted_at'], ['name' => 'leads_etapa_deleted_idx'])
            ->addIndex(['responsavel', 'deleted_at'], ['name' => 'leads_responsavel_deleted_idx'])
            ->update();

        $this->table('tasks')
            ->addIndex(['status', 'data'], ['name' => 'tasks_status_data_idx'])
            ->addIndex(['responsavel', 'status', 'data'], ['name' => 'tasks_responsavel_status_idx'])
            ->update();

        $this->table('interactions')
            ->addIndex(['tipo', 'lead_id', 'data'], ['name' => 'interactions_tipo_lead_data_idx'])
            ->update();

        $this->table('campaigns')
            ->addIndex(['criada_em'], ['name' => 'campaigns_criada_idx'])
            ->addIndex(['status', 'criada_em'], ['name' => 'campaigns_status_criada_idx'])
            ->update();

        $this->table('notifications')
            ->addIndex(['user_id', 'lida', 'data'], ['name' => 'notifications_user_lida_idx'])
            ->update();

        $this->table('sessions')
            ->addIndex(['expires'], ['name' => 'sessions_expires_idx'])
            ->update();
    }
}
