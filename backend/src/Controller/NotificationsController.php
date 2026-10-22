<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class NotificationsController extends AppController
{
    public function index(): Response
    {
        $rows = $this->fetchTable('Notifications')->find()
            ->orderBy(['data' => 'DESC'])
            ->all()
            ->toList();

        $notificacoes = array_map(fn ($row) => [
            'id' => (string)$row->get('id'),
            'tipo' => (string)$row->get('tipo'),
            'texto' => (string)$row->get('texto'),
            'data' => $this->service()->iso($row->get('data')),
            'lida' => (bool)$row->get('lida'),
            'href' => (string)$row->get('href'),
        ], $rows);

        return $this->respond($notificacoes);
    }

    public function markRead(): Response
    {
        $this->request->allowMethod(['post']);
        $this->fetchTable('Notifications')->updateAll(['lida' => true], ['lida' => false]);

        return $this->respond(['ok' => true]);
    }
}
