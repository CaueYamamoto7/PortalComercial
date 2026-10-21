/* ==========================================================================
   Painel Comercial — Configuração central
   Front-end local. O backend em PHP/CakePHP consumirá o contrato descrito
   em assets/js/api.js quando useMock for desativado.
   ========================================================================== */

window.Painel = window.Painel || {};

Painel.config = {
  app: "Painel Comercial",
  company: "AssinaSoft",
  versao: "2.0.0",

  useMock: true,
  apiBase: "/api",
  latenciaMock: [80, 220],

  storage: {
    db: "assinasoft.painel.v2",
    session: "assinasoft.sessao.v1"
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
    "configuracoes.html"
  ],

  demo: {
    email: "demo@assinasoft.com.br",
    senha: "demo123"
  }
};
