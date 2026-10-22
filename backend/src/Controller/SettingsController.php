<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

class SettingsController extends AppController
{
    public function index(): Response
    {
        $service = $this->service();
        $cat = $service->catalogo();

        $sistemas = $this->fetchTable('Systems')->find()
            ->orderBy(['criado_em' => 'ASC', 'nome' => 'ASC'])
            ->all()
            ->toList();
        $origens = $this->fetchTable('Sources')->find()
            ->orderBy(['criado_em' => 'ASC', 'nome' => 'ASC'])
            ->all()
            ->toList();
        $equipe = $this->fetchTable('Users')->find()->orderBy(['nome' => 'ASC'])->all()->toList();

        return $this->respond([
            'empresa' => $this->textoConfig('empresa'),
            'mensagens' => $this->textoConfig('mensagens'),
            'sistemas' => array_map(fn ($row) => $service->sistemaOut($row), $sistemas),
            'etapas' => $cat['etapas'],
            'origens' => array_map(fn ($row) => $service->origemOut($row), $origens),
            'equipe' => array_map(fn ($row) => $this->membroDetalhado($row), $equipe),
            'counts' => [
                'leads' => $this->fetchTable('Leads')->find()->count(),
                'interacoes' => $this->fetchTable('Interactions')->find()->count(),
                'tarefas' => $this->fetchTable('Tasks')->find()->count(),
                'campanhas' => $this->fetchTable('Campaigns')->find()->count(),
                'templates' => $this->fetchTable('Templates')->find()->count(),
            ],
            'sessao' => $this->sessao(),
        ]);
    }

    public function save(string $secao): Response
    {
        $this->request->allowMethod(['put', 'patch']);
        if (!in_array($secao, ['empresa', 'mensagens'], true)) {
            $this->erro('Seção de configuração inválida.');
        }

        $table = $this->fetchTable('Settings');
        $setting = $table->find()->where(['id' => $secao])->first();
        $atual = $setting ? (array)$setting->get('valor') : [];
        $dados = (array)$this->request->getData();

        foreach ($dados as $chave => $valor) {
            $atual[(string)$chave] = $valor;
        }

        if ($setting) {
            $setting->set('valor', $atual);
        } else {
            $setting = $table->newEntity(['id' => $secao, 'valor' => $atual]);
        }
        $table->saveOrFail($setting);

        return $this->respond($atual);
    }

    // ------------------------------------------------------------------
    // Sistemas
    // ------------------------------------------------------------------

    public function addSystem(): Response
    {
        $this->request->allowMethod(['post']);

        return $this->salvarSistema((array)$this->request->getData(), null);
    }

    public function editSystem(string $id): Response
    {
        $this->request->allowMethod(['put', 'patch']);

        return $this->salvarSistema((array)$this->request->getData(), $id);
    }

    public function deleteSystem(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $table = $this->fetchTable('Systems');
        $sistema = $table->find()->where(['id' => $id])->first();
        if (!$sistema) {
            $this->erro('Sistema não encontrado.', null, 404);
        }

        $emUso = false;
        foreach ($this->service()->todos() as $lead) {
            if (in_array($id, $lead['sistemaIds'], true)) {
                $emUso = true;
                break;
            }
        }

        $this->service()->invalidar();
        if ($emUso) {
            $sistema->set('ativo', false);
            $table->saveOrFail($sistema);

            return $this->respond(['arquivado' => true]);
        }

        $table->delete($sistema);

        return $this->respond(['removido' => true]);
    }

    // ------------------------------------------------------------------
    // Origens
    // ------------------------------------------------------------------

    public function addSource(): Response
    {
        $this->request->allowMethod(['post']);

        return $this->salvarOrigem((array)$this->request->getData(), null);
    }

    public function editSource(string $id): Response
    {
        $this->request->allowMethod(['put', 'patch']);

        return $this->salvarOrigem((array)$this->request->getData(), $id);
    }

    public function deleteSource(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $table = $this->fetchTable('Sources');
        $origem = $table->find()->where(['id' => $id])->first();
        if (!$origem) {
            $this->erro('Origem não encontrada.', null, 404);
        }

        $emUso = $this->fetchTable('Leads')->find()->where(['origem_id' => $id])->count() > 0;
        if ($emUso) {
            $origem->set('ativo', false);
            $table->saveOrFail($origem);
            $this->service()->invalidar();

            return $this->respond(['arquivado' => true]);
        }

        $table->delete($origem);
        $this->service()->invalidar();

        return $this->respond(['removido' => true]);
    }

