/* ==========================================================================
   Portal Comercial — Configuração central
   O front-end consome a API PHP/CakePHP em apiBase (mesma origem).
   ========================================================================== */

window.Painel = window.Painel || {};

Painel.config = {
  app: "Portal Comercial",
  company: "AssinaSoft",
  versao: "2.0.0",

  apiBase: "/api",

  storage: {
    session: "assinasoft.sessao.v1",
    conta: "assinasoft.conta.v1"
  },

  paginacao: {
    leads: 12,
    mensagens: 10
  },

  paginasInternas: [
    "/",
    "/leads",
    "/cadastro-lead",
    "/pipeline",
    "/followups",
    "/mensagens",
    "/relatorios",
    "/configuracoes",
    "/conta"
  ]
};
