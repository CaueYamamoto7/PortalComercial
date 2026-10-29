<?php
declare(strict_types=1);

use Cake\Routing\Route\DashedRoute;
use Cake\Routing\RouteBuilder;

return function (RouteBuilder $routes): void {
    $routes->setRouteClass(DashedRoute::class);

    $routes->scope('/api', function (RouteBuilder $builder): void {
        $builder->get('/health', ['controller' => 'Health', 'action' => 'index']);

        $builder->post('/auth/login', ['controller' => 'Auth', 'action' => 'login']);
        $builder->post('/auth/logout', ['controller' => 'Auth', 'action' => 'logout']);
        $builder->get('/auth/session', ['controller' => 'Auth', 'action' => 'session']);

        $builder->get('/bootstrap', ['controller' => 'Bootstrap', 'action' => 'index']);
        $builder->get('/resumo', ['controller' => 'Bootstrap', 'action' => 'resumo']);
        $builder->get('/catalogos', ['controller' => 'Bootstrap', 'action' => 'catalogos']);

        $builder->get('/dashboard', ['controller' => 'Dashboard', 'action' => 'index']);
        $builder->get('/dashboard/conversas', ['controller' => 'Dashboard', 'action' => 'conversas']);

        $builder->get('/leads', ['controller' => 'Leads', 'action' => 'index']);
        $builder->post('/leads', ['controller' => 'Leads', 'action' => 'add']);
        $builder->get('/leads/catalogos', ['controller' => 'Leads', 'action' => 'catalogs']);
        $builder->post('/leads/origens', ['controller' => 'Leads', 'action' => 'addSource']);
        $builder->post('/leads/importar', ['controller' => 'Leads', 'action' => 'importar']);
        $builder->post('/leads/lote', ['controller' => 'Leads', 'action' => 'lote']);
        $builder->get('/leads/exportar', ['controller' => 'Leads', 'action' => 'exportar']);
        $builder->get('/leads/{id}', ['controller' => 'Leads', 'action' => 'view'])->setPass(['id']);
        $builder->put('/leads/{id}', ['controller' => 'Leads', 'action' => 'edit'])->setPass(['id']);
        $builder->delete('/leads/{id}', ['controller' => 'Leads', 'action' => 'delete'])->setPass(['id']);
        $builder->post('/leads/{id}/mover', ['controller' => 'Leads', 'action' => 'mover'])->setPass(['id']);
        $builder->post('/leads/{leadId}/interacoes', ['controller' => 'Interactions', 'action' => 'add'])
            ->setPass(['leadId']);

        $builder->get('/tarefas', ['controller' => 'Tasks', 'action' => 'index']);
        $builder->post('/tarefas', ['controller' => 'Tasks', 'action' => 'add']);
        $builder->post('/tarefas/{id}/concluir', ['controller' => 'Tasks', 'action' => 'concluir'])->setPass(['id']);
        $builder->delete('/tarefas/{id}', ['controller' => 'Tasks', 'action' => 'delete'])->setPass(['id']);

        $builder->get('/pipeline', ['controller' => 'Pipeline', 'action' => 'index']);

        $builder->get('/mensagens', ['controller' => 'Campaigns', 'action' => 'index']);
        $builder->post('/mensagens', ['controller' => 'Campaigns', 'action' => 'add']);
        $builder->get('/mensagens/{id}', ['controller' => 'Campaigns', 'action' => 'view'])->setPass(['id']);
        $builder->post('/mensagens/publico', ['controller' => 'Campaigns', 'action' => 'publico']);
        $builder->post('/mensagens/individual', ['controller' => 'Campaigns', 'action' => 'individual']);
        $builder->post('/mensagens/{id}/cancelar', ['controller' => 'Campaigns', 'action' => 'cancelar'])
            ->setPass(['id']);

        $builder->get('/templates', ['controller' => 'Templates', 'action' => 'index']);
        $builder->post('/templates', ['controller' => 'Templates', 'action' => 'add']);
        $builder->put('/templates/{id}', ['controller' => 'Templates', 'action' => 'edit'])->setPass(['id']);
        $builder->delete('/templates/{id}', ['controller' => 'Templates', 'action' => 'delete'])->setPass(['id']);

        $builder->get('/relatorios', ['controller' => 'Reports', 'action' => 'index']);

        $builder->get('/configuracoes', ['controller' => 'Settings', 'action' => 'index']);
        $builder->put('/perfil', ['controller' => 'Settings', 'action' => 'perfil']);
        $builder->put('/preferencias', ['controller' => 'Settings', 'action' => 'preferencias']);
        $builder->put('/senha', ['controller' => 'Settings', 'action' => 'alterarSenha']);
        $builder->put('/configuracoes/{secao}', ['controller' => 'Settings', 'action' => 'save'])
            ->setPass(['secao']);
        $builder->post('/configuracoes/sistemas', ['controller' => 'Settings', 'action' => 'addSystem']);
        $builder->put('/configuracoes/sistemas/{id}', ['controller' => 'Settings', 'action' => 'editSystem'])
            ->setPass(['id']);
        $builder->delete('/configuracoes/sistemas/{id}', ['controller' => 'Settings', 'action' => 'deleteSystem'])
            ->setPass(['id']);
        $builder->post('/configuracoes/origens', ['controller' => 'Settings', 'action' => 'addSource']);
        $builder->put('/configuracoes/origens/{id}', ['controller' => 'Settings', 'action' => 'editSource'])
            ->setPass(['id']);
        $builder->delete('/configuracoes/origens/{id}', ['controller' => 'Settings', 'action' => 'deleteSource'])
            ->setPass(['id']);
        $builder->post('/configuracoes/etapas', ['controller' => 'Settings', 'action' => 'addStage']);
        $builder->post('/configuracoes/etapas/reordenar', ['controller' => 'Settings', 'action' => 'reorderStages']);
        $builder->put('/configuracoes/etapas/{id}', ['controller' => 'Settings', 'action' => 'editStage'])
            ->setPass(['id']);
        $builder->delete('/configuracoes/etapas/{id}', ['controller' => 'Settings', 'action' => 'deleteStage'])
            ->setPass(['id']);
        $builder->post('/configuracoes/equipe', ['controller' => 'Settings', 'action' => 'addMember']);
        $builder->delete('/configuracoes/equipe/{id}', ['controller' => 'Settings', 'action' => 'deleteMember'])
            ->setPass(['id']);

        $builder->get('/notificacoes', ['controller' => 'Notifications', 'action' => 'index']);
        $builder->post('/notificacoes/marcar-lidas', ['controller' => 'Notifications', 'action' => 'markRead']);
    });
};
