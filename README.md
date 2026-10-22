# Painel Comercial · AssinaSoft

CRM comercial da AssinaSoft para gestão de leads, funil de vendas, follow-ups, campanhas de WhatsApp e indicadores de desempenho.

## Visão geral

O Painel Comercial centraliza a operação comercial em uma aplicação web com front-end estático e API própria. A interface reúne cadastro e qualificação de leads, acompanhamento do pipeline, agenda de follow-ups, templates de mensagem, campanhas e relatórios gerenciais.

O sistema opera em uma única origem: o front-end é servido em `/` e a API em `/api`. A autenticação é baseada em sessão, com proteção CSRF e cookies restritos ao contexto da aplicação.

## Arquitetura

- **Front-end:** aplicação multipágina em HTML, CSS e JavaScript, sem framework de UI.
- **Backend:** API JSON em PHP 8.5 com CakePHP 5.4.
- **Banco de dados:** PostgreSQL em produção e SQLite em desenvolvimento.
- **Sessões:** armazenadas no banco de dados.
- **Cache:** arquivos no diretório configurado por `APP_TMP`.
- **Implantação:** container único com FrankenPHP e Caddy, hospedado na Vercel.
- **Rede:** front-end e API na mesma origem, sem CORS.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML5, CSS3, JavaScript |
| Planilhas | SheetJS |
| Backend | PHP 8.5, CakePHP 5.4, Composer |
| Banco | PostgreSQL, SQLite |
| Servidor | FrankenPHP, Caddy |
| Container | Docker |
| Hospedagem | Vercel |

## Módulos

### Painel

Visão operacional com cartões de contatos organizados por estágio de relacionamento: sem mensagem enviada, aguardando resposta, resposta pendente, conversas em aberto, clientes e contatos recusados.

### Leads

Cadastro, edição, consulta detalhada, timeline de interações, filtros combinados, ordenação e paginação. O detalhe do lead reúne dados cadastrais, histórico, conversa e tarefas associadas.

### Importação

Leitura de arquivos CSV, XLSX e XLS com mapeamento automático de colunas, validação de telefones e tratamento de registros duplicados.

### Pipeline

Quadro kanban com etapas configuráveis e movimentação de leads por arrastar e soltar.

### Follow-ups

Agenda de tarefas por período, identificação de atrasos, conclusão de atividades e filtros por responsável.

### Mensagens

Composição de campanhas, seleção de público por filtros ou de forma manual, prévia de mensagem, variáveis, templates e histórico de envios.

### Relatórios

Indicadores de conversão, funil, origem dos leads, motivos de perda, desempenho da equipe e volume de mensagens.

### Configurações

Gestão da empresa, funil, sistemas comercializados, origens de lead, equipe e regras de mensagens.

### Conta

Perfil persistido no servidor e preferências de exibição mantidas no navegador.

## Catálogo inicial

O funil padrão é composto por **Novo → Contatado → Qualificado → Proposta → Negociação → Ganho / Perdido**.

Os sistemas inicialmente acompanhados são **AssinaPDF**, **AssinaDNS** e **ConforSeg**.

## Estrutura do repositório

```text
assets/
  css/            estilos globais, componentes e páginas
  js/
    api.js        integração HTTP, CSRF e sessão
    auth.js       autenticação e ciclo de sessão
    ui.js         shell, navegação e componentes visuais
    components/   componentes de lead e drawers
    pages/        comportamento de cada tela
    store.js      sessão e preferências locais
  vendor/         dependências de front-end
*.html            páginas da aplicação
images/           identidade visual
router.php        roteamento local do front e da API
Caddyfile         configuração do FrankenPHP
Dockerfile.vercel imagem de implantação
serve.js          servidor estático auxiliar
backend/          aplicação CakePHP
  config/         rotas, banco, migrations e configuração
  src/            controllers, services, middleware e models
  webroot/        front controller da API
```

## API

As rotas são agrupadas sob `/api`. Respostas de sucesso utilizam o envelope `{ "data": ... }`; erros utilizam `{ "message": "...", "campo": "..." }`.

| Área | Rotas |
| --- | --- |
| Saúde | `GET /api/health` |
| Autenticação | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session` |
| Painel | `GET /api/dashboard`, `GET /api/dashboard/conversas` |
| Leads | `GET/POST /api/leads`, `GET/PUT/DELETE /api/leads/{id}`, `POST /api/leads/{id}/mover`, `POST /api/leads/importar` |
| Interações | `POST /api/leads/{id}/interacoes` |
| Tarefas | `GET/POST /api/tarefas`, `POST /api/tarefas/{id}/concluir`, `DELETE /api/tarefas/{id}` |
| Pipeline | `GET /api/pipeline` |
| Campanhas | `GET/POST /api/mensagens`, `POST /api/mensagens/individual`, `POST /api/mensagens/{id}/cancelar` |
| Templates | `GET/POST /api/templates`, `PUT/DELETE /api/templates/{id}` |
| Relatórios | `GET /api/relatorios` |
| Configurações | `GET /api/configuracoes`, `PUT /api/configuracoes/{secao}`, CRUD de sistemas, origens, etapas e equipe |
| Conta | `PUT /api/perfil`, `PUT /api/senha` |
| Notificações | `GET /api/notificacoes`, `POST /api/notificacoes/marcar-lidas` |

## Configuração de ambiente

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | Conexão com o PostgreSQL. Na ausência, a aplicação utiliza SQLite local. |
| `SECURITY_SALT` | Salt criptográfico do CakePHP. |
| `DEBUG` | Modo de diagnóstico detalhado. |
| `SESSION_SECURE` | Restringe o cookie de sessão a conexões HTTPS. |
| `APP_TMP` | Diretório de cache, logs e sessões. |
| `APP_DEFAULT_TIMEZONE` | Fuso horário da aplicação. |
| `ADMIN_NAME` | Nome do usuário inicial criado pela migration de catálogo. |
| `ADMIN_EMAIL` | E-mail do usuário inicial. |
| `ADMIN_PASSWORD` | Senha do usuário inicial. |

## Segurança

- Senhas armazenadas com `password_hash` e verificadas com `password_verify`.
- Sessões com cookie `HttpOnly`, `SameSite=Lax` e opção de restrição a HTTPS.
- Proteção CSRF por cookie double-submit e header `X-CSRF-Token`.
- Consultas de banco realizadas pelo ORM do CakePHP.
- Front-end e API na mesma origem, sem CORS.
- Conexão com PostgreSQL protegida por SSL.
- Cabeçalhos de segurança configurados no Caddy.

## Operação

A aplicação é implantada como um único container FrankenPHP/Caddy. O Caddy entrega o front-end estático e encaminha `/api/*` para o front controller do CakePHP. A região de implantação é `gru1` (São Paulo).

As migrations são aplicadas de forma independente do boot do container. As sessões utilizam a tabela `sessions` do banco e o cache utiliza arquivos no diretório `APP_TMP`.

## Estado atual

- O envio de WhatsApp está implementado como stub: a mensagem é validada e registrada no histórico, mas não é disparada para a API do WhatsApp.
- O banco inicial não contém leads, conversas ou campanhas fictícias.
- A interface e a API são servidas na mesma origem em produção.
