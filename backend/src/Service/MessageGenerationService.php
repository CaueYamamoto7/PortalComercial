<?php
declare(strict_types=1);

namespace App\Service;

use Cake\Http\Client;
use Throwable;

class MessageGenerationService
{
    /** Generate a contextual response, falling back to approved copy or human review. */
    public function generate(array $lead, string $objective, string $reply): string
    {
        $settings = new SettingsService();
        $config = $settings->whatsapp();
        $brand = (string)($settings->marca()['nome'] ?? 'AssinaSoft');
        $human = trim((string)($config['humanToken'] ?? 'HUMANO')) ?: 'HUMANO';
        $key = (string)env('GROQ_API_KEY', '');
        $model = trim((string)($config['aiModel'] ?? ''));
        if ($model === '') {
            $model = trim((string)env('GROQ_MODEL', ''));
        }
        // The approved objective doubles as the deterministic fallback.
        $first = preg_split('/\s+/u', trim((string)$lead['nome']))[0] ?? '';
        $objective = strtr($objective, [
            '{{nome}}' => $first,
            '{{empresa}}' => (string)$lead['empresa'],
            '{{sistema_interesse}}' => implode(', ', $lead['sistemasNomes'] ?? []),
        ]);
        $signature = trim((string)($config['fallbackSignature'] ?? ''));
        $signature = str_replace(
            ['{{empresa}}', '{{marca}}'],
            $brand,
            $signature !== '' ? $signature : 'da ' . $brand,
        );
        $fallback = ($first !== '' ? $first . ', aqui' : 'Aqui') . ' é '
            . ($lead['responsavel'] ?: 'a equipe') . ', ' . $signature . '. ' . $objective;
        $semIa = str_contains($reply, '?') ? $human : $fallback;
        if (empty($config['aiEnabled']) || $key === '' || $model === '') {
            return $semIa;
        }
        try {
            $prompt = str_replace(
                ['{{empresa}}', '{{marca}}', '{{humano}}'],
                [$brand, $brand, $human],
                (string)($config['aiSystemPrompt'] ?? ''),
            );
            $response = (new Client(['timeout' => (int)($config['aiTimeout'] ?? 15)]))->post(
                'https://api.groq.com/openai/v1/chat/completions',
                json_encode([
                    'model' => $model,
                    'temperature' => (float)($config['aiTemperature'] ?? 0.4),
                    'max_tokens' => (int)($config['aiMaxTokens'] ?? 400),
                    'messages' => [
                        ['role' => 'system', 'content' => $prompt],
                        ['role' => 'user', 'content' => json_encode([
                            'objetivo_aprovado' => $objective,
                            'resposta' => mb_substr($reply, 0, (int)($config['aiMaxReplyLength'] ?? 3000)),
                            'sistemas' => $lead['sistemasNomes'] ?? [],
                            'necessidades' => mb_substr(
                                $lead['observacoes'] ?? '',
                                0,
                                (int)($config['aiMaxNotesLength'] ?? 2000),
                            ),
                        ], JSON_UNESCAPED_UNICODE)],
                    ],
                ]),
                ['type' => 'json', 'headers' => ['Authorization' => 'Bearer ' . $key]],
            );
            $text = trim((string)($response->getJson()['choices'][0]['message']['content'] ?? ''));
            if (
                $response->isOk() && $text !== ''
                && mb_strlen($text) <= (int)($config['aiMaxOutputLength'] ?? 2000)
            ) {
                return $text;
            }
        } catch (Throwable) {
            // Free-tier exhaustion must not lose the pending conversation.
        }

        return $semIa;
    }
}
