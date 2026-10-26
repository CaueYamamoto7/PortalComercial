<?php
declare(strict_types=1);

namespace App\Service;

use Cake\I18n\DateTime;
use Cake\ORM\Locator\LocatorAwareTrait;

/**
 * Centraliza a leitura, o enriquecimento e os cálculos derivados dos leads.
 */
class LeadService
{
    use LocatorAwareTrait;

    private ?array $catalogo = null;
    private ?array $leadsCache = null;

    public function __construct()
    {
    }

    public function catalogo(): array
    {
        if ($this->catalogo !== null) {
            return $this->catalogo;
        }

        $stages = $this->fetchTable('Stages')->find()->orderBy(['ordem' => 'ASC'])->all()->toList();
        $systems = $this->fetchTable('Systems')->find()->orderBy(['criado_em' => 'ASC', 'nome' => 'ASC'])->all()->toList();
        $sources = $this->fetchTable('Sources')->find()->orderBy(['criado_em' => 'ASC', 'nome' => 'ASC'])->all()->toList();
        $users = $this->fetchTable('Users')->find()->orderBy(['nome' => 'ASC'])->all()->toList();

        $this->catalogo = [
            'etapas' => array_map([$this, 'etapaOut'], $stages),
            'sistemas' => array_map([$this, 'sistemaOut'], $systems),
            'origens' => array_map([$this, 'origemOut'], $sources),
            'equipe' => array_map([$this, 'membroOut'], $users),
        ];

        return $this->catalogo;
    }

    public function invalidar(): void
    {
        $this->catalogo = null;
        $this->leadsCache = null;
    }

    /** @return array<int, array<string, mixed>> */
    public function todos(): array
    {
        if ($this->leadsCache !== null) {
            return $this->leadsCache;
        }

        $rows = $this->fetchTable('Leads')->find()
            ->where(['deleted_at IS' => null])
            ->all()
            ->toList();
        $this->leadsCache = array_map(fn ($row) => $this->leadBaseOut($row), $rows);

        return $this->leadsCache;
    }

    public function enriquecer(array $lead): array
    {
        $cat = $this->catalogo();
        $etapasPorId = array_column($cat['etapas'], null, 'id');
        $sistemasPorId = array_column($cat['sistemas'], null, 'id');
        $origensPorId = array_column($cat['origens'], null, 'id');

        $sistemas = [];
        foreach ($lead['sistemaIds'] as $id) {
            if (isset($sistemasPorId[(string)$id])) {
                $sistemas[] = $sistemasPorId[(string)$id];
            }
        }

        $etapa = $etapasPorId[$lead['etapaId']] ?? ($cat['etapas'][0] ?? null);
        $origem = $origensPorId[$lead['origemId']] ?? null;

        $proximo = $lead['proximoContato'];
        $agora = new DateTime();
        $aberto = $etapa && $etapa['tipo'] === 'aberto';

        $lead['sistemas'] = $sistemas;
        $lead['sistemasNomes'] = array_map(fn ($s) => $s['nome'], $sistemas);
        $lead['etapa'] = $etapa;
        $lead['origem'] = $origem;
        $lead['proximoContatoAtrasado'] = $proximo !== null && $aberto && $proximo < $agora;
        $lead['diasParaContato'] = $this->diasParaContato($proximo);
        $lead['conversa'] = $this->conversa($lead, $etapa);

        return $lead;
    }

