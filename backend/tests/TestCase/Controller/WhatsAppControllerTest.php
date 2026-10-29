<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Core\Configure;
use Cake\Datasource\ConnectionManager;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

class WhatsAppControllerTest extends TestCase
{
    use IntegrationTestTrait;

    protected function setUp(): void
    {
        parent::setUp();
        Configure::write('debug', true);
        Configure::write('App.fullBaseUrl', 'http://localhost');
        $db = ConnectionManager::get('default');
        $db->begin();
        $db->insert('users', [
            'id' => 'us_wa', 'nome' => 'Consultor WA', 'email' => 'wa@example.test',
            'senha_hash' => 'unused', 'role' => 'consultor', 'auth_version' => 1,
        ]);
        foreach (['novo' => 0, 'contatado' => 1, 'proposta' => 3] as $name => $order) {
            $db->execute('INSERT INTO stages (id, nome, tipo, ordem) VALUES (:id, :name, :type, :position) '
                . 'ON CONFLICT DO NOTHING', [
                    'id' => 'et_' . $name, 'name' => ucfirst($name), 'type' => 'aberto', 'position' => $order,
                ]);
        }
        foreach (['own' => 'Consultor WA', 'other' => 'Outro'] as $id => $owner) {
            $db->insert('leads', [
                'id' => 'ld_wa_' . $id, 'nome' => 'Lead ' . $id, 'responsavel' => $owner,
                'telefone' => $id === 'own' ? '5511999994321' : '5511999994322', 'etapa_id' => 'et_novo',
            ]);
        }
        $this->session(['Auth' => [
            'id' => 'us_wa', 'nome' => 'Consultor WA', 'role' => 'consultor',
            'status' => 'ativo', 'authVersion' => 1,
        ]]);
        $this->enableCsrfToken();
    }

    protected function tearDown(): void
    {
        ConnectionManager::get('default')->rollback();
        parent::tearDown();
    }

    public function testSelectionEnforcesOwnershipAndDeduplicates(): void
    {
        $payload = [
            'leadIds' => ['ld_wa_own', 'ld_wa_other'],
            'objective' => 'Podemos conversar sobre AssinaPDF?', 'consentSource' => 'Formulário em 29/10/2026',
        ];
        $this->post('/api/whatsapp/outreach', $payload);
        $this->assertResponseCode(201);
        $this->assertResponseContains('"accepted":1');
        $this->post('/api/whatsapp/outreach', $payload);
        $this->assertResponseContains('"accepted":0');
        $this->get('/api/whatsapp/outreach');
        $this->assertResponseOk();
        $this->assertResponseContains('Lead own');
        $this->assertResponseNotContains('Lead other');
    }

    public function testExistingProposalAppearsInManualQueueWithoutApproach(): void
    {
        ConnectionManager::get('default')->update('leads', ['etapa_id' => 'et_proposta'], ['id' => 'ld_wa_own']);
        $this->get('/api/whatsapp/outreach?status=manual');
        $this->assertResponseOk();
        $this->assertResponseContains('Lead own');
        $this->assertResponseContains('"status":"manual"');
        $this->assertResponseNotContains('Lead other');
    }

    public function testOnlyAdministratorCanLinkAccount(): void
    {
        $this->post('/api/whatsapp/connect', ['action' => 'connect']);
        $this->assertResponseCode(403);
    }

    public function testOptionsExposeConfiguredStageAndLimits(): void
    {
        $this->get('/api/whatsapp/options');
        $this->assertResponseOk();
        $this->assertResponseContains('"etapaPropostaId"');
        $this->assertResponseContains('"maxLeadsPerBatch"');
    }

    public function testConsentRequiredAndStageBlocksApproach(): void
    {
        $this->post('/api/whatsapp/outreach', ['leadIds' => ['ld_wa_own'], 'objective' => 'Olá']);
        $this->assertResponseCode(422);
        ConnectionManager::get('default')->update('leads', ['etapa_id' => 'et_proposta'], ['id' => 'ld_wa_own']);
        $this->post('/api/whatsapp/outreach', [
            'leadIds' => ['ld_wa_own'], 'objective' => 'Olá', 'consentSource' => 'Solicitação registrada',
        ]);
        $this->assertResponseCode(201);
        $this->assertResponseContains('"accepted":0');
    }
}
