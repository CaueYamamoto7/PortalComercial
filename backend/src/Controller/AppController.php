<?php
declare(strict_types=1);

namespace App\Controller;

use App\Exception\ApiException;
use App\Service\LeadService;
use Cake\Controller\Controller;
use Cake\Http\Response;
use Cake\I18n\DateTime;

/**
 * Base dos controllers da API JSON do Painel Comercial.
 */
abstract class AppController extends Controller
{
    protected ?LeadService $leads = null;

    public function initialize(): void
    {
        parent::initialize();
        $this->viewBuilder()->setClassName('Json');
    }

    protected function service(): LeadService
    {
        if ($this->leads === null) {
            $this->leads = new LeadService();
        }

        return $this->leads;
    }

    protected function respond(mixed $data, int $status = 200): Response
    {
        return $this->response
            ->withStatus($status)
            ->withType('application/json')
            ->withStringBody((string)json_encode(['data' => $data], JSON_UNESCAPED_UNICODE));
    }

    protected function respondRaw(mixed $data, int $status = 200): Response
    {
        return $this->response
            ->withStatus($status)
            ->withType('application/json')
            ->withStringBody((string)json_encode($data, JSON_UNESCAPED_UNICODE));
    }

    protected function erro(string $message, ?string $campo = null, int $status = 422): never
    {
        throw new ApiException($message, $campo, $status);
    }

    /** @return array<string, mixed> */
    protected function identidade(): array
    {
        return (array)($this->request->getAttribute('identity') ?? []);
    }

    protected function usuarioNome(): string
    {
        return (string)($this->identidade()['nome'] ?? '');
    }

    protected function agora(): DateTime
    {
        return new DateTime();
    }

    protected function data(mixed $valor): ?DateTime
    {
        if ($valor instanceof \DateTimeInterface) {
            return new DateTime($valor->format('Y-m-d H:i:s'));
        }
        if ($valor === null || $valor === '') {
            return null;
        }

        try {
            return new DateTime((string)$valor);
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return array<int, string> */
    protected function lista(mixed $valor): array
    {
        if (is_array($valor)) {
            $itens = $valor;
        } elseif (is_string($valor) && trim($valor) !== '') {
            $itens = preg_split('/\s*[,;|]\s*/', $valor) ?: [];
        } else {
            $itens = [];
        }

        $itens = array_map(fn ($item) => trim((string)$item), $itens);
        $itens = array_filter($itens, fn ($item) => $item !== '');

        return array_values(array_unique($itens));
    }

    protected function texto(mixed $valor): string
    {
        return trim((string)($valor ?? ''));
    }

    protected function iniciais(string $nome): string
    {
        $partes = preg_split('/\s+/', trim($nome)) ?: [];
        $iniciais = '';
        foreach ([$partes[0] ?? '', end($partes) ?: ''] as $parte) {
            if ($parte !== '') {
                $iniciais .= mb_strtoupper(mb_substr($parte, 0, 1));
            }
        }

        return $iniciais;
    }

    protected function normalizarTelefone(string $valor): string
    {
        $digitos = preg_replace('/\D+/', '', $valor) ?? '';
        $digitos = ltrim($digitos, '0');

        if (strlen($digitos) === 12 || strlen($digitos) === 13) {
            if (str_starts_with($digitos, '55')) {
                return $digitos;
            }
        }
        if (strlen($digitos) === 10 || strlen($digitos) === 11) {
            return '55' . $digitos;
        }

        return $digitos;
    }

    protected function telefoneValido(string $telefone): bool
    {
        if (!preg_match('/^55(\d{2})(\d{8,9})$/', $telefone, $m)) {
            return false;
        }
        $ddd = (int)$m[1];
        if ($ddd < 11 || $ddd > 99) {
            return false;
        }
        $numero = $m[2];
        if (strlen($numero) === 9 && $numero[0] !== '9') {
            return false;
        }
        if (strlen($numero) === 8 && in_array($numero[0], ['0', '1'], true)) {
            return false;
        }

        return true;
    }

    protected function registrarInteracao(
        string $leadId,
        string $tipo,
        string $titulo,
        string $descricao,
        string $usuario,
        ?DateTime $data = null,
        ?string $canal = null,
        ?string $direcao = null
    ): array {
        $table = $this->fetchTable('Interactions');
        $entity = $table->newEntity([
            'lead_id' => $leadId,
            'tipo' => $tipo,
            'titulo' => $titulo,
            'descricao' => $descricao,
            'data' => $data ?? $this->agora(),
            'usuario' => $usuario,
            'canal' => $canal,
            'direcao' => $direcao,
        ]);
        $table->saveOrFail($entity);

        return $this->interacaoOut($entity);
    }

    protected function interacaoOut(object $row): array
    {
        return [
            'id' => (string)$row->get('id'),
            'leadId' => (string)$row->get('lead_id'),
            'tipo' => (string)$row->get('tipo'),
            'titulo' => (string)$row->get('titulo'),
            'descricao' => (string)$row->get('descricao'),
            'data' => $this->service()->iso($row->get('data')),
            'usuario' => (string)$row->get('usuario'),
            'canal' => $row->get('canal') ?: null,
            'direcao' => $row->get('direcao') ?: null,
        ];
    }

    protected function tarefaEnriquecida(object $row, ?array $lead = null): array
    {
        $data = $row->get('data');
        $status = (string)$row->get('status');
        $agora = $this->agora();

        return [
            'id' => (string)$row->get('id'),
            'leadId' => (string)$row->get('lead_id'),
            'titulo' => (string)$row->get('titulo'),
            'tipo' => (string)$row->get('tipo'),
            'data' => $this->service()->iso($data),
            'prioridade' => (string)$row->get('prioridade'),
            'status' => $status,
            'responsavel' => (string)$row->get('responsavel'),
            'lead' => $lead,
            'atrasada' => $status === 'pendente' && $data && $data < $agora,
        ];
    }

    protected function campanhaOut(object $row): array
    {
        return [
            'id' => (string)$row->get('id'),
            'nome' => (string)$row->get('nome'),
            'templateId' => $row->get('template_id') ?: null,
            'mensagem' => (string)$row->get('mensagem'),
            'status' => (string)$row->get('status'),
            'canal' => (string)$row->get('canal'),
            'leadIds' => array_values((array)($row->get('lead_ids') ?? [])),
            'publico' => (int)$row->get('publico'),
            'enviados' => (int)$row->get('enviados'),
            'entregues' => (int)$row->get('entregues'),
            'falhas' => (int)$row->get('falhas'),
            'criadaEm' => $this->service()->iso($row->get('criada_em')),
            'agendadaPara' => $this->service()->iso($row->get('agendada_para')),
            'responsavel' => (string)$row->get('responsavel'),
        ];
    }

    protected function templateOut(object $row): array
    {
        return [
            'id' => (string)$row->get('id'),
            'nome' => (string)$row->get('nome'),
            'categoria' => (string)$row->get('categoria'),
            'conteudo' => (string)$row->get('conteudo'),
            'atualizadoEm' => $this->service()->iso($row->get('atualizado_em')),
            'usos' => (int)$row->get('usos'),
        ];
    }
}