    public function conversa(array $lead, ?array $etapa): array
    {
        $enviadas = (int)($lead['mensagensEnviadas'] ?? 0);
        $recebidas = (int)($lead['mensagensRecebidas'] ?? 0);
        $ultimaDirecao = $lead['ultimaMensagemDirecao'] ?? null;
        $ultimaEm = $lead['ultimaMensagemEm'] ?? null;
        $ultimoTexto = trim((string)($lead['ultimaMensagemTexto'] ?? ''));

        $tipo = $etapa['tipo'] ?? 'aberto';
        if ($lead['naoContatar'] || $tipo === 'perdido') {
            $status = 'recusado';
        } elseif ($tipo === 'ganho') {
            $status = 'cliente';
        } elseif ($recebidas > 0 && $ultimaDirecao === 'entrada') {
            // Respondeu primeiro (ou a última mensagem é dele): precisa de resposta,
            // mesmo que ainda não tenhamos enviado nada pelo sistema.
            $status = 'responder';
        } elseif ($enviadas === 0 && $recebidas === 0 && !$this->etapaContatada($etapa)) {
            // Contato feito manualmente e etapa movida para Contatado já conta
            // como abordagem, mesmo sem mensagem registrada no sistema.
            $status = 'sem_mensagem';
        } elseif ($recebidas > 0) {
            $status = 'em_conversa';
        } else {
            $status = 'aguardando';
        }

        return [
            'status' => $status,
            'enviadas' => $enviadas,
            'recebidas' => $recebidas,
            'respondeu' => $recebidas > 0,
            'conversaAberta' => $tipo === 'aberto' && $recebidas > 0,
            'ultimaDirecao' => $ultimaDirecao,
            'ultimaMensagemEm' => $this->iso($ultimaEm),
            'ultimaMensagem' => $ultimaEm
                ? [
                    'texto' => $ultimoTexto,
                    'direcao' => $ultimaDirecao,
                    'data' => $this->iso($ultimaEm),
                ]
                : null,
            'podeEnviar' => $status !== 'recusado',
        ];
    }

    /**
     * Etapas que representam contato já realizado, mesmo que manualmente.
     *
     * O ID da etapa inicial é estável; o nome cobre etapas recriadas pelo
     * usuário com o mesmo significado.
     *
     * @return array<int, string>
     */
    public function etapasContatadas(): array
    {
        $ids = [];
        foreach ($this->catalogo()['etapas'] as $etapa) {
            if ($this->etapaContatada($etapa)) {
                $ids[] = (string)$etapa['id'];
            }
        }

        return array_values(array_unique($ids));
    }

    /** @param array<string, mixed>|object|null $etapa */
    public function etapaContatada(array|object|null $etapa): bool
    {
        if ($etapa === null) {
            return false;
        }

        $id = is_array($etapa) ? ($etapa['id'] ?? '') : $etapa->get('id');
        $nome = is_array($etapa) ? ($etapa['nome'] ?? '') : $etapa->get('nome');

        return (string)$id === 'et_contatado'
            || $this->normalizar((string)$nome) === 'contatado';
    }

