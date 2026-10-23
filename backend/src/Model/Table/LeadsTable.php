<?php
declare(strict_types=1);

namespace App\Model\Table;

use ArrayObject;
use Cake\Datasource\EntityInterface;
use Cake\Datasource\FactoryLocator;
use Cake\Event\EventInterface;

class LeadsTable extends AppTable
{
    protected string $idPrefix = 'ld_';

    /** Cache por requisição para evitar uma consulta por lead na importação. */
    private static array $nomesSistemas = [];

    private const CAMPOS_BUSCA = [
        'nome', 'empresa', 'cargo', 'telefone', 'email', 'cidade', 'uf',
        'origem_detalhe', 'responsavel', 'observacoes', 'sistema_atual',
        'sistema_ids', 'tags',
    ];

    public function initialize(array $config): void
    {
        parent::initialize($config);
        $this->setTable('leads');
        $this->setPrimaryKey('id');
        $this->setDisplayField('nome');
        $this->getSchema()->setColumnType('sistema_ids', 'json');
        $this->getSchema()->setColumnType('tags', 'json');
    }

    public function beforeSave(EventInterface $event, EntityInterface $entity, ArrayObject $options): void
    {
        parent::beforeSave($event, $entity, $options);

        $recalcular = $entity->isNew();
        foreach (self::CAMPOS_BUSCA as $campo) {
            if ($entity->isDirty($campo)) {
                $recalcular = true;
                break;
            }
        }
        if (!$recalcular) {
            return;
        }

        $sistemaIds = array_values(array_filter(array_map('strval', (array)($entity->get('sistema_ids') ?? []))));
        $faltantes = array_values(array_diff($sistemaIds, array_keys(self::$nomesSistemas)));
        if ($faltantes) {
            $rows = FactoryLocator::get('Table')->get('Systems')->find()
                ->select(['id', 'nome'])
                ->where(['id IN' => $faltantes])
                ->all();
            foreach ($rows as $row) {
                self::$nomesSistemas[(string)$row->get('id')] = (string)$row->get('nome');
            }
        }
        $nomesSistemas = [];
        foreach ($sistemaIds as $sistemaId) {
            if (isset(self::$nomesSistemas[$sistemaId])) {
                $nomesSistemas[] = self::$nomesSistemas[$sistemaId];
            }
        }

        $telefone = (string)($entity->get('telefone') ?? '');
        $entity->set('busca', $this->normalizar(implode(' ', [
            (string)($entity->get('nome') ?? ''),
            (string)($entity->get('empresa') ?? ''),
            (string)($entity->get('cargo') ?? ''),
            $telefone,
            preg_replace('/\D+/', '', $telefone) ?? '',
            (string)($entity->get('email') ?? ''),
            (string)($entity->get('cidade') ?? ''),
            (string)($entity->get('uf') ?? ''),
            (string)($entity->get('responsavel') ?? ''),
            (string)($entity->get('observacoes') ?? ''),
            (string)($entity->get('origem_detalhe') ?? ''),
            (string)($entity->get('sistema_atual') ?? ''),
            implode(' ', array_map('strval', (array)($entity->get('tags') ?? []))),
            implode(' ', $nomesSistemas),
        ])));
    }

    private function normalizar(string $valor): string
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
        }

        return preg_replace('/\s+/', ' ', $valor) ?? $valor;
    }
}
