<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class InteractionsController extends AppController
{
    public function add(string $leadId): Response
    {
        $this->request->allowMethod(['post']);
        $lead = $this->fetchTable('Leads')->find()->where(['id' => $leadId])->first();
        if (!$lead) {
            $this->erro('Lead não encontrado.', null, 404);
        }

        $dados = (array)$this->request->getData();
        $descricao = $this->texto($dados['descricao'] ?? '');
        $titulo = $this->texto($dados['titulo'] ?? '');

        if ($descricao === '' && $titulo === '') {
            $this->erro('Escreva a interação.');
        }

        $data = $this->data($dados['data'] ?? null) ?? $this->agora();
        $interacao = $this->registrarInteracao(
            $leadId,
            $this->texto($dados['tipo'] ?? '') ?: 'nota',
            $titulo ?: 'Interação',
            $descricao,
            (string)$lead->get('responsavel'),
            $data,
            isset($dados['canal']) ? $this->texto($dados['canal']) : null,
            isset($dados['direcao']) ? $this->texto($dados['direcao']) : null
        );

        $lead->set('ultimo_contato', $data);
        $lead->set('atualizado_em', $data);
        if (array_key_exists('proximoContato', $dados)) {
            $lead->set('proximo_contato', $this->data($dados['proximoContato']));
        }
        $this->fetchTable('Leads')->saveOrFail($lead);
        $this->service()->invalidar();

        return $this->respond($interacao);
    }
}
