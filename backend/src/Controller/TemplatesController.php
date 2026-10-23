<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;
use Cake\I18n\DateTime;

class TemplatesController extends AppController
{
    public function index(): Response
    {
        $rows = $this->fetchTable('Templates')->find()
            ->orderBy(['atualizado_em' => 'DESC'])
            ->all()
            ->toList();

        return $this->respond(array_map(fn ($row) => $this->templateOut($row), $rows));
    }

    public function add(): Response
    {
        $this->request->allowMethod(['post']);

        return $this->salvar((array)$this->request->getData(), null);
    }

    public function edit(string $id): Response
    {
        $this->request->allowMethod(['put', 'patch']);
        $dados = (array)$this->request->getData();
        $dados['id'] = $id;

        return $this->salvar($dados, $id);
    }

    public function delete(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $this->exigirGestor();
        $table = $this->fetchTable('Templates');
        $entity = $table->find()->where(['id' => $id])->first();
        if (!$entity) {
            $this->erro('Template não encontrado.', null, 404);
        }
        $table->delete($entity);
        $this->registroAuditoria('template.excluir', 'template', $id);

        return $this->respond(['removido' => true]);
    }

    private function salvar(array $dados, ?string $id): Response
    {
        $this->exigirGestor();
        $nome = $this->texto($dados['nome'] ?? '');
        if ($nome === '') {
            $this->erro('Informe o nome do template.', 'nome');
        }
        $conteudo = $this->texto($dados['conteudo'] ?? '');
        if ($conteudo === '') {
            $this->erro('Escreva o conteúdo do template.', 'conteudo');
        }

        $table = $this->fetchTable('Templates');
        $entity = $id ? $table->find()->where(['id' => $id])->first() : null;
        $agora = $this->agora();

        if ($entity) {
            $entity->set('nome', $nome);
            $entity->set('categoria', $this->texto($dados['categoria'] ?? '') ?: 'Geral');
            $entity->set('conteudo', $conteudo);
            $entity->set('atualizado_em', $agora);
            $status = 200;
        } else {
            $entity = $table->newEntity([
                'nome' => $nome,
                'categoria' => $this->texto($dados['categoria'] ?? '') ?: 'Geral',
                'conteudo' => $conteudo,
                'atualizado_em' => $agora,
                'usos' => 0,
            ]);
            $status = 201;
        }

        $table->saveOrFail($entity);
        $this->registroAuditoria('template.salvar', 'template', (string)$entity->get('id'));

        return $this->respond($this->templateOut($entity), $status);
    }
}
