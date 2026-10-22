# Painel Comercial · AssinaSoft

CRM comercial da **AssinaSoft** para importar leads de planilhas, organizar o funil e disparar mensagens de WhatsApp em lote ou individualmente.

> **Escopo atual:** front-end completo, com dados de demonstração no `localStorage`. O envio de WhatsApp é simulado. A integração real será feita no backend PHP/CakePHP.

## Acesso de demonstração

- **E-mail:** `demo@assinasoft.com.br`
- **Senha:** `demo123`

## Como executar

O projeto é estático, mas deve ser servido por HTTP para que o `localStorage` funcione corretamente.

```bash
node serve.js
```

Depois abra **http://127.0.0.1:4173**.

Também é possível usar qualquer servidor estático de sua preferência.

## Funcionalidades

- **Painel de contatos:** seis cartões operacionais com listas clicáveis — sem mensagem enviada, aguardando resposta, preciso responder, conversas em aberto, clientes e recusados/não contatar. Cada lista permite buscar, filtrar por responsável, abrir o contato, enviar mensagem, registrar uma resposta recebida e iniciar um envio em lote.
- **Status de conversa:** calculado a partir das mensagens de WhatsApp registradas. Uma última mensagem recebida coloca o contato em **Preciso responder**; depois do envio da resposta ele passa para **Conversas em aberto**. Contatos encerrados como perdidos ou marcados como “não contatar” ficam bloqueados para novos envios.
- **Leads:** busca, filtros combinados, paginação, cadastro/edição, detalhe com timeline, conversa de WhatsApp, tarefas e observações.
- **Importação de planilhas:** CSV, XLSX e XLS com mapeamento automático de colunas, prévia dos dados, validação de WhatsApp e tratamento de duplicados.
- **Pipeline:** kanban com arrastar e soltar entre etapas configuráveis.
- **Follow-ups:** agenda por período, atrasados, conclusão de tarefas e filtros por responsável.
- **Mensagens:** seleção de público por filtros ou manual, prévia no estilo WhatsApp, variáveis, templates, agendamento simulado e histórico de campanhas. Clientes, oportunidades perdidas e contatos marcados como “não contatar” são excluídos automaticamente dos disparos em lote.
- **Relatórios:** conversão, funil, origem dos leads, motivos de perda, desempenho da equipe e volume de mensagens.
- **Configurações:** empresa, funil, sistemas vendidos, origens, equipe, regras de mensagens e ferramentas de dados.

O funil inicial é **Novo → Contatado → Qualificado → Proposta → Negociação → Ganho / Perdido**, e os sistemas acompanhados são **AssinaPDF**, **AssinaDNS** e **ConforSeg**.

A identidade visual usa `images/logoFull.png` na sidebar e no login (em branco sobre o fundo escuro) e `images/logoMini.png` no atalho do workspace e como favicon.

## Estrutura

```text
assets/
  css/            tokens, componentes, páginas e estilos do CRM
  js/
    api.js        fachada de API usada pelas páginas
    mock/         dados de demonstração e implementação mock
    components/   drawers e componentes de lead
    pages/        scripts de cada tela
    store.js      persistência em localStorage
  vendor/         SheetJS para leitura de XLSX
*.html            páginas do sistema
serve.js          servidor estático local
```

## Dados e integração futura

- Os dados de demonstração ficam em `assinasoft.painel.v2`; a sessão fica em `assinasoft.sessao.v1`.
- Para voltar ao estado inicial, use **Configurações → Dados e demonstração → Restaurar dados de demonstração**.
- As páginas consomem `Painel.api`. Para conectar o backend, basta substituir a implementação mock de `assets/js/mock/api.js` por chamadas HTTP mantendo os mesmos métodos e contratos.
- O envio real de WhatsApp deve ser implementado no backend e chamado pela fachada de mensagens.
