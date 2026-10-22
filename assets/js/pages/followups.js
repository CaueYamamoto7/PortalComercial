/* ==========================================================================
   Painel Comercial — Follow-ups
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var ui = Painel.ui;
  var api = Painel.api;
  var leadUI = Painel.leadUI;

  var estado = { tab: "pendentes", q: "", responsavel: "" };
  var tarefas = [];

  function el(id) { return document.getElementById(id); }

  function iconTipo(tipo) {
    return tipo === "ligacao" ? "phone-call" : tipo === "reuniao" ? "calendar" : tipo === "mensagem" ? "message-circle" : "file-text";
  }

  function preencherResponsaveis() {
    var nomes = [];
    tarefas.forEach(function (t) { if (t.responsavel && nomes.indexOf(t.responsavel) === -1) nomes.push(t.responsavel); });
    nomes.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    el("followup-responsavel").innerHTML = '<option value="">Todos os responsáveis</option>' +
      nomes.map(function (n) { return '<option value="' + u.escaparHTML(n) + '">' + u.escaparHTML(n) + "</option>"; }).join("");
    el("followup-responsavel").value = estado.responsavel;
  }

  function filtrar() {
    var q = u.normalizarTexto(estado.q);
    var hoje = new Date();
    var limite = u.fimDoDia(u.diasFrente(7));
    return tarefas.filter(function (t) {
      if (estado.responsavel && t.responsavel !== estado.responsavel) return false;
      if (q) {
        var alvo = u.normalizarTexto(t.titulo + " " + (t.lead ? t.lead.nome + " " + t.lead.empresa : ""));
        if (alvo.indexOf(q) === -1) return false;
      }
      var d = new Date(t.data);
      if (estado.tab === "pendentes") return t.status === "pendente";
      if (estado.tab === "atrasadas") return t.status === "pendente" && t.atrasada;
      if (estado.tab === "hoje") return t.status === "pendente" && !t.atrasada && u.mesmoDia(d, hoje);
      if (estado.tab === "semana") return t.status === "pendente" && !t.atrasada && d >= hoje && d <= limite;
      if (estado.tab === "concluidas") return t.status === "concluida";
      return true;
    }).sort(function (a, b) {
      if (estado.tab === "concluidas") return new Date(b.data) - new Date(a.data);
      return new Date(a.data) - new Date(b.data);
    });
  }

  function tituloGrupo(data, atrasada, concluida) {
    if (concluida) return "Concluídos";
    if (atrasada) return "Atrasados";
    if (u.mesmoDia(data, new Date())) return "Hoje";
    if (u.mesmoDia(data, u.diasFrente(1))) return "Amanhã";
    return u.formatarData(data, "semana") + ", " + u.formatarData(data);
  }

  function linhaHTML(t) {
    var concluida = t.status === "concluida";
    var lead = t.lead;
    return '<div class="followup-row' + (t.atrasada ? " is-late" : "") + (concluida ? " is-done" : "") + '">' +
      '<label class="task-check task-check--lg" title="' + (concluida ? "Reabrir tarefa" : "Concluir tarefa") + '">' +
        '<input type="checkbox" data-concluir="' + t.id + '"' + (concluida ? " checked" : "") + ">" +
        "<span>" + ui.icone("check") + "</span></label>" +
      '<span class="followup-row__type">' + ui.icone(iconTipo(t.tipo)) + "</span>" +
      '<div class="followup-row__main">' +
        '<button class="followup-row__title" type="button" data-open="' + t.leadId + '">' + u.escaparHTML(t.titulo) + "</button>" +
        '<div class="followup-row__meta">' +
          (lead ? '<span class="followup-row__lead">' + u.escaparHTML(lead.nome) + (lead.empresa ? " · " + u.escaparHTML(lead.empresa) : "") + "</span>" : '<span class="faint">Lead removido</span>') +
          (lead ? leadUI.etapaBadge(lead.etapa) : "") +
          (t.atrasada ? '<span class="badge badge--danger">Atrasado</span>' : "") +
        "</div>" +
      "</div>" +
      '<div class="followup-row__side">' +
        '<span class="followup-row__date">' + u.rotuloPrazo(t.data) + "<small>" + u.formatarData(t.data) + " · " + u.formatarData(t.data, "hora") + "</small></span>" +
        '<span class="followup-row__owner"><span class="avatar avatar--xs ' + u.tomAvatar(t.responsavel) + '">' + u.escaparHTML(u.iniciais(t.responsavel)) + "</span>" + u.escaparHTML(u.primeiroNome(t.responsavel)) + "</span>" +
        (lead ? '<button class="icon-btn icon-btn--sm" type="button" data-msg="' + lead.id + '" title="Enviar mensagem"' + (lead.naoContatar ? " disabled" : "") + ">" + ui.icone("message-circle") + "</button>" : "") +
      "</div>" +
    "</div>";
  }

  function render() {
    var list = el("followup-list");
    var filtradas = filtrar();
    el("followup-count").textContent = filtradas.length + " tarefa(s) nesta visão";

    if (!filtradas.length) {
      var mensagens = {
        pendentes: ["Agenda em dia", "Nenhum follow-up pendente."],
        atrasadas: ["Nada atrasado", "Nenhum follow-up atrasado. Bom trabalho!"],
        hoje: ["Nada para hoje", "Nenhum follow-up agendado para hoje."],
        semana: ["Semana livre", "Nenhum follow-up nos próximos 7 dias."],
        concluidas: ["Nada concluído", "Nenhuma tarefa concluída neste filtro."]
      };
      var msg = mensagens[estado.tab] || mensagens.pendentes;
      list.innerHTML = '<div class="empty"><span class="empty__icon">' + ui.icone(estado.tab === "concluidas" ? "check-circle" : "calendar-check") + "</span><h3>" + msg[0] + "</h3><p>" + msg[1] + "</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-novo>Agendar follow-up</button></div>';
      return;
    }

    var grupos = [];
    filtradas.forEach(function (t) {
      var chave = t.status === "concluida" ? "concluidos" : t.atrasada ? "atrasados" : u.paraInputDate(t.data);
      var grupo = grupos.filter(function (g) { return g.chave === chave; })[0];
      if (!grupo) {
        grupo = {
          chave: chave,
          titulo: tituloGrupo(t.data, t.atrasada, t.status === "concluida"),
          itens: []
        };
        grupos.push(grupo);
      }
      grupo.itens.push(t);
    });

    list.innerHTML = grupos.map(function (g) {
      return '<div class="followup-group">' +
        '<div class="followup-group__head"><h3>' + u.escaparHTML(g.titulo) + '</h3><span>' + g.itens.length + "</span></div>" +
        g.itens.map(linhaHTML).join("") +
      "</div>";
    }).join("");
  }

  function carregar() {
    return api.tarefas.listar().then(function (res) {
      tarefas = res.data;
      preencherResponsaveis();
      render();
      ui.recarregarResumoSidebar();
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar a agenda.", "error");
      el("followup-list").innerHTML = '<div class="empty"><p>Erro ao carregar os follow-ups.</p></div>';
    });
  }

  function bind() {
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("[data-tab]").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        estado.tab = btn.getAttribute("data-tab");
        render();
      });
    });

    var busca = el("followup-busca");
    busca.addEventListener("input", u.debounce(function () {
      estado.q = busca.value.trim();
      render();
    }, 220));

    el("followup-responsavel").addEventListener("change", function (e) {
      estado.responsavel = e.target.value;
      render();
    });

    document.addEventListener("click", function (e) {
      var open = e.target.closest("[data-open]");
      if (open) {
        leadUI.abrirDetalhe(open.getAttribute("data-open"), { onChanged: carregar });
        return;
      }
      var msg = e.target.closest("[data-msg]");
      if (msg) {
        leadUI.abrirMensagem(msg.getAttribute("data-msg"), { onSent: carregar });
        return;
      }
      if (e.target.closest("[data-novo]")) {
        leadUI.abrirTarefa({ onSaved: carregar });
      }
    });

    document.addEventListener("change", function (e) {
      var check = e.target.closest("[data-concluir]");
      if (!check) return;
      check.disabled = true;
      var concluida = check.checked;
      api.tarefas.concluir(check.getAttribute("data-concluir"), concluida).then(function () {
        ui.toast(concluida ? "Follow-up concluído." : "Follow-up reaberto.", "success");
        carregar();
      }).catch(function (err) {
        check.disabled = false;
        check.checked = !concluida;
        ui.toast(err.message || "Não foi possível atualizar a tarefa.", "error");
      });
    });
  }

  bind();
  carregar().then(function () {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get("nova") === "1") leadUI.abrirTarefa({ onSaved: carregar });
  });
})(window.Painel);
