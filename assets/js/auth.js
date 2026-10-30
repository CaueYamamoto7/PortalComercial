/* ==========================================================================
   Portal Comercial — Autenticação (sessão do backend)
   ========================================================================== */

(function (Painel) {
  "use strict";

  function paginaAtual() {
    return window.location.pathname || "/";
  }

  function normalizarDestino(next) {
    if (!next) return "/";
    try {
      var destino = new URL(String(next), window.location.origin);
      if (destino.origin !== window.location.origin) return "/";
      var path = destino.pathname === "/index.html" ? "/" : destino.pathname.replace(/\.html$/, "");
      if (Painel.config.paginasInternas.indexOf(path) !== -1) return path + destino.search;
    } catch (e) { /* destino inválido */ }
    return "/";
  }

  function redirecionarLogin() {
    var next = paginaAtual() + window.location.search;
    window.location.replace("/login?next=" + encodeURIComponent(next));
  }

  var idleLimit = 30 * 60 * 1000;
  var activityKey = "assinasoft.ultimaAtividade.v1";
  var leadKey = "assinasoft.cadastroLeadAberto.v1";
  var leadLeaseKey = "assinasoft.cadastroLeadAtivo.v1";
  var isLead = paginaAtual() === "/cadastro-lead";
  var lastActivity = Date.now();
  var lastPing = 0;
  var idleClosing = false;
  var resumeFromLead = false;

  try {
    resumeFromLead = !isLead && window.sessionStorage.getItem(leadKey) === "1";
    if (isLead) window.sessionStorage.setItem(leadKey, "1");
    else window.sessionStorage.removeItem(leadKey);
    var saved = Number(window.localStorage.getItem(activityKey));
    if (saved > 0 && saved <= Date.now()) lastActivity = saved;
    if (isLead || resumeFromLead) lastActivity = Date.now();
  } catch (e) { /* armazenamento indisponível */ }

  function recordActivity() {
    if (isLead || idleClosing || !Painel.store.getSession()) return;
    var now = Date.now();
    if (now - lastActivity >= idleLimit) { checkIdle(); return; }
    lastActivity = now;
    try { window.localStorage.setItem(activityKey, String(now)); } catch (e) { /* segue nesta aba */ }
    if (now - lastPing < 60000) return;
    lastPing = now;
    fetch(Painel.config.apiBase + "/auth/session", {
      credentials: "same-origin",
      headers: { "Accept": "application/json", "X-User-Activity": "1" }
    }).then(function (response) {
      if (response.status === 401) {
        Painel.store.clearSession();
        redirecionarLogin();
      }
    }).catch(function () { /* a próxima requisição validará a sessão */ });
  }

  function checkIdle() {
    if (isLead || idleClosing || !Painel.store.getSession()) return;
    try {
      var leadLease = Number(window.localStorage.getItem(leadLeaseKey));
      if (leadLease > Date.now() - 15000 && leadLease <= Date.now()) {
        lastActivity = Date.now();
        window.localStorage.setItem(activityKey, String(lastActivity));
        return;
      }
      var shared = Number(window.localStorage.getItem(activityKey));
      if (shared > lastActivity && shared <= Date.now()) lastActivity = shared;
    } catch (e) { /* segue nesta aba */ }
    if (Date.now() - lastActivity < idleLimit) return;
    idleClosing = true;
    Painel.api.auth.logout().catch(function () { /* sessão local deve ser limpa mesmo sem rede */ }).then(function () {
      Painel.store.clearSession();
      redirecionarLogin();
    });
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
        lastActivity = Date.now();
        try { window.localStorage.setItem(activityKey, String(lastActivity)); } catch (e) { /* segue nesta aba */ }
        return sessao;
      });
    },

    sair: function () {
      var concluir = function () {
        Painel.store.clearSession();
        try { window.localStorage.removeItem(activityKey); } catch (e) { /* ignora */ }
        window.location.href = "/login";
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
          if (sessao.mustChangePassword && paginaAtual() !== "/conta") {
            window.location.replace("/conta");
            return sessao;
          }
          if (resposta && resposta.preferencias) {
            document.documentElement.classList.toggle("tables-compact", !!resposta.preferencias.tabelaCompacta);
          }
          return sessao;
        }
        Painel.store.clearSession();
        return null;
      }).catch(function (error) {
        if (paginaAtual() === "/cadastro-lead" && !error.status) {
          return auth.sessao();
        }
        return null;
      });
    },

    destino: normalizarDestino
  };

  auth.resumeFromLead = resumeFromLead;

  Painel.auth = auth;

  var modo = document.documentElement.getAttribute("data-auth");

  if (modo === "required" && Painel.store.disponivel && !Painel.store.getSession()) {
    redirecionarLogin();
    return;
  }

  if (modo === "required") {
    if (isLead) {
      function renewLeadLease() {
        try { window.localStorage.setItem(leadLeaseKey, String(Date.now())); } catch (e) { /* segue nesta aba */ }
      }
      renewLeadLease();
      window.setInterval(renewLeadLease, 5000);
      window.addEventListener("pagehide", function () {
        fetch(Painel.config.apiBase + "/auth/session", {
          credentials: "same-origin",
          keepalive: true,
          headers: { "Accept": "application/json", "X-Page-Context": "cadastro-lead" }
        }).catch(function () { /* a próxima requisição validará a sessão */ });
      });
      window.setInterval(function () {
        if (!Painel.store.getSession()) return;
        Painel.api.auth.sessao().catch(function () { /* a próxima requisição validará a sessão */ });
      }, 5 * 60 * 1000);
    } else {
      ["pointerdown", "keydown", "scroll", "touchstart", "input"].forEach(function (eventName) {
        document.addEventListener(eventName, recordActivity, { passive: true });
      });
      window.addEventListener("focus", checkIdle);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) checkIdle(); });
      window.addEventListener("storage", function (event) {
        if (event.key === activityKey) checkIdle();
        if (event.key === Painel.config.storage.session && !event.newValue) redirecionarLogin();
      });
      window.setInterval(checkIdle, 10000);
      if (Date.now() - lastActivity >= idleLimit) checkIdle();
      else if (!saved) recordActivity();
    }
    auth.verificar().then(function (sessao) {
      if (!sessao) redirecionarLogin();
    });
  }

  if (modo === "guest" && Painel.store.getSession()) {
    auth.verificar().then(function (sessao) {
      if (sessao) {
        var next = new URLSearchParams(window.location.search).get("next");
        window.location.replace(auth.destino(next));
      }
    });
  }
})(window.Painel);
