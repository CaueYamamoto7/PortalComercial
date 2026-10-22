/* ==========================================================================
   Painel Comercial — Configuração central
   O front-end consome a API PHP/CakePHP em apiBase (mesma origem).
   ========================================================================== */

window.Painel = window.Painel || {};

Painel.config = {
  app: "Painel Comercial",
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
    "index.html",
    "leads.html",
    "pipeline.html",
    "followups.html",
    "mensagens.html",
    "relatorios.html",
    "configuracoes.html",
    "conta.html"
  ]
};
