<?php
/**
 * Servidor de desenvolvimento (PHP built-in server).
 *
 * Uso:
 *   php -S 127.0.0.1:8080 -t . router.php
 *
 * Serve o front estático e encaminha /api/* para o CakePHP em
 * backend/webroot/index.php, mantendo a mesma origem (cookies/CSRF).
 */
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Nunca expõe arquivos internos do backend ou do próprio repositório.
if (preg_match('#^/(backend|vendor|node_modules|\.)#', $path)) {
    http_response_code(404);
    echo 'Não encontrado';
    return true;
}

if ($path === '/api' || str_starts_with($path, '/api/')) {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['PHP_SELF'] = '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = __DIR__ . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . 'webroot' . DIRECTORY_SEPARATOR . 'index.php';

    require $_SERVER['SCRIPT_FILENAME'];
    return true;
}

if ($path !== '/' && is_file(__DIR__ . $path)) {
    return false;
}

if ($path === '/') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . DIRECTORY_SEPARATOR . 'index.html');
    return true;
}

http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
echo 'Página não encontrada. <a href="/">Voltar ao painel</a>';
return true;
