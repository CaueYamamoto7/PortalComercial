/* ==========================================================================
   Painel Comercial — Autenticação (protótipo local)
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

  function derivarNome(email) {
    var local = String(email || "").split("@")[0].replace(/[._-]+/g, " ");
    var partes = local.split(/\s+/).filter(Boolean).map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    });
    return partes.join(" ") || "Usuário";
  }

  var auth = {
    sessao: function () {
      return Painel.store.getSession();
    },

    usuario: function () {
      return Painel.store.getSession() || {
        nome: "Marina Costa",
        email: Painel.config.demo.email,
        cargo: "Diretora Comercial",
        empresa: Painel.config.company,
        iniciais: "MC"
      };
    },

    entrar: function (email, senha, lembrar) {
      return new Promise(function (resolve, reject) {
        var e = String(email || "").trim().toLowerCase();
        var s = String(senha || "");

        setTimeout(function () {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
            reject(new Error("Informe um e-mail válido."));
            return;
          }
          if (s.length < 6) {
            reject(new Error("A senha deve ter pelo menos 6 caracteres."));
            return;
          }

          var demo = e === Painel.config.demo.email;
          var nome = demo ? "Marina Costa" : derivarNome(e);
          var sessao = {
            nome: nome,
            email: e,
            cargo: demo ? "Diretora Comercial" : "Consultor(a) comercial",
            empresa: Painel.config.company,
            iniciais: Painel.util.iniciais(nome),
            lembrar: !!lembrar,
            desde: new Date().toISOString()
          };

          Painel.store.setSession(sessao);
          resolve(sessao);
        }, 380);
      });
    },

    sair: function () {
      Painel.store.clearSession();
      window.location.href = "login.html";
    },

    destino: normalizarDestino
  };

  Painel.auth = auth;

  var modo = document.documentElement.getAttribute("data-auth");
  if (modo === "required" && Painel.store.disponivel && !Painel.store.getSession()) {
    var next = paginaAtual() + window.location.search;
    window.location.replace("login.html?next=" + encodeURIComponent(next));
  }
})(window.Painel);
