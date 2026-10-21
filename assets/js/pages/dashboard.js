/* ==========================================================================
   Painel Comercial — Dashboard
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var api = Painel.api;
  var ui = Painel.ui;
  var leadUI = Painel.leadUI;
  var periodo = "30";

  function el(id) { return document.getElementById(id); }

  function statusCampanha(status) {
    var mapa = {
      concluida: { label: "Concluída", cls: "badge--success" },
      em_andamento: { label: "Em andamento", cls: "badge--info" },
      agendada: { label: "Agendada", cls: "badge--warning" },
      falha: { label: "Falha", cls: "badge--danger" },
      cancelada: { label: "Cancelada", cls: "badge--neutral" }
    };
    return mapa[status] || mapa.concluida;
  }

  function renderKpis(dados) {
    var valores = {
      ativos: dados.stats.abertos,
      novos: dados.novosPeriodo,
      atrasados: dados.stats.atrasados,
      conversao: u.formatarNumero(dados.taxaConversaoPeriodo, 1) + "%"
    };
    Object.keys(valores).forEach(function (k) {
      var node = document.querySelector('[data-kpi="' + k + '"]');
      if (node) node.textContent = valores[k];
    });

    var hints = {
      ativos: dados.stats.total + " leads na base",
      novos: dados.ganhosPeriodo + " ganho(s) no período",
      atrasados: dados.stats.followupsHoje + " para hoje",
      conversao: dados.ganhosPeriodo + " ganho(s) · " + (dados.stats.emNegociacao || 0) + " em negociação"
    };
    Object.keys(hints).forEach(function (k) {
      var node = document.querySelector('[data-kpi-hint="' + k + '"]');
      if (node) node.textContent = hints[k];
    });

    var serie = (dados.serie || []).map(function (p) { return p.valor; });
    var acumulado = [];
    serie.reduce(function (acc, v) { acumulado.push(acc + v); return acc + v; }, 0);
    if (serie.length) {
      Painel.charts.sparkline(document.querySelector('[data-spark="ativos"]'), acumulado, { cor: "var(--brand-500)" });
      Painel.charts.sparkline(document.querySelector('[data-spark="novos"]'), serie, { cor: "var(--success-600)" });
      Painel.charts.sparkline(document.querySelector('[data-spark="atrasados"]'), serie.map(function (v) { return Math.max(0, v - 1); }), { cor: "var(--warning-600)" });
      Painel.charts.sparkline(document.querySelector('[data-spark="conversao"]'), serie.map(function (v) { return v + 1; }), { cor: "var(--danger-600)" });
    }
  }

  function renderAlerta(dados) {
    var alerta = el("dash-alerta");
    if (!alerta) return;
    if (dados.stats.atrasados > 0) {
      alerta.hidden = false;
      el("dash-alerta-texto").innerHTML = "<strong>" + dados.stats.atrasados + " follow-up(s) atrasado(s).</strong> Retome o contato para não esfriar a oportunidade.";
    } else if (dados.stats.followupsHoje > 0) {
      alerta.hidden = false;
      el("dash-alerta-texto").innerHTML = "<strong>" + dados.stats.followupsHoje + " follow-up(s) para hoje.</strong> Veja a agenda comercial e organize o dia.";
      el("dash-alerta-link").textContent = "Abrir agenda";
    } else {
      alerta.hidden = true;
    }
  }

  function tipoIcone(tipo) {
    return tipo === "ligacao" ? "phone-call" : tipo === "reuniao" ? "calendar" : tipo === "mensagem" ? "message-circle" : "file-text";
  }

  function renderTarefas(dados) {
    var list = el("lista-tarefas");
    if (!list) return;
    if (!dados.tarefas || !dados.tarefas.length) {
      list.innerHTML = '<div class="empty empty--compact"><span class="empty__icon">' + ui.icone("check-circle") + '</span><h3>Agenda em dia</h3><p>Nenhum follow-up pendente para os próximos dias.</p></div>';
    } else {
      list.innerHTML = dados.tarefas.map(function (t) {
        var atrasada = t.atrasada;
        return '<div class="task-row' + (atrasada ? " is-late" : "") + '">' +
          '<label class="task-check" title="Concluir tarefa"><input type="checkbox" data-concluir="' + t.id + '"><span>' + ui.icone("check") + "</span></label>" +
          '<span class="task-row__type">' + ui.icone(tipoIcone(t.tipo)) + "</span>" +
          '<button class="task-row__main" type="button" data-lead="' + t.leadId + '">' +
            "<strong>" + u.escaparHTML(t.titulo) + "</strong>" +
            "<small>" + u.escaparHTML(t.lead ? t.lead.nome : "Lead") + (t.lead && t.lead.empresa ? " · " + u.escaparHTML(t.lead.empresa) : "") + "</small>" +
          "</button>" +
          '<span class="task-row__date ' + (atrasada ? "is-late" : "") + '">' + u.rotuloPrazo(t.data) + "</span>" +
        "</div>";
      }).join("");
    }
    var total = el("tarefas-total");
    if (total) total.textContent = dados.tarefasTotal + " follow-up(s) pendente(s) na agenda";
  }

  function renderRecentes(dados) {
    var tbody = el("tabela-recentes");
    if (!tbody) return;
    if (!dados.recentes || !dados.recentes.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty empty--compact"><p>Nenhum lead cadastrado.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = dados.recentes.map(function (l) {
      return '<tr data-lead-row="' + l.id + '" style="cursor:pointer">' +
        '<td><div class="cell-main"><span class="avatar avatar--sm ' + u.tomAvatar(l.nome) + '">' + u.escaparHTML(u.iniciais(l.nome)) + "</span>" +
          "<span><strong>" + u.escaparHTML(l.nome) + "</strong><small>" + u.escaparHTML(l.empresa || "Sem empresa") + "</small></span></div></td>" +
        "<td>" + leadUI.sistemaChips(l.sistemas, 2) + "</td>" +
        "<td>" + leadUI.etapaBadge(l.etapa) + "</td>" +
        '<td><span class="cell-muted">' + u.escaparHTML(l.responsavel) + "</span></td>" +
        '<td class="td--right"><span class="cell-muted">' + u.formatarData(l.criadoEm) + "</span></td>" +
        '<td class="td--actions"><button class="icon-btn icon-btn--sm" type="button" data-open-lead="' + l.id + '" title="Abrir lead">' + ui.icone("chevron-right") + "</button></td>" +
      "</tr>";
    }).join("");
  }

  function renderAtividades(dados) {
    var list = el("lista-atividades");
    if (!list) return;
    if (!dados.atividades || !dados.atividades.length) {
      list.innerHTML = '<div class="empty empty--compact"><p>Nenhuma atividade recente.</p></div>';
      return;
    }
    var icones = {
      mensagem: { icon: "message-circle", cls: "" },
      ligacao: { icon: "phone-call", cls: "" },
      reuniao: { icon: "calendar", cls: "" },
      etapa: { icon: "corner-down-right", cls: "activity-item__dot--warning" },
      nota: { icon: "file-text", cls: "activity-item__dot--success" }
    };
    list.innerHTML = dados.atividades.map(function (a) {
      var cfg = icones[a.tipo] || icones.nota;
      return '<div class="activity-item">' +
        '<span class="activity-item__dot ' + cfg.cls + '">' + ui.icone(cfg.icon) + "</span>" +
        '<div class="activity-item__text"><strong>' + u.escaparHTML(a.titulo) + "</strong>" +
          "<p>" + (a.lead ? '<button type="button" class="activity-lead" data-open-lead="' + a.lead.id + '">' + u.escaparHTML(a.lead.nome) + "</button>" : "Lead removido") + "</p>" +
          "<time>" + u.tempoRelativo(a.data) + "</time></div></div>";
    }).join("");
  }

  function renderCampanhas(dados) {
    var list = el("lista-campanhas");
    if (!list) return;
    if (!dados.campanhas || !dados.campanhas.length) {
      list.innerHTML = '<div class="empty empty--compact"><p>Nenhuma mensagem enviada ainda.</p></div>';
      return;
    }
    list.innerHTML = dados.campanhas.map(function (c) {
      var st = statusCampanha(c.status);
      return '<a class="campaign-mini__item" href="mensagens.html?tab=historico">' +
        '<span class="campaign-mini__icon">' + ui.icone("message-circle") + "</span>" +
        '<span class="campaign-mini__text"><strong>' + u.escaparHTML(c.nome) + "</strong><small>" + c.publico + " contato(s) · " + u.tempoRelativo(c.criadaEm) + "</small></span>" +
        '<span class="badge ' + st.cls + '">' + st.label + "</span></a>";
    }).join("");
  }

  function render(dados) {
    renderKpis(dados);
    renderAlerta(dados);
    Painel.charts.volume(el("chart-serie"), dados.serie, { rotulo: "Novos leads" });
    Painel.charts.funnel(el("chart-funil"), dados.porEtapa, { interativo: true });
    Painel.charts.hbar(el("chart-sistemas"), dados.porSistema, { cor: "var(--brand-500)" });
    renderTarefas(dados);
    renderRecentes(dados);
    renderAtividades(dados);
    renderCampanhas(dados);
    var desc = document.querySelector("[data-serie-desc]");
    if (desc) desc.textContent = "Entrada de contatos nos últimos " + periodo + " dias";
  }

  function carregar() {
    return api.dashboard.obter(periodo).then(render).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar o painel.", "error");
    });
  }

  function bind() {
    document.querySelectorAll("[data-periodo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("[data-periodo]").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        periodo = btn.getAttribute("data-periodo");
        carregar();
      });
    });

    document.addEventListener("click", function (e) {
      var row = e.target.closest("[data-lead-row]");
      var open = e.target.closest("[data-open-lead]");
      if (open) {
        e.preventDefault();
        leadUI.abrirDetalhe(open.getAttribute("data-open-lead"), { onChanged: carregar });
        return;
      }
      if (row) {
        leadUI.abrirDetalhe(row.getAttribute("data-lead-row"), { onChanged: carregar });
      }
    });

    document.addEventListener("change", function (e) {
      var check = e.target.closest("[data-concluir]");
      if (!check) return;
      check.disabled = true;
      api.tarefas.concluir(check.getAttribute("data-concluir"), true).then(function () {
        ui.toast("Follow-up concluído.", "success");
        ui.recarregarResumoSidebar();
        carregar();
      }).catch(function (err) {
        check.disabled = false;
        ui.toast(err.message || "Não foi possível concluir a tarefa.", "error");
      });
    });

    var nova = document.querySelector("[data-nova-tarefa]");
    if (nova) {
      nova.addEventListener("click", function () {
        leadUI.abrirTarefa({ onSaved: function () { carregar(); } });
      });
    }
  }

  bind();
  carregar();
})(window.Painel);
