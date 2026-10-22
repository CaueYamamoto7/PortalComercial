<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class InitialSchema extends BaseMigration
{
    public function change(): void
    {
        $this->table('users', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('nome', 'string', ['limit' => 160])
            ->addColumn('email', 'string', ['limit' => 190])
            ->addColumn('senha_hash', 'string', ['limit' => 255])
            ->addColumn('cargo', 'string', ['limit' => 120, 'default' => ''])
            ->addColumn('perfil', 'string', ['limit' => 120, 'default' => 'Consultor comercial'])
            ->addColumn('status', 'string', ['limit' => 20, 'default' => 'ativo'])
            ->addColumn('iniciais', 'string', ['limit' => 4, 'default' => ''])
            ->addColumn('criado_em', 'datetime', ['null' => true])
            ->addColumn('atualizado_em', 'datetime', ['null' => true])
            ->addIndex(['email'], ['unique' => true, 'name' => 'users_email_unique'])
            ->create();

        $this->table('systems', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('nome', 'string', ['limit' => 120])
            ->addColumn('descricao', 'text', ['null' => true])
            ->addColumn('cor', 'string', ['limit' => 9, 'default' => '#0B6B57'])
            ->addColumn('ativo', 'boolean', ['default' => true])
            ->addColumn('criado_em', 'datetime', ['null' => true])
            ->create();

        $this->table('sources', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('nome', 'string', ['limit' => 120])
            ->addColumn('ativo', 'boolean', ['default' => true])
            ->addColumn('criado_em', 'datetime', ['null' => true])
            ->create();

        $this->table('stages', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('nome', 'string', ['limit' => 120])
            ->addColumn('cor', 'string', ['limit' => 9, 'default' => '#0B6B57'])
            ->addColumn('tipo', 'string', ['limit' => 20, 'default' => 'aberto'])
            ->addColumn('ordem', 'integer', ['default' => 0])
            ->create();

        $this->table('leads', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('nome', 'string', ['limit' => 160])
            ->addColumn('empresa', 'string', ['limit' => 160, 'default' => ''])
            ->addColumn('cargo', 'string', ['limit' => 120, 'default' => ''])
            ->addColumn('telefone', 'string', ['limit' => 20])
            ->addColumn('email', 'string', ['limit' => 190, 'default' => ''])
            ->addColumn('cidade', 'string', ['limit' => 120, 'default' => ''])
            ->addColumn('uf', 'string', ['limit' => 2, 'default' => ''])
            ->addColumn('origem_id', 'string', ['limit' => 40, 'null' => true])
            ->addColumn('origem_detalhe', 'string', ['limit' => 190, 'default' => ''])
            ->addColumn('sistema_ids', 'json', ['null' => true])
            ->addColumn('possui_sistema', 'string', ['limit' => 20, 'default' => 'nao_informado'])
            ->addColumn('sistema_atual', 'string', ['limit' => 160, 'default' => ''])
            ->addColumn('etapa_id', 'string', ['limit' => 40, 'null' => true])
            ->addColumn('prioridade', 'string', ['limit' => 10, 'default' => 'media'])
            ->addColumn('responsavel', 'string', ['limit' => 160, 'default' => ''])
            ->addColumn('proximo_contato', 'datetime', ['null' => true])
            ->addColumn('ultimo_contato', 'datetime', ['null' => true])
            ->addColumn('observacoes', 'text', ['null' => true])
            ->addColumn('tags', 'json', ['null' => true])
            ->addColumn('nao_contatar', 'boolean', ['default' => false])
            ->addColumn('criado_em', 'datetime', ['null' => true])
            ->addColumn('atualizado_em', 'datetime', ['null' => true])
            ->addColumn('motivo_perda', 'string', ['limit' => 190, 'default' => ''])
            ->addIndex(['telefone'], ['unique' => true, 'name' => 'leads_telefone_unique'])
            ->addIndex(['etapa_id'], ['name' => 'leads_etapa_idx'])
            ->addIndex(['responsavel'], ['name' => 'leads_responsavel_idx'])
            ->create();

        $this->table('interactions', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('lead_id', 'string', ['limit' => 40])
            ->addColumn('tipo', 'string', ['limit' => 20, 'default' => 'nota'])
            ->addColumn('titulo', 'string', ['limit' => 190, 'default' => ''])
            ->addColumn('descricao', 'text', ['null' => true])
            ->addColumn('data', 'datetime')
            ->addColumn('usuario', 'string', ['limit' => 160, 'default' => ''])
            ->addColumn('canal', 'string', ['limit' => 40, 'null' => true])
            ->addColumn('direcao', 'string', ['limit' => 10, 'null' => true])
            ->addIndex(['lead_id'], ['name' => 'interactions_lead_idx'])
            ->addIndex(['data'], ['name' => 'interactions_data_idx'])
            ->create();

        $this->table('tasks', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('lead_id', 'string', ['limit' => 40])
            ->addColumn('titulo', 'string', ['limit' => 190])
            ->addColumn('tipo', 'string', ['limit' => 20, 'default' => 'ligacao'])
            ->addColumn('data', 'datetime')
            ->addColumn('prioridade', 'string', ['limit' => 10, 'default' => 'media'])
            ->addColumn('status', 'string', ['limit' => 20, 'default' => 'pendente'])
            ->addColumn('responsavel', 'string', ['limit' => 160, 'default' => ''])
            ->addIndex(['lead_id'], ['name' => 'tasks_lead_idx'])
            ->addIndex(['data'], ['name' => 'tasks_data_idx'])
            ->create();

        $this->table('templates', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('nome', 'string', ['limit' => 190])
            ->addColumn('categoria', 'string', ['limit' => 60, 'default' => 'Geral'])
            ->addColumn('conteudo', 'text')
            ->addColumn('atualizado_em', 'datetime', ['null' => true])
            ->addColumn('usos', 'integer', ['default' => 0])
            ->create();

        $this->table('campaigns', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('nome', 'string', ['limit' => 190])
            ->addColumn('template_id', 'string', ['limit' => 40, 'null' => true])
            ->addColumn('mensagem', 'text')
            ->addColumn('status', 'string', ['limit' => 20, 'default' => 'concluida'])
            ->addColumn('canal', 'string', ['limit' => 30, 'default' => 'WhatsApp'])
            ->addColumn('lead_ids', 'json', ['null' => true])
            ->addColumn('publico', 'integer', ['default' => 0])
            ->addColumn('enviados', 'integer', ['default' => 0])
            ->addColumn('entregues', 'integer', ['default' => 0])
            ->addColumn('falhas', 'integer', ['default' => 0])
            ->addColumn('criada_em', 'datetime', ['null' => true])
            ->addColumn('agendada_para', 'datetime', ['null' => true])
            ->addColumn('responsavel', 'string', ['limit' => 160, 'default' => ''])
            ->addIndex(['status'], ['name' => 'campaigns_status_idx'])
            ->create();

        $this->table('notifications', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 40])
            ->addColumn('tipo', 'string', ['limit' => 20, 'default' => 'info'])
            ->addColumn('texto', 'string', ['limit' => 255])
            ->addColumn('data', 'datetime')
            ->addColumn('lida', 'boolean', ['default' => false])
            ->addColumn('href', 'string', ['limit' => 190, 'default' => ''])
            ->create();

        $this->table('settings', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 60])
            ->addColumn('valor', 'json', ['null' => true])
            ->create();

        $this->table('sessions', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 64])
            ->addColumn('data', 'text', ['null' => true])
            ->addColumn('expires', 'integer', ['null' => true])
            ->create();
    }
}