    // ------------------------------------------------------------------
    // Etapas
    // ------------------------------------------------------------------

    public function addStage(): Response
    {
        $this->request->allowMethod(['post']);

        return $this->salvarEtapa((array)$this->request->getData(), null);
    }

    public function editStage(string $id): Response
    {
        $this->request->allowMethod(['put', 'patch']);

        return $this->salvarEtapa((array)$this->request->getData(), $id);
    }

    public function reorderStages(): Response
    {
        $this->request->allowMethod(['post']);
        $ids = $this->lista($this->request->getData('ids'));
        $table = $this->fetchTable('Stages');
        $etapas = $table->find()->all()->toList();

        $posicao = [];
        foreach ($ids as $indice => $id) {
            $posicao[$id] = $indice;
        }
        usort($etapas, function ($a, $b) use ($posicao): int {
            $pa = $posicao[(string)$a->get('id')] ?? (int)$a->get('ordem');
            $pb = $posicao[(string)$b->get('id')] ?? (int)$b->get('ordem');

            return $pa <=> $pb;
        });

        $abertas = array_values(array_filter($etapas, fn ($e) => (string)$e->get('tipo') === 'aberto'));
        $terminais = array_values(array_filter($etapas, fn ($e) => (string)$e->get('tipo') !== 'aberto'));
        $ordenadas = array_merge($abertas, $terminais);

        foreach ($ordenadas as $indice => $etapa) {
            $etapa->set('ordem', $indice);
            $table->saveOrFail($etapa);
        }
        $this->service()->invalidar();

        return $this->respond($this->service()->catalogo()['etapas']);
    }

    public function deleteStage(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $table = $this->fetchTable('Stages');
        $etapa = $table->find()->where(['id' => $id])->first();
        if (!$etapa) {
            $this->erro('Etapa não encontrada.', null, 404);
        }

        $etapas = $table->find()->orderBy(['ordem' => 'ASC'])->all()->toList();
        if (count($etapas) <= 2) {
            $this->erro('O funil precisa ter pelo menos duas etapas.');
        }

        $restantes = array_values(array_filter($etapas, fn ($e) => (string)$e->get('id') !== $id));
        $abertas = array_values(array_filter($restantes, fn ($e) => (string)$e->get('tipo') === 'aberto'));
        if (!$abertas) {
            $this->erro('O funil precisa ter pelo menos uma etapa em aberto.');
        }
        $destino = $abertas[0];

        $movidos = $this->fetchTable('Leads')->updateAll(
            ['etapa_id' => (string)$destino->get('id')],
            ['etapa_id' => $id]
        );

        $table->delete($etapa);
        foreach ($restantes as $indice => $restante) {
            $restante->set('ordem', $indice);
            $table->saveOrFail($restante);
        }
        $this->service()->invalidar();

        return $this->respond([
            'removido' => true,
            'movidos' => $movidos,
            'destino' => (string)$destino->get('nome'),
        ]);
    }

    // ------------------------------------------------------------------
    // Equipe
    // ------------------------------------------------------------------

