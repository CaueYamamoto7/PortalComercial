# Painel Comercial · AssinaSoft

CRM comercial da **AssinaSoft** para importar leads, organizar o funil de vendas, acompanhar follow-ups e registrar mensagens de WhatsApp.

O projeto tem duas partes no mesmo repositório:

- **Front-end** estático (HTML/CSS/JS) na raiz.
- **Backend** em **PHP 8.5 + CakePHP 5.4** em `backend/`, com banco **Postgres** (produção) ou **SQLite** (desenvolvimento).

Em produção, um único container (FrankenPHP) serve o front em `/` e a API em `/api`, na mesma origem — sem CORS.

> O envio de WhatsApp ainda é um **stub**: a mensagem é validada e registrada no histórico do lead, mas não é disparada para a API do WhatsApp.

## Funcionalidades

- **Painel:** cartões operacionais com listas de contatos — sem mensagem enviada, aguardando resposta, preciso responder, conversas em aberto, clientes e recusados/não contatar.
- **Leads:** busca, filtros combinados, paginação, cadastro/edição, detalhe com timeline, conversa e tarefas.
- **Importação:** CSV, XLSX e XLS com mapeamento automático de colunas, validação de telefone e tratamento de duplicados.
- **Pipeline:** kanban com arrastar e soltar entre etapas configuráveis.
- **Follow-ups:** agenda por período, atrasados, conclusão de tarefas e filtros por responsável.
- **Mensagens:** seleção de público por filtros ou manual, prévia estilo WhatsApp, variáveis, templates e histórico de campanhas.
- **Relatórios:** conversão, funil, origem dos leads, motivos de perda, desempenho da equipe e volume de mensagens.
- **Configurações:** empresa, funil, sistemas vendidos, origens, equipe e regras de mensagens.
- **Conta:** perfil persistido no servidor e preferências de exibição neste navegador.

O funil inicial é **Novo → Contatado → Qualificado → Proposta → Negociação → Ganho / Perdido**, e os sistemas acompanhados são **AssinaPDF**, **AssinaDNS** e **ConforSeg**.

## Requisitos

- PHP **8.2+** (recomendado 8.5) com `intl`, `mbstring`, `pdo_sqlite` e `pdo_pgsql`.
- Composer 2.
- Node.js apenas para o servidor estático alternativo (`serve.js`); não é necessário para o backend.

## Desenvolvimento local

### 1. Backend

```bash
cd backend
composer install

# Cria o banco SQLite em tmp/dev.sqlite
php bin/cake.php migrations migrate
```

A migration `SeedCatalog` cria o catálogo inicial (funil, sistemas, origens e configurações) e **um único usuário administrador**:

- **E-mail:** `admin@assinasoft.com.br`
- **Senha:** `admin123`

Para usar outras credenciais já na criação, defina `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_NAME` antes de rodar a migration. Depois do primeiro acesso, altere a senha diretamente no banco (a troca pelo painel é feita pelo administrador da conta).

> Não há leads, conversas ou campanhas fictícias no banco. A base começa vazia.

### 2. Front + API na mesma origem

Na raiz do repositório:

```bash
php -S 127.0.0.1:8080 -t . router.php
```

Abra **http://127.0.0.1:8080**. O `router.php` serve os arquivos estáticos e encaminha `/api/*` para `backend/webroot/index.php`.

Também é possível servir apenas o front com `node serve.js` (porta 4173), mas nesse caso a API não estará disponível na mesma origem.

### Configuração do backend

`backend/config/app_local.php` lê as variáveis de ambiente:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | — | URL do Postgres. Sem ela, usa SQLite em `backend/tmp/dev.sqlite`. |
| `SECURITY_SALT` | valor de desenvolvimento | Salt do CakePHP. **Obrigatório em produção.** |
| `DEBUG` | `true` | Desative em produção. |
| `SESSION_SECURE` | `false` | Use `true` em produção (HTTPS). |
| `APP_TMP` | `backend/tmp` | Diretório gravável para cache, logs e sessões. |
| `APP_DEFAULT_TIMEZONE` | `America/Sao_Paulo` | Fuso do servidor. |

As sessões são gravadas na tabela `sessions` do banco (sem Redis) e o cache usa arquivos em `APP_TMP`.

## Estrutura

```text
assets/
  css/            tokens, componentes, páginas e estilos do CRM
  js/
    api.js        fachada HTTP (CSRF, sessão, tratamento de 401)
    auth.js       login, verificação de sessão e logout
    ui.js         navegação, sidebar, topbar e componentes visuais
    components/   drawers e componentes de lead
    pages/        scripts de cada tela
    store.js      sessão e preferências no localStorage
  vendor/         SheetJS para leitura de XLSX
*.html            páginas do sistema
images/           logotipos
router.php        servidor de desenvolvimento (front + /api)
Caddyfile         configuração do FrankenPHP em produção
Dockerfile.vercel imagem do container (front + API)
serve.js          servidor estático alternativo
backend/          aplicação CakePHP (API)
  config/         rotas, banco, migrations
  src/            controllers, services, middleware, models
  webroot/        front controller
```

## API

