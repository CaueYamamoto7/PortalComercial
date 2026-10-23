<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\PreferencesService;
use Cake\Http\Response;

/**
 * Carrega sessão, catálogos e resumo em uma única chamada para reduzir o
 * waterfall de requisições do front.
 */
class BootstrapController extends AppController
{
    public function index(): Response
    {
        $identidade = $this->identidade();
        $access = $this->access();
        $setting = $this->fetchTable('Settings')->find()->where(['id' => 'empresa'])->first();
        $empresa = $setting ? (array)$setting->get('valor') : [];
        $userId = (string)($identidade['id'] ?? '');
        $usuario = $userId !== ''
            ? $this->fetchTable('Users')->find()->select(['telefone'])->where(['id' => $userId])->first()
            : null;

        return $this->respond([
            'usuario' => [
                'nome' => (string)($identidade['nome'] ?? ''),
                'email' => (string)($identidade['email'] ?? ''),
                'cargo' => (string)($identidade['cargo'] ?? ''),
                'telefone' => (string)($usuario?->get('telefone') ?? ($identidade['telefone'] ?? '')),
                'empresa' => (string)($empresa['nome'] ?? ''),
                'iniciais' => (string)($identidade['iniciais'] ?? ''),
                'role' => $access->roleFromIdentity($identidade),
                'permissoes' => [
                    'gerenciarEquipe' => $access->canManageTeam($identidade),
                    'gerenciarEmpresa' => $access->canManageCompany($identidade),
                    'gerenciarCatalogo' => $access->canManageCatalog($identidade),
                    'excluirLeads' => $access->canDeleteLead($identidade),
                    'verTodosLeads' => $access->canSeeAllLeads($identidade),
                ],
                'mustChangePassword' => (bool)($identidade['mustChangePassword'] ?? false),
            ],
            'catalogos' => $this->queryService()->facets([], $identidade),
            'preferencias' => (new PreferencesService())->obter($userId),
            'resumo' => $this->resumoDados(),
        ]);
    }

    public function resumo(): Response
    {
        return $this->respond($this->resumoDados());
    }

    public function catalogos(): Response
    {
        return $this->respond($this->queryService()->facets(
            (array)$this->request->getQueryParams(),
            $this->identidade()
        ));
    }

    private function resumoDados(): array
    {
        $identidade = $this->identidade();
        $tasks = $this->fetchTable('Tasks')->find();
        $this->access()->scopeTasks($tasks, $identidade);

        $agora = $this->agora();
        $atrasadas = (clone $tasks)->where(['status' => 'pendente', 'data <' => $agora])->count();
        $hoje = (clone $tasks)->where([
            'status' => 'pendente',
            'data >=' => new \Cake\I18n\DateTime('today'),
            'data <' => new \Cake\I18n\DateTime('today +1 day'),
        ])->count();

        return [
            'stats' => $this->queryService()->stats([], $identidade),
            'conversas' => $this->queryService()->contagensConversas([], $identidade),
            'tarefas' => [
                'atrasadas' => $atrasadas,
                'hoje' => $hoje,
                'pendentes' => $atrasadas + $hoje,
            ],
        ];
    }
}
