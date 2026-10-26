<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Core\Configure;
use Cake\Database\Connection;
use Cake\Datasource\ConnectionManager;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

/**
 * Garantias de segurança da equipe: convite com senha temporária, troca
 * obrigatória, revogação de sessão e exclusão com realocação de registros.
 */
class TeamSecurityTest extends TestCase
{
    use IntegrationTestTrait;

    private Connection $conn;

    protected function setUp(): void
    {
        parent::setUp();
        Configure::write('debug', true);
        Configure::write('App.fullBaseUrl', 'http://localhost');
        $this->conn = ConnectionManager::get('default');
    }

    protected function tearDown(): void
    {
        Configure::write('debug', true);
        parent::tearDown();
    }

    public function testConviteCriaUsuarioAtivoComSenhaTemporaria(): void
    {
        $this->criarUsuario('us_admin_t', 'Admin Teste', 'admin.t@example.com');
        $this->autenticar('us_admin_t', 'Admin Teste');
        $this->enableCsrfToken();

        $this->post('/api/configuracoes/equipe', [
            'nome' => 'Novo Consultor',
            'email' => 'novo.consultor@example.com',
            'senha' => 'senha-temporaria',
            'perfil' => 'Consultor comercial',
        ]);

        $this->assertResponseCode(201);
        $linha = $this->conn->execute(
            'SELECT status, must_change_password, senha_hash FROM users WHERE email = :email',
            ['email' => 'novo.consultor@example.com'],
        )->fetch('assoc');

        $this->assertSame('ativo', $linha['status']);
        $this->assertTrue((bool)$linha['must_change_password']);
        $this->assertTrue(password_verify('senha-temporaria', $linha['senha_hash']));
    }

    public function testConviteRejeitaSenhaCurta(): void
    {
        $this->criarUsuario('us_admin_t', 'Admin Teste', 'admin.t@example.com');
        $this->autenticar('us_admin_t', 'Admin Teste');
        $this->enableCsrfToken();

        $this->post('/api/configuracoes/equipe', [
            'nome' => 'Novo Consultor',
            'email' => 'curta@example.com',
            'senha' => '1234567',
            'perfil' => 'Consultor comercial',
        ]);

        $this->assertResponseCode(422);
        $this->assertResponseContains('senha');
    }

    public function testTrocaObrigatoriaBloqueiaApiELiberaAposAlterar(): void
    {
        $this->criarUsuario('us_troca', 'Usuário Troca', 'troca@example.com', 'consultor', 1, true);
        $this->autenticar('us_troca', 'Usuário Troca', 1, true);
        $this->enableCsrfToken();

        $this->get('/api/leads');
        $this->assertResponseCode(428);

        $this->put('/api/senha', [
            'atual' => 'senha-inicial',
            'nova' => 'senha-definitiva',
            'confirmacao' => 'senha-definitiva',
        ]);
        $this->assertResponseOk();

        $linha = $this->conn->execute(
            'SELECT must_change_password, auth_version FROM users WHERE id = :id',
            ['id' => 'us_troca'],
        )->fetch('assoc');
        $this->assertFalse((bool)$linha['must_change_password']);
        $this->assertSame(2, (int)$linha['auth_version']);

        $this->autenticar('us_troca', 'Usuário Troca', 2, false);
        $this->get('/api/leads');
        $this->assertResponseOk();
    }

    public function testSessaoComVersaoAntigaEhRevogada(): void
    {
        $this->criarUsuario('us_revoga', 'Usuário Revoga', 'revoga@example.com', 'consultor', 3);
        $this->autenticar('us_revoga', 'Usuário Revoga', 1);

        $this->get('/api/leads');

        $this->assertResponseCode(401);
    }

    public function testExclusaoExigeNovoResponsavelQuandoHaRegistros(): void
    {
        $this->prepararExclusao();

        $this->delete('/api/configuracoes/equipe/us_alvo');

        $this->assertResponseCode(422);
        $this->assertResponseContains('novo responsável');
        $this->assertSame(1, $this->conn->execute(
            "SELECT COUNT(*) AS total FROM users WHERE id = 'us_alvo'",
        )->fetch('assoc')['total']);
    }

