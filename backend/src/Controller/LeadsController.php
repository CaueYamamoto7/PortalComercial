<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;
use Cake\I18n\DateTime;

class LeadsController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $service = $this->service();

        $todos = array_map(fn ($lead) => $service->enriquecer($lead), $service->todos());
        $filtrados = $service->filtrar($todos, $params);
        $filtrados = $service->ordenar(
            $filtrados,
            (string)($params['sort'] ?? 'atualizadoEm'),
            (string)($params['direction'] ?? 'desc')
        );
        $pagina = $service->paginar(
            $filtrados,
            (int)($params['page'] ?? 1),
            (int)($params['perPage'] ?? 12)
        );

        return $this->respond([
            'data' => $this->serializarLeads($pagina['data']),
            'meta' => $pagina['meta'],
            'stats' => $service->stats($todos),
            'facets' => $service->facets(),
        ]);
    }

    public function view(string $id): Response
    {
        $service = $this->service();
        $lead = $service->leadCompleto($id);
        if (!$lead) {
            $this->erro('Lead não encontrado.', null, 404);
        }

        $interacoes = $this->fetchTable('Interactions')->find()
            ->where(['lead_id' => $id])
            ->orderBy(['data' => 'DESC'])
            ->all()
            ->toList();

        $tarefas = $this->fetchTable('Tasks')->find()
            ->where(['lead_id' => $id])
            ->orderBy(['data' => 'ASC'])
            ->all()
            ->toList();

        return $this->respond([
            'lead' => $this->serializarLead($lead),
            'interacoes' => array_map(fn ($row) => $this->interacaoOut($row), $interacoes),
            'tarefas' => array_map(fn ($row) => $this->tarefaEnriquecida($row, $lead), $tarefas),
        ]);
    }

    public function add(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $campos = $this->montarLead($dados);
        $this->validarLead($campos, null);

        $table = $this->fetchTable('Leads');
        $entity = $table->newEntity($campos);
        $table->saveOrFail($entity);

        $this->registrarInteracao(
            (string)$entity->get('id'),
            'nota',
            'Lead cadastrado',
            'Lead criado manualmente no Painel Comercial.',
            (string)$entity->get('responsavel'),
            $entity->get('criado_em')
        );
        $this->service()->invalidar();

        return $this->respond($this->serializarLead($this->service()->leadCompleto((string)$entity->get('id'))), 201);
    }

    public function edit(string $id): Response
    {
        $this->request->allowMethod(['put', 'patch']);
        $table = $this->fetchTable('Leads');
        $entity = $table->find()->where(['id' => $id])->first();
        if (!$entity) {
            $this->erro('Lead não encontrado.', null, 404);
        }

        $base = $this->service()->leadBaseOut($entity);
        $dados = (array)$this->request->getData();
        $campos = $this->montarLead($dados, $base);
        $this->validarLead($campos, $id);

        $etapaAnterior = (string)$entity->get('etapa_id');

        $table->patchEntity($entity, $campos);
        $table->saveOrFail($entity);

        if ($etapaAnterior !== (string)$entity->get('etapa_id')) {
            $etapa = $this->fetchTable('Stages')->find()->where(['id' => $entity->get('etapa_id')])->first();
            $this->registrarInteracao(
                $id,
                'etapa',
                'Etapa alterada',
                'Lead movido para ' . ($etapa?->get('nome') ?? '') . '.',
                (string)$entity->get('responsavel'),
                $entity->get('atualizado_em')
            );
        }
        $this->service()->invalidar();

        return $this->respond($this->serializarLead($this->service()->leadCompleto($id)));
    }

    public function mover(string $id): Response
    {
        $this->request->allowMethod(['post']);
        $table = $this->fetchTable('Leads');
        $entity = $table->find()->where(['id' => $id])->first();
        if (!$entity) {
            $this->erro('Lead não encontrado.', null, 404);
        }

        $dados = (array)$this->request->getData();
        $etapaId = $this->texto($dados['etapaId'] ?? '');
        $etapa = $this->fetchTable('Stages')->find()->where(['id' => $etapaId])->first();
        if (!$etapa) {
            $this->erro('Etapa inválida.', 'etapaId');
        }

        if ((string)$entity->get('etapa_id') === $etapaId) {
            return $this->respond($this->serializarLead($this->service()->leadCompleto($id)));
        }

        $agora = $this->agora();
        $entity->set('etapa_id', $etapaId);
        $entity->set('atualizado_em', $agora);
        if (in_array((string)$etapa->get('tipo'), ['ganho', 'perdido'], true)) {
            $entity->set('proximo_contato', null);
        }
        $table->saveOrFail($entity);

        $this->registrarInteracao(
            $id,
            'etapa',
            'Etapa alterada',
            'Lead movido para ' . (string)$etapa->get('nome') . '.',
            (string)$entity->get('responsavel'),
            $agora
        );
        $this->service()->invalidar();

        return $this->respond($this->serializarLead($this->service()->leadCompleto($id)));
    }

    public function delete(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        $table = $this->fetchTable('Leads');
        $entity = $table->find()->where(['id' => $id])->first();
        if (!$entity) {
            $this->erro('Lead não encontrado.', null, 404);
        }

        $this->fetchTable('Interactions')->deleteAll(['lead_id' => $id]);
        $this->fetchTable('Tasks')->deleteAll(['lead_id' => $id]);
        $table->delete($entity);
        $this->service()->invalidar();

        return $this->respond(['removido' => true]);
    }

    public function importar(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();
        $linhas = (array)($dados['linhas'] ?? []);

        $service = $this->service();
        $cat = $service->catalogo();
        $etapasPorId = array_column($cat['etapas'], null, 'id');
        $etapasPorNome = [];
        foreach ($cat['etapas'] as $etapa) {
            $etapasPorNome[$service->normalizar($etapa['nome'])] = $etapa;
        }
        $sistemasPorId = array_column($cat['sistemas'], null, 'id');
        $sistemasPorNome = [];
        foreach ($cat['sistemas'] as $sistema) {
            $sistemasPorNome[$service->normalizar($sistema['nome'])] = $sistema;
        }
        $origensPorId = array_column($cat['origens'], null, 'id');
        $origensPorNome = [];
        foreach ($cat['origens'] as $origem) {
            $origensPorNome[$service->normalizar($origem['nome'])] = $origem;
        }
        $equipe = array_column($cat['equipe'], 'nome');

        $importados = 0;
        $duplicados = 0;
        $invalidos = 0;
        $detalhes = [];
        $table = $this->fetchTable('Leads');
        $telefones = $table->find()->select(['telefone'])->all()->extract('telefone')->toList();
        $telefones = array_map('strval', $telefones);

        $etapaPadrao = null;
        foreach ($cat['etapas'] as $etapa) {
            if ($etapa['tipo'] === 'aberto') {
                $etapaPadrao = $etapa;
                break;
            }
        }

        foreach ($linhas as $indice => $linha) {
            $linha = (array)$linha;
            $numero = (int)$indice + 2;
            $nome = $this->texto($linha['nome'] ?? $linha['name'] ?? '');
            $telefone = $this->texto($linha['telefone'] ?? $linha['phone'] ?? $linha['celular'] ?? $linha['whatsapp'] ?? '');
            $email = mb_strtolower($this->texto($linha['email'] ?? $linha['e_mail'] ?? $linha['mail'] ?? ''));

            if ($nome === '') {
                $invalidos++;
                $detalhes[] = ['linha' => $numero, 'motivo' => 'Nome ausente'];
                continue;
            }
            $telefone = $this->normalizarTelefone($telefone);
            if (!$this->telefoneValido($telefone)) {
                $invalidos++;
                $detalhes[] = ['linha' => $numero, 'motivo' => 'Telefone inválido'];
                continue;
            }
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $invalidos++;
                $detalhes[] = ['linha' => $numero, 'motivo' => 'E-mail inválido'];
                continue;
            }
            if (in_array($telefone, $telefones, true)) {
                $duplicados++;
                $detalhes[] = ['linha' => $numero, 'motivo' => 'Telefone já cadastrado'];
                continue;
            }

            $sistemaIds = [];
            $sistemasRaw = $this->lista($linha['sistemas_interesse'] ?? $linha['sistemas'] ?? $linha['sistema'] ?? '');
            foreach ($sistemasRaw as $valor) {
                if (isset($sistemasPorId[$valor])) {
                    $sistemaIds[] = $valor;
                } elseif (isset($sistemasPorNome[$service->normalizar($valor)])) {
                    $sistemaIds[] = $sistemasPorNome[$service->normalizar($valor)]['id'];
                }
            }

            $origemTexto = $this->texto($linha['origem'] ?? '');
            $origemId = isset($origensPorId[$origemTexto])
                ? $origemTexto
                : ($origensPorNome[$service->normalizar($origemTexto)]['id'] ?? 'org_outro');

            $etapaTexto = $this->texto($linha['etapa'] ?? '');
            $etapaId = isset($etapasPorId[$etapaTexto])
                ? $etapaTexto
                : ($etapasPorNome[$service->normalizar($etapaTexto)]['id'] ?? ($etapaPadrao['id'] ?? 'et_novo'));

            $responsavel = $this->texto($linha['responsavel'] ?? '');
            if (!in_array($responsavel, $equipe, true)) {
                $responsavel = $this->usuarioNome();
            }

            $possui = $service->normalizar($this->texto($linha['possui_sistema'] ?? $linha['possui'] ?? ''));
            if (str_starts_with($possui, 'sim')) {
                $possuiSistema = 'sim';
            } elseif (str_starts_with($possui, 'nao') || str_starts_with($possui, 'não')) {
                $possuiSistema = 'nao';
            } else {
                $possuiSistema = 'nao_informado';
            }

            $prioridade = $service->normalizar($this->texto($linha['prioridade'] ?? ''));
            if (!in_array($prioridade, ['alta', 'media', 'baixa'], true)) {
                $prioridade = 'media';
            }

            $agora = $this->agora();
            $campos = [
                'nome' => $nome,
                'empresa' => $this->texto($linha['empresa'] ?? $linha['company'] ?? ''),
                'cargo' => $this->texto($linha['cargo'] ?? ''),
                'telefone' => $telefone,
                'email' => $email,
                'cidade' => $this->texto($linha['cidade'] ?? ''),
                'uf' => mb_substr(mb_strtoupper($this->texto($linha['uf'] ?? $linha['estado'] ?? '')), 0, 2),
                'origem_id' => $origemId,
                'origem_detalhe' => $this->texto($linha['evento'] ?? $linha['origem_detalhe'] ?? ''),
                'sistema_ids' => array_values(array_unique($sistemaIds)),
                'possui_sistema' => $possuiSistema,
                'sistema_atual' => $this->texto($linha['sistema_atual'] ?? ''),
                'etapa_id' => $etapaId,
                'prioridade' => $prioridade,
                'responsavel' => $responsavel,
                'proximo_contato' => $this->data($linha['proximo_contato'] ?? null),
                'ultimo_contato' => null,
                'observacoes' => $this->texto($linha['observacoes'] ?? $linha['notas'] ?? ''),
                'tags' => $this->lista($linha['tags'] ?? 'Importado'),
                'nao_contatar' => false,
                'criado_em' => $agora,
                'atualizado_em' => $agora,
                'motivo_perda' => '',
            ];

            $entity = $table->newEntity($campos);
            $table->saveOrFail($entity);
            $telefones[] = $telefone;
            $importados++;

            $this->registrarInteracao(
                (string)$entity->get('id'),
                'nota',
                'Lead importado',
                'Cadastro criado por importação de planilha.',
                $responsavel,
                $agora
            );
        }

        $this->service()->invalidar();

        return $this->respond([
            'importados' => $importados,
            'duplicados' => $duplicados,
            'invalidos' => $invalidos,
            'detalhes' => $detalhes,
        ]);
    }

    // ------------------------------------------------------------------

    private function montarLead(array $dados, ?array $base = null): array
    {
        $b = $base ?? [];
        $tem = fn (string $chave) => array_key_exists($chave, $dados);

        $etapaId = $this->texto($dados['etapaId'] ?? '') ?: ($b['etapaId'] ?? $this->etapaPadrao());
        $responsavel = $this->texto($dados['responsavel'] ?? '') ?: ($b['responsavel'] ?? $this->usuarioNome());
        $origemId = $this->texto($dados['origemId'] ?? '') ?: ($b['origemId'] ?? 'org_outro');

        $possui = $this->texto($dados['possuiSistema'] ?? '');
        if (!in_array($possui, ['sim', 'nao', 'nao_informado'], true)) {
            $possui = $b['possuiSistema'] ?? 'nao_informado';
        }

        $prioridade = $this->texto($dados['prioridade'] ?? '');
        if (!in_array($prioridade, ['alta', 'media', 'baixa'], true)) {
            $prioridade = $b['prioridade'] ?? 'media';
        }

        if ($tem('proximoContato')) {
            $proximo = $this->data($dados['proximoContato']);
        } else {
            $proximo = $b['proximoContato'] ?? null;
        }

        $agora = $this->agora();

        return [
            'nome' => $this->texto($dados['nome'] ?? ($b['nome'] ?? '')),
            'empresa' => $this->texto($dados['empresa'] ?? ($b['empresa'] ?? '')),
            'cargo' => $this->texto($dados['cargo'] ?? ($b['cargo'] ?? '')),
            'telefone' => $this->normalizarTelefone($this->texto($dados['telefone'] ?? ($b['telefone'] ?? ''))),
            'email' => mb_strtolower($this->texto($dados['email'] ?? ($b['email'] ?? ''))),
            'cidade' => $this->texto($dados['cidade'] ?? ($b['cidade'] ?? '')),
            'uf' => mb_substr(mb_strtoupper($this->texto($dados['uf'] ?? ($b['uf'] ?? ''))), 0, 2),
            'origem_id' => $origemId,
            'origem_detalhe' => $this->texto($dados['origemDetalhe'] ?? ($b['origemDetalhe'] ?? '')),
            'sistema_ids' => $this->lista($dados['sistemaIds'] ?? ($b['sistemaIds'] ?? [])),
            'possui_sistema' => $possui,
            'sistema_atual' => $this->texto($dados['sistemaAtual'] ?? ($b['sistemaAtual'] ?? '')),
            'etapa_id' => $etapaId,
            'prioridade' => $prioridade,
            'responsavel' => $responsavel,
            'proximo_contato' => $proximo,
            'ultimo_contato' => $b['ultimoContato'] ?? null,
            'observacoes' => $this->texto($dados['observacoes'] ?? ($b['observacoes'] ?? '')),
            'tags' => $this->lista($dados['tags'] ?? ($b['tags'] ?? [])),
            'nao_contatar' => array_key_exists('naoContatar', $dados)
                ? (bool)$dados['naoContatar']
                : (bool)($b['naoContatar'] ?? false),
            'criado_em' => $b['criadoEm'] ?? $agora,
            'atualizado_em' => $agora,
            'motivo_perda' => $this->texto($dados['motivoPerda'] ?? ($b['motivoPerda'] ?? '')),
        ];
    }

    private function validarLead(array $campos, ?string $ignorarId): void
    {
        if ($campos['nome'] === '') {
            $this->erro('Informe o nome do lead.', 'nome');
        }
        if ($campos['telefone'] === '') {
            $this->erro('Informe o telefone do lead.', 'telefone');
        }
        if (!$this->telefoneValido($campos['telefone'])) {
            $this->erro('Telefone inválido. Use DDD + número.', 'telefone');
        }
        if ($campos['email'] !== '' && !filter_var($campos['email'], FILTER_VALIDATE_EMAIL)) {
            $this->erro('Informe um e-mail válido.', 'email');
        }

        $condicao = ['telefone' => $campos['telefone']];
        if ($ignorarId) {
            $condicao['id !='] = $ignorarId;
        }
        $existe = $this->fetchTable('Leads')->find()->where($condicao)->count();
        if ($existe > 0) {
            $this->erro('Já existe um lead com este telefone.', 'telefone');
        }

        $etapa = $this->fetchTable('Stages')->find()->where(['id' => $campos['etapa_id']])->first();
        if (!$etapa) {
            $this->erro('Etapa inválida.', 'etapaId');
        }
    }

    private function etapaPadrao(): string
    {
        $etapa = $this->fetchTable('Stages')->find()
            ->where(['tipo' => 'aberto'])
            ->orderBy(['ordem' => 'ASC'])
            ->first();

        return $etapa ? (string)$etapa->get('id') : 'et_novo';
    }

    private function serializarLead(?array $lead): ?array
    {
        if ($lead === null) {
            return null;
        }
        $lead['proximoContato'] = $this->service()->iso($lead['proximoContato']);
        $lead['ultimoContato'] = $this->service()->iso($lead['ultimoContato']);
        $lead['criadoEm'] = $this->service()->iso($lead['criadoEm']);
        $lead['atualizadoEm'] = $this->service()->iso($lead['atualizadoEm']);

        return $lead;
    }

    /** @param array<int, array<string, mixed>> $leads */
    private function serializarLeads(array $leads): array
    {
        return array_map(fn ($lead) => $this->serializarLead($lead), $leads);
    }
}
