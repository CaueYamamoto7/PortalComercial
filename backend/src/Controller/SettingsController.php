<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\PreferencesService;
use Cake\Datasource\ConnectionManager;
use Cake\Http\Response;

class SettingsController extends AppController
{
    public function index(): Response
    {
        $this->exigirGestor();
        $identidade = $this->identidade();
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

        $isAdmin = $this->access()->isAdmin($identidade);

        return $this->respond([
            'empresa' => $isAdmin ? $this->textoConfig('empresa') : [],
            'mensagens' => $this->textoConfig('mensagens'),
            'sistemas' => array_map(fn ($row) => $service->sistemaOut($row), $sistemas),
            'etapas' => $cat['etapas'],
            'origens' => array_map(fn ($row) => $service->origemOut($row), $origens),
            'equipe' => $isAdmin ? array_map(fn ($row) => $this->membroDetalhado($row), $equipe) : [],
            'counts' => $isAdmin ? [
                'leads' => $this->fetchTable('Leads')->find()->where(['deleted_at IS' => null])->count(),
                'interacoes' => $this->fetchTable('Interactions')->find()->count(),
                'tarefas' => $this->fetchTable('Tasks')->find()->count(),
                'campanhas' => $this->fetchTable('Campaigns')->find()->count(),
                'templates' => $this->fetchTable('Templates')->find()->count(),
            ] : [],
            'sessao' => $this->sessao(),
        ]);
    }

    public function save(string $secao): Response
    {
        $this->request->allowMethod(['put', 'patch']);
        if (!in_array($secao, ['empresa', 'mensagens'], true)) {
            $this->erro('Seção de configuração inválida.');
        }
        if ($secao === 'empresa') {
            $this->exigirAdmin();
        } else {
            $this->exigirGestor();
        }

        $dados = (array)$this->request->getData();
        $permitidos = $secao === 'empresa'
            ? ['nome', 'documento', 'email', 'telefone', 'site', 'cidade', 'uf']
            : ['limiteDiario', 'intervalo', 'inicio', 'fim'];
        $novos = [];
        foreach ($permitidos as $chave) {
            if (array_key_exists($chave, $dados)) {
                $novos[$chave] = is_scalar($dados[$chave]) ? trim((string)$dados[$chave]) : '';
            }
        }

        if ($secao === 'empresa') {
            if (($novos['nome'] ?? '') === '' || mb_strlen($novos['nome']) > 190) {
                $this->erro('Informe o nome da empresa.', 'nome');
            }
            if (($novos['email'] ?? '') !== '' && !filter_var($novos['email'], FILTER_VALIDATE_EMAIL)) {
                $this->erro('Informe um e-mail válido.', 'email');
            }
            if (isset($novos['uf'])) {
                $novos['uf'] = mb_substr(mb_strtoupper($novos['uf']), 0, 2);
            }
        } else {
            $novos['limiteDiario'] = max(1, min(2000, (int)($novos['limiteDiario'] ?? 300)));
            $novos['intervalo'] = max(1, min(120, (int)($novos['intervalo'] ?? 10)));
            foreach (['inicio', 'fim'] as $campo) {
                if (isset($novos[$campo]) && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $novos[$campo])) {
                    $this->erro('Horário inválido.', $campo);
                }
            }
        }

        $table = $this->fetchTable('Settings');
        $setting = $table->find()->where(['id' => $secao])->first();
        $atual = $setting ? (array)$setting->get('valor') : [];
        foreach ($novos as $chave => $valor) {
            $atual[$chave] = $valor;
        }

        if ($setting) {
            $setting->set('valor', $atual);
        } else {
            $setting = $table->newEntity(['id' => $secao, 'valor' => $atual]);
        }
        $table->saveOrFail($setting);
        $this->registroAuditoria('configuracao.salvar', 'settings', $secao);

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
        $this->exigirGestor();
        $table = $this->fetchTable('Systems');
        $sistema = $table->find()->where(['id' => $id])->first();
        if (!$sistema) {
            $this->erro('Sistema não encontrado.', null, 404);
        }

        $emUso = false;
        try {
            $emUso = (bool)ConnectionManager::get('default')
                ->execute('SELECT 1 FROM lead_systems WHERE system_id = :id LIMIT 1', ['id' => $id])
                ->fetch();
        } catch (\Throwable) {
            $emUso = $this->fetchTable('Leads')->find()
                ->where(['sistema_ids LIKE' => '%' . $id . '%'])
                ->count() > 0;
        }

        if ($emUso) {
            $sistema->set('ativo', false);
            $table->saveOrFail($sistema);
            $this->registroAuditoria('sistema.arquivar', 'system', $id);

            return $this->respond(['arquivado' => true]);
        }

        $table->delete($sistema);
        $this->registroAuditoria('sistema.excluir', 'system', $id);

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
        $this->exigirGestor();
        $table = $this->fetchTable('Sources');
        $origem = $table->find()->where(['id' => $id])->first();
        if (!$origem) {
            $this->erro('Origem não encontrada.', null, 404);
        }