    public function filtrar(array $leads, array $params): array
    {
        $cat = $this->catalogo();
        $sistemasPorId = array_column($cat['sistemas'], null, 'id');
        $etapasPorId = array_column($cat['etapas'], null, 'id');

        $q = $this->normalizar((string)($params['q'] ?? ''));
        $qDigitos = preg_replace('/\D+/', '', $q) ?? '';
        $etapa = (string)($params['etapa'] ?? '');
        $sistema = (string)($params['sistema'] ?? '');
        $origem = (string)($params['origem'] ?? '');
        $responsavel = (string)($params['responsavel'] ?? '');
        $prioridade = (string)($params['prioridade'] ?? '');
        $possui = (string)($params['possuiSistema'] ?? '');
        $tag = (string)($params['tag'] ?? '');
        $naoContatar = (string)($params['naoContatar'] ?? '');
        $atrasados = (string)($params['atrasados'] ?? '');
        $ids = array_filter(array_map('trim', explode(',', (string)($params['ids'] ?? ''))));
        $agora = new DateTime();

        $resultado = array_values(array_filter($leads, function (array $lead) use (
            $q,
            $qDigitos,
            $etapa,
            $sistema,
            $origem,
            $responsavel,
            $prioridade,
            $possui,
            $tag,
            $naoContatar,
            $atrasados,
            $ids,
            $etapasPorId,
            $sistemasPorId,
            $agora
        ): bool {
            if ($q !== '') {
                $nomesSistemas = [];
                foreach ($lead['sistemaIds'] as $sid) {
                    if (isset($sistemasPorId[(string)$sid])) {
                        $nomesSistemas[] = $sistemasPorId[(string)$sid]['nome'];
                    }
                }
                $alvo = $this->normalizar(implode(' ', [
                    $lead['nome'],
                    $lead['empresa'],
                    $lead['cargo'],
                    $lead['email'],
                    $lead['cidade'],
                    $lead['uf'],
                    $lead['responsavel'],
                    $lead['observacoes'],
                    $lead['origemDetalhe'],
                    implode(' ', $lead['tags']),
                    implode(' ', $nomesSistemas),
                ]));
                $achou = str_contains($alvo, $q)
                    || ($qDigitos !== '' && str_contains(preg_replace('/\D+/', '', $lead['telefone']) ?? '', $qDigitos));
                if (!$achou) {
                    return false;
                }
            }

            $etapaLead = $etapasPorId[$lead['etapaId']] ?? null;
            if ($etapa !== '') {
                if ($etapa === 'abertos') {
                    if (!$etapaLead || $etapaLead['tipo'] !== 'aberto') {
                        return false;
                    }
                } elseif ($lead['etapaId'] !== $etapa) {
                    return false;
                }
            }
            if ($sistema !== '' && !in_array($sistema, $lead['sistemaIds'], true)) {
                return false;
            }
            if ($origem !== '' && $lead['origemId'] !== $origem) {
                return false;
            }
            if ($responsavel !== '' && $lead['responsavel'] !== $responsavel) {
                return false;
            }
            if ($prioridade !== '' && $lead['prioridade'] !== $prioridade) {
                return false;
            }
            if ($possui !== '' && $lead['possuiSistema'] !== $possui) {
                return false;
            }
            if ($tag !== '' && !in_array($tag, $lead['tags'], true)) {
                return false;
            }
            if ($naoContatar !== '' && in_array($naoContatar, ['0', '1'], true)) {
                if ($lead['naoContatar'] !== ($naoContatar === '1')) {
                    return false;
                }
            }
            if ($atrasados === '1') {
                if (!$etapaLead || $etapaLead['tipo'] !== 'aberto' || !$lead['proximoContato'] || $lead['proximoContato'] >= $agora) {
                    return false;
                }
            }
            if ($ids && !in_array($lead['id'], $ids, true)) {
                return false;
            }

            return true;
        }));

        return $resultado;
    }

    public function ordenar(array $leads, string $sort = 'atualizadoEm', string $direction = 'desc'): array
    {
        usort($leads, function (array $a, array $b) use ($sort, $direction): int {
            $va = $this->valorOrdenacao($a, $sort);
            $vb = $this->valorOrdenacao($b, $sort);
            $cmp = strnatcasecmp((string)$va, (string)$vb);

            return $direction === 'desc' ? -$cmp : $cmp;
        });

        return $leads;
    }

    private function valorOrdenacao(array $lead, string $sort): mixed
    {
        $valor = $lead[$sort] ?? '';
        if ($valor instanceof \DateTimeInterface) {
            return $valor->getTimestamp();
        }
        if (is_bool($valor)) {
            return $valor ? 1 : 0;
        }

        return $this->normalizar((string)$valor);
    }

