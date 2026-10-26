<?php
declare(strict_types=1);

/**
 * Painel Comercial — configuração da aplicação CakePHP.
 */
namespace App;

use App\Middleware\AuthMiddleware;
use App\Middleware\ForcePasswordChangeMiddleware;
use App\Middleware\HostHeaderMiddleware;
use App\Middleware\JsonErrorMiddleware;
use Cake\Core\Configure;
use Cake\Core\ContainerInterface;
use Cake\Datasource\FactoryLocator;
use Cake\Error\Middleware\ErrorHandlerMiddleware;
use Cake\Event\EventManagerInterface;
use Cake\Http\BaseApplication;
use Cake\Http\Middleware\BodyParserMiddleware;
use Cake\Http\Middleware\CsrfProtectionMiddleware;
use Cake\Http\MiddlewareQueue;
use Cake\ORM\Locator\TableLocator;
use Cake\Routing\Middleware\AssetMiddleware;
use Cake\Routing\Middleware\RoutingMiddleware;

class Application extends BaseApplication
{
    public function bootstrap(): void
    {
        parent::bootstrap();

        FactoryLocator::add(
            'Table',
            (new TableLocator())->allowFallbackClass(false),
        );
    }

    public function middleware(MiddlewareQueue $middlewareQueue): MiddlewareQueue
    {
        $secureCookie = filter_var(env('SESSION_SECURE', false), FILTER_VALIDATE_BOOLEAN);

        $middlewareQueue
            ->add(new ErrorHandlerMiddleware(Configure::read('Error'), $this))
            ->add(new HostHeaderMiddleware())
            ->add(new AssetMiddleware([
                'cacheTime' => Configure::read('Asset.cacheTime'),
            ]))
            ->add(new RoutingMiddleware($this))
            ->add(new BodyParserMiddleware())
            ->add(new JsonErrorMiddleware())
            ->add(new CsrfProtectionMiddleware([
                'cookieName' => 'csrfToken',
                'httponly' => false,
                'secure' => $secureCookie,
                'samesite' => 'Lax',
            ]))
            ->add(new AuthMiddleware())
            ->add(new ForcePasswordChangeMiddleware());

        return $middlewareQueue;
    }

    public function services(ContainerInterface $container): void
    {
    }

    public function events(EventManagerInterface $eventManager): EventManagerInterface
    {
        return $eventManager;
    }
}
