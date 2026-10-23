<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class NotificationsController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $perPage = $this->perPage($params['perPage'] ?? 50, 50);
        $userId = (string)($this->identidade()['id'] ?? '');

        $query = $this->fetchTable('Notifications')->find()
            ->where(['OR' => [
                'user_id IS' => null,
                'user_id' => $userId,
            ]]);
        $rows = $query
            ->orderBy(['data' => 'DESC'])
            ->limit($perPage)
            ->all()
            ->toList();

        return $this->respond(array_map(fn ($row) => [
            'id' => (string)$row->get('id'),
            'tipo' => (string)$row->get('tipo'),
            'texto' => (string)$row->get('texto'),
            'data' => $this->service()->iso($row->get('data')),
            'lida' => (bool)$row->get('lida'),
            'href' => (string)$row->get('href'),
        ], $rows));
    }

    public function markRead(): Response
    {
        $this->request->allowMethod(['post']);
        $userId = (string)($this->identidade()['id'] ?? '');
        $this->fetchTable('Notifications')->updateAll(
            ['lida' => true],
            ['lida' => false, 'OR' => ['user_id IS' => null, 'user_id' => $userId]]
        );

        return $this->respond(['ok' => true]);
    }
}
