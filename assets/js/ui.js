/* ==========================================================================
   Painel Comercial — Interface base
   Shell, navegação, modais, drawers, menus e feedbacks.
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var camada = 0;
  var camadas = [];
  var icone = Painel.icons.icone;

  var PAGINAS = {
    dashboard: { label: "Painel", href: "index.html", icon: "grid", grupo: "Comercial" },
    leads: { label: "Leads", href: "leads.html", icon: "users", grupo: "Comercial" },
    pipeline: { label: "Pipeline", href: "pipeline.html", icon: "kanban", grupo: "Comercial" },
    followups: { label: "Follow-ups", href: "followups.html", icon: "calendar-clock", grupo: "Comercial" },
    mensagens: { label: "Mensagens", href: "mensagens.html", icon: "message-circle", grupo: "Relacionamento" },
    relatorios: { label: "Relatórios", href: "relatorios.html", icon: "chart", grupo: "Relacionamento" },
    configuracoes: { label: "Configurações", href: "configuracoes.html", icon: "sliders", grupo: "Sistema" },
    conta: { label: "Minha conta", href: "conta.html", icon: "user", grupo: "Sistema" }
  };

  function paginaAtual() {
    return document.documentElement.getAttribute("data-page") || "dashboard";
  }

  function marca() {
    return '<span class="brand__text">' +
      '<img class="brand__logo" src="images/logoFull.png" alt="AssinaSoft">' +
      '<span class="brand__tag">Painel Comercial</span></span>';
  }

  function navGrupo(nome, chaves, atual) {
    return '<div class="nav-group"><div class="nav-group__label">' + nome + '</div>' +
      chaves.map(function (chave) {
        var p = PAGINAS[chave];
        var ativo = chave === atual ? " is-active" : "";
        var badge = chave === "leads"
          ? '<span class="nav-item__badge" data-sidebar-leads hidden>—</span>'
          : chave === "followups"
            ? '<span class="nav-item__badge nav-item__badge--alert" data-sidebar-tarefas hidden>0</span>'
            : "";
        return '<a class="nav-item' + ativo + '" href="' + p.href + '">' + icone(p.icon) +
          "<span>" + p.label + "</span>" + badge + "</a>";
      }).join("") + "</div>";
  }

  function renderSidebar() {
    var el = document.getElementById("sidebar");
    if (!el) return;
    var atual = paginaAtual();
    var sessao = Painel.auth.usuario();
    var grupos = [
      { nome: "Comercial", chaves: ["dashboard", "leads", "pipeline", "followups"] },
      { nome: "Relacionamento", chaves: ["mensagens", "relatorios"] },
      { nome: "Sistema", chaves: ["configuracoes"] }
    ];
    var nav = grupos.map(function (g) { return navGrupo(g.nome, g.chaves, atual); }).join("");

    el.innerHTML =
      '<div class="sidebar__brand"><a href="index.html" class="brand brand--inverse" aria-label="AssinaSoft — Painel Comercial">' + marca() + "</a></div>" +
      '<nav class="sidebar__nav" aria-label="Navegação principal">' + nav + "</nav>" +
      '<div class="sidebar__foot">' +
        '<a class="conn-card" href="mensagens.html" title="Envio de mensagens registrado no histórico do lead">' +
          '<span class="conn-card__dot"></span>' +
          '<span class="conn-card__text"><strong>WhatsApp</strong><small>Integração pendente</small></span>' +
          icone("message-circle") +
        "</a>" +
        '<button class="sidebar__user" type="button" data-user-menu-sidebar>' +
          '<span class="avatar">' + u.escaparHTML(sessao.iniciais || "MC") + "</span>" +
          '<span class="sidebar__user-text"><strong>' + u.escaparHTML(sessao.nome) + "</strong><small>" + u.escaparHTML(sessao.cargo || "Comercial") + "</small></span>" +
          icone("chevron-down") +
        "</button>" +
      "</div>";

    carregarResumoSidebar();
  }

  function carregarResumoSidebar() {
    var api = Painel.api;
    if (!api) return;
    api.leads.listar({ perPage: 1 }).then(function (res) {
      var total = res.stats.total || 0;
      var ativos = res.stats.abertos || 0;
      var leadsEl = document.querySelector("[data-sidebar-leads]");
      if (leadsEl) {
        leadsEl.textContent = u.formatarNumero(total);
        leadsEl.hidden = false;
      }
      var ativosEl = document.querySelector("[data-sidebar-ativos]");
      if (ativosEl) ativosEl.textContent = u.formatarNumero(ativos);
      var progress = document.querySelector("[data-sidebar-progress]");
      if (progress) progress.style.width = Math.min(100, total ? (ativos / total) * 100 : 0) + "%";
      var resumo = document.querySelector("[data-sidebar-resumo]");
      if (resumo) resumo.textContent = res.stats.atrasados
        ? res.stats.atrasados + " follow-up(s) atrasado(s)"
        : "Nenhum follow-up atrasado";
    }).catch(function () { /* silencioso */ });

    api.tarefas.listar({ status: "pendente" }).then(function (res) {
      var badge = document.querySelector("[data-sidebar-tarefas]");
      if (!badge) return;
      var n = (res.stats.atrasadas || 0) + (res.stats.hoje || 0);
      badge.textContent = n;
      badge.hidden = n === 0;
    }).catch(function () { /* silencioso */ });
  }

  /* Topbar ----------------------------------------------------------------- */

  function renderTopbar() {
    var el = document.getElementById("topbar");
    if (!el) return;
    var atual = PAGINAS[paginaAtual()] || PAGINAS.dashboard;
    var sessao = Painel.auth.usuario();

    el.innerHTML =
      '<button class="icon-btn sidebar-toggle" type="button" data-sidebar-toggle aria-label="Abrir menu">' + icone("menu") + "</button>" +
      '<div class="topbar__crumbs"><span class="topbar__workspace">Painel Comercial</span>' + icone("chevron-right") +
        "<strong>" + atual.label + "</strong></div>" +
      '<div class="topbar__right">' +
        '<button class="search-trigger" type="button" data-cmd-open aria-label="Buscar no painel">' +
          icone("search") + '<span class="search-trigger__label">Buscar no painel…</span><kbd>Ctrl K</kbd>' +
        "</button>" +
        '<div class="dropdown">' +
          '<button class="icon-btn" type="button" data-panel="help" aria-label="Ajuda e atalhos" aria-haspopup="true">' + icone("help") + "</button>" +
          '<div class="dropdown-panel dropdown-panel--wide" id="panel-help">' +
            '<div class="dropdown-panel__head"><strong>Ajuda e atalhos</strong><span class="xs faint">Painel Comercial</span></div>' +
            '<div class="help-panel">' +
              '<div class="help-panel__section">' +
                '<span class="help-panel__label">Atalhos de teclado</span>' +
                '<div class="help-shortcut"><span>Busca global</span><kbd>Ctrl + K</kbd></div>' +
                '<div class="help-shortcut"><span>Fechar janelas</span><kbd>ESC</kbd></div>' +
                '<div class="help-shortcut"><span>Salvar formulário</span><kbd>Ctrl + Enter</kbd></div>' +
              "</div>" +
              '<div class="help-panel__section">' +
                '<span class="help-panel__label">Envio de mensagens</span>' +
                '<p class="xs faint">Os envios pelo WhatsApp ficam registrados no histórico do lead. A integração oficial será habilitada em breve.</p>' +
              "</div>" +
            "</div>" +
            '<div class="dropdown-panel__foot"><a class="text-link xs" href="mailto:contato@assinasoft.com.br">Falar com o suporte</a></div>' +
          "</div>" +
        "</div>" +
        '<div class="dropdown">' +
          '<button class="icon-btn" type="button" data-panel="notif" aria-label="Notificações" aria-haspopup="true" data-notif-bell>' + icone("bell") + "</button>" +
          '<div class="dropdown-panel dropdown-panel--wide" id="panel-notif">' +
            '<div class="dropdown-panel__head"><strong>Notificações</strong>' +
            '<button class="text-link xs" type="button" data-read-all>Marcar como lidas</button></div>' +
            '<div data-notif-list><div class="dropdown-panel__empty">Carregando…</div></div>' +
            '<div class="dropdown-panel__foot"><a class="text-link xs" href="followups.html">Ver follow-ups</a></div>' +
          "</div>" +
        "</div>" +
        '<div class="topbar__divider"></div>' +
        '<div class="dropdown">' +
          '<button class="user-btn" type="button" data-panel="user" aria-haspopup="true">' +
            '<span class="avatar avatar--sm">' + u.escaparHTML(sessao.iniciais || "MC") + "</span>" +
            '<span class="user-btn__text"><strong>' + u.escaparHTML(u.primeiroNome(sessao.nome)) + '</strong><small>' + u.escaparHTML(sessao.cargo || "Comercial") + "</small></span>" +
            icone("chevron-down") +
          "</button>" +
          '<div class="dropdown-panel" id="panel-user">' +
            '<div class="dropdown-panel__head"><div><strong>' + u.escaparHTML(sessao.nome) + '</strong><div class="xs faint" style="margin-top:2px">' + u.escaparHTML(sessao.email) + "</div></div></div>" +
            '<div class="dropdown-list">' +
              '<a class="dropdown-item" href="conta.html">' + icone("user") + '<span class="dropdown-item__text"><strong>Minha conta</strong><small>Perfil e preferências</small></span></a>' +
              '<a class="dropdown-item" href="configuracoes.html">' + icone("sliders") + '<span class="dropdown-item__text"><strong>Configurações</strong><small>Empresa, funil e equipe</small></span></a>' +
            "</div>" +
            '<div class="dropdown-panel__foot"><button class="dropdown-item dropdown-item--danger" type="button" data-logout>' + icone("logout") + "<span>Encerrar sessão</span></button></div>" +
          "</div>" +
        "</div>" +
      "</div>";

    carregarNotificacoes();
  }

  function carregarNotificacoes() {
    var lista = document.querySelector("[data-notif-list]");
    if (!lista || !Painel.api) return;
    Painel.api.notificacoes.listar().then(function (itens) {
      var naoLidas = itens.filter(function (n) { return !n.lida; }).length;
      var bell = document.querySelector("[data-notif-bell]");
      if (bell) bell.classList.toggle("has-dot", naoLidas > 0);
      if (!itens.length) {
        lista.innerHTML = '<div class="dropdown-panel__empty">Nenhuma notificação.</div>';
        return;
      }
      lista.innerHTML = itens.map(function (n) {
        var cls = n.tipo === "sucesso" ? "notif-item__icon--success" : n.tipo === "alerta" ? "notif-item__icon--warning" : "";
        var ico = n.tipo === "sucesso" ? "check-circle" : n.tipo === "alerta" ? "alert-triangle" : "info";
        return '<a class="notif-item" href="' + u.escaparHTML(n.href || "index.html") + '">' +
          '<span class="notif-item__icon ' + cls + '">' + icone(ico) + "</span>" +
          '<span class="notif-item__text"><p>' + u.escaparHTML(n.texto) + "</p><time>" + u.tempoRelativo(n.data) + "</time></span>" +
          (!n.lida ? '<span class="notif-item__unread"></span>' : "") +
          "</a>";
      }).join("");
    }).catch(function () {
      lista.innerHTML = '<div class="dropdown-panel__empty">Não foi possível carregar.</div>';
    });
  }

  /* Command palette -------------------------------------------------------- */

  function comandos() {
    return [
      { grupo: "Navegação", label: "Painel", desc: "Visão geral comercial", icon: "grid", href: "index.html", termos: "dashboard inicio indicadores" },
      { grupo: "Navegação", label: "Leads", desc: "Base comercial", icon: "users", href: "leads.html", termos: "contatos base importar planilha" },
      { grupo: "Navegação", label: "Pipeline", desc: "Funil kanban", icon: "kanban", href: "pipeline.html", termos: "funil etapas negociacao" },
      { grupo: "Navegação", label: "Follow-ups", desc: "Agenda comercial", icon: "calendar-clock", href: "followups.html", termos: "tarefas agenda retorno" },
      { grupo: "Navegação", label: "Mensagens", desc: "Envios e histórico", icon: "message-circle", href: "mensagens.html", termos: "whatsapp campanha disparo" },
      { grupo: "Navegação", label: "Relatórios", desc: "Conversão e desempenho", icon: "chart", href: "relatorios.html", termos: "metricas exportar" },
      { grupo: "Navegação", label: "Configurações", desc: "Empresa, funil e sistemas", icon: "sliders", href: "configuracoes.html", termos: "ajustes etapas assinasoft" },
      { grupo: "Ações", label: "Cadastrar lead", desc: "Abrir formulário", icon: "user-plus", href: "leads.html?novo=1", termos: "novo contato lead" },
      { grupo: "Ações", label: "Importar planilha", desc: "CSV ou XLSX", icon: "file-spreadsheet", href: "leads.html?importar=1", termos: "csv xlsx planilha" },
      { grupo: "Ações", label: "Nova mensagem", desc: "Enviar pelo WhatsApp", icon: "send", href: "mensagens.html", termos: "campanha disparo whatsapp" },
      { grupo: "Ações", label: "Nova tarefa", desc: "Agendar follow-up", icon: "calendar", href: "followups.html?nova=1", termos: "followup tarefa retorno" },
      { grupo: "Sistema", label: "Minha conta", desc: "Perfil e preferências", icon: "user", href: "conta.html", termos: "perfil senha preferencias conta" },
      { grupo: "Sistema", label: "Encerrar sessão", desc: "Sair do painel", icon: "logout", action: "logout", termos: "sair logout" }
    ];
  }

  function renderComando() {
    var itens = comandos();
    var grupos = [];
    itens.forEach(function (c) { if (grupos.indexOf(c.grupo) === -1) grupos.push(c.grupo); });
    var html = grupos.map(function (g) {
      return '<div class="cmd__label">' + g + "</div>" + itens.filter(function (c) { return c.grupo === g; }).map(function (c) {
        return '<button class="cmd__item" type="button" data-cmd-index="' + itens.indexOf(c) + '">' + icone(c.icon) +
          "<span>" + c.label + "</span><small>" + c.desc + "</small></button>";
      }).join("");
    }).join("");

    var layer = document.createElement("div");
    layer.className = "layer";
    layer.id = "cmd-layer";
    layer.hidden = true;
    layer.innerHTML =
      '<div class="layer__backdrop" data-cmd-close></div>' +
      '<div class="cmd" role="dialog" aria-modal="true" aria-label="Busca e comandos">' +
        '<div class="cmd__search">' + icone("search") +
          '<input type="text" id="cmd-input" placeholder="Buscar páginas e ações…" autocomplete="off" spellcheck="false" aria-label="Buscar páginas e ações">' +
          '<kbd>ESC</kbd>' +
        "</div>" +
        '<div class="cmd__list" id="cmd-list">' + html + "</div>" +
        '<div class="cmd__foot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span>' + itens.length + " comandos</span></div>" +
      "</div>";
    document.body.appendChild(layer);
  }

  var cmdAtivo = 0;
  var cmdVisiveis = [];

  function abrirCmd() {
    var layer = document.getElementById("cmd-layer");
    if (!layer) return;
    layer.hidden = false;
    document.body.classList.add("no-scroll");
    var input = document.getElementById("cmd-input");
    input.value = "";
    filtrarCmd("");
    setTimeout(function () { input.focus(); }, 30);
  }

  function fecharCmd() {
    var layer = document.getElementById("cmd-layer");
    if (!layer) return;
    layer.hidden = true;
    liberarScroll();
    document.querySelectorAll(".cmd__item").forEach(function (b) { b.style.display = ""; });
    document.querySelectorAll(".cmd__label").forEach(function (b) { b.style.display = ""; });
  }

  function filtrarCmd(termo) {
    var t = u.normalizarTexto(termo);
    var itens = document.querySelectorAll(".cmd__item");
    cmdVisiveis = [];
    itens.forEach(function (btn) {
      var idx = Number(btn.getAttribute("data-cmd-index"));
      var c = comandos()[idx];
      var texto = u.normalizarTexto(c.label + " " + c.desc + " " + c.termos);
      var visivel = !t || texto.indexOf(t) !== -1;
      btn.style.display = visivel ? "" : "none";
      btn.classList.remove("is-active");
      if (visivel) cmdVisiveis.push(btn);
    });
    document.querySelectorAll(".cmd__label").forEach(function (lab) {
      var next = lab.nextElementSibling;
      var tem = false;
      while (next && !next.classList.contains("cmd__label")) {
        if (next.classList.contains("cmd__item") && next.style.display !== "none") tem = true;
        next = next.nextElementSibling;
      }
      lab.style.display = tem ? "" : "none";
    });
    cmdAtivo = 0;
    if (cmdVisiveis.length) cmdVisiveis[0].classList.add("is-active");
    var vazio = document.getElementById("cmd-empty");
    if (!cmdVisiveis.length) {
      if (!vazio) {
        var el = document.createElement("div");
        el.className = "cmd__empty";
        el.id = "cmd-empty";
        document.getElementById("cmd-list").appendChild(el);
      }
      document.getElementById("cmd-empty").textContent = "Nenhum comando encontrado para “" + termo + "”.";
    } else if (vazio) {
      vazio.remove();
    }
  }

  function executarComando(idx) {
    var c = comandos()[idx];
    if (!c) return;
    fecharCmd();
    if (c.action === "logout") {
      Painel.auth.sair();
      return;
    }
    window.location.href = c.href;
  }

  function moverCmd(dir) {
    if (!cmdVisiveis.length) return;
    cmdVisiveis[cmdAtivo].classList.remove("is-active");
    cmdAtivo = (cmdAtivo + dir + cmdVisiveis.length) % cmdVisiveis.length;
    cmdVisiveis[cmdAtivo].classList.add("is-active");
    cmdVisiveis[cmdAtivo].scrollIntoView({ block: "nearest" });
  }

  function bindCmd() {
    document.addEventListener("keydown", function (e) {
      var layer = document.getElementById("cmd-layer");
      var aberto = layer && !layer.hidden;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        aberto ? fecharCmd() : abrirCmd();
        return;
      }
      if (!aberto) return;
      if (e.key === "Escape") { e.preventDefault(); fecharCmd(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moverCmd(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moverCmd(-1); }
      else if (e.key === "Enter") {
        if (cmdVisiveis[cmdAtivo]) {
          e.preventDefault();
          executarComando(Number(cmdVisiveis[cmdAtivo].getAttribute("data-cmd-index")));
        }
      }
    });

    document.addEventListener("input", function (e) {
      if (e.target && e.target.id === "cmd-input") filtrarCmd(e.target.value);
    });

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-cmd-open]")) { e.preventDefault(); abrirCmd(); return; }
      if (e.target.closest("[data-cmd-close]")) { fecharCmd(); return; }
      var item = e.target.closest("[data-cmd-index]");
      if (item) executarComando(Number(item.getAttribute("data-cmd-index")));
    });

    document.addEventListener("mouseover", function (e) {
      var item = e.target.closest(".cmd__item");
      if (!item || item.style.display === "none") return;
      cmdVisiveis.forEach(function (b) { b.classList.remove("is-active"); });
      item.classList.add("is-active");
      cmdAtivo = cmdVisiveis.indexOf(item);
    });
  }

  /* Overlay mobile --------------------------------------------------------- */

  function renderOverlay() {
    if (document.querySelector(".sidebar-overlay")) return;
    var el = document.createElement("div");
    el.className = "sidebar-overlay";
    el.setAttribute("data-sidebar-close", "");
    document.body.appendChild(el);
  }

  /* Menus ------------------------------------------------------------------ */

  function fecharPainéis(exceto) {
    document.querySelectorAll(".dropdown-panel.is-open").forEach(function (p) {
      if (p !== exceto) p.classList.remove("is-open");
    });
  }

  function fecharMenuFlutuante() {
    var m = document.querySelector(".floating-menu");
    if (m) m.remove();
    document.removeEventListener("click", fecharAoClicarFora);
    window.removeEventListener("scroll", fecharMenuFlutuante);
  }

  function menuFlutuante(anchor, itens) {
    fecharMenuFlutuante();
    var menu = document.createElement("div");
    menu.className = "floating-menu";
    menu.setAttribute("role", "menu");
    itens.forEach(function (item) {
      if (item.divider) { menu.appendChild(document.createElement("hr")); return; }
      var b = document.createElement("button");
      b.type = "button";
      b.className = item.perigo ? "is-danger" : "";
      b.innerHTML = icone(item.icone || "chevron-right") + "<span>" + u.escaparHTML(item.label) + "</span>";
      b.addEventListener("click", function () {
        fecharMenuFlutuante();
        try { anchor.focus(); } catch (e) { /* ignora */ }
        item.acao();
      });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);

    var r = anchor.getBoundingClientRect();
    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    var left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    var top = r.bottom + 5;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 5);
    menu.style.left = left + "px";
    menu.style.top = top + "px";

    setTimeout(function () {
      if (document.querySelector(".floating-menu") === menu) {
        document.addEventListener("click", fecharAoClicarFora, { once: true });
      }
    }, 0);
    window.addEventListener("scroll", fecharMenuFlutuante, { once: true });
  }

  function fecharAoClicarFora(e) {
    if (!e.target.closest(".floating-menu")) fecharMenuFlutuante();
  }

  /* Modal / drawer / toast ------------------------------------------------- */

  function bloquearScroll() { document.body.classList.add("no-scroll"); }
  function liberarScroll() {
    if (!document.querySelector(".layer:not([hidden])")) document.body.classList.remove("no-scroll");
  }

  function camadaTopo() {
    return camadas.length ? camadas[camadas.length - 1] : null;
  }

  function focaveis(layer) {
    return Array.prototype.slice.call(layer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) {
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }

  function prenderFoco(e, layer) {
    var itens = focaveis(layer);
    if (!itens.length) {
      e.preventDefault();
      layer.focus();
      return;
    }
    var primeiro = itens[0];
    var ultimo = itens[itens.length - 1];
    var ativo = document.activeElement;
    var dentro = layer.contains(ativo);

    if (e.shiftKey) {
      if (!dentro || ativo === primeiro) {
        e.preventDefault();
        ultimo.focus();
      }
      return;
    }
    if (!dentro || ativo === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  function fecharCamada(item) {
    if (!item || !item.layer.isConnected) return;
    var indice = camadas.indexOf(item);
    if (indice !== -1) camadas.splice(indice, 1);
    item.layer.remove();
    camada = Math.max(0, camada - 1);
    liberarScroll();
    var alvo = item.anterior;
    if ((!alvo || !alvo.isConnected) && item.focoSeletor) {
      try { alvo = document.querySelector(item.focoSeletor); } catch (e) { alvo = null; }
    }
    if (alvo && alvo.isConnected && alvo.focus) {
      try { alvo.focus(); } catch (e) { /* ignora */ }
    }
    if (item.opts.onClose) item.opts.onClose();
  }

  function seletorFoco(el) {
    if (!el || !el.getAttribute) return null;
    var attrs = ["data-open", "data-menu", "data-card-menu", "data-campanha-menu", "data-select", "data-ver", "data-ver-campanha", "data-task", "data-tarefa", "data-edit", "data-editar", "data-add-etapa", "data-add-origem", "data-add-sistema", "data-add-membro"];
    for (var i = 0; i < attrs.length; i++) {
      var valor = el.getAttribute(attrs[i]);
      if (valor) {
        try { return "[" + attrs[i] + '="' + CSS.escape(valor) + '"]'; } catch (e) { /* ignora */ }
      }
    }
    if (el.id) {
      try { return "#" + CSS.escape(el.id); } catch (e) { /* ignora */ }
    }
    return null;
  }

  function modal(opts) {
    opts = opts || {};
    camada++;
    var anterior = document.activeElement;
    var layer = document.createElement("div");
    layer.className = "layer";
    layer.style.zIndex = String(100 + camada * 2);
    layer.innerHTML =
      '<div class="layer__backdrop"' + (opts.locked ? "" : " data-close") + "></div>" +
      '<div class="modal ' + (opts.size === "sm" ? "modal--sm" : opts.size === "lg" ? "modal--lg" : "") + '" role="dialog" aria-modal="true" aria-labelledby="modal-title-' + camada + '">' +
        '<div class="modal__head">' +
          '<div class="modal__titles"><h2 class="modal__title" id="modal-title-' + camada + '">' + u.escaparHTML(opts.title || "") + "</h2>" +
          (opts.subtitle ? '<p class="modal__subtitle">' + u.escaparHTML(opts.subtitle) + "</p>" : "") + "</div>" +
          (opts.locked ? "" : '<button class="icon-btn icon-btn--sm" type="button" data-close aria-label="Fechar">' + icone("x") + "</button>") +
        "</div>" +
        '<div class="modal__body">' + (opts.body || "") + "</div>" +
        (opts.footer ? '<div class="modal__foot">' + opts.footer + "</div>" : "") +
      "</div>";
    document.body.appendChild(layer);
    bloquearScroll();

    var item = {
      layer: layer,
      opts: opts,
      anterior: anterior,
      focoSeletor: seletorFoco(anterior),
      fechar: function () { fecharCamada(item); }
    };
    camadas.push(item);

    layer.querySelectorAll("[data-close]").forEach(function (el) { el.addEventListener("click", item.fechar); });
    setTimeout(function () {
      var foco = layer.querySelector("input:not([type=hidden]), select, textarea, button.btn--primary, button.btn--secondary");
      if (foco) foco.focus();
    }, 60);

    if (opts.onMount) opts.onMount(layer, item.fechar);
    return { el: layer, close: item.fechar, body: layer.querySelector(".modal__body") };
  }

  function drawer(opts) {
    opts = opts || {};
    camada++;
    var anterior = document.activeElement;
    var layer = document.createElement("div");
    layer.className = "layer";
    layer.style.zIndex = String(100 + camada * 2);
    layer.innerHTML =
      '<div class="layer__backdrop" data-close></div>' +
      '<aside class="drawer ' + (opts.wide ? "drawer--wide" : "") + '" role="dialog" aria-modal="true">' +
        '<div class="drawer__head"><div class="modal__titles"><h2 class="modal__title">' + u.escaparHTML(opts.title || "") + "</h2>" +
        (opts.subtitle ? '<p class="modal__subtitle">' + u.escaparHTML(opts.subtitle) + "</p>" : "") + "</div>" +
        '<button class="icon-btn icon-btn--sm" type="button" data-close aria-label="Fechar">' + icone("x") + "</button></div>" +
        '<div class="drawer__body">' + (opts.body || "") + "</div>" +
        (opts.footer ? '<div class="drawer__foot">' + opts.footer + "</div>" : "") +
      "</aside>";
    document.body.appendChild(layer);
    bloquearScroll();

    var item = {
      layer: layer,
      opts: opts,
      anterior: anterior,
      focoSeletor: seletorFoco(anterior),
      fechar: function () { fecharCamada(item); }
    };
    camadas.push(item);

    layer.querySelectorAll("[data-close]").forEach(function (el) { el.addEventListener("click", item.fechar); });
    setTimeout(function () {
      var foco = layer.querySelector("input:not([type=hidden]), select, textarea");
      if (foco) foco.focus();
    }, 70);

    if (opts.onMount) opts.onMount(layer, item.fechar);
    return { el: layer, close: item.fechar, body: layer.querySelector(".drawer__body") };
  }

  function confirmar(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var confirmado = false;
      var m = modal({
        title: opts.titulo || "Confirmar ação",
        subtitle: opts.subtitulo || "",
        size: "sm",
        body: '<div class="notice ' + (opts.perigo ? "notice--danger" : "notice--brand") + '">' +
          icone(opts.perigo ? "alert-triangle" : "info") + "<div>" + (opts.texto || "") + "</div></div>",
        footer: '<button class="btn btn--secondary" type="button" data-cancelar>Cancelar</button>' +
          '<button class="btn ' + (opts.perigo ? "btn--danger" : "btn--primary") + '" type="button" data-confirmar>' + (opts.acao || "Confirmar") + "</button>",
        onClose: function () { if (!confirmado) resolve(false); }
      });
      m.el.querySelector("[data-cancelar]").addEventListener("click", function () { m.close(); });
      m.el.querySelector("[data-confirmar]").addEventListener("click", function () {
        confirmado = true;
        m.close();
        resolve(true);
      });
    });
  }

  function toast(mensagem, tipo, titulo) {
    var region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    var map = {
      success: { icon: "check-circle", titulo: titulo || "Tudo certo" },
      error: { icon: "alert-circle", titulo: titulo || "Não foi possível concluir" },
      warning: { icon: "alert-triangle", titulo: titulo || "Atenção" },
      info: { icon: "info", titulo: titulo || "Informação" }
    };
    var cfg = map[tipo] || map.success;
    var el = document.createElement("div");
    el.className = "toast toast--" + (tipo || "success");
    el.innerHTML =
      '<span class="toast__icon">' + icone(cfg.icon) + "</span>" +
      '<div class="toast__text"><strong>' + u.escaparHTML(cfg.titulo) + "</strong>" + u.escaparHTML(mensagem) + "</div>" +
      '<button class="toast__close" type="button" aria-label="Fechar">' + icone("x") + "</button>";
    region.appendChild(el);
    var fechar = function () {
      if (el.classList.contains("is-leaving")) return;
      el.classList.add("is-leaving");
      setTimeout(function () { el.remove(); }, 180);
    };
    el.querySelector(".toast__close").addEventListener("click", fechar);
    setTimeout(fechar, tipo === "error" ? 6500 : 4300);
  }

  function copiar(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).then(function () {
        toast("Conteúdo copiado para a área de transferência.", "success");
      }).catch(function () {
        toast("Não foi possível copiar automaticamente.", "error");
      });
    }
    var el = document.createElement("textarea");
    el.value = texto;
    document.body.appendChild(el);
    el.select();
    try { document.execCommand("copy"); toast("Conteúdo copiado.", "success"); }
    catch (e) { toast("Não foi possível copiar.", "error"); }
    document.body.removeChild(el);
    return Promise.resolve();
  }

  /* Init ------------------------------------------------------------------- */

  function bindGlobal() {
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-sidebar-toggle]")) {
        document.body.classList.toggle("sidebar-visible");
        return;
      }
      if (e.target.closest("[data-sidebar-close]")) {
        document.body.classList.remove("sidebar-visible");
        return;
      }
      if (e.target.closest(".sidebar__nav a")) {
        document.body.classList.remove("sidebar-visible");
      }

      if (e.target.closest("[data-logout]")) {
        e.preventDefault();
        Painel.auth.sair();
        return;
      }

      if (e.target.closest("[data-read-all]")) {
        e.preventDefault();
        var btn = e.target.closest("[data-read-all]");
        btn.disabled = true;
        Painel.api.notificacoes.marcarLidas().then(function () {
          document.querySelectorAll(".notif-item__unread").forEach(function (d) { d.remove(); });
          var bell = document.querySelector("[data-notif-bell]");
          if (bell) bell.classList.remove("has-dot");
          toast("Notificações marcadas como lidas.", "success");
        }).catch(function () {
          btn.disabled = false;
          toast("Não foi possível atualizar as notificações.", "error");
        });
        return;
      }

      var panelBtn = e.target.closest("[data-panel]");
      if (panelBtn) {
        e.preventDefault();
        var id = panelBtn.getAttribute("data-panel");
        var panel = document.getElementById("panel-" + id);
        if (panel) {
          var jaAberto = panel.classList.contains("is-open");
          fecharPainéis();
          if (!jaAberto) panel.classList.add("is-open");
        }
        return;
      }

      if (!e.target.closest(".dropdown")) fecharPainéis();

      if (e.target.closest("[data-user-menu-sidebar]")) {
        menuFlutuante(e.target.closest("[data-user-menu-sidebar]"), [
          { label: "Minha conta", icone: "user", acao: function () { window.location.href = "conta.html"; } },
          { label: "Configurações", icone: "sliders", acao: function () { window.location.href = "configuracoes.html"; } },
          { divider: true },
          { label: "Encerrar sessão", icone: "logout", perigo: true, acao: function () { Painel.auth.sair(); } }
        ]);
        return;
      }
    });

    document.addEventListener("keydown", function (e) {
      var cmdLayer = document.getElementById("cmd-layer");
      if (cmdLayer && !cmdLayer.hidden) return;

      var topo = camadaTopo();

      if (e.key === "Tab" && topo) {
        prenderFoco(e, topo.layer);
        return;
      }

      if (e.key === "Escape") {
        if (document.querySelector(".floating-menu")) {
          fecharMenuFlutuante();
          return;
        }
        if (topo) {
          e.preventDefault();
          if (!topo.opts.locked) topo.fechar();
          return;
        }
        fecharPainéis();
        document.body.classList.remove("sidebar-visible");
      }
    });

    window.addEventListener("resize", fecharMenuFlutuante);
  }

  function aplicarPreferencias() {
    if (!Painel.config.storage.conta || !Painel.store) return;
    var conta = Painel.store.get(Painel.config.storage.conta);
    var compactas = !!(conta && conta.preferencias && conta.preferencias.tabelaCompacta);
    document.documentElement.classList.toggle("tables-compact", compactas);
  }

  function iniciar() {
    aplicarPreferencias();
    bindGlobal();
    renderSidebar();
    renderTopbar();
    renderOverlay();
    renderComando();
    bindCmd();
  }

  var ui = {
    icone: icone,
    toast: toast,
    modal: modal,
    drawer: drawer,
    confirmar: confirmar,
    menu: menuFlutuante,
    copiar: copiar,
    fecharPainéis: fecharPainéis,
    paginaAtual: paginaAtual,
    abrirCmd: abrirCmd,
    renderSidebar: renderSidebar,
    renderTopbar: renderTopbar,
    recarregarResumoSidebar: carregarResumoSidebar,
    recarregarNotificacoes: carregarNotificacoes
  };

  Painel.ui = ui;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})(window.Painel);
