<?php
declare(strict_types=1);

namespace App\Command;

use Cake\Command\Command;
use Cake\Console\Arguments;
use Cake\Console\ConsoleIo;
use Cake\Console\ConsoleOptionParser;
use Cake\Core\Configure;
use Cake\Datasource\ConnectionManager;
use Cake\Utility\Security;
use Throwable;

/**
 * Verifica as configurações mínimas antes de um deploy em produção.
 *
 * Uso: bin/cake app:check
 */
class AppCheckCommand extends Command
{
    private const SALT_DESENVOLVIMENTO = 'desenvolvimento-local-troque-em-producao';

    public static function defaultName(): string
    {
        return 'app:check';
    }

    public function getOptionParser(): ConsoleOptionParser
    {
        return parent::getOptionParser()
            ->setDescription('Valida variáveis de ambiente, banco e diretório temporário.');
    }

    public function execute(Arguments $args, ConsoleIo $io): int
    {
        $falhas = 0;

        $appEnv = (string)env('APP_ENV', 'development');
        $debug = (bool)Configure::read('debug');
        $baseUrl = (string)Configure::read('App.fullBaseUrl');
        $salt = (string)Security::getSalt();
        $producao = $appEnv === 'production';

        $io->out('Ambiente: ' . $appEnv);
        $io->out('Debug: ' . ($debug ? 'true' : 'false'));

        if ($producao && $debug) {
            $io->error('DEBUG deve ser false em produção.');
            $falhas++;
        }

        if ($baseUrl === '') {
            if ($debug) {
                $io->warning('APP_FULL_BASE_URL não configurada (ignorada em desenvolvimento).');
            } else {
                $io->error('APP_FULL_BASE_URL não configurada. O HostHeaderMiddleware bloqueará as requisições.');
                $falhas++;
            }
        } else {
            $io->success('APP_FULL_BASE_URL: ' . $baseUrl);
        }

        if ($salt === '') {
            $io->error('SECURITY_SALT não configurado.');
            $falhas++;
        } elseif ($producao && $salt === self::SALT_DESENVOLVIMENTO) {
            $io->error('SECURITY_SALT ainda usa o valor de desenvolvimento.');
            $falhas++;
        } else {
            $io->success('SECURITY_SALT configurado.');
        }

        try {
            ConnectionManager::get('default')->execute('SELECT 1');
            $io->success('Conexão com o banco OK.');
        } catch (Throwable $e) {
            $io->error('Falha ao conectar no banco: ' . $e->getMessage());
            $falhas++;
        }

        $tmp = defined('TMP') ? TMP : sys_get_temp_dir();
        if (!is_dir($tmp) || !is_writable($tmp)) {
            $io->error('Diretório temporário sem permissão de escrita: ' . $tmp);
            $falhas++;
        } else {
            $io->success('Diretório temporário gravável: ' . $tmp);
        }

        if ($falhas > 0) {
            $io->error($falhas . ' verificação(ões) falharam.');

            return static::CODE_ERROR;
        }

        $io->success('Ambiente pronto para produção.');

        return static::CODE_SUCCESS;
    }
}
