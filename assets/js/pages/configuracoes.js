/* ==========================================================================
   Painel Comercial — Configurações
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var ui = Painel.ui;
  var api = Painel.api;
  var config = null;

  function el(id) { return document.getElementById(id); }

  function preencher(form, dados) {
    Object.keys(dados || {}).forEach(function (k) {
      var campo = form.elements[k];
      if (campo) campo.value = dados[k] === null || dados[k] === undefined ? "" : dados[k];
    });
  }

  function carregar() {
    return api.configuracoes.obter().then(function (cfg) {
      config = cfg;
      preencher(el("form-empresa"), cfg.empresa);
      preencher(el("form-mensagens"), cfg.mensagens);
      renderEtapas();
      renderSistemas();
      renderOrigens();
      renderEquipe();
      Object.keys(cfg.counts).forEach(function (k) {
        var node = document.querySelector('[data-count="' + k + '"]');
        if (node) node.textContent = u.formatarNumero(cfg.counts[k]);
      });
      return cfg;
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar as configurações.", "error");
    });
  }

  function ordenarEtapas() {
    return (config.etapas || []).slice().sort(function (a, b) { return a.ordem - b.ordem; });
  }

  /* Empresa e mensagens ---------------------------------------------------- */

  function salvarSecao(secao, form, botao) {
    if (!form.reportValidity()) return;
    var dados = {};
    Array.prototype.forEach.call(form.elements, function (campo) {
      if (!campo.name) return;
      dados[campo.name] = campo.value.trim();
    });
    if (secao === "mensagens") {
      dados.limiteDiario = Number(dados.limiteDiario) || 300;
      dados.intervalo = Number(dados.intervalo) || 10;
    }
    botao.disabled = true;
    botao.classList.add("is-loading");
    api.configuracoes.salvar(secao, dados).then(function () {
      botao.disabled = false;
      botao.classList.remove("is-loading");
      ui.toast(secao === "empresa" ? "Dados da empresa salvos." : "Configurações de mensagens salvas.", "success");
      if (secao === "empresa") {
        var sessao = Painel.auth.sessao();
        if (sessao) {
          sessao.empresa = dados.nome;
          Painel.store.setSession(sessao);
        }
      }
    }).catch(function (err) {
      botao.disabled = false;
      botao.classList.remove("is-loading");
      ui.toast(err.message || "Não foi possível salvar.", "error");
    });
  }

  /* Funil ------------------------------------------------------------------ */

  function renderEtapas() {
    var lista = ordenarEtapas();
    el("lista-etapas").innerHTML = lista.map(function (etapa, idx) {
      return '<div class="settings-item">' +
        '<span class="settings-item__dot" style="background:' + etapa.cor + '"></span>' +
        '<div class="settings-item__main"><strong>' + u.escaparHTML(etapa.nome) + "</strong>" +
          '<small>Tipo: ' + (etapa.tipo === "ganho" ? "Ganho" : etapa.tipo === "perdido" ? "Perdido" : "Em aberto") + " · Ordem " + (idx + 1) + "</small></div>" +
        '<div class="settings-item__actions">' +
          '<button class="icon-btn icon-btn--sm" type="button" data-etapa-up="' + etapa.id + '" title="Mover para cima"' + (idx === 0 ? " disabled" : "") + ">" + ui.icone("arrow-up") + "</button>" +
          '<button class="icon-btn icon-btn--sm" type="button" data-etapa-down="' + etapa.id + '" title="Mover para baixo"' + (idx === lista.length - 1 ? " disabled" : "") + ">" + ui.icone("arrow-down") + "</button>" +
          '<button class="icon-btn icon-btn--sm" type="button" data-etapa-edit="' + etapa.id + '" title="Editar">' + ui.icone("pencil") + "</button>" +
          '<button class="icon-btn icon-btn--sm" type="button" data-etapa-del="' + etapa.id + '" title="Excluir">' + ui.icone("trash") + "</button>" +
        "</div></div>";
    }).join("");
  }

  function abrirEtapa(etapa) {
    var editando = !!etapa;
    var m = ui.modal({
      title: editando ? "Editar etapa" : "Nova etapa",
      size: "sm",
      body: '<form id="etapa-form" class="form-grid">' +
        '<label class="field field--full"><span class="field__label">Nome <em class="field__req">*</em></span><input class="input" name="nome" value="' + u.escaparHTML(etapa ? etapa.nome : "") + '" placeholder="Ex.: Contato feito"></label>' +
        '<label class="field"><span class="field__label">Cor</span><input class="input input--color" type="color" name="cor" value="' + (etapa ? etapa.cor : "#0B6B57") + '"></label>' +
        '<label class="field"><span class="field__label">Tipo</span><select class="select" name="tipo">' +
          '<option value="aberto"' + (etapa && etapa.tipo === "aberto" ? " selected" : "") + ">Em aberto</option>" +
          '<option value="ganho"' + (etapa && etapa.tipo === "ganho" ? " selected" : "") + ">Ganho</option>" +
          '<option value="perdido"' + (etapa && etapa.tipo === "perdido" ? " selected" : "") + ">Perdido</option>" +
        "</select></label></form>",
      footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn btn--primary" type="button" data-salvar-etapa>Salvar etapa</button>'
    });
    var form = m.el.querySelector("#etapa-form");
    m.el.querySelector("[data-salvar-etapa]").addEventListener("click", function (e) {
      if (!form.reportValidity()) return;
      var btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add("is-loading");
      api.configuracoes.salvarEtapa({
        id: etapa ? etapa.id : null,
        nome: form.elements.nome.value.trim(),
        cor: form.elements.cor.value,
        tipo: form.elements.tipo.value
      }).then(function () {
        m.close();
        ui.toast(editando ? "Etapa atualizada." : "Etapa criada.", "success");
        carregar();
      }).catch(function (err) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        ui.toast(err.message || "Não foi possível salvar a etapa.", "error");
      });
    });
  }

  /* Sistemas --------------------------------------------------------------- */

  function renderSistemas() {
    el("lista-sistemas").innerHTML = config.sistemas.map(function (s) {
      return '<div class="settings-item' + (!s.ativo ? " is-inactive" : "") + '">' +
        '<span class="settings-item__swatch" style="background:' + s.cor + '"></span>' +
        '<div class="settings-item__main"><strong>' + u.escaparHTML(s.nome) + (s.ativo ? "" : ' <span class="badge badge--neutral">Arquivado</span>') + "</strong>" +
          "<small>" + u.escaparHTML(s.descricao || "Sem descrição") + "</small></div>" +
        '<div class="settings-item__actions">' +
          '<button class="icon-btn icon-btn--sm" type="button" data-sistema-edit="' + s.id + '" title="Editar">' + ui.icone("pencil") + "</button>" +
          '<button class="icon-btn icon-btn--sm" type="button" data-sistema-del="' + s.id + '" title="Remover">' + ui.icone("trash") + "</button>" +
        "</div></div>";
    }).join("") || '<div class="empty empty--compact"><p>Nenhum sistema cadastrado.</p></div>';
  }

  function abrirSistema(sistema) {
    var editando = !!sistema;
    var m = ui.modal({
      title: editando ? "Editar sistema" : "Novo sistema",
      size: "sm",
      body: '<form id="sistema-form" class="form-grid">' +
        '<label class="field field--full"><span class="field__label">Nome <em class="field__req">*</em></span><input class="input" name="nome" value="' + u.escaparHTML(sistema ? sistema.nome : "") + '" placeholder="Ex.: AssinaPDF"></label>' +
        '<label class="field field--full"><span class="field__label">Descrição</span><textarea class="textarea" name="descricao" rows="3">' + u.escaparHTML(sistema ? sistema.descricao : "") + "</textarea></label>" +
        '<label class="field"><span class="field__label">Cor</span><input class="input input--color" type="color" name="cor" value="' + (sistema ? sistema.cor : "#0B6B57") + '"></label>' +
        '<label class="field"><span class="field__label">Situação</span><select class="select" name="ativo">' +
          '<option value="1"' + (!sistema || sistema.ativo ? " selected" : "") + ">Ativo</option>" +
          '<option value="0"' + (sistema && !sistema.ativo ? " selected" : "") + ">Arquivado</option>" +
        "</select></label></form>",
      footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn btn--primary" type="button" data-salvar-sistema>Salvar sistema</button>'
    });
    var form = m.el.querySelector("#sistema-form");
    m.el.querySelector("[data-salvar-sistema]").addEventListener("click", function (e) {
      if (!form.reportValidity()) return;
      var btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add("is-loading");
      api.configuracoes.salvarSistema({
        id: sistema ? sistema.id : null,
        nome: form.elements.nome.value.trim(),
        descricao: form.elements.descricao.value.trim(),
        cor: form.elements.cor.value,
        ativo: form.elements.ativo.value === "1"
      }).then(function () {
        m.close();
        ui.toast(editando ? "Sistema atualizado." : "Sistema criado.", "success");
        carregar();
      }).catch(function (err) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        ui.toast(err.message || "Não foi possível salvar o sistema.", "error");
      });
    });
  }

  /* Origens ---------------------------------------------------------------- */

  function renderOrigens() {
    el("lista-origens").innerHTML = config.origens.map(function (o) {
      return '<div class="settings-item' + (!o.ativo ? " is-inactive" : "") + '">' +
        '<span class="settings-item__dot" style="background:' + (o.ativo ? "var(--brand-500)" : "var(--neutral-400)") + '"></span>' +
        '<div class="settings-item__main"><strong>' + u.escaparHTML(o.nome) + (o.ativo ? "" : ' <span class="badge badge--neutral">Inativa</span>') + "</strong></div>" +
        '<div class="settings-item__actions">' +
          '<button class="icon-btn icon-btn--sm" type="button" data-origem-edit="' + o.id + '" title="Editar">' + ui.icone("pencil") + "</button>" +
          '<button class="icon-btn icon-btn--sm" type="button" data-origem-del="' + o.id + '" title="Remover">' + ui.icone("trash") + "</button>" +
        "</div></div>";
    }).join("") || '<div class="empty empty--compact"><p>Nenhuma origem cadastrada.</p></div>';
  }

  function abrirOrigem(origem) {
    var editando = !!origem;
    var m = ui.modal({
      title: editando ? "Editar origem" : "Nova origem",
      size: "sm",
      body: '<form id="origem-form" class="form-grid">' +
        '<label class="field field--full"><span class="field__label">Nome <em class="field__req">*</em></span><input class="input" name="nome" value="' + u.escaparHTML(origem ? origem.nome : "") + '" placeholder="Ex.: Feira / evento"></label>' +
        '<label class="field field--full"><span class="field__label">Situação</span><select class="select" name="ativo">' +
          '<option value="1"' + (!origem || origem.ativo ? " selected" : "") + ">Ativa</option>" +
          '<option value="0"' + (origem && !origem.ativo ? " selected" : "") + ">Inativa</option>" +
        "</select></label></form>",
      footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn btn--primary" type="button" data-salvar-origem>Salvar origem</button>'
    });
    var form = m.el.querySelector("#origem-form");
    m.el.querySelector("[data-salvar-origem]").addEventListener("click", function (e) {
      if (!form.reportValidity()) return;
      var btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add("is-loading");
      api.configuracoes.salvarOrigem({
        id: origem ? origem.id : null,
        nome: form.elements.nome.value.trim(),
        ativo: form.elements.ativo.value === "1"
      }).then(function () {
        m.close();
        ui.toast(editando ? "Origem atualizada." : "Origem criada.", "success");
        carregar();
      }).catch(function (err) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        ui.toast(err.message || "Não foi possível salvar a origem.", "error");
      });
    });
  }

  /* Equipe ----------------------------------------------------------------- */

  function renderEquipe() {
    el("lista-equipe").innerHTML = config.equipe.map(function (m) {
      var badge = m.status === "ativo"
        ? '<span class="badge badge--success">Ativo</span>'
        : '<span class="badge badge--warning">Convite pendente</span>';
      return '<div class="settings-item">' +
        '<span class="avatar avatar--sm ' + u.tomAvatar(m.nome) + '">' + u.escaparHTML(m.iniciais || u.iniciais(m.nome)) + "</span>" +
        '<div class="settings-item__main"><strong>' + u.escaparHTML(m.nome) + "</strong><small>" + u.escaparHTML(m.email) + " · " + u.escaparHTML(m.perfil) + "</small></div>" +
        badge +
        '<div class="settings-item__actions">' +
          '<button class="icon-btn icon-btn--sm" type="button" data-membro-del="' + m.id + '" title="Remover"' + (m.id === "us_001" ? " disabled" : "") + ">" + ui.icone("trash") + "</button>" +
        "</div></div>";
    }).join("") || '<div class="empty empty--compact"><p>Nenhum membro na equipe.</p></div>';
  }

  function abrirConvite() {
    var m = ui.modal({
      title: "Convidar membro",
      subtitle: "O convite ficará pendente até o primeiro acesso.",
      size: "sm",
      body: '<form id="membro-form" class="form-grid">' +
        '<label class="field field--full"><span class="field__label">Nome <em class="field__req">*</em></span><input class="input" name="nome" placeholder="Nome completo"></label>' +
        '<label class="field field--full"><span class="field__label">E-mail <em class="field__req">*</em></span><input class="input" type="email" name="email" placeholder="nome@assinasoft.com.br"></label>' +
        '<label class="field field--full"><span class="field__label">Perfil</span><select class="select" name="perfil">' +
          '<option>Consultor comercial</option><option>Consultora comercial</option><option>Administrador</option><option>Gestor comercial</option>' +
        "</select></label></form>",
      footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button><button class="btn btn--primary" type="button" data-convidar>' + ui.icone("user-plus") + 'Enviar convite</button>'
    });
    var form = m.el.querySelector("#membro-form");
    m.el.querySelector("[data-convidar]").addEventListener("click", function (e) {
      if (!form.reportValidity()) return;
      var btn = e.currentTarget;
      btn.disabled = true;
      btn.classList.add("is-loading");
      api.configuracoes.convidar({
        nome: form.elements.nome.value.trim(),
        email: form.elements.email.value.trim(),
        perfil: form.elements.perfil.value
      }).then(function () {
        m.close();
        ui.toast("Convite registrado para o novo membro.", "success");
        carregar();
      }).catch(function (err) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        ui.toast(err.message || "Não foi possível convidar.", "error");
      });
    });
  }

  /* Dados ------------------------------------------------------------------ */

  /* Eventos ---------------------------------------------------------------- */

  function bind() {
    document.querySelectorAll("[data-salvar]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var secao = btn.getAttribute("data-salvar");
        var form = el(secao === "empresa" ? "form-empresa" : "form-mensagens");
        salvarSecao(secao, form, btn);
      });
    });

    el("lista-etapas").addEventListener("click", function (e) {
      var up = e.target.closest("[data-etapa-up]");
      var down = e.target.closest("[data-etapa-down]");
      var edit = e.target.closest("[data-etapa-edit]");
      var del = e.target.closest("[data-etapa-del]");
      var lista = ordenarEtapas();
      if (up || down) {
        var id = (up || down).getAttribute(up ? "data-etapa-up" : "data-etapa-down");
        var idx = lista.findIndex(function (x) { return x.id === id; });
        var destino = up ? idx - 1 : idx + 1;
        if (destino < 0 || destino >= lista.length) return;
        var tmp = lista[idx];
        lista[idx] = lista[destino];
        lista[destino] = tmp;
        api.configuracoes.reordenarEtapas(lista.map(function (x) { return x.id; })).then(function () {
          ui.toast("Ordem do funil atualizada.", "success");
          carregar();
        }).catch(function (err) { ui.toast(err.message, "error"); });
        return;
      }
      if (edit) {
        var etapa = lista.filter(function (x) { return x.id === edit.getAttribute("data-etapa-edit"); })[0];
        if (etapa) abrirEtapa(etapa);
        return;
      }
      if (del) {
        var alvo = lista.filter(function (x) { return x.id === del.getAttribute("data-etapa-del"); })[0];
        if (!alvo) return;
        ui.confirmar({
          titulo: "Excluir etapa",
          texto: "Excluir a etapa <strong>" + u.escaparHTML(alvo.nome) + "</strong>? Os leads nela serão movidos para outra etapa aberta.",
          acao: "Excluir etapa",
          perigo: true
        }).then(function (ok) {
          if (!ok) return;
          api.configuracoes.removerEtapa(alvo.id).then(function (res) {
            ui.toast("Etapa excluída. " + res.movidos + " lead(s) movido(s) para " + res.destino + ".", "success");
            carregar();
          }).catch(function (err) { ui.toast(err.message, "error"); });
        });
      }
    });

    document.querySelector("[data-add-etapa]").addEventListener("click", function () { abrirEtapa(null); });

    el("lista-sistemas").addEventListener("click", function (e) {
      var edit = e.target.closest("[data-sistema-edit]");
      var del = e.target.closest("[data-sistema-del]");
      if (edit) {
        var s = config.sistemas.filter(function (x) { return x.id === edit.getAttribute("data-sistema-edit"); })[0];
        if (s) abrirSistema(s);
      }
      if (del) {
        var alvo = config.sistemas.filter(function (x) { return x.id === del.getAttribute("data-sistema-del"); })[0];
        if (!alvo) return;
        ui.confirmar({
          titulo: "Remover sistema",
          texto: "Remover <strong>" + u.escaparHTML(alvo.nome) + "</strong>? Se houver leads usando este sistema, ele será apenas arquivado.",
          acao: "Remover",
          perigo: true
        }).then(function (ok) {
          if (!ok) return;
          api.configuracoes.removerSistema(alvo.id).then(function (res) {
            ui.toast(res.arquivado ? "Sistema arquivado (em uso por leads)." : "Sistema removido.", "success");
            carregar();
          }).catch(function (err) { ui.toast(err.message, "error"); });
        });
      }
    });
    document.querySelector("[data-add-sistema]").addEventListener("click", function () { abrirSistema(null); });

    el("lista-origens").addEventListener("click", function (e) {
      var edit = e.target.closest("[data-origem-edit]");
      var del = e.target.closest("[data-origem-del]");
      if (edit) {
        var o = config.origens.filter(function (x) { return x.id === edit.getAttribute("data-origem-edit"); })[0];
        if (o) abrirOrigem(o);
      }
      if (del) {
        var alvo = config.origens.filter(function (x) { return x.id === del.getAttribute("data-origem-del"); })[0];
        if (!alvo) return;
        ui.confirmar({
          titulo: "Remover origem",
          texto: "Remover <strong>" + u.escaparHTML(alvo.nome) + "</strong>? Origens em uso serão apenas desativadas.",
          acao: "Remover",
          perigo: true
        }).then(function (ok) {
          if (!ok) return;
          api.configuracoes.removerOrigem(alvo.id).then(function (res) {
            ui.toast(res.arquivado ? "Origem desativada (em uso por leads)." : "Origem removida.", "success");
            carregar();
          }).catch(function (err) { ui.toast(err.message, "error"); });
        });
      }
    });
    document.querySelector("[data-add-origem]").addEventListener("click", function () { abrirOrigem(null); });

    el("lista-equipe").addEventListener("click", function (e) {
      var del = e.target.closest("[data-membro-del]");
      if (!del) return;
      var m = config.equipe.filter(function (x) { return x.id === del.getAttribute("data-membro-del"); })[0];
      if (!m) return;
      ui.confirmar({
        titulo: "Remover membro",
        texto: "Remover <strong>" + u.escaparHTML(m.nome) + "</strong> da equipe? Os leads continuarão com o nome registrado no histórico.",
        acao: "Remover",
        perigo: true
      }).then(function (ok) {
        if (!ok) return;
        api.configuracoes.removerMembro(m.id).then(function () {
          ui.toast("Membro removido.", "success");
          carregar();
        }).catch(function (err) { ui.toast(err.message, "error"); });
      });
    });
    document.querySelector("[data-add-membro]").addEventListener("click", abrirConvite);

    document.querySelector("[data-sair]").addEventListener("click", function () { Painel.auth.sair(); });

    var links = Array.prototype.slice.call(document.querySelectorAll(".settings-nav a"));

    function ativarLink(alvo) {
      links.forEach(function (x) { x.classList.toggle("is-active", x === alvo); });
    }

    function linkDoHash() {
      var hash = window.location.hash;
      if (!hash) return null;
      return links.filter(function (a) { return a.getAttribute("href") === hash; })[0] || null;
    }

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var alvo = document.querySelector(a.getAttribute("href"));
        if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
        ativarLink(a);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", a.getAttribute("href"));
        }
      });
    });

    var inicial = linkDoHash();
    if (inicial) ativarLink(inicial);

    window.addEventListener("hashchange", function () {
      var alvo = linkDoHash();
      if (!alvo) return;
      ativarLink(alvo);
      var secao = document.querySelector(alvo.getAttribute("href"));
      if (secao) secao.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    window.addEventListener("scroll", function () {
      var pos = window.scrollY + 140;
      var atual = links[0];
      links.forEach(function (a) {
        var secao = document.querySelector(a.getAttribute("href"));
        if (secao && secao.offsetTop <= pos) atual = a;
      });
      ativarLink(atual);
    }, { passive: true });
  }

  bind();
  carregar();
})(window.Painel);
