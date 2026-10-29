<?php
declare(strict_types=1);

namespace App\Service;

use Cake\Http\Client;
use RuntimeException;

class WhatsAppGateway
{
    /** Authenticate a bounded request to the private connector. */
    public function request(string $path, ?array $body = null): array
    {
        $url = rtrim((string)env('WHATSAPP_CONNECTOR_URL', ''), '/');
        $token = (string)env('WHATSAPP_CONNECTOR_TOKEN', '');
        if ($url === '' || strlen($token) < 32) {
            throw new RuntimeException('Configure WHATSAPP_CONNECTOR_URL e WHATSAPP_CONNECTOR_TOKEN no servidor.');
        }
        $client = new Client(['timeout' => 35]);
        $options = ['headers' => ['Authorization' => 'Bearer ' . $token], 'type' => 'json'];
        $response = $body === null
            ? $client->get($url . $path, [], $options)
            : $client->post($url . $path, json_encode($body), $options);
        if (!$response->isOk()) {
            throw new RuntimeException('Conector indisponível. Verifique a conexão e os logs do serviço.');
        }

        return (array)$response->getJson();
    }
}
