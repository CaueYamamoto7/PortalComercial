/* ==========================================================================
   Painel Comercial — Fachada de API
   useMock: true  -> demonstração local
   useMock: false -> backend PHP/CakePHP em Painel.config.apiBase
   ========================================================================== */

(function (Painel) {
  "use strict";

  function queryString(params) {
    var partes = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === "") return;
      partes.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    return partes.length ? "?" + partes.join("&") : "";
  }

  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute("content") : "";
  }

  function requisicao(method, caminho, corpo, params) {
    var url = Painel.config.apiBase + caminho + queryString(params);
    var headers = { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" };
    var token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    if (corpo !== undefined) headers["Content-Type"] = "application/json";

    return fetch(url, {
      method: method,
      headers: headers,
      credentials: "same-origin",
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) {
          var e = new Error(json.message || "Não foi possível concluir a operação.");
          e.campo = json.campo || null;
          e.status = res.status;
          throw e;
        }
        return json.data !== undefined ? json.data : json;
      });
    });
  }

  function apiHttp() {
    return {
      modo: "http",
      auth: {
        login: function (email, senha) { return requisicao("POST", "/auth/login", { email: email, senha: senha }); },
        logout: function () { return requisicao("POST", "/auth/logout"); }
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
        importar: function (linhas) { return requisicao("POST", "/leads/importar", { linhas: linhas }); }
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
      sistema: {
        resetar: function () { return Promise.reject(new Error("Disponível apenas no modo de demonstração.")); }
      }
    };
  }

  if (Painel.config.useMock) {
    Painel.api = Painel.apiMock;
    Painel.api.modo = "mock";
  } else {
    Painel.api = apiHttp();
  }
})(window.Painel);
