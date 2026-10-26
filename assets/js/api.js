/* ==========================================================================
   Painel Comercial — Fachada de API (backend PHP/CakePHP)
   ========================================================================== */

(function (Painel) {
  "use strict";

  var tokenAtual = "";
  var bootstrapToken = null;
  var bootstrapDados = null;
  var emAndamento = {};

  function queryString(params) {
    var partes = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === "") return;
      partes.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    return partes.length ? "?" + partes.join("&") : "";
  }

  function cookie(nome) {
    var alvo = String(nome) + "=";
    var itens = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < itens.length; i++) {
      var item = itens[i].trim();
      if (item.indexOf(alvo) === 0) {
        return decodeURIComponent(item.slice(alvo.length));
      }
    }
    return "";
  }

  function csrfToken() {
    return tokenAtual || cookie("csrfToken");
  }

  function garantirToken() {
    if (csrfToken()) return Promise.resolve();
    if (!bootstrapToken) {
      bootstrapToken = fetch(Painel.config.apiBase + "/auth/session", {
        headers: { "Accept": "application/json" },
        credentials: "same-origin"
      }).then(function () {
        tokenAtual = cookie("csrfToken");
      }).catch(function () {
        /* segue sem token: a requisição original reportará o erro */
      }).then(function () {
        bootstrapToken = null;
      });
    }
    return bootstrapToken;
  }

  function limparBootstrap() {
    bootstrapDados = null;
  }

  function redirecionarLogin() {
    var pagina = window.location.pathname.split("/").pop() || "index.html";
    if (pagina === "login.html") return;
    var next = pagina + window.location.search;
    window.location.replace("login.html?next=" + encodeURIComponent(next));
  }

  function requisicao(method, caminho, corpo, params) {
    var url = Painel.config.apiBase + caminho + queryString(params);
    var chave = method + " " + url + (corpo !== undefined ? " " + JSON.stringify(corpo) : "");

    if (method === "GET" && emAndamento[chave]) {
      return emAndamento[chave];
    }

    var promessa = garantirToken().then(function () {
      var headers = { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" };
      var token = csrfToken();
      if (token) headers["X-CSRF-Token"] = token;
      if (corpo !== undefined) headers["Content-Type"] = "application/json";

      return fetch(url, {
        method: method,
        headers: headers,
        credentials: "same-origin",
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) {
          if (res.status === 401 && caminho !== "/auth/login") {
            Painel.store.clearSession();
            redirecionarLogin();
          }
          if (res.status === 428) {
            var atual = window.location.pathname.split("/").pop();
            if (atual !== "conta.html") window.location.replace("conta.html");
          }
          if (res.status === 419) {
            tokenAtual = "";
          }
          var e = new Error(json.message || "Não foi possível concluir a operação.");
          e.campo = json.campo || null;
          e.status = res.status;
          throw e;
        }
        return json.data !== undefined ? json.data : json;
      });
    });

    if (method === "GET") {
      emAndamento[chave] = promessa;
      promessa.then(function () { delete emAndamento[chave]; }, function () { delete emAndamento[chave]; });
    }

    return promessa;
  }

  Painel.api = {
    modo: "http",
    bootstrap: function () {
      if (bootstrapDados) return Promise.resolve(bootstrapDados);
      return requisicao("GET", "/bootstrap").then(function (dados) {
        bootstrapDados = dados;
        return dados;
      });
    },
    resumo: function () { return requisicao("GET", "/resumo"); },
    catalogos: function (params) { return requisicao("GET", "/catalogos", undefined, params); },
    auth: {
      login: function (email, senha) {
        limparBootstrap();
        return requisicao("POST", "/auth/login", { email: email, senha: senha });
      },
      logout: function () {
        limparBootstrap();
        return requisicao("POST", "/auth/logout");
      },
      sessao: function () { return requisicao("GET", "/auth/session"); }
    },
    dashboard: {
      obter: function (periodo) { return requisicao("GET", "/dashboard", undefined, { periodo: periodo }); },
      conversas: function (tipo, params) { return requisicao("GET", "/dashboard/conversas", undefined, Object.assign({ tipo: tipo }, params || {})); }
    },
    leads: {
      listar: function (params) { return requisicao("GET", "/leads", undefined, params); },
      obter: function (id) { return requisicao("GET", "/leads/" + id); },
      criar: function (dados) { return requisicao("POST", "/leads", dados); },
      atualizar: function (id, dados) { return requisicao("PUT", "/leads/" + id, dados); },
      mover: function (id, etapaId) { return requisicao("POST", "/leads/" + id + "/mover", { etapaId: etapaId }); },
      remover: function (id) { return requisicao("DELETE", "/leads/" + id); },
      importar: function (linhas) { return requisicao("POST", "/leads/importar", { linhas: linhas }); },
      lote: function (payload) { return requisicao("POST", "/leads/lote", payload); }
    },
    interacoes: {
      criar: function (leadId, dados) { return requisicao("POST", "/leads/" + leadId + "/interacoes", dados); }
    },
    tarefas: {
      listar: function (params) { return requisicao("GET", "/tarefas", undefined, params); },
      criar: function (dados) { return requisicao("POST", "/tarefas", dados); },
      concluir: function (id, concluida) { return requisicao("POST", "/tarefas/" + id + "/concluir", { concluida: !!concluida }); },
      remover: function (id) { return requisicao("DELETE", "/tarefas/" + id); }
    },
    pipeline: {
      obter: function (params) { return requisicao("GET", "/pipeline", undefined, params); }
    },
    mensagens: {
      listar: function (params) { return requisicao("GET", "/mensagens", undefined, params); },
      obter: function (id) { return requisicao("GET", "/mensagens/" + id); },
      publico: function (payload) { return requisicao("POST", "/mensagens/publico", payload); },
      criar: function (payload) { return requisicao("POST", "/mensagens", payload); },
      cancelar: function (id) { return requisicao("POST", "/mensagens/" + id + "/cancelar"); },
      enviarIndividual: function (leadId, payload) { return requisicao("POST", "/mensagens/individual", { leadId: leadId, mensagem: payload.mensagem }); },
      templates: function () { return requisicao("GET", "/templates"); },
      salvarTemplate: function (dados) {
        return dados.id ? requisicao("PUT", "/templates/" + dados.id, dados) : requisicao("POST", "/templates", dados);
      },
      removerTemplate: function (id) { return requisicao("DELETE", "/templates/" + id); }
    },
    relatorios: {
      obter: function (filtros) { return requisicao("GET", "/relatorios", undefined, filtros); }
    },
    configuracoes: {
      obter: function () { return requisicao("GET", "/configuracoes"); },
      salvar: function (secao, dados) { return requisicao("PUT", "/configuracoes/" + secao, dados); },
      salvarSistema: function (dados) {
        return dados.id ? requisicao("PUT", "/configuracoes/sistemas/" + dados.id, dados) : requisicao("POST", "/configuracoes/sistemas", dados);
      },
      removerSistema: function (id) { return requisicao("DELETE", "/configuracoes/sistemas/" + id); },
      salvarOrigem: function (dados) {
        return dados.id ? requisicao("PUT", "/configuracoes/origens/" + dados.id, dados) : requisicao("POST", "/configuracoes/origens", dados);
      },
      removerOrigem: function (id) { return requisicao("DELETE", "/configuracoes/origens/" + id); },
      salvarEtapa: function (dados) {
        return dados.id ? requisicao("PUT", "/configuracoes/etapas/" + dados.id, dados) : requisicao("POST", "/configuracoes/etapas", dados);
      },
      reordenarEtapas: function (ids) { return requisicao("POST", "/configuracoes/etapas/reordenar", { ids: ids }); },
      removerEtapa: function (id) { return requisicao("DELETE", "/configuracoes/etapas/" + id); },
      convidar: function (dados) { return requisicao("POST", "/configuracoes/equipe", dados); },
      removerMembro: function (id) { return requisicao("DELETE", "/configuracoes/equipe/" + id); }
    },
    notificacoes: {
      listar: function () { return requisicao("GET", "/notificacoes"); },
      marcarLidas: function () { return requisicao("POST", "/notificacoes/marcar-lidas"); }
    },
    conta: {
      salvarPerfil: function (dados) { return requisicao("PUT", "/perfil", dados); },
      salvarPreferencias: function (dados) { return requisicao("PUT", "/preferencias", dados); },
      alterarSenha: function (dados) { return requisicao("PUT", "/senha", dados); }
    }
  };
})(window.Painel);
