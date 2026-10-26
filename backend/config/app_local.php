<?php

use Cake\Database\Connection;
use Cake\Database\Driver\Postgres;
use function Cake\Core\env;

/*
 * Configuração local/produção do Painel Comercial.
 * Em produção as credenciais vêm de variáveis de ambiente
 * (DATABASE_URL, SECURITY_SALT, SESSION_SECURE).
 */
$databaseUrl = env('DATABASE_URL', null);

$appEnv = (string)env('APP_ENV', 'development');
$debug = filter_var(env('DEBUG', $appEnv !== 'production'), FILTER_VALIDATE_BOOLEAN);
$salt = env('SECURITY_SALT', null);

if (!$salt) {
    if ($appEnv === 'production' || !$debug) {
        throw new RuntimeException(
            'SECURITY_SALT não configurado. Defina uma chave aleatória forte no ambiente.'
        );
    }
    $salt = 'desenvolvimento-local-troque-em-producao';
}

/*
 * O CakePHP só reconhece o esquema "postgres://" no mapa de DSN, mas o Neon
 * fornece "postgresql://". Por isso montamos a configuração do driver
 * explicitamente, normalizando também "?sslmode=require" para ssl/ssl_mode.
 */
$databaseConfig = null;
if ($databaseUrl) {
    $parts = parse_url($databaseUrl) ?: [];
    $query = [];
    parse_str((string)($parts['query'] ?? ''), $query);

    $databaseConfig = [
        'className' => Connection::class,
        'driver' => Postgres::class,
        'host' => $parts['host'] ?? 'localhost',
        'port' => (int)($parts['port'] ?? 5432),
        'username' => isset($parts['user']) ? urldecode($parts['user']) : null,
        'password' => isset($parts['pass']) ? urldecode($parts['pass']) : null,
        'database' => isset($parts['path']) ? ltrim(urldecode($parts['path']), '/') : null,
        'encoding' => 'utf8',
        'timezone' => 'UTC',
        'persistent' => false,
        'cacheMetadata' => true,
        'quoteIdentifiers' => false,
        'log' => false,
        'ssl' => true,
        'ssl_mode' => $query['sslmode'] ?? 'require',
        /*
         * O pdo_pgsql do PHP 8.5 aborta a transação silenciosamente ao
         * executar DDL com prepared statements nativos. Emular os prepares
         * evita o problema e também é mais compatível com o pooler do Neon.
         */
        'flags' => [PDO::ATTR_EMULATE_PREPARES => true],
    ];
}

return [
    'debug' => $debug,

    'App' => [
        'defaultLocale' => 'pt_BR',
        'defaultTimezone' => env('APP_DEFAULT_TIMEZONE', 'America/Sao_Paulo'),
    ],

    'Security' => [
        'salt' => $salt,
    ],

    'Datasources' => [
        'default' => $databaseConfig ?: [
            'driver' => 'Sqlite',
            'database' => TMP . 'dev.sqlite',
        ],
        'test' => [
            'driver' => 'Sqlite',
            'database' => TMP . 'tests.sqlite',
        ],
    ],

    'Session' => [
        'defaults' => 'database',
        'timeout' => (int)env('SESSION_TIMEOUT', 240),
        'cookie' => env('SESSION_COOKIE', 'PAINEL_SESSION'),
        'ini' => [
            'session.cookie_httponly' => true,
            'session.cookie_secure' => filter_var(env('SESSION_SECURE', false), FILTER_VALIDATE_BOOLEAN),
            'session.cookie_samesite' => 'Lax',
        ],
    ],

    'EmailTransport' => [
        'default' => [
            'host' => 'localhost',
            'port' => 25,
            'username' => null,
            'password' => null,
            'client' => null,
            'url' => env('EMAIL_TRANSPORT_DEFAULT_URL', null),
        ],
    ],
];
