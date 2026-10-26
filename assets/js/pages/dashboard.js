/* ==========================================================================
   Painel Comercial — Dashboard operacional
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var api = Painel.api;
  var ui = Painel.ui;
  var leadUI = Painel.leadUI;

  var CONVERSAS = {
    sem_mensagem: {
      titulo: "Sem mensagem enviada",
      desc: "Contatos ainda não abordados e fora da etapa Contatado.",
      vazio: "Todos os contatos já foram abordados."
    },
    aguardando: {
      titulo: "Aguardando resposta",
      desc: "Contato já abordado (pelo sistema ou manualmente) e ainda sem resposta.",
      vazio: "Nenhum contato aguardando resposta."
    },
    responder: {
      titulo: "Preciso responder",
      desc: "O contato respondeu e a próxima mensagem é sua.",
      vazio: "Nenhuma resposta pendente. Bom trabalho!"
    },
    abertas: {
      titulo: "Conversas em aberto",
      desc: "Contatos que já responderam e seguem em conversa.",
      vazio: "Nenhuma conversa em aberto."
    },
    clientes: {
      titulo: "Clientes",
      desc: "Contatos que fecharam negócio.",
      vazio: "Nenhum cliente fechado ainda."
    },
    recusados: {
      titulo: "Recusados e não contatar",
      desc: "Contatos que recusaram ou pediram para não receber mensagens.",
      vazio: "Nenhum contato recusado."
    }
  };

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

  function renderResumo(dados) {
    var valores = {
      total: dados.stats.total,
      semMensagem: dados.conversas.semMensagem,
      aguardando: dados.conversas.aguardando,
      precisoResponder: dados.conversas.precisoResponder,
      conversasAbertas: dados.conversas.conversasAbertas,
      clientes: dados.conversas.clientes,
      recusados: dados.conversas.recusados
    };
    Object.keys(valores).forEach(function (k) {
      document.querySelectorAll('[data-conv="' + k + '"]').forEach(function (node) {
        node.textContent = u.formatarNumero(valores[k]);
      });
    });
    var total = document.querySelector("[data-base-total]");
    if (total) total.textContent = u.formatarNumero(dados.stats.total) + " contato(s) na base";
  }

  function renderAlerta(dados) {
    var alerta = el("dash-alerta");
    var link = el("dash-alerta-link");
    if (!alerta || !link) return;
    if (dados.conversas.precisoResponder > 0) {
      alerta.hidden = false;
      el("dash-alerta-texto").innerHTML = "<strong>" + dados.conversas.precisoResponder + " contato(s) responderam e aguardam você.</strong> Responda enquanto a conversa está quente.";
      link.textContent = "Ver contatos";
      link.setAttribute("href", "#");
      link.setAttribute("data-abrir-conversa", "responder");
    } else if (dados.stats.atrasados > 0) {
      alerta.hidden = false;
      el("dash-alerta-texto").innerHTML = "<strong>" + dados.stats.atrasados + " follow-up(s) atrasado(s).</strong> Retome o contato para não esfriar a oportunidade.";
      link.textContent = "Ver follow-ups";
      link.removeAttribute("data-abrir-conversa");
      link.setAttribute("href", "followups.html");
    } else if (dados.stats.followupsHoje > 0) {
      alerta.hidden = false;
      el("dash-alerta-texto").innerHTML = "<strong>" + dados.stats.followupsHoje + " follow-up(s) para hoje.</strong> Veja a agenda comercial e organize o dia.";
      link.textContent = "Abrir agenda";
      link.removeAttribute("data-abrir-conversa");
      link.setAttribute("href", "followups.html");
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
    renderResumo(dados);
    renderAlerta(dados);
    renderTarefas(dados);
    renderCampanhas(dados);
  }

  function carregar() {
    return api.dashboard.obter("30").then(render).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar o painel.", "error");
    });
  }

  /* Lista por card --------------------------------------------------------- */

  function resumoUltima(lead) {
    var msg = lead.conversa && lead.conversa.ultimaMensagem;
    if (!msg || !msg.texto) return "Nenhuma mensagem registrada.";
    return (msg.direcao === "entrada" ? "Recebida: " : "Enviada: ") + u.truncar(msg.texto.replace(/\s+/g, " "), 90);
  }

  function linhaConversa(lead) {
    var conversa = lead.conversa;
    var status = conversa.status;
    var podeResponder = ["sem_mensagem", "aguardando", "responder", "em_conversa"].indexOf(status) !== -1;
    var podeEnviar = conversa.podeEnviar;
    var ultima = conversa.ultimaMensagemEm;
    return '<article class="conv-row' + (status === "responder" ? " is-action" : "") + '">' +
      '<button class="conv-row__main" type="button" data-conv-open="' + lead.id + '">' +
        '<span class="avatar avatar--sm ' + u.tomAvatar(lead.nome) + '">' + u.escaparHTML(u.iniciais(lead.nome)) + "</span>" +
        '<span class="conv-row__text">' +
          '<span class="conv-row__name"><strong>' + u.escaparHTML(lead.nome) + "</strong>" + leadUI.conversaBadge(status) + "</span>" +
          '<small>' + u.escaparHTML(lead.empresa || "Sem empresa") + " · " + u.formatarTelefone(lead.telefone) + "</small>" +
          '<em>' + u.escaparHTML(resumoUltima(lead)) + "</em>" +
        "</span>" +
      "</button>" +
      '<span class="conv-row__side">' +
        '<time>' + (ultima ? u.tempoRelativo(ultima) : "—") + "</time>" +
        '<span class="conv-row__actions">' +
          (podeEnviar ? '<button class="icon-btn icon-btn--sm" type="button" data-conv-msg="' + lead.id + '" title="Enviar mensagem">' + ui.icone("send") + "</button>" : "") +
          (podeResponder ? '<button class="icon-btn icon-btn--sm" type="button" data-conv-resposta="' + lead.id + '" title="Registrar resposta recebida">' + ui.icone("inbox") + "</button>" : "") +
          '<button class="icon-btn icon-btn--sm" type="button" data-conv-open="' + lead.id + '" title="Abrir contato">' + ui.icone("chevron-right") + "</button>" +
        "</span>" +
      "</span>" +
    "</article>";
  }

  function abrirConversa(tipo) {
    var cfg = CONVERSAS[tipo];
    if (!cfg) return;
    var estado = { q: "", responsavel: "" };
    var lista = null;
    var resultado = null;
    var seqLista = 0;

    Promise.all([
      api.configuracoes.obter(),
      api.dashboard.conversas(tipo, { perPage: 100 })
    ]).then(function (res) {
      resultado = res[1];
      var equipe = (res[0].equipe || []).filter(function (m) { return m.status === "ativo"; });
      var d = ui.drawer({
        title: cfg.titulo,
        subtitle: cfg.desc,
        wide: true,
        body:
          '<div class="conv-toolbar">' +
            '<div class="input-wrap">' + ui.icone("search") +
              '<input class="input" type="search" data-conv-busca placeholder="Buscar por nome, empresa, telefone…" autocomplete="off"></div>' +
            '<button class="btn btn--secondary btn--sm search-submit" type="button" data-conv-pesquisar>' +
              ui.icone("search") + "Pesquisar</button>" +
            '<select class="select select--sm" data-conv-responsavel aria-label="Filtrar por responsável">' +
              '<option value="">Todos os responsáveis</option>' +
              equipe.map(function (m) { return '<option value="' + u.escaparHTML(m.nome) + '">' + u.escaparHTML(m.nome) + "</option>"; }).join("") +
            "</select>" +
          "</div>" +
          '<div class="conv-resumo"><strong data-conv-total>—</strong> contato(s)' +
            '<span data-conv-lote-wrap></span></div>' +
          '<div data-conv-list><div class="conv-loading"><span class="skeleton" style="height:12px;width:60%"></span></div></div>',
        footer: '<span class="small faint">Clique em um contato para abrir o histórico completo.</span>' +
          '<span class="spacer"></span><button class="btn btn--secondary" type="button" data-close>Fechar</button>'
      });

      lista = d.el.querySelector("[data-conv-list]");

      function renderLista() {
        var itens = resultado.data || [];
        var total = d.el.querySelector("[data-conv-total]");
        if (total) total.textContent = u.formatarNumero(resultado.total);
        var loteWrap = d.el.querySelector("[data-conv-lote-wrap]");
        var elegiveis = itens.filter(function (l) {
          return l.conversa.podeEnviar && l.etapa && l.etapa.tipo === "aberto";
        });
        if (loteWrap) {
          loteWrap.innerHTML = elegiveis.length && tipo !== "recusados"
            ? '<button class="text-link xs" type="button" data-conv-lote="' + elegiveis.map(function (l) { return l.id; }).join(",") + '">Enviar mensagem para os ' + elegiveis.length + "</button>"
            : "";
        }

        if (!itens.length) {
          lista.innerHTML = '<div class="empty empty--compact"><span class="empty__icon">' + ui.icone("inbox") + "</span><h3>Nada por aqui</h3><p>" + u.escaparHTML(cfg.vazio) + "</p></div>";
          return;
        }
        lista.innerHTML = '<div class="conv-list">' + itens.map(linhaConversa).join("") + "</div>";
      }

      function carregarLista() {
        var seq = ++seqLista;
        return api.dashboard.conversas(tipo, { q: estado.q, responsavel: estado.responsavel, perPage: 100 }).then(function (novo) {
          if (seq !== seqLista) return;
          resultado = novo;
          renderLista();
        }).catch(function (err) {
          if (seq !== seqLista) return;
          ui.toast(err.message || "Não foi possível carregar os contatos.", "error");
        });
      }

      var convBusca = d.el.querySelector("[data-conv-busca]");
      var convBuscaDebounce = u.debounce(function () {
        estado.q = convBusca.value;
        carregarLista();
      }, 220);
      convBusca.addEventListener("input", convBuscaDebounce);

      function pesquisarConversasAgora() {
        convBuscaDebounce.cancel();
        estado.q = convBusca.value;
        carregarLista();
      }

      convBusca.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        pesquisarConversasAgora();
      });
      d.el.querySelector("[data-conv-pesquisar]").addEventListener("click", pesquisarConversasAgora);

      d.el.querySelector("[data-conv-responsavel]").addEventListener("change", function (e) {
        estado.responsavel = e.target.value;
        carregarLista();
      });

      d.el.addEventListener("click", function (e) {
        var lote = e.target.closest("[data-conv-lote]");
        if (lote) {
          window.location.href = "mensagens.html?leads=" + lote.getAttribute("data-conv-lote");
          return;
        }
        var abrir = e.target.closest("[data-conv-open]");
        if (abrir) {
          leadUI.abrirDetalhe(abrir.getAttribute("data-conv-open"), {
            onChanged: function () { carregarLista(); carregar(); }
          });
          return;
        }
        var msg = e.target.closest("[data-conv-msg]");
        if (msg) {
          leadUI.abrirMensagem(msg.getAttribute("data-conv-msg"), {
            onSent: function () { carregarLista(); carregar(); }
          });
          return;
        }
        var resposta = e.target.closest("[data-conv-resposta]");
        if (resposta) {
          leadUI.abrirResposta(resposta.getAttribute("data-conv-resposta"), {
            onSaved: function () { carregarLista(); carregar(); }
          });
        }
      });

      renderLista();
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível abrir a lista.", "error");
    });
  }

  /* Eventos ---------------------------------------------------------------- */

  function bind() {
    document.addEventListener("click", function (e) {
      var card = e.target.closest("[data-conversa]");
      if (card) {
        abrirConversa(card.getAttribute("data-conversa"));
        return;
      }
      var alerta = e.target.closest("[data-abrir-conversa]");
      if (alerta) {
        e.preventDefault();
        abrirConversa(alerta.getAttribute("data-abrir-conversa"));
        return;
      }
      var leadRow = e.target.closest("[data-lead]");
      if (leadRow) {
        leadUI.abrirDetalhe(leadRow.getAttribute("data-lead"), { onChanged: carregar });
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