    public function testExclusaoRealocaLeadsETarefas(): void
    {
        $this->prepararExclusao();

        $this->delete('/api/configuracoes/equipe/us_alvo?novo_responsavel=' . rawurlencode('Novo Teste'));

        $this->assertResponseOk();
        $lead = $this->conn->execute(
            "SELECT responsavel, busca FROM leads WHERE id = 'ld_alvo'",
        )->fetch('assoc');
        $this->assertSame('Novo Teste', $lead['responsavel']);
        $this->assertStringContainsString('novo teste', (string)$lead['busca']);
        $this->assertStringNotContainsString('alvo teste', (string)$lead['busca']);

        $tarefa = $this->conn->execute(
            "SELECT responsavel FROM tasks WHERE id = 'tk_alvo'",
        )->fetch('assoc');
        $this->assertSame('Novo Teste', $tarefa['responsavel']);

        $alvo = $this->conn->execute(
            "SELECT COUNT(*) AS total FROM users WHERE id = 'us_alvo'",
        )->fetch('assoc');
        $this->assertSame(0, (int)$alvo['total']);
    }

    private function prepararExclusao(): void
    {
        $this->criarUsuario('us_admin_t', 'Admin Teste', 'admin.t@example.com');
        $this->criarUsuario('us_alvo', 'Alvo Teste', 'alvo@example.com', 'consultor');
        $this->criarUsuario('us_novo', 'Novo Teste', 'novo@example.com', 'consultor');
        $this->autenticar('us_admin_t', 'Admin Teste');
        $this->enableCsrfToken();

        $this->conn->delete('leads', ['id' => 'ld_alvo']);
        $this->conn->delete('tasks', ['id' => 'tk_alvo']);
        $agora = date('Y-m-d H:i:s');
        $this->conn->insert('leads', [
            'id' => 'ld_alvo',
            'nome' => 'Lead do Alvo',
            'telefone' => '11999990000',
            'responsavel' => 'Alvo Teste',
            'busca' => 'lead do alvo alvo teste',
            'etapa_id' => 'et_novo',
            'criado_em' => $agora,
            'atualizado_em' => $agora,
        ]);
        $this->conn->insert('tasks', [
            'id' => 'tk_alvo',
            'lead_id' => 'ld_alvo',
            'titulo' => 'Tarefa do Alvo',
            'responsavel' => 'Alvo Teste',
            'status' => 'pendente',
            'data' => $agora,
        ]);
    }

    private function criarUsuario(
        string $id,
        string $nome,
        string $email,
        string $role = 'admin',
        int $versao = 1,
        bool $trocaObrigatoria = false,
    ): void {
        $this->conn->delete('users', ['id' => $id]);
        $this->conn->insert('users', [
            'id' => $id,
            'nome' => $nome,
            'email' => $email,
            'senha_hash' => password_hash('senha-inicial', PASSWORD_DEFAULT),
            'cargo' => 'Consultor',
            'perfil' => $role === 'admin' ? 'Administrador' : 'Consultor comercial',
            'role' => $role,
            'status' => 'ativo',
            'iniciais' => mb_substr($nome, 0, 1),
            'must_change_password' => $trocaObrigatoria,
            'auth_version' => $versao,
            'criado_em' => date('Y-m-d H:i:s'),
            'atualizado_em' => date('Y-m-d H:i:s'),
        ]);
    }

    private function autenticar(string $id, string $nome, int $versao = 1, bool $troca = false): void
    {
        $this->session(['Auth' => [
            'id' => $id,
            'nome' => $nome,
            'email' => $nome . '@example.com',
            'cargo' => 'Consultor',
            'perfil' => 'Consultor comercial',
            'role' => 'admin',
            'iniciais' => mb_substr($nome, 0, 1),
            'status' => 'ativo',
            'mustChangePassword' => $troca,
            'authVersion' => $versao,
        ]]);
    }
}
