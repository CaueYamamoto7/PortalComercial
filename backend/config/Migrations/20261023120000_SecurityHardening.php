<?php
declare(strict_types=1);

use Migrations\BaseMigration;

/**
 * Estruturas de segurança, auditoria e performance.
 *
 * Importante: esta migration é puramente aditiva. Nenhuma tabela ou coluna
 * existente é removida, renomeada ou tem o tipo alterado.
 */
class SecurityHardening extends BaseMigration
{
    public function change(): void
    {
        $this->table('users')
            ->addColumn('role', 'string', ['limit' => 20, 'default' => 'consultor', 'null' => false])
            ->addColumn('telefone', 'string', ['limit' => 20, 'null' => true])
            ->addColumn('must_change_password', 'boolean', ['default' => false, 'null' => false])
            ->addColumn('ultimo_login_em', 'datetime', ['null' => true])
            ->addIndex(['role'], ['name' => 'users_role_idx'])
            ->update();

        $this->table('leads')
            ->addColumn('deleted_at', 'datetime', ['null' => true])
            ->addColumn('mensagens_enviadas', 'integer', ['default' => 0, 'null' => false])
            ->addColumn('mensagens_recebidas', 'integer', ['default' => 0, 'null' => false])
            ->addColumn('ultima_mensagem_em', 'datetime', ['null' => true])
            ->addColumn('ultima_mensagem_direcao', 'string', ['limit' => 10, 'null' => true])
            ->addColumn('busca', 'text', ['null' => true])
            ->update();

        $this->table('notifications')
            ->addColumn('user_id', 'string', ['limit' => 40, 'null' => true])
            ->addIndex(['user_id'], ['name' => 'notifications_user_idx'])
            ->update();

        $this->table('rate_limits', ['id' => false, 'primary_key' => ['chave']])
            ->addColumn('chave', 'string', ['limit' => 190])
            ->addColumn('tentativas', 'integer', ['default' => 0])
            ->addColumn('janela_inicio', 'datetime')
            ->addColumn('bloqueado_ate', 'datetime', ['null' => true])
            ->addColumn('atualizado_em', 'datetime')
            ->create();

        $this->table('audit_log', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('user_id', 'string', ['limit' => 40, 'null' => true])
            ->addColumn('user_nome', 'string', ['limit' => 160, 'default' => ''])
            ->addColumn('acao', 'string', ['limit' => 60])
            ->addColumn('entidade', 'string', ['limit' => 60])
            ->addColumn('entidade_id', 'string', ['limit' => 40, 'null' => true])
            ->addColumn('meta', 'json', ['null' => true])
            ->addColumn('ip', 'string', ['limit' => 45, 'null' => true])
            ->addColumn('criado_em', 'datetime')
            ->addIndex(['criado_em'], ['name' => 'audit_log_criado_idx'])
            ->addIndex(['user_id'], ['name' => 'audit_log_user_idx'])
            ->create();

        $this->table('user_preferences', ['id' => false, 'primary_key' => ['user_id']])
            ->addColumn('user_id', 'string', ['limit' => 40])
            ->addColumn('valor', 'json', ['null' => true])
            ->addColumn('atualizado_em', 'datetime')
            ->create();
    }
}
