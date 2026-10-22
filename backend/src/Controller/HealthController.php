<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;
use Throwable;

class HealthController extends AppController
{
    public function index(): Response
    {
        $banco = true;
        try {
            $this->fetchTable('Stages')->find()->first();
        } catch (Throwable $e) {
            $banco = false;
        }

        return $this->respondRaw([
            'status' => $banco ? 'ok' : 'degradado',
            'app' => 'Painel Comercial',
            'php' => PHP_VERSION,
            'cakephp' => \Cake\Core\Configure::version(),
            'banco' => $banco,
            'horario' => (new \DateTimeImmutable())->format('c'),
        ], $banco ? 200 : 503);
    }
}
