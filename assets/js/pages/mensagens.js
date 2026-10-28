/* ==========================================================================
   Portal Comercial — Mensagens
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var ui = Painel.ui;
  var api = Painel.api;
  var leadUI = Painel.leadUI;

  var leads = [];
  var templates = [];
  var selecionados = {};
  var modo = "filtros";
  var filtros = { q: "", etapa: "", sistema: "", origem: "", responsavel: "", possuiSistema: "", prioridade: "" };
  var view = "composer";
  var history = { q: "", status: "", page: 1, perPage: 10 };

  function el(id) { return document.getElementById(id); }

  function statusCampanha(status) {
    var mapa = {
      registrada: { label: "Registrada", cls: "badge--info" },
      concluida: { label: "Concluída", cls: "badge--success" },
      em_andamento: { label: "Em andamento", cls: "badge--info" },
      agendada: { label: "Agendada", cls: "badge--warning" },
      falha: { label: "Falha", cls: "badge--danger" },
      cancelada: { label: "Cancelada", cls: "badge--neutral" }
    };
    return mapa[status] || mapa.registrada;
  }

  function podeCancelar(status) {
    return ["registrada", "agendada", "em_andamento"].indexOf(status) !== -1;
  }

  /* Público ---------------------------------------------------------------- */

  var publico = { total: 0, bloqueados: null, amostra: [], limitado: false };
  var seqPublico = 0;

  function preencherFiltros(cfg) {
    cfg = cfg || {};
    var responsaveis = cfg.responsaveis || cfg.equipe || [];
    el("msg-etapa").innerHTML = '<option value="">Todas as etapas</option>' +
      (cfg.etapas || []).map(function (e) { return '<option value="' + e.id + '">' + u.escaparHTML(e.nome) + "</option>"; }).join("");
    el("msg-sistema").innerHTML = '<option value="">Todos os sistemas</option>' +
      (cfg.sistemas || []).filter(function (s) { return s.ativo; }).map(function (s) { return '<option value="' + s.id + '">' + u.escaparHTML(s.nome) + "</option>"; }).join("");
    el("msg-origem").innerHTML = '<option value="">Todas as origens</option>' +
      (cfg.origens || []).filter(function (o) { return o.ativo; }).map(function (o) { return '<option value="' + o.id + '">' + u.escaparHTML(o.nome) + "</option>"; }).join("");
    el("msg-responsavel").innerHTML = '<option value="">Todos os responsáveis</option>' +
      responsaveis.filter(function (m) { return m.status !== "inativo"; }).map(function (m) { return '<option value="' + u.escaparHTML(m.nome) + '">' + u.escaparHTML(m.nome) + "</option>"; }).join("");
  }

  function paramsFiltros() {
    var p = {};
    Object.keys(filtros).forEach(function (k) { if (filtros[k]) p[k] = filtros[k]; });
    return p;
  }

  function elegivelLead(l) {
    return !l.naoContatar && !!l.etapa && l.etapa.tipo === "aberto";
  }

  function motivoBloqueio(l) {
    if (l.naoContatar) return "Não contatar";
    if (l.etapa && l.etapa.tipo === "ganho") return "Cliente";
    if (l.etapa && l.etapa.tipo === "perdido") return "Recusado";
    return "Encerrado";
  }

  function idsSelecionados() {
    return Object.keys(selecionados).filter(function (id) { return selecionados[id]; });
  }

  function totalPublico() {
    return modo === "manual" ? idsSelecionados().length : (publico.total || 0);
  }

  function mesclarLeads(novos) {
    var mapa = {};
    leads.concat(novos || []).forEach(function (l) { mapa[l.id] = l; });
    leads = Object.keys(mapa).map(function (id) { return mapa[id]; });
  }

  function carregarLeadsManuais() {
    var p = paramsFiltros();
    p.page = 1;
    p.perPage = 100;
    return api.leads.listar(p).then(function (res) {
      leads = res.data;
      return res;
    });
  }

  function carregarLeadsPorIds(ids) {
    if (!ids || !ids.length) return Promise.resolve();
    var faltantes = ids.filter(function (id) {
      return !leads.some(function (l) { return l.id === id; });
    });
    if (!faltantes.length) return Promise.resolve();
    return api.leads.listar({ ids: faltantes.join(","), perPage: 100 }).then(function (res) {
      mesclarLeads(res.data);
    });
  }

  function itemManual(l) {
    var bloqueado = !elegivelLead(l);
    var marcado = !!selecionados[l.id];
    return '<label class="audience-item' + (marcado ? " is-selected" : "") + (bloqueado ? " is-blocked" : "") + '">' +
      '<input type="checkbox" data-pick="' + l.id + '"' + (marcado ? " checked" : "") + (bloqueado ? " disabled" : "") + ">" +
      '<span class="audience-item__check">' + ui.icone("check") + "</span>" +
      '<span class="avatar avatar--sm ' + u.tomAvatar(l.nome) + '">' + u.escaparHTML(u.iniciais(l.nome)) + "</span>" +
      '<span class="audience-item__main"><strong>' + u.escaparHTML(l.nome) + "</strong><small>" + u.escaparHTML(l.empresa || "Sem empresa") + " · " + u.formatarTelefone(l.telefone) + "</small></span>" +
      '<span class="audience-item__tags">' + leadUI.sistemaChips(l.sistemas, 1) + "</span>" +
      (bloqueado ? '<span class="badge badge--danger">' + motivoBloqueio(l) + "</span>" : leadUI.etapaBadge(l.etapa)) +
    "</label>";
  }

  function amostra() {
    if (modo === "manual") {
      for (var i = 0; i < leads.length; i++) {
        if (selecionados[leads[i].id] && elegivelLead(leads[i])) return leads[i];
      }
      return leads[0] || null;
    }
    return (publico.amostra || [])[0] || null;
  }

  function renderPublico() {
    if (modo === "manual") {
      var ids = idsSelecionados();
      var bloqueados = leads.filter(function (l) { return !elegivelLead(l); }).length;
      el("msg-publico").textContent = u.formatarNumero(ids.length);
      el("msg-publico-nota").textContent = "· seleção manual";
      el("resumo-publico").textContent = u.formatarNumero(ids.length);
      el("resumo-bloqueados").textContent = u.formatarNumero(bloqueados);
      el("msg-excluidos").hidden = !bloqueados;
      if (bloqueados) el("msg-excluidos").textContent = bloqueados + " contato(s) desta página estão encerrados, são clientes ou estão marcados como “não contatar” e serão ignorados no envio.";
      el("audience-manual").hidden = false;
      el("audience-list").innerHTML = leads.length
        ? leads.map(itemManual).join("")
        : '<div class="empty empty--compact"><p>Nenhum contato encontrado.</p></div>';
      atualizarMensagem();
      return;
    }

    el("audience-manual").hidden = true;
    var seq = ++seqPublico;
    api.mensagens.publico({ filtros: paramsFiltros() }).then(function (res) {
      if (seq !== seqPublico) return;
      publico = res;
      el("msg-publico").textContent = u.formatarNumero(res.total);
      el("msg-publico-nota").textContent = res.limitado
        ? "· máximo de 5.000 contatos por campanha"
        : "· todos os filtrados elegíveis serão incluídos";
      el("resumo-publico").textContent = u.formatarNumero(res.total);
      el("resumo-bloqueados").textContent = (res.bloqueados === null || res.bloqueados === undefined)
        ? "—"
        : u.formatarNumero(res.bloqueados);
      el("msg-excluidos").hidden = !res.bloqueados;
      if (res.bloqueados) el("msg-excluidos").textContent = res.bloqueados + " contato(s) do filtro estão encerrados, são clientes ou estão marcados como “não contatar” e serão ignorados no envio.";
      atualizarMensagem();
    }).catch(function (err) {
      if (seq !== seqPublico) return;
      publico = { total: 0, bloqueados: null, amostra: [], limitado: false };
      ui.toast(err.message || "Não foi possível calcular o público.", "error");
      atualizarMensagem();
    });
  }

  function limparFiltrosPublico() {
    filtros = { q: "", etapa: "", sistema: "", origem: "", responsavel: "", possuiSistema: "", prioridade: "" };
    ["msg-etapa", "msg-sistema", "msg-origem", "msg-responsavel", "msg-possui", "msg-prioridade"].forEach(function (id) { el(id).value = ""; });
    el("msg-busca").value = "";
    if (modo === "manual") {
      carregarLeadsManuais().then(renderPublico);
    } else {
      renderPublico();
    }
  }

  /* Mensagem --------------------------------------------------------------- */

  function variavelChips() {
    el("msg-variaveis").innerHTML = u.VARIAVEIS.map(function (v) {
      return '<button type="button" class="tag tag--button" data-var="' + v.chave + '" title="' + v.label + '">{{' + v.chave + "}}</button>";
    }).join("");
  }

  function atualizarMensagem() {
    var texto = el("msg-texto").value;
    var total = totalPublico();
    var seg = u.contarSegmentos(texto);
    el("msg-chars").textContent = texto.length + " caractere" + (texto.length === 1 ? "" : "s");
    el("msg-segs").textContent = seg + " segmento" + (seg === 1 ? "" : "s");
    el("resumo-segmentos").textContent = u.formatarNumero(seg * total);
    el("resumo-responsavel").textContent = Painel.auth.usuario().nome;

    var s = amostra();
    el("preview-lead").textContent = s ? "Prévia para " + s.nome : "Selecione um lead";
    var preview = el("msg-preview");
    if (!texto.trim()) {
      preview.innerHTML = '<span class="faint">A prévia aparece aqui.</span>';
    } else {
      var render = u.renderizarMensagem(texto, s, "…");
      preview.innerHTML = u.escaparHTML(render).replace(/\n/g, "<br>");
    }
  }

  function preencherTemplates() {
    el("msg-template").innerHTML = '<option value="">Mensagem livre</option>' +
      templates.map(function (t) { return '<option value="' + t.id + '">' + u.escaparHTML(t.nome) + " · " + u.escaparHTML(t.categoria) + "</option>"; }).join("");
  }

  function inserirVariavel(chave) {
    var textarea = el("msg-texto");
    var texto = "{{" + chave + "}}";
    var start = textarea.selectionStart || 0;
    var end = textarea.selectionEnd || 0;
    textarea.value = textarea.value.slice(0, start) + texto + textarea.value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + texto.length, start + texto.length);
    atualizarMensagem();
  }

  /* Envio ------------------------------------------------------------------ */

  function enviar() {
    var nome = el("msg-nome").value.trim();
    var mensagem = el("msg-texto").value.trim();
    var total = totalPublico();
    var agendar = el("msg-agendar").checked;
    var data = el("msg-data").value;

    if (!nome) { ui.toast("Dê um nome para a campanha.", "warning"); el("msg-nome").focus(); return; }
    if (!mensagem) { ui.toast("Escreva a mensagem antes de registrar.", "warning"); el("msg-texto").focus(); return; }
    if (!total) { ui.toast("Nenhum contato selecionado para a campanha.", "warning"); return; }
    if (agendar && !data) { ui.toast("Informe a data e hora do agendamento.", "warning"); el("msg-data").focus(); return; }

    if (!agendar && total > 1) {
      ui.confirmar({
        titulo: "Registrar campanha",
        texto: "A campanha será registrada para <strong>" + total + " contato(s)</strong>. O envio pelo WhatsApp ainda não está integrado. Deseja continuar?",
        acao: "Registrar campanha"
      }).then(function (ok) { if (ok) executarEnvio(nome, mensagem, agendar, data); });
      return;
    }
    executarEnvio(nome, mensagem, agendar, data);
  }

  function executarEnvio(nome, mensagem, agendar, data) {
    var btn = el("msg-enviar");
    var payload = {
      nome: nome,
      mensagem: mensagem,
      templateId: el("msg-template").value || null,
      agendadaPara: agendar && data ? new Date(data).toISOString() : null
    };

    if (modo === "manual") {
      payload.leadIds = idsSelecionados();
    } else {
      payload.filtros = paramsFiltros();
      if (!Object.keys(payload.filtros).length) payload.filtros.etapa = "abertos";
    }

    btn.disabled = true;
    btn.classList.add("is-loading");
    api.mensagens.criar(payload).then(function (campanha) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      ui.toast(campanha.agendadaPara
        ? "Campanha registrada e agendada para " + u.formatarDataHoraCurta(campanha.agendadaPara) + "."
        : "Campanha registrada para " + campanha.publico + " contato(s).", "success");
      el("msg-nome").value = "";
      el("msg-texto").value = "";
      el("msg-template").value = "";
      el("msg-agendar").checked = false;
      el("msg-data-wrap").hidden = true;
      if (modo === "manual") selecionados = {};
      renderPublico();
      ui.recarregarResumoSidebar();
      mostrarView("historico");
    }).catch(function (err) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      ui.toast(err.message || "Não foi possível registrar a campanha.", "error");
    });
  }

  /* Histórico -------------------------------------------------------------- */

  function renderHistorico(res) {
    var contagens = res.contagens || {};
    ["todas", "registrada", "agendada", "cancelada"].forEach(function (k) {
      var node = document.querySelector('[data-hstat="' + k + '"]');
      if (node) node.textContent = u.formatarNumero(contagens[k] || 0);
    });

    var tbody = el("history-tbody");
    if (!res.data.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty"><span class="empty__icon">' + ui.icone("message-circle") + "</span><h3>Nenhuma campanha encontrada</h3><p>Crie uma nova mensagem para começar o histórico.</p><button class=\"btn btn--primary btn--sm\" type=\"button\" data-nova-mensagem>Nova mensagem</button></div></td></tr>";
    } else {
      tbody.innerHTML = res.data.map(function (c) {
        var st = statusCampanha(c.status);
        var quando = c.agendadaPara ? "Agendada para " + u.formatarDataHoraCurta(c.agendadaPara) : u.formatarDataHoraCurta(c.criadaEm);
        return '<tr data-campanha="' + c.id + '">' +
          '<td><div class="cell-main"><span class="cell-icon">' + ui.icone("message-circle") + "</span><span><strong>" + u.escaparHTML(c.nome) + "</strong><small>" + u.escaparHTML(c.responsavel || "") + "</small></span></div></td>" +
          '<td><span class="badge ' + st.cls + '">' + st.label + "</span></td>" +
          '<td class="td--right">' + u.formatarNumero(c.publico) + "</td>" +
          '<td class="td--right">' + u.formatarNumero(c.enviados) + "</td>" +
          '<td class="td--right">' + u.formatarNumero(c.entregues) + "</td>" +
          '<td class="td--right">' + (c.falhas ? '<span class="text-danger">' + c.falhas + "</span>" : "0") + "</td>" +
          "<td><span class=\"cell-muted\">" + quando + "</span></td>" +
          '<td class="td--actions"><div class="row-actions">' +
            '<button class="icon-btn icon-btn--sm" type="button" data-ver-campanha="' + c.id + '" title="Ver detalhes" aria-label="Ver detalhes da campanha ' + u.escaparHTML(c.nome) + '">' + ui.icone("eye") + "</button>" +
          "</div></td>" +
        "</tr>";
      }).join("");
    }

    var meta = res.meta;
    var inicio = meta.total ? (meta.page - 1) * meta.perPage + 1 : 0;
    var fim = Math.min(meta.page * meta.perPage, meta.total);
    el("history-info").innerHTML = "Mostrando <strong>" + inicio + "–" + fim + "</strong> de <strong>" + meta.total + "</strong> campanha(s)";
    var cont = el("history-pagination");
    if (meta.paginas <= 1) { cont.innerHTML = ""; return; }
    var paginas = [];
    for (var i = 1; i <= meta.paginas; i++) {
      if (i === 1 || i === meta.paginas || Math.abs(i - meta.page) <= 1) paginas.push(i);
      else if (paginas[paginas.length - 1] !== "…") paginas.push("…");
    }
    cont.innerHTML = '<button type="button" data-hpage="' + (meta.page - 1) + '"' + (meta.page === 1 ? " disabled" : "") + ">" + ui.icone("chevron-left") + "</button>" +
      paginas.map(function (p) {
        if (p === "…") return '<span class="pagination__gap">…</span>';
        return '<button type="button" data-hpage="' + p + '"' + (p === meta.page ? ' class="is-active"' : "") + ">" + p + "</button>";
      }).join("") +
      '<button type="button" data-hpage="' + (meta.page + 1) + '"' + (meta.page === meta.paginas ? " disabled" : "") + ">" + ui.icone("chevron-right") + "</button>";
  }

  function carregarHistorico() {
    return api.mensagens.listar({ q: history.q, status: history.status, page: history.page, perPage: history.perPage })
      .then(renderHistorico)
      .catch(function (err) {
        ui.toast(err.message || "Não foi possível carregar o histórico.", "error");
        el("history-info").textContent = "Dados indisponíveis";
        var tbody = document.querySelector("#view-historico tbody");
        if (tbody) tbody.innerHTML = '<tr><td colspan="8"><div class="empty"><p>Não foi possível carregar o histórico.</p></div></td></tr>';
      });
  }

  function verCampanha(id) {
    api.mensagens.obter(id).then(function (c) {
      if (!c) { ui.toast("Campanha não encontrada.", "error"); return; }
      var st = statusCampanha(c.status);
      var taxa = c.enviados ? Math.round((c.entregues / c.enviados) * 100) : 0;
      var m = ui.modal({
        title: c.nome,
        subtitle: "Campanha · " + u.formatarDataHoraCurta(c.criadaEm),
        size: "lg",
        body:
          '<div class="campaign-detail">' +
            '<div class="campaign-detail__head"><span class="badge ' + st.cls + '">' + st.label + "</span>" +
              '<span class="small faint">' + u.escaparHTML(c.responsavel || "") + "</span></div>" +
            '<div class="campaign-detail__stats">' +
              '<div><strong>' + c.publico + "</strong><span>público</span></div>" +
              '<div><strong>' + c.enviados + "</strong><span>enviados</span></div>" +
              '<div><strong class="is-success">' + c.entregues + "</strong><span>entregues</span></div>" +
              '<div><strong class="' + (c.falhas ? "is-danger" : "") + '">' + c.falhas + "</strong><span>falhas</span></div>" +
            "</div>" +
            '<div class="progress" style="margin:6px 0 18px"><div class="progress__bar" style="width:' + taxa + '%"></div></div>' +
            '<div class="form-section__title" style="margin-top:0">Mensagem</div>' +
            '<div class="campaign-message">' + u.escaparHTML(c.mensagem).replace(/\n/g, "<br>") + "</div>" +
            (c.agendadaPara ? '<p class="small muted" style="margin-top:12px">Agendada para ' + u.formatarDataHoraCurta(c.agendadaPara) + "</p>" : "") +
          "</div>",
        footer: '<button class="btn btn--secondary" type="button" data-close>Fechar</button>' +
          (podeCancelar(c.status) ? '<button class="btn btn--danger-soft" type="button" data-cancelar-campanha="' + c.id + '">Cancelar campanha</button>' : "") +
          '<button class="btn btn--primary" type="button" data-duplicar="' + c.id + '">Duplicar mensagem</button>',
        onMount: function (layer, fechar) {
          var dup = layer.querySelector("[data-duplicar]");
          if (dup) dup.addEventListener("click", function () {
            var campanha = c;
            fechar();
            duplicar(campanha);
          });
          var cancelar = layer.querySelector("[data-cancelar-campanha]");
          if (cancelar) cancelar.addEventListener("click", function () {
            api.mensagens.cancelar(c.id).then(function () {
              fechar();
              ui.toast("Campanha cancelada.", "success");
              carregarHistorico();
            }).catch(function (err) { ui.toast(err.message, "error"); });
          });
        }
      });
      return m;
    });
  }

  function duplicar(c) {
    mostrarView("composer");
    modo = "manual";
    document.querySelectorAll("[data-modo]").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-modo") === "manual"); });
    selecionados = {};
    carregarLeadsPorIds(c.leadIds || []).then(function () {
      (c.leadIds || []).forEach(function (id) {
        var l = leads.filter(function (x) { return x.id === id; })[0];
        if (l && elegivelLead(l)) selecionados[id] = true;
      });
      el("msg-nome").value = "Cópia de " + c.nome;
      el("msg-texto").value = c.mensagem;
      el("msg-template").value = c.templateId || "";
      atualizarMensagem();
      renderPublico();
      ui.toast("Mensagem carregada no compositor.", "info");
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar o público da campanha.", "error");
    });
  }

  /* Templates -------------------------------------------------------------- */

  function abrirTemplates() {
    var drawer = ui.drawer({
      title: "Templates de mensagem",
      subtitle: "Modelos reutilizáveis com variáveis",
      wide: true,
      body: '<div id="template-list" class="template-list"><div class="loading-lines" role="status" aria-label="Carregando templates"></div></div>',
      footer: '<button class="btn btn--secondary" type="button" data-close>Fechar</button>' +
        '<button class="btn btn--primary" type="button" data-novo-template>' + ui.icone("plus") + "Novo template</button>"
    });
    var list = drawer.el.querySelector("#template-list");
    var drawerEl = drawer.el.querySelector(".drawer");
    if (drawerEl) drawerEl.classList.add("drawer--templates");

    function render() {
      list.innerHTML = templates.length ? templates.map(function (t) {
        return '<div class="template-item"><div class="template-item__main"><div class="template-item__top"><strong>' + u.escaparHTML(t.nome) + "</strong><span class=\"tag\">" + u.escaparHTML(t.categoria) + "</span></div>" +
          '<p>' + u.escaparHTML(u.truncar(t.conteudo, 180)) + "</p><small>" + (t.usos || 0) + " uso(s) · atualizado " + u.tempoRelativo(t.atualizadoEm) + "</small></div>" +
          '<div class="template-item__actions"><button class="icon-btn icon-btn--sm" type="button" data-template-edit="' + t.id + '" title="Editar">' + ui.icone("pencil") + "</button>" +
          '<button class="icon-btn icon-btn--sm" type="button" data-template-del="' + t.id + '" title="Excluir">' + ui.icone("trash") + "</button></div></div>";
      }).join("") : '<div class="empty"><p>Nenhum template. Crie o primeiro modelo.</p></div>';
    }

    render();
    drawer.el.addEventListener("click", function (e) {
      var novo = e.target.closest("[data-novo-template]");
      if (novo) { abrirFormTemplate(null, function () { render(); }); return; }
      var edit = e.target.closest("[data-template-edit]");
      if (edit) {
        var t = templates.filter(function (x) { return x.id === edit.getAttribute("data-template-edit"); })[0];
        if (t) abrirFormTemplate(t, function () { render(); });
        return;
      }
      var del = e.target.closest("[data-template-del]");
      if (del) {
        var td = templates.filter(function (x) { return x.id === del.getAttribute("data-template-del"); })[0];
        if (!td) return;
        ui.confirmar({ titulo: "Excluir template", texto: "Excluir <strong>" + u.escaparHTML(td.nome) + "</strong>?", acao: "Excluir", perigo: true })
          .then(function (ok) {
            if (!ok) return;
            api.mensagens.removerTemplate(td.id).then(function () {
              return atualizarTemplates();
            }).then(function () {
              render();
              ui.toast("Template excluído.", "success");
            }).catch(function (err) { ui.toast(err.message, "error"); });
          });
      }
    });
  }

  function abrirFormTemplate(template, onDone) {
    var editando = !!template;
    var m = ui.modal({
      title: editando ? "Editar template" : "Novo template",
      subtitle: "Use variáveis como {{primeiro_nome}} para personalizar.",
      size: "lg",
      body: '<form id="template-form" class="form-grid">' +
        '<label class="field"><span class="field__label">Nome <em class="field__req">*</em></span><input class="input" name="nome" value="' + u.escaparHTML(template ? template.nome : "") + '" placeholder="Ex.: Primeiro contato — feira"></label>' +
        '<label class="field"><span class="field__label">Categoria</span><input class="input" name="categoria" value="' + u.escaparHTML(template ? template.categoria : "") + '" placeholder="Ex.: Prospecção"></label>' +
        '<label class="field field--full"><span class="field__label">Conteúdo <em class="field__req">*</em></span>' +
          '<textarea class="textarea" name="conteudo" rows="8" placeholder="Olá, {{primeiro_nome}}!">' + u.escaparHTML(template ? template.conteudo : "") + "</textarea></label>" +
        '<div class="field field--full"><span class="field__label">Variáveis disponíveis</span><div class="variable-chips">' +
          u.VARIAVEIS.map(function (v) { return '<button type="button" class="tag tag--button" data-tpl-var="' + v.chave + '">{{' + v.chave + "}}</button>"; }).join("") + "</div></div>" +
      "</form>",
      footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn btn--primary" type="button" data-salvar-template>Salvar template</button>'
    });
    var form = m.el.querySelector("#template-form");
    m.el.querySelectorAll("[data-tpl-var]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ta = form.elements.conteudo;
        var txt = "{{" + b.getAttribute("data-tpl-var") + "}}";
        var start = ta.selectionStart || 0;
        ta.value = ta.value.slice(0, start) + txt + ta.value.slice(ta.selectionEnd || start);
        ta.focus();
        ta.setSelectionRange(start + txt.length, start + txt.length);
      });
    });
    m.el.querySelector("[data-salvar-template]").addEventListener("click", function (e) {
      var btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add("is-loading");
      api.mensagens.salvarTemplate({
        id: template ? template.id : null,
        nome: form.elements.nome.value.trim(),
        categoria: form.elements.categoria.value.trim(),
        conteudo: form.elements.conteudo.value.trim()
      }).then(function () {
        return atualizarTemplates();
      }).then(function () {
        m.close();
        ui.toast(editando ? "Template atualizado." : "Template criado.", "success");
        if (onDone) onDone();
      }).catch(function (err) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        ui.toast(err.message || "Não foi possível salvar o template.", "error");
      });
    });
  }

  function atualizarTemplates() {
    return api.mensagens.templates().then(function (lista) {
      var atual = el("msg-template").value;
      templates = lista;
      preencherTemplates();
      var existe = templates.some(function (t) { return t.id === atual; });
      el("msg-template").value = existe ? atual : "";
    });
  }

  /* Views ------------------------------------------------------------------ */

  function mostrarView(nova) {
    view = nova;
    el("view-composer").hidden = view !== "composer";
    el("view-historico").hidden = view !== "historico";
    document.querySelectorAll("[data-view]").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-view") === view); });
    if (view === "historico") carregarHistorico();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* Eventos ---------------------------------------------------------------- */

  function bind() {
    document.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () { mostrarView(btn.getAttribute("data-view")); });
    });
    document.querySelector("[data-templates]").addEventListener("click", abrirTemplates);

    document.querySelectorAll("[data-modo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        modo = btn.getAttribute("data-modo");
        document.querySelectorAll("[data-modo]").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        if (modo === "manual") {
          carregarLeadsManuais().then(renderPublico).catch(function (err) {
            ui.toast(err.message || "Não foi possível carregar os contatos.", "error");
          });
        } else {
          renderPublico();
        }
      });
    });

    function atualizarPublico() {
      if (modo === "manual") {
        carregarLeadsManuais().then(renderPublico).catch(function (err) {
          ui.toast(err.message || "Não foi possível carregar os contatos.", "error");
        });
      } else {
        renderPublico();
      }
    }

    [["etapa", "msg-etapa"], ["sistema", "msg-sistema"], ["origem", "msg-origem"], ["responsavel", "msg-responsavel"], ["possuiSistema", "msg-possui"], ["prioridade", "msg-prioridade"]].forEach(function (par) {
      el(par[1]).addEventListener("change", function (e) {
        filtros[par[0]] = e.target.value;
        atualizarPublico();
      });
    });
    var msgBusca = el("msg-busca");
    var msgBuscaDebounce = u.debounce(function () {
      filtros.q = msgBusca.value.trim();
      atualizarPublico();
    }, 220);
    msgBusca.addEventListener("input", msgBuscaDebounce);

    function pesquisarPublicoAgora() {
      msgBuscaDebounce.cancel();
      filtros.q = msgBusca.value.trim();
      atualizarPublico();
    }

    msgBusca.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      pesquisarPublicoAgora();
    });
    document.querySelector("[data-buscar-publico]").addEventListener("click", pesquisarPublicoAgora);
    document.querySelector("[data-limpar-publico]").addEventListener("click", limparFiltrosPublico);

    el("audience-list").addEventListener("change", function (e) {
      var pick = e.target.closest("[data-pick]");
      if (!pick) return;
      selecionados[pick.getAttribute("data-pick")] = pick.checked;
      pick.closest(".audience-item").classList.toggle("is-selected", pick.checked);
      renderPublico();
    });

    document.querySelector("[data-selecionar-visiveis]").addEventListener("click", function () {
      leads.forEach(function (l) { if (elegivelLead(l)) selecionados[l.id] = true; });
      renderPublico();
    });
    document.querySelector("[data-limpar-selecao]").addEventListener("click", function () {
      selecionados = {};
      renderPublico();
    });

    el("msg-texto").addEventListener("input", atualizarMensagem);
    el("msg-variaveis").addEventListener("click", function (e) {
      var b = e.target.closest("[data-var]");
      if (b) inserirVariavel(b.getAttribute("data-var"));
    });
    el("msg-template").addEventListener("change", function (e) {
      var t = templates.filter(function (x) { return x.id === e.target.value; })[0];
      if (t) {
        el("msg-texto").value = t.conteudo;
        atualizarMensagem();
      }
    });
    el("msg-agendar").addEventListener("change", function (e) {
      el("msg-data-wrap").hidden = !e.target.checked;
      if (e.target.checked && !el("msg-data").value) {
        el("msg-data").value = u.paraInputDateTime(u.diasFrente(1, 9, 0));
      }
    });
    el("msg-enviar").addEventListener("click", enviar);

    var historyBusca = el("history-busca");
    var historyBuscaDebounce = u.debounce(function () {
      history.q = historyBusca.value.trim();
      history.page = 1;
      carregarHistorico();
    }, 260);
    historyBusca.addEventListener("input", historyBuscaDebounce);

    function pesquisarHistoricoAgora() {
      historyBuscaDebounce.cancel();
      history.q = historyBusca.value.trim();
      history.page = 1;
      carregarHistorico();
    }

    historyBusca.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      pesquisarHistoricoAgora();
    });
    document.querySelector("[data-buscar-historico]").addEventListener("click", pesquisarHistoricoAgora);
    el("history-status").addEventListener("change", function (e) {
      history.status = e.target.value;
      history.page = 1;
      carregarHistorico();
    });
    el("history-pagination").addEventListener("click", function (e) {
      var b = e.target.closest("[data-hpage]");
      if (!b) return;
      history.page = Number(b.getAttribute("data-hpage"));
      carregarHistorico();
    });

    document.addEventListener("click", function (e) {
      var ver = e.target.closest("[data-ver-campanha]");
      if (ver) { verCampanha(ver.getAttribute("data-ver-campanha")); return; }
      if (e.target.closest("[data-nova-mensagem]")) { mostrarView("composer"); }
    });

    el("msg-data").value = u.paraInputDateTime(u.diasFrente(1, 9, 0));
  }

  /* Init ------------------------------------------------------------------- */

  function iniciar() {
    if (!document.querySelector(".toast-region")) {
      var region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    variavelChips();
    bind();

    Promise.all([
      api.bootstrap(),
      api.mensagens.templates()
    ]).then(function (res) {
      var dados = res[0] || {};
      preencherFiltros(dados.catalogos || {});
      templates = res[1] || [];
      preencherTemplates();

      var qs = new URLSearchParams(window.location.search);
      var ids = (qs.get("leads") || "").split(",").filter(Boolean);
      if (ids.length) {
        modo = "manual";
        document.querySelectorAll("[data-modo]").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-modo") === "manual"); });
        carregarLeadsPorIds(ids).then(function () {
          ids.forEach(function (id) {
            var l = leads.filter(function (x) { return x.id === id; })[0];
            if (l && elegivelLead(l)) selecionados[id] = true;
          });
          if (ids.length === 1) {
            var unico = leads.filter(function (x) { return x.id === ids[0]; })[0];
            if (unico) el("msg-nome").value = "Mensagem para " + unico.nome;
          }
          renderPublico();
        });
      } else {
        el("msg-nome").value = "Campanha " + u.formatarData(new Date());
        renderPublico();
      }

      if (qs.get("tab") === "historico") mostrarView("historico");
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar a base de leads.", "error");
    });
  }

  iniciar();
})(window.Painel);
