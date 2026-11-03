<?php
declare(strict_types=1);

namespace App\Service;

use Cake\ORM\Locator\LocatorAwareTrait;

class CaptureOriginLock
{
    use LocatorAwareTrait;

    public function current(): array
    {
        $row = $this->fetchTable('Settings')->find()->where(['id' => 'origemCadastro'])->first();
        $value = $row ? (array)$row->get('valor') : [];
        $id = (string)($value['origemId'] ?? '');
        $until = (string)($value['ate'] ?? '');
        $active = false;
        if ($id !== '' && $until !== '') {
            try {
                $active = new \DateTimeImmutable($until) > new \DateTimeImmutable('now');
            } catch (\Exception) {
                $active = false;
            }
        }
        if ($active) {
            $source = $this->fetchTable('Sources')->find()->where(['id' => $id, 'ativo' => true])->first();
            $active = $source !== null;
        }
        return ['origemId' => $active ? $id : null, 'ate' => $active ? $until : null, 'ativa' => $active];
    }
}