        $emUso = $this->fetchTable('Leads')->find()
            ->where(['origem_id' => $id, 'deleted_at IS' => null])
            ->count() > 0;
        if ($emUso) {
            $origem->set('ativo', false);
            $table->saveOrFail($origem);
            $this->service()->invalidar();
            $this->registroAuditoria('origem.arquivar', 'source', $id);

            return $this->respond(['arquivado' => true]);
        }

        $table->delete($origem);
        $this->service()->invalidar();
        $this->registroAuditoria('origem.excluir', 'source', $id);

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
        $this->exigirGestor();
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
        $this->exigirGestor();
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
        $this->registroAuditoria('etapa.excluir', 'stage', $id, ['movidos' => $movidos]);

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

        $telefone = $this->texto($dados['telefone'] ?? $usuario->get('telefone'));
        if ($telefone !== '') {
            $telefone = $this->normalizarTelefone($telefone);
            if (!$this->telefoneValido($telefone)) {
                $this->erro('Informe um WhatsApp válido com DDD.', 'telefone');
            }
        }

        $nomeAnterior = (string)$usuario->get('nome');
        $usuario->set('nome', $nome);
        $usuario->set('email', $email);
        $usuario->set('cargo', $this->texto($dados['cargo'] ?? $usuario->get('cargo')));
        $usuario->set('telefone', $telefone !== '' ? $telefone : null);
        $usuario->set('iniciais', $this->iniciais($nome));
        $usuario->set('atualizado_em', $this->agora());
        $table->saveOrFail($usuario);

        if ($nomeAnterior !== $nome) {
            $this->fetchTable('Leads')->updateAll(['responsavel' => $nome], ['responsavel' => $nomeAnterior]);
            $this->fetchTable('Tasks')->updateAll(['responsavel' => $nome], ['responsavel' => $nomeAnterior]);
            $this->fetchTable('Campaigns')->updateAll(['responsavel' => $nome], ['responsavel' => $nomeAnterior]);
        }

        $this->request->getSession()->write('Auth', [
            'id' => (string)$usuario->get('id'),
            'nome' => (string)$usuario->get('nome'),
            'email' => (string)$usuario->get('email'),
            'cargo' => (string)$usuario->get('cargo'),
            'telefone' => (string)($usuario->get('telefone') ?? ''),
            'perfil' => (string)$usuario->get('perfil'),
            'role' => $this->access()->roleFromIdentity(['perfil' => (string)$usuario->get('perfil'), 'role' => $usuario->get('role')]),
            'iniciais' => (string)$usuario->get('iniciais'),
            'status' => (string)$usuario->get('status'),
            'mustChangePassword' => (bool)$usuario->get('must_change_password'),
            'authVersion' => (int)($usuario->get('auth_version') ?? 1),
        ]);
        $this->service()->invalidar();
        $this->registroAuditoria('perfil.salvar', 'user', (string)$usuario->get('id'));

