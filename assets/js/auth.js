/* ==========================================================================
   Painel Comercial — Autenticação (sessão do backend)
   ========================================================================== */

(function (Painel) {
  "use strict";

  function paginaAtual() {
    var partes = window.location.pathname.split("/");
    return partes[partes.length - 1] || "index.html";
  }

  function normalizarDestino(next) {
    if (!next) return "index.html";
    var base = String(next).split("?")[0].split("#")[0].split("\\").pop().split("/").pop();
    if (Painel.config.paginasInternas.indexOf(base) !== -1) return base;
    return "index.html";
  }

  function redirecionarLogin() {
    var next = paginaAtual() + window.location.search;
    window.location.replace("login.html?next=" + encodeURIComponent(next));
  }

  var auth = {
    sessao: function () {
      return Painel.store.getSession();
    },

    usuario: function () {
      return Painel.store.getSession() || {
        nome: "",
        email: "",
        cargo: "",
        empresa: Painel.config.company,
        iniciais: ""
      };
    },

    entrar: function (email, senha, lembrar) {
      return Painel.api.auth.login(email, senha).then(function (usuario) {
        var sessao = Object.assign({}, usuario, {
          lembrar: !!lembrar,
          desde: usuario.desde || new Date().toISOString()
        });
        Painel.store.setSession(sessao);
        return sessao;
      });
    },

    sair: function () {
      var concluir = function () {
        Painel.store.clearSession();
        window.location.href = "login.html";
      };
      if (Painel.api && Painel.api.auth) {
        Painel.api.auth.logout().then(concluir, concluir);
      } else {
        concluir();
      }
    },

    verificar: function () {
      if (!Painel.api) return Promise.resolve(auth.sessao());
      var carregar = Painel.api.bootstrap || Painel.api.auth.sessao;
      return carregar().then(function (resposta) {
        var usuario = resposta && resposta.usuario;
        if (usuario) {
          var sessao = Object.assign({}, auth.sessao() || {}, usuario, {
            desde: (auth.sessao() || {}).desde || new Date().toISOString()
          });
          Painel.store.setSession(sessao);
          if (sessao.mustChangePassword && paginaAtual() !== "conta.html") {
            window.location.replace("conta.html");
            return sessao;
          }
          if (resposta && resposta.preferencias) {
            document.documentElement.classList.toggle("tables-compact", !!resposta.preferencias.tabelaCompacta);
          }
          return sessao;
        }
        Painel.store.clearSession();
        return null;
      }).catch(function () {
        return null;
      });
    },

    destino: normalizarDestino
  };

  Painel.auth = auth;

  var modo = document.documentElement.getAttribute("data-auth");

  if (modo === "required" && Painel.store.disponivel && !Painel.store.getSession()) {
    redirecionarLogin();
    return;
  }

  if (modo === "required") {
    auth.verificar().then(function (sessao) {
      if (!sessao) redirecionarLogin();
    });
  }

  if (modo === "guest" && Painel.store.getSession()) {
    auth.verificar().then(function (sessao) {
      if (sessao) window.location.replace("index.html");
    });
  }
})(window.Painel);
