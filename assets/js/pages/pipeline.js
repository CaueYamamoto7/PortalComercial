/* ==========================================================================
   Painel Comercial — Pipeline
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var ui = Painel.ui;
  var api = Painel.api;
  var leadUI = Painel.leadUI;

  var estado = { q: "", sistema: "", responsavel: "", origem: "", prioridade: "" };
  var facetsCarregadas = false;
  var arrastando = false;
  var etapaArrastada = null;

  function el(id) { return document.getElementById(id); }

  function preencherSelects(facets) {
    if (facetsCarregadas) return;
    facetsCarregadas = true;
    el("pipeline-sistema").innerHTML = '<option value="">Todos os sistemas</option>' +
      facets.sistemas.map(function (s) { return '<option value="' + s.id + '">' + u.escaparHTML(s.nome) + "</option>"; }).join("");
    el("pipeline-responsavel").innerHTML = '<option value="">Todos os responsáveis</option>' +
      facets.responsaveis.map(function (r) { return '<option value="' + u.escaparHTML(r.nome) + '">' + u.escaparHTML(r.nome) + "</option>"; }).join("");
    el("pipeline-origem").innerHTML = '<option value="">Todas as origens</option>' +
      facets.origens.map(function (o) { return '<option value="' + o.id + '">' + u.escaparHTML(o.nome) + "</option>"; }).join("");
  }

  function cardHTML(l) {
    var next = "";
    if (l.proximoContato) {
      next = '<span class="kanban-card__next' + (l.proximoContatoAtrasado ? " is-late" : "") + '">' +
        ui.icone("calendar") + u.rotuloPrazo(l.proximoContato) + "</span>";
    } else {
      next = '<span class="kanban-card__next faint">Sem follow-up</span>';
    }
    return '<article class="kanban-card" draggable="true" data-card="' + l.id + '" data-etapa="' + l.etapaId + '">' +
      '<div class="kanban-card__top">' +
        '<span class="prio-dot prio-dot--' + l.prioridade + '" title="Prioridade ' + l.prioridade + '"></span>' +
        '<span class="kanban-card__company">' + u.escaparHTML(l.empresa || "Sem empresa") + "</span>" +
        '<button class="icon-btn icon-btn--xs" type="button" data-card-menu="' + l.id + '" title="Ações">' + ui.icone("more") + "</button>" +
      "</div>" +
      '<button class="kanban-card__name" type="button" data-open="' + l.id + '">' + u.escaparHTML(l.nome) + "</button>" +
      (l.cargo ? '<p class="kanban-card__role">' + u.escaparHTML(l.cargo) + "</p>" : "") +
      '<div class="kanban-card__tags">' + leadUI.sistemaChips(l.sistemas, 2) +
        (l.naoContatar ? '<span class="tag tag--danger">Não contatar</span>' : "") + "</div>" +
      '<div class="kanban-card__foot">' + next +
        '<span class="kanban-card__owner" title="' + u.escaparHTML(l.responsavel) + '"><span class="avatar avatar--xs ' + u.tomAvatar(l.responsavel) + '">' + u.escaparHTML(u.iniciais(l.responsavel)) + "</span></span>" +
      "</div>" +
    "</article>";
  }

  function render(dados) {
    var board = el("pipeline-board");
    var scroll = board.scrollLeft;
    preencherSelects(dados.facets);
    el("pipeline-total").textContent = u.formatarNumero(dados.total);

    board.innerHTML = dados.etapas.map(function (etapa) {
      return '<section class="kanban-col" data-drop="' + etapa.id + '">' +
        '<header class="kanban-col__head" style="--etapa-cor:' + etapa.cor + '">' +
          '<span class="kanban-col__dot" style="background:' + etapa.cor + '"></span>' +
          '<strong>' + u.escaparHTML(etapa.nome) + "</strong>" +
          '<span class="kanban-col__count">' + etapa.total + "</span>" +
          '<button class="icon-btn icon-btn--xs" type="button" data-add-etapa="' + etapa.id + '" title="Adicionar lead nesta etapa">' + ui.icone("plus") + "</button>" +
        "</header>" +
        '<div class="kanban-col__list" data-list="' + etapa.id + '">' +
          (etapa.leads.map(cardHTML).join("") || '<div class="kanban-col__empty">' + ui.icone("inbox") + "<span>Nenhum lead</span></div>") +
        "</div>" +
      "</section>";
    }).join("");

    board.scrollLeft = scroll;
  }

  function carregar() {
    return api.pipeline.obter(estado).then(render).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar o pipeline.", "error");
      el("pipeline-board").innerHTML = '<div class="empty"><p>Erro ao carregar o funil.</p></div>';
    });
  }

  function abrirEdicao(id) {
    api.leads.obter(id).then(function (res) {
      leadUI.abrirFormulario(res.lead, { onSaved: function () { leadUI.invalidarListas(); carregar(); } });
    }).catch(function (err) { ui.toast(err.message, "error"); });
  }

  function bind() {
    var board = el("pipeline-board");

    board.addEventListener("click", function (e) {
      if (arrastando) return;
      var add = e.target.closest("[data-add-etapa]");
      if (add) {
        leadUI.abrirFormulario({ etapaId: add.getAttribute("data-add-etapa"), responsavel: Painel.auth.usuario().nome }, {
          onSaved: function () { leadUI.invalidarListas(); carregar(); }
        });
        return;
      }
      var menu = e.target.closest("[data-card-menu]");
      if (menu) {
        var idMenu = menu.getAttribute("data-card-menu");
        ui.menu(menu, [
          { label: "Abrir detalhes", icone: "eye", acao: function () { leadUI.abrirDetalhe(idMenu, { onChanged: carregar }); } },
          { label: "Enviar mensagem", icone: "message-circle", acao: function () { leadUI.abrirMensagem(idMenu, { onSent: carregar }); } },
          { label: "Editar lead", icone: "pencil", acao: function () { abrirEdicao(idMenu); } }
        ]);
        return;
      }
      var open = e.target.closest("[data-open]");
      if (open) { leadUI.abrirDetalhe(open.getAttribute("data-open"), { onChanged: carregar }); return; }
      var card = e.target.closest("[data-card]");
      if (card) leadUI.abrirDetalhe(card.getAttribute("data-card"), { onChanged: carregar });
    });

    board.addEventListener("dragstart", function (e) {
      var card = e.target.closest("[data-card]");
      if (!card) return;
      arrastando = true;
      etapaArrastada = card.getAttribute("data-etapa");
      card.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.getAttribute("data-card"));
      document.querySelectorAll(".kanban-col").forEach(function (c) { c.classList.add("is-drag-active"); });
    });

    board.addEventListener("dragend", function (e) {
      var card = e.target.closest("[data-card]");
      if (card) card.classList.remove("is-dragging");
      document.querySelectorAll(".kanban-col").forEach(function (c) {
        c.classList.remove("is-drag-active", "is-over");
      });
      setTimeout(function () { arrastando = false; }, 60);
    });

    board.addEventListener("dragover", function (e) {
      var col = e.target.closest("[data-drop]");
      if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".kanban-col.is-over").forEach(function (c) { if (c !== col) c.classList.remove("is-over"); });
      col.classList.add("is-over");
    });

    board.addEventListener("dragleave", function (e) {
      var col = e.target.closest("[data-drop]");
      if (!col) return;
      if (!col.contains(e.relatedTarget)) col.classList.remove("is-over");
    });

    board.addEventListener("drop", function (e) {
      var col = e.target.closest("[data-drop]");
      if (!col) return;
      e.preventDefault();
      col.classList.remove("is-over");
      var leadId = e.dataTransfer.getData("text/plain");
      var destino = col.getAttribute("data-drop");
      if (!leadId) return;
      if (etapaArrastada === destino) return;
      var nomeEtapa = col.querySelector(".kanban-col__head strong").textContent;
      api.leads.mover(leadId, destino).then(function () {
        ui.toast("Lead movido para " + nomeEtapa + ".", "success");
        ui.recarregarResumoSidebar();
        carregar();
      }).catch(function (err) {
        ui.toast(err.message || "Não foi possível mover o lead.", "error");
        carregar();
      });
    });

    var busca = el("pipeline-busca");
    busca.addEventListener("input", u.debounce(function () {
      estado.q = busca.value.trim();
      carregar();
    }, 260));

    [["sistema", "pipeline-sistema"], ["responsavel", "pipeline-responsavel"], ["origem", "pipeline-origem"], ["prioridade", "pipeline-prioridade"]].forEach(function (par) {
      el(par[1]).addEventListener("change", function (e) {
        estado[par[0]] = e.target.value;
        carregar();
      });
    });

    document.querySelector("[data-limpar]").addEventListener("click", function () {
      estado = { q: "", sistema: "", responsavel: "", origem: "", prioridade: "" };
      busca.value = "";
      ["pipeline-sistema", "pipeline-responsavel", "pipeline-origem", "pipeline-prioridade"].forEach(function (id) { el(id).value = ""; });
      carregar();
    });

    document.querySelector("[data-novo]").addEventListener("click", function () {
      leadUI.abrirFormulario(null, { onSaved: function () { leadUI.invalidarListas(); carregar(); } });
    });
  }

  bind();
  carregar();
})(window.Painel);