    public function paginar(array $items, int $page, int $perPage): array
    {
        $total = count($items);
        $paginas = max(1, (int)ceil($total / max(1, $perPage)));
        $page = min(max(1, $page), $paginas);
        $offset = ($page - 1) * $perPage;

        return [
            'data' => array_slice($items, $offset, $perPage),
            'meta' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'paginas' => $paginas,
            ],
        ];
    }

    public function stats(array $leads): array
    {
        $cat = $this->catalogo();
        $etapasPorId = array_column($cat['etapas'], null, 'id');
        $agora = new DateTime();
        $hoje = $agora->format('Y-m-d');

        $total = count($leads);
        $abertos = $ganhos = $perdidos = $atrasados = $hojeCount = $naoContatar = 0;
        $emNegociacao = $emProposta = 0;

        foreach ($leads as $lead) {
            $etapa = $etapasPorId[$lead['etapaId']] ?? null;
            $tipo = $etapa['tipo'] ?? 'aberto';
            if ($tipo === 'ganho') {
                $ganhos++;
            } elseif ($tipo === 'perdido') {
                $perdidos++;
            } else {
                $abertos++;
                if ($lead['proximoContato'] && $lead['proximoContato'] < $agora) {
                    $atrasados++;
                }
                if ($lead['proximoContato'] && $lead['proximoContato']->format('Y-m-d') === $hoje) {
                    $hojeCount++;
                }
            }
            if ($lead['etapaId'] === 'et_negociacao') {
                $emNegociacao++;
            }
            if ($lead['etapaId'] === 'et_proposta') {
                $emProposta++;
            }
            if ($lead['naoContatar']) {
                $naoContatar++;
            }
        }

        $decididos = $ganhos + $perdidos;

        return [
            'total' => $total,
            'abertos' => $abertos,
            'ganhos' => $ganhos,
            'perdidos' => $perdidos,
            'taxaConversao' => $decididos > 0 ? round($ganhos / $decididos * 100, 1) : 0,
            'emNegociacao' => $emNegociacao,
            'emProposta' => $emProposta,
            'atrasados' => $atrasados,
            'followupsHoje' => $hojeCount,
            'naoContatar' => $naoContatar,
        ];
    }

    public function contagensConversas(array $enriquecidos): array
    {
        $cont = [
            'total' => count($enriquecidos),
            'semMensagem' => 0,
            'aguardando' => 0,
            'precisoResponder' => 0,
            'emConversa' => 0,
            'conversasAbertas' => 0,
            'clientes' => 0,
            'recusados' => 0,
        ];

        foreach ($enriquecidos as $lead) {
            $status = $lead['conversa']['status'];
            if ($status === 'sem_mensagem') {
                $cont['semMensagem']++;
            } elseif ($status === 'aguardando') {
                $cont['aguardando']++;
            } elseif ($status === 'responder') {
                $cont['precisoResponder']++;
            } elseif ($status === 'em_conversa') {
                $cont['emConversa']++;
            }
            if ($lead['conversa']['conversaAberta']) {
                $cont['conversasAbertas']++;
            }
            if ($status === 'cliente') {
                $cont['clientes']++;
            }
            if ($status === 'recusado') {
                $cont['recusados']++;
            }
        }

        return $cont;
    }

    public function facets(): array
    {
        $cat = $this->catalogo();
        $tags = [];
        try {
            $rows = \Cake\Datasource\ConnectionManager::get('default')
                ->execute('SELECT DISTINCT tag FROM lead_tags ORDER BY tag')
                ->fetchAll('assoc');
            $tags = array_values(array_filter(array_map(
                fn ($row) => (string)$row['tag'],
                $rows
            ), fn ($tag) => $tag !== ''));
        } catch (\Throwable) {
            // Banco ainda sem a migration de relações: mantém facets vazias.
        }

        return [
            'etapas' => $cat['etapas'],
            'sistemas' => array_values(array_filter($cat['sistemas'], fn ($s) => $s['ativo'])),
            'origens' => array_values(array_filter($cat['origens'], fn ($o) => $o['ativo'])),
            'responsaveis' => array_values(array_filter($cat['equipe'], fn ($u) => $u['status'] === 'ativo')),
            'tags' => $tags,
        ];
    }

    public function leadCompleto(string $id): ?array
    {
        $row = $this->fetchTable('Leads')->find()
            ->where(['id' => $id, 'deleted_at IS' => null])
            ->first();
        if (!$row) {
            return null;
        }

        return $this->enriquecer($this->leadBaseOut($row));
    }

    /** @return array<int, array<string, mixed>> */
    public function todosEnriquecidos(): array
    {
        return array_map(fn ($lead) => $this->enriquecer($lead), $this->todos());
    }

    public function leadOut(?array $lead): ?array
    {
        if ($lead === null) {
            return null;
        }
        foreach (['proximoContato', 'ultimoContato', 'criadoEm', 'atualizadoEm'] as $campo) {
            $lead[$campo] = $this->iso($lead[$campo] ?? null);
        }

        return $lead;
    }

    public function leadsOut(array $leads): array
    {
        return array_map(fn ($lead) => $this->leadOut($lead), $leads);
    }

    public function normalizar(string $valor): string
    {
        $valor = trim(mb_strtolower($valor));
        if ($valor === '') {
            return '';
        }
        if (class_exists('Normalizer')) {
            $norm = \Normalizer::normalize($valor, \Normalizer::FORM_D);
            if ($norm !== false) {
                $valor = preg_replace('/\p{Mn}+/u', '', $norm) ?? $valor;
            }
        } else {
            $valor = strtr($valor, [
                'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a',
                'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
                'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
                'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
                'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
                'ç' => 'c', 'ñ' => 'n',
            ]);
        }

        return preg_replace('/\s+/', ' ', $valor) ?? $valor;
    }

    public function diasParaContato(?DateTime $data): ?int
    {
        if (!$data) {
            return null;
        }
        $hoje = new DateTime('today');
        $alvo = new DateTime($data->format('Y-m-d'));

        return (int)$hoje->diff($alvo)->format('%r%a');
    }

    public function iso(mixed $data): ?string
    {
        if (!$data) {
            return null;
        }
        if ($data instanceof \DateTimeInterface) {
            return $data->format('c');
        }

        try {
            return (new DateTime((string)$data))->format('c');
        } catch (\Throwable) {
            return null;
        }
    }

    // ------------------------------------------------------------------
    // Serialização
    // ------------------------------------------------------------------

    public function leadBaseOut(object $row): array
    {
        return [
            'id' => (string)$row->get('id'),
            'nome' => (string)$row->get('nome'),
            'empresa' => (string)$row->get('empresa'),
            'cargo' => (string)$row->get('cargo'),
            'telefone' => (string)$row->get('telefone'),
            'email' => (string)$row->get('email'),
            'cidade' => (string)$row->get('cidade'),
            'uf' => (string)$row->get('uf'),
            'origemId' => (string)$row->get('origem_id'),
            'origemDetalhe' => (string)$row->get('origem_detalhe'),
            'sistemaIds' => array_values((array)($row->get('sistema_ids') ?? [])),
            'possuiSistema' => (string)$row->get('possui_sistema'),
            'sistemaAtual' => (string)$row->get('sistema_atual'),
            'etapaId' => (string)$row->get('etapa_id'),
            'prioridade' => (string)$row->get('prioridade'),
            'responsavel' => (string)$row->get('responsavel'),
            'proximoContato' => $row->get('proximo_contato'),
            'ultimoContato' => $row->get('ultimo_contato'),
            'observacoes' => (string)$row->get('observacoes'),
            'tags' => array_values((array)($row->get('tags') ?? [])),
            'naoContatar' => (bool)$row->get('nao_contatar'),
            'criadoEm' => $row->get('criado_em'),
            'atualizadoEm' => $row->get('atualizado_em'),
            'motivoPerda' => (string)$row->get('motivo_perda'),
            'mensagensEnviadas' => (int)$row->get('mensagens_enviadas'),
            'mensagensRecebidas' => (int)$row->get('mensagens_recebidas'),
            'ultimaMensagemEm' => $row->get('ultima_mensagem_em'),
            'ultimaMensagemDirecao' => $row->get('ultima_mensagem_direcao') ?: null,
            'ultimaMensagemTexto' => (string)($row->get('ultima_mensagem_texto') ?? ''),
        ];
    }

    public function etapaOut(object $row): array
    {
        return [
            'id' => (string)$row->get('id'),
            'nome' => (string)$row->get('nome'),
            'cor' => (string)$row->get('cor'),
            'tipo' => (string)$row->get('tipo'),
            'ordem' => (int)$row->get('ordem'),
        ];
    }

    public function sistemaOut(object $row): array
    {
        return [
            'id' => (string)$row->get('id'),
            'nome' => (string)$row->get('nome'),
            'descricao' => (string)$row->get('descricao'),
            'cor' => (string)$row->get('cor'),
            'ativo' => (bool)$row->get('ativo'),
        ];
    }

    public function origemOut(object $row): array
    {
        return [
            'id' => (string)$row->get('id'),
            'nome' => (string)$row->get('nome'),
            'ativo' => (bool)$row->get('ativo'),
        ];
    }

    public function membroOut(object $row): array
    {
        return [
            'id' => (string)$row->get('id'),
            'nome' => (string)$row->get('nome'),
            'email' => (string)$row->get('email'),
            'perfil' => (string)$row->get('perfil'),
            'status' => (string)$row->get('status'),
            'iniciais' => (string)$row->get('iniciais'),
        ];
    }
}
