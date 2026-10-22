<?php
declare(strict_types=1);

namespace App\Model\Table;

use ArrayObject;
use Cake\Event\EventInterface;
use Cake\Datasource\EntityInterface;
use Cake\ORM\Table;

abstract class AppTable extends Table
{
    protected string $idPrefix = '';

    public function beforeSave(EventInterface $event, EntityInterface $entity, ArrayObject $options): void
    {
        if ($entity->isNew() && !$entity->get('id')) {
            $entity->set('id', $this->idPrefix . bin2hex(random_bytes(8)));
        }
    }
}
