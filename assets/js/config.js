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

/* Marca editável em Configurações. O HTML mantém o visual atual como fallback. */
(function (Painel) {
  "use strict";

  var dados = {
    nome: Painel.config.company,
    nomeExibicao: Painel.config.company,
    nomeApp: Painel.config.app,
    logo: "images/logoFull.png",
    logoMini: "images/logoMini.png",
    emailSuporte: "",
    rodape: Painel.config.company + " · " + Painel.config.app
  };

  function trocarTexto(antigo, novo) {
    return function (texto) {
      return novo ? String(texto || "").split(antigo).join(novo) : texto;
    };
  }

  function aplicar() {
    var nome = dados.nomeExibicao || dados.nome || Painel.config.company;
    var app = dados.nomeApp || Painel.config.app;

    document.querySelectorAll("[data-brand-name]").forEach(function (el) { el.textContent = nome; });
    document.querySelectorAll("[data-brand-app]").forEach(function (el) { el.textContent = app; });
    document.querySelectorAll("[data-brand-rodape]").forEach(function (el) { el.textContent = dados.rodape; });
    document.querySelectorAll("img.brand__logo").forEach(function (img) {
      if (dados.logo) img.src = dados.logo;
      img.alt = nome;
    });
    document.querySelectorAll("img.brand__logo-mini, .rail-brand img").forEach(function (img) {
      if (dados.logoMini) img.src = dados.logoMini;
    });
    document.querySelectorAll(".brand__tag").forEach(function (el) { el.textContent = app; });
    document.querySelectorAll(".rail-brand").forEach(function (el) { el.setAttribute("aria-label", app); });
    if (dados.emailSuporte) {
      document.querySelectorAll('a[href^="mailto:suporte@assinasoft.com.br"]').forEach(function (a) {
        a.href = "mailto:" + dados.emailSuporte + (a.href.indexOf("?") >= 0 ? a.href.slice(a.href.indexOf("?")) : "");
      });
    }
    if (document.title && nome) {
      document.title = trocarTexto(Painel.config.company, nome)(document.title);
    }
    if (document.title && app) {
      document.title = trocarTexto(Painel.config.app, app)(document.title);
    }
    var descricao = document.querySelector('meta[name="description"]');
    if (descricao && descricao.content) {
      var texto = trocarTexto(Painel.config.company, nome)(descricao.content);
      descricao.content = trocarTexto(Painel.config.app, app)(texto);
    }
  }

  Painel.brand = {
    dados: dados,
    aplicar: aplicar,
    carregar: function () {
      return fetch(Painel.config.apiBase + "/auth/session", {
        headers: { "Accept": "application/json" },
        credentials: "same-origin"
      }).then(function (res) {
        return res.json();
      }).then(function (json) {
        var marca = json && json.data && json.data.marca;
        if (marca) {
          dados.nome = marca.nome || dados.nome;
          dados.nomeExibicao = marca.nomeExibicao || dados.nomeExibicao;
          dados.nomeApp = marca.nomeApp || dados.nomeApp;
          dados.logo = marca.logo || dados.logo;
          dados.logoMini = marca.logoMini || dados.logoMini;
          dados.emailSuporte = marca.emailSuporte || dados.emailSuporte;
          dados.rodape = marca.rodape || dados.rodape;
        }
        return dados;
      }).catch(function () {
        return dados;
      }).then(function () {
        aplicar();
        return dados;
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { aplicar(); });
  } else {
    aplicar();
  }
  Painel.brand.carregar();
})(window.Painel);
