<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Core\Configure;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

/**
 * Testes de integração das garantias mínimas da API:
 * saúde pública, sessão obrigatória, Host válido e preferências do usuário.
 */
class ApiSecurityTest extends TestCase
{
    use IntegrationTestTrait;

    protected function setUp(): void
    {
        parent::setUp();
        Configure::write('debug', true);
        Configure::write('App.fullBaseUrl', 'http://localhost');
    }

    protected function tearDown(): void
    {
        Configure::write('debug', true);
        parent::tearDown();
    }

    public function testHealthEhPublico(): void
    {
        $this->get('/api/health');

        $this->assertResponseOk();
        $this->assertHeaderContains('Content-Type', 'application/json');
        $this->assertResponseContains('"status":"ok"');
    }

    public function testLeadsExigemSessao(): void
    {
        $this->get('/api/leads');

        $this->assertResponseCode(401);
        $this->assertHeaderContains('Content-Type', 'application/json');
        $this->assertResponseContains('Sessão expirada');
    }

    public function testBootstrapExigeSessao(): void
    {
        $this->get('/api/bootstrap');

        $this->assertResponseCode(401);
    }

    public function testHostHeaderInvalidoEhRejeitadoEmProducao(): void
    {
        Configure::write('debug', false);
        $this->configRequest(['environment' => ['HTTP_HOST' => 'evil.example']]);

        $this->get('/api/health');

        $this->assertResponseCode(400);
    }

    public function testPreferenciasSaoPersistidas(): void
    {
        $this->session(['Auth' => [
            'id' => 'us_teste',
            'nome' => 'Usuário Teste',
            'email' => 'teste@example.com',
            'cargo' => 'Consultor',
            'perfil' => 'Consultor comercial',
            'role' => 'consultor',
            'iniciais' => 'UT',
            'status' => 'ativo',
        ]]);
        $this->enableCsrfToken();

        $this->put('/api/preferencias', [
            'notifLeads' => false,
            'notifFollowups' => true,
            'tabelaCompacta' => true,
            'idioma' => 'pt-BR',
            'fuso' => 'America/Sao_Paulo',
        ]);

        $this->assertResponseOk();
        $this->assertResponseContains('"tabelaCompacta":true');
        $this->assertResponseContains('"notifLeads":false');

        $this->get('/api/bootstrap');
        $this->assertResponseOk();
        $this->assertResponseContains('"preferencias"');
        $this->assertResponseContains('"tabelaCompacta":true');
    }
}
