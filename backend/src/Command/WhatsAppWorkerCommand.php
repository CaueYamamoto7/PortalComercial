<?php
declare(strict_types=1);

namespace App\Command;

use App\Service\OutreachService;
use Cake\Command\Command;
use Cake\Console\Arguments;
use Cake\Console\ConsoleIo;
use Cake\Console\ConsoleOptionParser;
use Throwable;

class WhatsAppWorkerCommand extends Command
{
    /** Configure a one-shot mode for diagnostics and supervised schedulers. */
    public function buildOptionParser(ConsoleOptionParser $parser): ConsoleOptionParser
    {
        return $parser->addOption('once', ['boolean' => true, 'help' => 'Executa um ciclo e encerra.']);
    }

    /** Run the persistent queue independently of browser sessions. */
    public function execute(Arguments $args, ConsoleIo $io): ?int
    {
        do {
            try {
                (new OutreachService())->tick();
            } catch (Throwable $error) {
                $io->err($error->getMessage());
                if ($args->getOption('once')) {
                    return static::CODE_ERROR;
                }
            }
            if (!$args->getOption('once')) {
                sleep(3);
            }
        } while (!$args->getOption('once'));

        return static::CODE_SUCCESS;
    }
}
