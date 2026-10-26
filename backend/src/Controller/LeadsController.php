<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Datasource\ConnectionManager;
use Cake\Http\Response;

class LeadsController extends AppController
{
    public function index(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $identidade = $this->identidade();

        $pagina = $this->queryService()->paginar($params, $identidade);

        return $this->respond([
            'data' => $pagina['data'],
            'meta' => $pagina['meta'],
            'stats' => $this->queryService()->stats($params, $identidade),
            'facets' => $this->queryService()->facets($params, $identidade),
        ]);
    }

    public function view(string $id): Response
    {
        $lead = $this->queryService()->findLead($id, $this->identidade());
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

        $leadOut = $this->service()->leadOut($lead);

        return $this->respond([
            'lead' => $leadOut,
            'interacoes' => array_map(fn ($row) => $this->interacaoOut($row), $interacoes),
            'tarefas' => array_map(fn ($row) => $this->tarefaEnriquecida($row, $leadOut), $tarefas),
        ]);
    }

    public function add(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();

        $campos = $this->montarLead($dados);
        $this->validarLead($campos, null);
        $campos = $this->marcarUltimoContatoSeContatada($campos);

        $entity = $this->writeService()->criar($campos, $this->identidade());

        $this->registrarInteracao(
            (string)$entity->get('id'),
            'nota',
            'Lead cadastrado',
            'Lead criado manualmente no Painel Comercial.',
            (string)$entity->get('responsavel'),
            $entity->get('criado_em')
        );
        $this->registroAuditoria('lead.criar', 'lead', (string)$entity->get('id'));

        return $this->respond(
            $this->service()->leadOut($this->service()->leadCompleto((string)$entity->get('id'))),
            201
        );
    }

    public function edit(string $id): Response
    {
        $this->request->allowMethod(['put', 'patch']);
        $table = $this->fetchTable('Leads');
        $query = $table->find()->where(['id' => $id, 'deleted_at IS' => null]);
        $this->access()->scopeLeads($query, $this->identidade());
        $entity = $query->first();
        if (!$entity) {
            $this->erro('Lead não encontrado.', null, 404);
        }

        $base = $this->service()->leadBaseOut($entity);
        $dados = (array)$this->request->getData();
        $etapaAnterior = (string)$entity->get('etapa_id');
        $campos = $this->montarLead($dados, $base);
        $this->validarLead($campos, $id);
        $campos = $this->marcarUltimoContatoSeContatada($campos, $etapaAnterior);

        $entity = $this->writeService()->atualizar($entity, $campos, $this->identidade());

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
        $this->registroAuditoria('lead.editar', 'lead', $id);

        return $this->respond(
            $this->service()->leadOut($this->service()->leadCompleto($id))
        );
    }

    public function mover(string $id): Response
    {
        $this->request->allowMethod(['post']);
        $table = $this->fetchTable('Leads');
        $query = $table->find()->where(['id' => $id, 'deleted_at IS' => null]);
        $this->access()->scopeLeads($query, $this->identidade());
        $entity = $query->first();
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
            return $this->respond($this->service()->leadOut($this->service()->leadCompleto($id)));
        }

        $agora = $this->agora();
        if ($this->service()->etapaContatada($etapa)
            && !$this->etapaContatadaPorId((string)$entity->get('etapa_id'))
        ) {
            $entity->set('ultimo_contato', $agora);
        }
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
        $this->registroAuditoria('lead.mover', 'lead', $id, ['etapaId' => $etapaId]);

