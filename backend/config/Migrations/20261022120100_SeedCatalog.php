<?php
declare(strict_types=1);

use Migrations\BaseMigration;
use Migrations\Db\Literal;

/**
 * Catálogo inicial do CRM. Não inclui dados de demonstração:
 * apenas o funil padrão, os produtos, as origens e o usuário administrador.
 */
class SeedCatalog extends BaseMigration
{
    public function up(): void
    {
        $now = date('Y-m-d H:i:s');

        $this->table('stages')->insert([
            ['id' => 'et_novo', 'nome' => 'Novo', 'cor' => '#64748B', 'tipo' => 'aberto', 'ordem' => 0],
            ['id' => 'et_contatado', 'nome' => 'Contatado', 'cor' => '#2563EB', 'tipo' => 'aberto', 'ordem' => 1],
            ['id' => 'et_qualificado', 'nome' => 'Qualificado', 'cor' => '#7C3AED', 'tipo' => 'aberto', 'ordem' => 2],
            ['id' => 'et_proposta', 'nome' => 'Proposta', 'cor' => '#D97706', 'tipo' => 'aberto', 'ordem' => 3],
            ['id' => 'et_negociacao', 'nome' => 'Negociação', 'cor' => '#DB2777', 'tipo' => 'aberto', 'ordem' => 4],
            ['id' => 'et_ganho', 'nome' => 'Ganho', 'cor' => '#059669', 'tipo' => 'ganho', 'ordem' => 5],
            ['id' => 'et_perdido', 'nome' => 'Perdido', 'cor' => '#DC2626', 'tipo' => 'perdido', 'ordem' => 6],
        ])->save();

        $this->table('systems')->insert([
            [
                'id' => 'sis_pdf',
                'nome' => 'AssinaPDF',
                'descricao' => 'Assinatura digital e gestão de documentos PDF.',
                'cor' => '#0B6B57',
                'ativo' => new Literal('TRUE'),
                'criado_em' => $now,
            ],
            [
                'id' => 'sis_dns',
                'nome' => 'AssinaDNS',
                'descricao' => 'Gestão, proteção e monitoramento de DNS.',
                'cor' => '#2563EB',
                'ativo' => new Literal('TRUE'),
                'criado_em' => $now,
            ],
            [
                'id' => 'sis_seg',
                'nome' => 'ConforSeg',
                'descricao' => 'Conformidade, segurança da informação e auditoria.',
                'cor' => '#B45309',
                'ativo' => new Literal('TRUE'),
                'criado_em' => $now,
            ],
        ])->save();

        $this->table('sources')->insert([
            ['id' => 'org_feira', 'nome' => 'Feira / evento', 'ativo' => new Literal('TRUE'), 'criado_em' => $now],
            ['id' => 'org_indicacao', 'nome' => 'Indicação', 'ativo' => new Literal('TRUE'), 'criado_em' => $now],
            ['id' => 'org_site', 'nome' => 'Site', 'ativo' => new Literal('TRUE'), 'criado_em' => $now],
            ['id' => 'org_linkedin', 'nome' => 'LinkedIn', 'ativo' => new Literal('TRUE'), 'criado_em' => $now],
            ['id' => 'org_prospeccao', 'nome' => 'Prospecção ativa', 'ativo' => new Literal('TRUE'), 'criado_em' => $now],
            ['id' => 'org_evento', 'nome' => 'Evento próprio', 'ativo' => new Literal('TRUE'), 'criado_em' => $now],
            ['id' => 'org_outro', 'nome' => 'Outro', 'ativo' => new Literal('TRUE'), 'criado_em' => $now],
        ])->save();

        $this->table('settings')->insert([
            [
                'id' => 'empresa',
                'valor' => json_encode([
                    'nome' => 'AssinaSoft',
                    'documento' => '',
                    'email' => '',
                    'telefone' => '',
                    'site' => '',
                    'cidade' => '',
                    'uf' => '',
                ]),
            ],
            [
                'id' => 'mensagens',
                'valor' => json_encode([
                    'limiteDiario' => 300,
                    'intervalo' => 10,
                    'inicio' => '08:00',
                    'fim' => '18:00',
                ]),
            ],
        ])->save();

        $appEnv = getenv('APP_ENV') ?: 'development';
        $email = getenv('ADMIN_EMAIL') ?: 'admin@assinasoft.com.br';
        $senha = getenv('ADMIN_PASSWORD') ?: '';
        $nome = getenv('ADMIN_NAME') ?: 'Administrador';

        if ($senha === '') {
            if ($appEnv === 'production') {
                throw new RuntimeException(
                    'ADMIN_PASSWORD não configurada. Defina uma senha forte antes de rodar as migrations.'
                );
            }
            $senha = 'admin123';
        }
        if (mb_strlen($senha) < 8) {
            throw new RuntimeException('ADMIN_PASSWORD deve ter pelo menos 8 caracteres.');
        }

        $this->table('users')->insert([
            'id' => 'us_admin',
            'nome' => $nome,
            'email' => mb_strtolower(trim($email)),
            'senha_hash' => password_hash($senha, PASSWORD_DEFAULT),
            'cargo' => 'Administrador',
            'perfil' => 'Administrador',
            'status' => 'ativo',
            'iniciais' => $this->iniciais($nome),
            'criado_em' => $now,
            'atualizado_em' => $now,
        ])->save();
    }

    public function down(): void
    {
        $this->table('users')->truncate();
        $this->table('settings')->truncate();
        $this->table('sources')->truncate();
        $this->table('systems')->truncate();
        $this->table('stages')->truncate();
    }

    private function iniciais(string $nome): string
    {
        $partes = preg_split('/\s+/', trim($nome)) ?: [];
        $iniciais = '';
        foreach ([$partes[0] ?? '', end($partes) ?: ''] as $parte) {
            if ($parte !== '') {
                $iniciais .= mb_strtoupper(mb_substr($parte, 0, 1));
            }
        }

        return $iniciais;
    }
}
