<?php
declare(strict_types=1);

namespace App\Service;

use Cake\ORM\Locator\LocatorAwareTrait;

/**
 * Preferências do usuário persistidas em user_preferences.
 *
 * A ausência de registro é tratada como "usar os padrões". Nenhuma
 * preferência é lida de localStorage como fonte de verdade.
 */
class PreferencesService
{
    use LocatorAwareTrait;

    /** @var array<string, mixed> */
    public const PADRAO = [
        'notifLeads' => true,
        'notifFollowups' => true,
        'tabelaCompacta' => false,
        'idioma' => 'pt-BR',
        'fuso' => 'America/Sao_Paulo',
    ];

    private const IDIOMAS = ['pt-BR', 'en-US', 'es-ES'];

    /** @return array<string, mixed> */
    public function obter(string $userId): array
    {
        if ($userId === '') {
            return self::PADRAO;
        }

        $row = $this->fetchTable('UserPreferences')->find()
            ->where(['user_id' => $userId])
            ->first();
        $salvas = $row ? (array)$row->get('valor') : [];

        return $this->normalizar($salvas, self::PADRAO);
    }

    /**
     * @param array<string, mixed> $dados
     * @return array<string, mixed>
     */
    public function salvar(string $userId, array $dados): array
    {
        $prefs = $this->normalizar($dados, $this->obter($userId));
        $table = $this->fetchTable('UserPreferences');
        $row = $table->find()->where(['user_id' => $userId])->first();
        if (!$row) {
            $row = $table->newEmptyEntity();
            $row->set('user_id', $userId);
        }
        $row->set('valor', $prefs);
        $row->set('atualizado_em', new \Cake\I18n\DateTime());
        $table->saveOrFail($row);

        return $prefs;
    }

    /**
     * Normaliza e limita os campos aceitos, ignorando qualquer chave extra.
     *
     * @param array<string, mixed> $dados
     * @param array<string, mixed> $base
     * @return array<string, mixed>
     */
    public function normalizar(array $dados, array $base = self::PADRAO): array
    {
        $prefs = array_merge(self::PADRAO, $base);
        $booleanos = ['notifLeads', 'notifFollowups', 'tabelaCompacta'];
        foreach ($booleanos as $chave) {
            if (array_key_exists($chave, $dados)) {
                $prefs[$chave] = $this->booleano($dados[$chave]);
            } else {
                $prefs[$chave] = (bool)$prefs[$chave];
            }
        }

        if (array_key_exists('idioma', $dados)) {
            $idioma = trim((string)$dados['idioma']);
            if (in_array($idioma, self::IDIOMAS, true)) {
                $prefs['idioma'] = $idioma;
            }
        }
        if (!in_array((string)$prefs['idioma'], self::IDIOMAS, true)) {
            $prefs['idioma'] = self::PADRAO['idioma'];
        }

        if (array_key_exists('fuso', $dados)) {
            $fuso = trim((string)$dados['fuso']);
            if (in_array($fuso, timezone_identifiers_list(), true)) {
                $prefs['fuso'] = $fuso;
            }
        }
        if (!in_array((string)$prefs['fuso'], timezone_identifiers_list(), true)) {
            $prefs['fuso'] = self::PADRAO['fuso'];
        }

        return $prefs;
    }

    private function booleano(mixed $valor): bool
    {
        if (is_bool($valor)) {
            return $valor;
        }

        return in_array($valor, [1, '1', 'true', 'on', 'sim'], true);
    }
}