        return $this->respond($this->membroDetalhado($usuario));
    }

    public function preferencias(): Response
    {
        $this->request->allowMethod(['put', 'patch']);
        $identidade = $this->identidade();
        $userId = (string)($identidade['id'] ?? '');
        if ($userId === '') {
            $this->erro('Sessão inválida.', null, 401);
        }

        $prefs = (new PreferencesService())->salvar($userId, (array)$this->request->getData());
        $this->registroAuditoria('preferencias.salvar', 'user', $userId);

        return $this->respond($prefs);
    }

    public function alterarSenha(): Response
    {
        $this->request->allowMethod(['put', 'patch']);
        $identidade = $this->identidade();
        $table = $this->fetchTable('Users');
        $usuario = $table->find()->where(['id' => (string)($identidade['id'] ?? '')])->first();
        if (!$usuario) {
            $this->erro('Usuário não encontrado.', null, 404);
        }

        $dados = (array)$this->request->getData();
        $atual = (string)($dados['atual'] ?? '');
        $nova = (string)($dados['nova'] ?? '');
        $confirmacao = (string)($dados['confirmacao'] ?? '');
        $hashAtual = (string)$usuario->get('senha_hash');

        if ($atual === '') {
            $this->erro('Informe a senha atual.', 'atual');
        }
        if (!password_verify($atual, $hashAtual)) {
            $this->erro('A senha atual está incorreta.', 'atual');
        }
        if (mb_strlen($nova) < 8) {
            $this->erro('A nova senha deve ter pelo menos 8 caracteres.', 'nova');
        }
        if ($nova !== $confirmacao) {
            $this->erro('A confirmação não confere com a nova senha.', 'confirmacao');
        }
        if (password_verify($nova, $hashAtual)) {
            $this->erro('A nova senha precisa ser diferente da atual.', 'nova');
        }

        $versao = (int)($usuario->get('auth_version') ?? 1) + 1;
        $usuario->set('senha_hash', password_hash($nova, PASSWORD_DEFAULT));
        $usuario->set('auth_version', $versao);
        $usuario->set('atualizado_em', $this->agora());
        $table->saveOrFail($usuario);

        $identidade['authVersion'] = $versao;
        $this->request->getSession()->renew();
        $this->request->getSession()->write('Auth', $identidade);
        $this->registroAuditoria('senha.alterar', 'user', (string)$usuario->get('id'));

        return $this->respond(['ok' => true]);
    }

    public function addMember(): Response
    {
        $this->request->allowMethod(['post']);
        $this->exigirAdmin();
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

        $senha = (string)($dados['senha'] ?? '');
        if (mb_strlen($senha) < 8) {
            $this->erro('Defina uma senha temporária com pelo menos 8 caracteres.', 'senha');
        }

        [$perfil, $role] = $this->resolverPerfil($this->texto($dados['perfil'] ?? ''));

        $table = $this->fetchTable('Users');
        $entity = $table->newEntity([
            'nome' => $nome,
            'email' => $email,
            'senha_hash' => password_hash($senha, PASSWORD_DEFAULT),
            'cargo' => $perfil,
            'perfil' => $perfil,
            'role' => $role,
            'status' => 'ativo',
            'must_change_password' => true,
            'iniciais' => $this->iniciais($nome),
            'criado_em' => $this->agora(),
            'atualizado_em' => $this->agora(),
        ]);
        $table->saveOrFail($entity);
        $this->service()->invalidar();
        $this->registroAuditoria('equipe.adicionar', 'user', (string)$entity->get('id'), ['role' => $role]);

        return $this->respond($this->membroDetalhado($entity), 201);
    }

    public function deleteMember(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $this->exigirAdmin();
        $table = $this->fetchTable('Users');
        $membro = $table->find()->where(['id' => $id])->first();
        if (!$membro) {
            $this->erro('Membro não encontrado.', null, 404);
        }

        $identidade = $this->identidade();
        if ((string)$membro->get('id') === (string)($identidade['id'] ?? '')) {
            $this->erro('Não é possível remover o próprio usuário.');
        }
        $role = $this->access()->roleFromIdentity([
            'perfil' => (string)$membro->get('perfil'),
            'role' => $membro->get('role'),
        ]);
        $admins = $table->find()->where(['role' => 'admin'])->count();
        if ($role === 'admin' && $admins <= 1) {
            $this->erro('Não é possível remover a administradora da conta.');
        }

        $table->delete($membro);
        $this->service()->invalidar();
        $this->registroAuditoria('equipe.remover', 'user', $id);

        return $this->respond(['removido' => true]);
    }

    // ------------------------------------------------------------------

    private function salvarSistema(array $dados, ?string $id): Response
    {
        $this->exigirGestor();
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
            $entity->set('cor', $this->corValida($dados['cor'] ?? '', (string)$entity->get('cor')));
            $entity->set('ativo', ($dados['ativo'] ?? true) !== false);
            $status = 200;
        } else {
            $entity = $table->newEntity([
                'nome' => $nome,
                'descricao' => $this->texto($dados['descricao'] ?? ''),
                'cor' => $this->corValida($dados['cor'] ?? '', '#0B6B57'),
                'ativo' => true,
                'criado_em' => $this->agora(),
            ]);
            $status = 201;
        }
        $table->saveOrFail($entity);
        $this->service()->invalidar();
        $this->registroAuditoria('sistema.salvar', 'system', (string)$entity->get('id'));

        return $this->respond($this->service()->sistemaOut($entity), $status);
    }

    private function salvarOrigem(array $dados, ?string $id): Response
    {
        $this->exigirGestor();
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
        $this->registroAuditoria('origem.salvar', 'source', (string)$entity->get('id'));

        return $this->respond($this->service()->origemOut($entity), $status);
    }

    private function salvarEtapa(array $dados, ?string $id): Response
    {
        $this->exigirGestor();
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
            $entity->set('cor', $this->corValida($dados['cor'] ?? '', (string)$entity->get('cor')));
            $entity->set('tipo', $tipo);
            $status = 200;
        } else {
            $max = $table->find()->select(['max' => $table->find()->func()->max('ordem')])->first();
            $entity = $table->newEntity([
                'nome' => $nome,
                'cor' => $this->corValida($dados['cor'] ?? '', '#0B6B57'),
                'tipo' => $tipo,
                'ordem' => (int)($max?->get('max') ?? -1) + 1,
            ]);
            $status = 201;
        }
        $table->saveOrFail($entity);
        $this->service()->invalidar();
        $this->registroAuditoria('etapa.salvar', 'stage', (string)$entity->get('id'));

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
        $membro['telefone'] = (string)($row->get('telefone') ?? '');
        $membro['role'] = $this->access()->roleFromIdentity([
            'perfil' => (string)$row->get('perfil'),
            'role' => $row->get('role'),
        ]);

        return $membro;
    }

    /** @return array{0: string, 1: string} */
    private function resolverPerfil(string $perfil): array
    {
        $normalizado = $this->service()->normalizar($perfil);
        if (str_contains($normalizado, 'admin')) {
            return ['Administrador', 'admin'];
        }
        if (str_contains($normalizado, 'gestor')) {
            return ['Gestor comercial', 'gestor'];
        }

        return ['Consultor comercial', 'consultor'];
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
            'role' => $this->access()->roleFromIdentity($identidade),
            'lembrar' => false,
            'desde' => $this->agora()->format('c'),
        ];
    }
}
