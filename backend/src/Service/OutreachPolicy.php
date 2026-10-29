<?php
declare(strict_types=1);

namespace App\Service;

class OutreachPolicy
{
    private const REFUSAL_FALLBACK = '/\b(n[aã]o (quero|tenho interesse|me (mande|envie|contate))'
        . '|pare|parar|remov[ae]|exclu[ai]|sair|cancelar|descadastr|n[uú]mero errado)/iu';

    /** Conservative opt-out detection; ambiguous content is handled manually. */
    public static function refusal(string $text): bool
    {
        $pattern = (string)((new SettingsService())->whatsapp()['refusalPattern'] ?? '');
        if ($pattern === '' || @preg_match($pattern, '') === false) {
            $pattern = self::REFUSAL_FALLBACK;
        }

        // Configuração adicional nunca pode desativar as recusas básicas.
        return (bool)preg_match(self::REFUSAL_FALLBACK, $text) || (bool)preg_match($pattern, $text);
    }

    /** Build the first message from the configured greeting template. */
    public static function greeting(string $name): string
    {
        $config = (new SettingsService())->whatsapp();
        $first = preg_split('/\s+/u', trim($name))[0] ?? '';
        $template = $first === ''
            ? (string)($config['greetingTemplateSemNome'] ?? 'Olá, tudo bem?')
            : (string)($config['greetingTemplate'] ?? 'Olá {{nome}}, tudo bem?');
        if (trim($template) === '') {
            $template = $first === '' ? 'Olá, tudo bem?' : 'Olá {{nome}}, tudo bem?';
        }

        return str_replace(['{{nome}}', '{{primeiro_nome}}'], $first, $template);
    }

    /** Normalize Brazilian local numbers and preserve international numbers. */
    public static function phone(string $phone): string
    {
        $phone = preg_replace('/\D/', '', $phone) ?? '';

        return in_array(strlen($phone), [10, 11], true) ? '55' . $phone : $phone;
    }
}