    public function perfil(): Response
    {
        $this->request->allowMethod(['put', 'patch']);
        $identidade = $this->identidade();
        $table = $this->fetchTable('Users');
        $usuario = $table->find()->where(['id' => (string)($identidade['id'] ?? '')])->first();
        if (!$usuario) {
            $this->erro('Usuário não encontrado.', null, 404);
        }

        $dados = (array)$this->request->getData();
        $nome = $this->texto($dados['nome'] ?? $usuario->get('nome'));
        if (mb_strlen($nome) < 2) {
            $this->erro('Informe seu nome completo.', 'nome');
        }
        $email = mb_strtolower($this->texto($dados['email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->erro('Informe um e-mail válido.', 'email');
        }
        $outro = $table->find()->where(['email' => $email, 'id !=' => (string)$usuario->get('id')])->count();
        if ($outro > 0) {
            $this->erro('Já existe um usuário com este e-mail.', 'email');
        }

        $usuario->set('nome', $nome);
        $usuario->set('email', $email);
        $usuario->set('cargo', $this->texto($dados['cargo'] ?? $usuario->get('cargo')));
        $usuario->set('iniciais', $this->iniciais($nome));
        $usuario->set('atualizado_em', $this->agora());
        $table->saveOrFail($usuario);

        $this->request->getSession()->write('Auth', [
            'id' => (string)$usuario->get('id'),
            'nome' => (string)$usuario->get('nome'),
            'email' => (string)$usuario->get('email'),
            'cargo' => (string)$usuario->get('cargo'),
            'perfil' => (string)$usuario->get('perfil'),
            'iniciais' => (string)$usuario->get('iniciais'),
            'status' => (string)$usuario->get('status'),
        ]);
        $this->service()->invalidar();

        return $this->respond($this->membroDetalhado($usuario));
    }

    public function addMember(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $nome = $this->texto($dados['nome'] ?? '');
        if ($nome === '') {
            $this->erro('Informe o nome do membro.', 'nome');
        }
        $email = mb_strtolower($this->texto($dados['email'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->erro('Informe um e-mail válido.', 'email');
        }
        $existe = $this->fetchTable('Users')->find()->where(['email' => $email])->count();
        if ($existe > 0) {
            $this->erro('Já existe um membro com este e-mail.', 'email');
        }

        $table = $this->fetchTable('Users');
        $entity = $table->newEntity([
            'nome' => $nome,
            'email' => $email,
            'senha_hash' => '',
            'cargo' => $this->texto($dados['perfil'] ?? '') ?: 'Consultor comercial',
            'perfil' => $this->texto($dados['perfil'] ?? '') ?: 'Consultor comercial',
            'status' => 'convite',
            'iniciais' => $this->iniciais($nome),
            'criado_em' => $this->agora(),
            'atualizado_em' => $this->agora(),
        ]);
        $table->saveOrFail($entity);
        $this->service()->invalidar();

        return $this->respond($this->membroDetalhado($entity), 201);
    }

    public function deleteMember(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $table = $this->fetchTable('Users');
        $membro = $table->find()->where(['id' => $id])->first();
        if (!$membro) {
            $this->erro('Membro não encontrado.', null, 404);
        }

        $identidade = $this->identidade();
        if ((string)$membro->get('id') === (string)($identidade['id'] ?? '')) {
            $this->erro('Não é possível remover o próprio usuário.');
        }
        $admins = $table->find()->where(['perfil' => 'Administrador'])->count();
        if ((string)$membro->get('perfil') === 'Administrador' && $admins <= 1) {
            $this->erro('Não é possível remover a administradora da conta.');
        }

        $table->delete($membro);
        $this->service()->invalidar();

        return $this->respond(['removido' => true]);
    }

    // ------------------------------------------------------------------

    private function salvarSistema(array $dados, ?string $id): Response
    {
        $nome = $this->texto($dados['nome'] ?? '');
        if ($nome === '') {
            $this->erro('Informe o nome do sistema.', 'nome');
        }

        $table = $this->fetchTable('Systems');
        $duplicado = $table->find()
            ->where(['id !=' => $id ?: ''])
            ->all()
            ->toList();
        $alvo = $this->service()->normalizar($nome);
        foreach ($duplicado as $sistema) {
            if ($this->service()->normalizar((string)$sistema->get('nome')) === $alvo) {
                $this->erro('Já existe um sistema com este nome.', 'nome');
            }
        }

        $entity = $id ? $table->find()->where(['id' => $id])->first() : null;
        if ($id && !$entity) {
            $this->erro('Sistema não encontrado.', null, 404);
        }

        if ($entity) {
            $entity->set('nome', $nome);
            $entity->set('descricao', $this->texto($dados['descricao'] ?? ''));
            $entity->set('cor', $this->texto($dados['cor'] ?? '') ?: (string)$entity->get('cor'));
            $entity->set('ativo', ($dados['ativo'] ?? true) !== false);
            $status = 200;
        } else {
            $entity = $table->newEntity([
                'nome' => $nome,
                'descricao' => $this->texto($dados['descricao'] ?? ''),
                'cor' => $this->texto($dados['cor'] ?? '') ?: '#0B6B57',
                'ativo' => true,
                'criado_em' => $this->agora(),
            ]);
            $status = 201;
        }
        $table->saveOrFail($entity);
        $this->service()->invalidar();

        return $this->respond($this->service()->sistemaOut($entity), $status);
    }

    private function salvarOrigem(array $dados, ?string $id): Response
    {
        $nome = $this->texto($dados['nome'] ?? '');
        if ($nome === '') {
            $this->erro('Informe o nome da origem.', 'nome');
        }

        $table = $this->fetchTable('Sources');
        $alvo = $this->service()->normalizar($nome);
        foreach ($table->find()->all()->toList() as $origem) {
            if ((string)$origem->get('id') !== (string)$id
                && $this->service()->normalizar((string)$origem->get('nome')) === $alvo
            ) {
                $this->erro('Já existe uma origem com este nome.', 'nome');
            }
        }

        $entity = $id ? $table->find()->where(['id' => $id])->first() : null;
        if ($id && !$entity) {
            $this->erro('Origem não encontrada.', null, 404);
        }

        if ($entity) {
            $entity->set('nome', $nome);
            $entity->set('ativo', ($dados['ativo'] ?? true) !== false);
            $status = 200;
        } else {
            $entity = $table->newEntity([
                'nome' => $nome,
                'ativo' => true,
                'criado_em' => $this->agora(),
            ]);
            $status = 201;
        }
        $table->saveOrFail($entity);
        $this->service()->invalidar();

        return $this->respond($this->service()->origemOut($entity), $status);
    }

    private function salvarEtapa(array $dados, ?string $id): Response
    {
        $nome = $this->texto($dados['nome'] ?? '');
        if ($nome === '') {
            $this->erro('Informe o nome da etapa.', 'nome');
        }

        $table = $this->fetchTable('Stages');
        $alvo = $this->service()->normalizar($nome);
        foreach ($table->find()->all()->toList() as $etapa) {
            if ((string)$etapa->get('id') !== (string)$id
                && $this->service()->normalizar((string)$etapa->get('nome')) === $alvo
            ) {
                $this->erro('Já existe uma etapa com este nome.', 'nome');
            }
        }

        $entity = $id ? $table->find()->where(['id' => $id])->first() : null;
        if ($id && !$entity) {
            $this->erro('Etapa não encontrada.', null, 404);
        }

        $tipo = $this->texto($dados['tipo'] ?? '');
        if (!in_array($tipo, ['aberto', 'ganho', 'perdido'], true)) {
            $tipo = $entity ? (string)$entity->get('tipo') : 'aberto';
        }

        if ($entity && (string)$entity->get('tipo') === 'aberto' && $tipo !== 'aberto') {
            $outraAberta = $table->find()
                ->where(['id !=' => (string)$entity->get('id'), 'tipo' => 'aberto'])
                ->count();
            if ($outraAberta === 0) {
                $this->erro('O funil precisa ter pelo menos uma etapa em aberto.', 'tipo');
            }
        }

        if ($entity) {
            $entity->set('nome', $nome);
            $entity->set('cor', $this->texto($dados['cor'] ?? '') ?: (string)$entity->get('cor'));
            $entity->set('tipo', $tipo);
            $status = 200;
        } else {
            $max = $table->find()->select(['max' => $table->find()->func()->max('ordem')])->first();
            $entity = $table->newEntity([
                'nome' => $nome,
                'cor' => $this->texto($dados['cor'] ?? '') ?: '#0B6B57',
                'tipo' => $tipo,
                'ordem' => (int)($max?->get('max') ?? -1) + 1,
            ]);
            $status = 201;
        }
        $table->saveOrFail($entity);
        $this->service()->invalidar();

        return $this->respond($this->service()->etapaOut($entity), $status);
    }

    private function textoConfig(string $chave): array
    {
        $setting = $this->fetchTable('Settings')->find()->where(['id' => $chave])->first();

        return $setting ? (array)$setting->get('valor') : [];
    }

    private function membroDetalhado(object $row): array
    {
        $membro = $this->service()->membroOut($row);
        $membro['cargo'] = (string)$row->get('cargo');

        return $membro;
    }

    private function sessao(): array
    {
        $identidade = $this->identidade();
        $empresa = $this->textoConfig('empresa');

        return [
            'nome' => (string)($identidade['nome'] ?? ''),
            'email' => (string)($identidade['email'] ?? ''),
            'cargo' => (string)($identidade['cargo'] ?? ''),
            'empresa' => (string)($empresa['nome'] ?? ''),
            'iniciais' => (string)($identidade['iniciais'] ?? ''),
            'lembrar' => false,
            'desde' => $this->agora()->format('c'),
        ];
    }
}