        return $this->respond($this->service()->leadOut($this->service()->leadCompleto($id)));
    }

    /** Ação em lote com transação e limite de segurança. */
    public function lote(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();
        $acao = (string)($dados['acao'] ?? '');
        $ids = array_values(array_unique(array_filter(array_map(
            'trim',
            (array)($dados['ids'] ?? [])
        ))));
        if (!$ids) {
            $this->erro('Selecione pelo menos um lead.', 'ids');
        }
        if (count($ids) > 500) {
            $this->erro('Selecione no máximo 500 leads por lote.', 'ids');
        }

        $table = $this->fetchTable('Leads');
        $query = $table->find()->where(['id IN' => $ids, 'deleted_at IS' => null]);
        $this->access()->scopeLeads($query, $this->identidade());
        $encontrados = $query->all()->toList();
        $idsPermitidos = array_map(fn ($row) => (string)$row->get('id'), $encontrados);
        if (count($idsPermitidos) !== count($ids)) {
            $this->erro('Um ou mais leads não estão disponíveis para você.', 'ids', 403);
        }

        $conn = ConnectionManager::get('default');
        $conn->begin();
        try {
            if ($acao === 'mover') {
                $etapaId = $this->texto($dados['etapaId'] ?? '');
                $etapa = $this->fetchTable('Stages')->find()->where(['id' => $etapaId])->first();
                if (!$etapa) {
                    $this->erro('Etapa inválida.', 'etapaId');
                }
                $agora = $this->agora();
                foreach ($encontrados as $entity) {
                    if ($this->service()->etapaContatada($etapa)
                        && !$this->etapaContatadaPorId((string)$entity->get('etapa_id'))
                    ) {
                        $entity->set('ultimo_contato', $agora);
                    }
                    $entity->set('etapa_id', $etapaId);
                    $entity->set('atualizado_em', $agora);
                    $table->saveOrFail($entity);
                    $this->registrarInteracao(
                        (string)$entity->get('id'),
                        'etapa',
                        'Etapa alterada em lote',
                        'Lead movido para ' . (string)$etapa->get('nome') . '.',
                        (string)$entity->get('responsavel'),
                        $agora
                    );
                }
            } elseif ($acao === 'naoContatar') {
                $valor = (bool)($dados['valor'] ?? true);
                $table->updateAll(
                    ['nao_contatar' => $valor, 'atualizado_em' => $this->agora()],
                    ['id IN' => $idsPermitidos]
                );
            } elseif ($acao === 'prioridade') {
                $prioridade = $this->texto($dados['prioridade'] ?? '');
                if (!in_array($prioridade, ['alta', 'media', 'baixa'], true)) {
                    $this->erro('Prioridade inválida.', 'prioridade');
                }
                $table->updateAll(
                    ['prioridade' => $prioridade, 'atualizado_em' => $this->agora()],
                    ['id IN' => $idsPermitidos]
                );
            } elseif ($acao === 'excluir') {
                if (!$this->access()->canDeleteLead($this->identidade())) {
                    $this->erro('Apenas administradores e gestores podem excluir leads.', null, 403);
                }
                $table->updateAll(
                    ['deleted_at' => $this->agora(), 'atualizado_em' => $this->agora()],
                    ['id IN' => $idsPermitidos]
                );
            } else {
                $this->erro('Ação de lote inválida.', 'acao');
            }

            $conn->commit();
        } catch (\Throwable $e) {
            $conn->rollback();
            throw $e;
        }

        $this->registroAuditoria('lead.lote.' . $acao, 'lead', null, ['ids' => $idsPermitidos]);

        return $this->respond(['ok' => true, 'afetados' => count($idsPermitidos)]);
    }

    public function delete(string $id): Response
    {
        $this->request->allowMethod(['delete']);
        if (!$this->access()->canDeleteLead($this->identidade())) {
            $this->erro('Apenas administradores e gestores podem excluir leads.', null, 403);
        }

        $table = $this->fetchTable('Leads');
        $entity = $table->find()->where(['id' => $id, 'deleted_at IS' => null])->first();
        if (!$entity) {
            $this->erro('Lead não encontrado.', null, 404);
        }

        $this->writeService()->softDelete($id, $this->identidade());
        $this->registroAuditoria('lead.excluir', 'lead', $id);

        return $this->respond(['removido' => true, 'retencaoDias' => 90]);
    }

    public function importar(): Response
    {
        $this->request->allowMethod(['post']);
        $dados = (array)$this->request->getData();
        $linhas = (array)($dados['linhas'] ?? []);
        if (count($linhas) > 2000) {
            $this->erro('Importe no máximo 2.000 linhas por vez.', 'linhas');
        }

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

        $etapaPadrao = null;
        foreach ($cat['etapas'] as $etapa) {
            if ($etapa['tipo'] === 'aberto') {
                $etapaPadrao = $etapa;
                break;
            }
        }

        $table = $this->fetchTable('Leads');
        $telefones = $table->find()->select(['telefone'])->all()->extract('telefone')->toList();
        $telefones = array_map('strval', $telefones);
        $telefones = array_fill_keys($telefones, true);

        $importados = 0;
        $duplicados = 0;
        $invalidos = 0;
        $detalhes = [];
        $conn = ConnectionManager::get('default');
        $conn->begin();

        try {
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
                if (isset($telefones[$telefone])) {
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
                if (!$this->access()->canSeeAllLeads($this->identidade()) || !in_array($responsavel, $equipe, true)) {
                    $responsavel = $this->usuarioNome();
                }

                $possui = $service->normalizar($this->texto($linha['possui_sistema'] ?? $linha['possui'] ?? ''));
                if (str_starts_with($possui, 'sim')) {
                    $possuiSistema = 'sim';
                } elseif (str_starts_with($possui, 'nao')) {
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
                    'ultimo_contato' => in_array($etapaId, $this->service()->etapasContatadas(), true)
                        ? $agora
                        : null,
                    'observacoes' => $this->texto($linha['observacoes'] ?? $linha['notas'] ?? ''),
                    'tags' => $this->lista($linha['tags'] ?? 'Importado'),
                    'nao_contatar' => false,
                    'criado_em' => $agora,
                    'atualizado_em' => $agora,
                    'motivo_perda' => '',
                ];

                $entity = $this->writeService()->criar($campos, $this->identidade());
                $telefones[$telefone] = true;
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

            $conn->commit();
        } catch (\Throwable $e) {
            $conn->rollback();
            throw $e;
        }

        $this->registroAuditoria('lead.importar', 'lead', null, [
            'importados' => $importados,
            'duplicados' => $duplicados,
            'invalidos' => $invalidos,
        ]);

        return $this->respond([
            'importados' => $importados,
            'duplicados' => $duplicados,
            'invalidos' => $invalidos,
            'detalhes' => $detalhes,
        ]);
    }

    /** Exporta o resultado filtrado como CSV, direto no backend. */
    public function exportar(): Response
    {
        $params = (array)$this->request->getQueryParams();
        $identidade = $this->identidade();
        $query = $this->queryService()->baseQuery($params, $identidade);
        $rows = $query
            ->orderBy(['Leads.atualizado_em' => 'DESC'])
            ->limit(10000)
            ->all()
            ->toList();

        $cat = $this->service()->catalogo();
        $etapas = array_column($cat['etapas'], null, 'id');
        $sistemas = array_column($cat['sistemas'], null, 'id');
        $origens = array_column($cat['origens'], null, 'id');
        $possuiLabel = ['sim' => 'Sim', 'nao' => 'Não', 'nao_informado' => 'Não informado'];

        $fp = fopen('php://temp', 'r+');
        fwrite($fp, "\xEF\xBB\xBF");
        fputcsv($fp, [
            'Nome', 'Empresa', 'Cargo', 'WhatsApp', 'E-mail', 'Cidade', 'UF',
            'Origem', 'Detalhe da origem', 'Sistemas', 'Possui sistema',
            'Sistema atual', 'Etapa', 'Prioridade', 'Responsável',
            'Próximo contato', 'Último contato', 'Tags', 'Observações',
            'Não contatar',
        ], ';');

        foreach ($rows as $row) {
            $lead = $this->service()->leadBaseOut($row);
            $nomesSistemas = [];
            foreach ($lead['sistemaIds'] as $sistemaId) {
                $nomesSistemas[] = $sistemas[$sistemaId]['nome'] ?? $sistemaId;
            }
            fputcsv($fp, array_map([$this, 'celulaCSV'], [
                $lead['nome'],
                $lead['empresa'],
                $lead['cargo'],
                $lead['telefone'],
                $lead['email'],
                $lead['cidade'],
                $lead['uf'],
                $origens[$lead['origemId']]['nome'] ?? $lead['origemId'],
                $lead['origemDetalhe'],
                implode(', ', $nomesSistemas),
                $possuiLabel[$lead['possuiSistema']] ?? $lead['possuiSistema'],
                $lead['sistemaAtual'],
                $etapas[$lead['etapaId']]['nome'] ?? $lead['etapaId'],
                $lead['prioridade'],
                $lead['responsavel'],
                $lead['proximoContato']?->format('d/m/Y H:i') ?? '',
                $lead['ultimoContato']?->format('d/m/Y H:i') ?? '',
                implode(', ', $lead['tags']),
                $lead['observacoes'],
                $lead['naoContatar'] ? 'Sim' : 'Não',
            ]), ';');
        }

        rewind($fp);
        $csv = (string)stream_get_contents($fp);
        fclose($fp);

        return $this->response
            ->withType('text/csv')
            ->withHeader('Content-Disposition', 'attachment; filename="leads-assinasoft.csv"')
            ->withStringBody($csv);
    }

    /** Evita injeção de fórmulas ao abrir o CSV no Excel/LibreOffice. */
    private function celulaCSV(mixed $valor): string
    {
        $texto = (string)$valor;
        if ($texto !== '' && in_array($texto[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'" . $texto;
        }

        return $texto;
    }

    // ------------------------------------------------------------------

    private function montarLead(array $dados, ?array $base = null): array
    {
        $b = $base ?? [];
        $tem = fn (string $chave) => array_key_exists($chave, $dados);

        $etapaId = $this->texto($dados['etapaId'] ?? '') ?: ($b['etapaId'] ?? $this->etapaPadrao());
        $responsavel = $this->texto($dados['responsavel'] ?? '') ?: ($b['responsavel'] ?? $this->usuarioNome());
        if (!$this->access()->canSeeAllLeads($this->identidade())) {
            $responsavel = $this->usuarioNome();
        }
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

    private function etapaContatadaPorId(string $etapaId): bool
    {
        return $etapaId !== ''
            && in_array($etapaId, $this->service()->etapasContatadas(), true);
    }

    /**
     * Ao entrar em uma etapa de contato, registra o contato manual do operador.
     *
     * @param array<string, mixed> $campos
     * @return array<string, mixed>
     */
    private function marcarUltimoContatoSeContatada(array $campos, string $etapaAnterior = ''): array
    {
        $etapaNova = (string)($campos['etapa_id'] ?? '');
        if ($this->etapaContatadaPorId($etapaNova) && !$this->etapaContatadaPorId($etapaAnterior)) {
            $campos['ultimo_contato'] = $this->agora();
        }

        return $campos;
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
        return $this->service()->leadOut($lead);
    }

    /** @param array<int, array<string, mixed>> $leads */
    private function serializarLeads(array $leads): array
    {
        return $this->service()->leadsOut($leads);
    }
}