Todas as rotas ficam sob `/api`. Respostas de sucesso usam `{ "data": ... }`; erros usam `{ "message": "...", "campo": "..." }`.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Status da aplicação e do banco |
| `POST` | `/api/auth/login` | Login (sessão + cookie) |
| `POST` | `/api/auth/logout` | Encerra a sessão |
| `GET` | `/api/auth/session` | Sessão atual e empresa |
| `GET` | `/api/dashboard` | Indicadores, tarefas e campanhas |
| `GET` | `/api/dashboard/conversas` | Conversas por status |
| `GET/POST` | `/api/leads` | Lista e cria leads |
| `GET/PUT/DELETE` | `/api/leads/{id}` | Detalhe, edição e remoção |
| `POST` | `/api/leads/{id}/mover` | Move de etapa no funil |
| `POST` | `/api/leads/importar` | Importa linhas de planilha |
| `POST` | `/api/leads/{id}/interacoes` | Registra nota, mensagem ou ligação |
| `GET/POST` | `/api/tarefas` | Lista e cria tarefas |
| `POST` | `/api/tarefas/{id}/concluir` | Conclui/reabre tarefa |
| `DELETE` | `/api/tarefas/{id}` | Remove tarefa |
| `GET` | `/api/pipeline` | Quadro do funil |
| `GET/POST` | `/api/mensagens` | Campanhas |
| `POST` | `/api/mensagens/individual` | Mensagem para um lead |
| `POST` | `/api/mensagens/{id}/cancelar` | Cancela campanha agendada |
| `GET/POST` | `/api/templates` | Templates de mensagem |
| `PUT/DELETE` | `/api/templates/{id}` | Edita/remove template |
| `GET` | `/api/relatorios` | Relatórios por período |
| `GET` | `/api/configuracoes` | Configurações, catálogo e equipe |
| `PUT` | `/api/configuracoes/{empresa\|mensagens}` | Salva seção de configuração |
| `POST/PUT/DELETE` | `/api/configuracoes/sistemas[/{id}]` | CRUD de sistemas |
| `POST/PUT/DELETE` | `/api/configuracoes/origens[/{id}]` | CRUD de origens |
| `POST/PUT/DELETE` | `/api/configuracoes/etapas[/{id}]` | CRUD de etapas |
| `POST` | `/api/configuracoes/etapas/reordenar` | Reordena o funil |
| `POST/DELETE` | `/api/configuracoes/equipe[/{id}]` | Convida/remove membros |
| `PUT` | `/api/perfil` | Atualiza o próprio perfil |
| `PUT` | `/api/senha` | Altera a própria senha (exige a senha atual) |
| `GET` | `/api/notificacoes` | Notificações |
| `POST` | `/api/notificacoes/marcar-lidas` | Marca notificações como lidas |

A autenticação usa sessão do CakePHP com `password_hash`/`password_verify`. O CSRF usa cookie double-submit (`csrfToken`): o front lê o cookie e envia o valor em `X-CSRF-Token`.

## Deploy na Vercel

O repositório já contém `Dockerfile.vercel`, `Caddyfile` e `vercel.json`. A Vercel detecta o `Dockerfile.vercel` automaticamente e roteia todo o tráfego para o container.

### 1. Banco gratuito no Neon

1. Crie uma conta em [neon.tech](https://neon.tech) e um projeto na região **AWS South America East 1 (São Paulo)**, para ficar próximo da Vercel.
2. Copie a **connection string** (formato `postgresql://...?sslmode=require`). O app aceita tanto `postgresql://` quanto `postgres://`.
3. Rode as migrations **manualmente**, uma única vez, da sua máquina. Prefira o host **direto** (sem `-pooler`) para migrações:

```bash
cd backend
$env:DATABASE_URL="postgresql://usuario:senha@ep-xxxx.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require"
$env:ADMIN_EMAIL="seu@email.com"
$env:ADMIN_PASSWORD="uma-senha-forte"
php bin/cake.php migrations migrate
```

Em Linux/macOS use `DATABASE_URL=... ADMIN_EMAIL=... php bin/cake.php migrations migrate`.

> As migrations **não** rodam no boot do container. Isso evita alterações acidentais no schema a cada deploy.
>
> A conexão usa `PDO::ATTR_EMULATE_PREPARES` para evitar um bug do pdo_pgsql (PHP 8.5) em que DDL dentro de transação aborta silenciosamente, e também para maior compatibilidade com o pooler do Neon.

O plano gratuito do Neon oferece 1 GB por projeto, 100 CU-horas/mês e suspensão automática após 5 minutos sem uso (o primeiro acesso pode levar alguns segundos).

### 2. Variáveis na Vercel

Configure em **Project → Settings → Environment Variables**:

- `DATABASE_URL` — connection string do Neon.
- `SECURITY_SALT` — gere com `php -r "echo bin2hex(random_bytes(32));"`.
- `DEBUG=false`
- `SESSION_SECURE=true`
- `APP_TMP=/tmp/cake`
- `APP_DEFAULT_TIMEZONE=America/Sao_Paulo`

### 3. Deploy

```bash
npx vercel
```

ou conecte o repositório no painel da Vercel. O container escuta em `$PORT` (padrão `80`) e serve front + API na mesma origem.

O `vercel.json` fixa a região em **`gru1` (São Paulo)**, co-localizada com o banco no Neon. O plano **Hobby** permite uma única região por projeto.

> **Plano:** a Vercel permite o uso do plano **Hobby** apenas para projetos pessoais e não comerciais. Para um CRM de uso comercial, é necessário o plano **Pro**.

### Alternativas de banco gratuito

- **Neon** (recomendado): 1 GB, 100 CU-horas/mês, pooled, scale-to-zero.
- **Aiven Free**: 1 GB e 20 conexões.

## Segurança e operação

- Nunca versione `.env` nem credenciais de produção.
- `SECURITY_SALT` deve ser único por ambiente.
- Em produção, mantenha `DEBUG=false` e `SESSION_SECURE=true`.
- Faça backup do banco pelo painel do provedor (Neon/Aiven) antes de mudanças de schema.
- A senha pode ser alterada em **Conta → Acesso e segurança**; o perfil (nome, e-mail e cargo) também é editável em **Conta**.
