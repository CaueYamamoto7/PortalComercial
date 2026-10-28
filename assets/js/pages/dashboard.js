/* ==========================================================================
   Portal Comercial — Dashboard operacional
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var api = Painel.api;
  var ui = Painel.ui;
  var leadUI = Painel.leadUI;
  var periodo = "30";
  var ultimaCarga = 0;
  var ultimosDados = null;

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
      desc: "Contatos que já responderam ou estão na etapa Proposta, exceto os marcados como não contatar.",
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
      registrada: { label: "Registrada", cls: "badge--neutral" },
      concluida: { label: "Concluída", cls: "badge--success" },
      em_andamento: { label: "Em andamento", cls: "badge--info" },
      agendada: { label: "Agendada", cls: "badge--warning" },
      falha: { label: "Falha", cls: "badge--danger" },
      cancelada: { label: "Cancelada", cls: "badge--neutral" }
    };
    return mapa[status] || { label: "Não informado", cls: "badge--neutral" };
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
    document.querySelectorAll(".dashboard [data-conversa]").forEach(function (card) {
      var node = card.querySelector("[data-conv]");
      var valor = valores[node.getAttribute("data-conv")];
      var foot = card.querySelector(".conv-card__foot");
      if (!foot) {
        foot = document.createElement("span");
        foot.className = "conv-card__foot";
        card.appendChild(foot);
      }
      var percentual = dados.stats.total ? (valor / dados.stats.total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0";
      foot.innerHTML = '<span><strong>' + percentual + '%</strong> da base</span>' + ui.icone("arrow-up-right");
    });
    if (total) total.textContent = u.formatarNumero(dados.stats.total) + " contato(s) criado(s) no período · categorias dos cards podem se sobrepor";
  }

  function renderAlerta(dados) {
    var alerta = el("dash-alerta");
    var link = el("dash-alerta-link");
    if (!alerta || !link) return;
    if (dados.pendencias > 0) {
      alerta.hidden = false;
      el("dash-alerta-texto").innerHTML = "<strong>" + dados.pendencias + " contato(s) aguardam sua resposta.</strong> Retome as conversas e não deixe oportunidades esperando.";
      link.textContent = "Ver contatos";
      link.setAttribute("href", "#");
      link.setAttribute("data-abrir-conversa", "responder");
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
    var tarefas = dados.acoesHoje || [];
    el("acoes-total").textContent = dados.acoesHojeTotal;
    if (!tarefas.length) {
      list.innerHTML = '<div class="empty empty--compact"><span class="empty__icon">' + ui.icone("check-circle") + '</span><h3>Agenda em dia</h3><p>Nenhum follow-up para hoje ou atrasado.</p></div>';
    } else {
      list.innerHTML = '<div class="dashboard-table-wrap" role="region" aria-label="Follow-ups de hoje e atrasados" tabindex="0"><table class="dashboard-table"><thead><tr><th scope="col">Contato</th><th scope="col">Ação</th><th scope="col">Campanha</th><th scope="col">Data / hora</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Concluir</span></th></tr></thead><tbody>' + tarefas.map(function (t) {
        var atrasada = t.atrasada;
        var nome = t.lead ? t.lead.nome : "Contato";
        return '<tr><td><button class="dashboard-contact" type="button" data-lead="' + u.escaparHTML(t.leadId) + '"><span class="avatar avatar--sm ' + u.tomAvatar(nome) + '">' + u.escaparHTML(u.iniciais(nome)) + '</span><span><strong>' + u.escaparHTML(nome) + '</strong><small>' + u.escaparHTML(t.lead && t.lead.empresa || "Sem empresa") + '</small></span></button></td>' +
          '<td><span class="dashboard-action">' + ui.icone(tipoIcone(t.tipo)) + u.escaparHTML(t.titulo) + '</span></td>' +
          '<td><span title="Follow-ups não possuem vínculo com campanhas">—</span></td>' +
          '<td class="dashboard-task-date">' + dataCurta(t.data) + '<small>' + hora(t.data) + '</small></td>' +
          '<td><span class="dashboard-task-status' + (atrasada ? ' is-late' : '') + '">' + (atrasada ? 'Atrasado' : 'Pendente') + '</span></td>' +
          '<td><label class="task-check" title="Concluir follow-up"><input type="checkbox" data-concluir="' + u.escaparHTML(t.id) + '" aria-label="Concluir ' + u.escaparHTML(t.titulo) + '"><span>' + ui.icone("check") + '</span></label></td></tr>';
      }).join("") + '</tbody></table></div>';
    }
    var total = el("tarefas-total");
    if (total) total.textContent = (dados.acoesHojeTotal > tarefas.length ? "Exibindo " + tarefas.length + " de " + dados.acoesHojeTotal + " ações · " : "") + dados.tarefasTotal + " follow-up(s) pendente(s) na agenda";
    el("proximas-acoes").innerHTML = (dados.proximasAcoes || []).map(function (t) {
      var date = new Date(t.data);
      return '<div class="dashboard-next-item"><span class="dashboard-next-item__date"><strong>' + date.getDate() + '</strong><small>' + date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") + '</small></span><button class="dashboard-next-item__main" type="button" data-lead="' + u.escaparHTML(t.leadId) + '"><strong>' + u.escaparHTML(t.titulo) + '</strong><small>' + u.escaparHTML(t.lead ? t.lead.nome : "Contato") + '</small><span>' + hora(t.data) + ' · ' + u.escaparHTML(t.responsavel || "Sem responsável") + '</span></button><label class="task-check" title="Concluir follow-up"><input type="checkbox" data-concluir="' + u.escaparHTML(t.id) + '" aria-label="Concluir ' + u.escaparHTML(t.titulo) + '"><span>' + ui.icone("check") + '</span></label></div>';
    }).join("") || '<div class="empty empty--compact"><h3>Espaço para novas oportunidades</h3><p>Nenhum follow-up agendado a partir de amanhã.</p></div>';
  }

  function dataCurta(data) { return data ? new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"; }
  function hora(data) { return data ? new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"; }

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
        '<span class="campaign-mini__text"><strong>' + u.escaparHTML(c.nome) + "</strong><small>" + u.formatarNumero(c.publico) + " contato(s) · " + u.escaparHTML(c.canal) + "</small></span>" +
        '<span class="campaign-mini__meta"><time datetime="' + u.escaparHTML(c.criadaEm || "") + '">' + dataCurta(c.criadaEm) + ' · ' + hora(c.criadaEm) + '</time><span class="badge ' + st.cls + '">' + st.label + "</span></span></a>";
    }).join("");
  }

  function render(dados) {
    renderResumo(dados);
    renderAlerta(dados);
    renderTarefas(dados);
    renderCampanhas(dados);
    Painel.dashboardCharts.render(dados.metricas);
  }

  function carregar() {
    var seq = ++ultimaCarga;
    var main = el("dashboard");
    main.classList.add("is-refreshing");
    main.setAttribute("aria-busy", "true");
    el("dashboard-erro").hidden = true;
    el("dashboard-status").textContent = "Atualizando painel…";
    return api.dashboard.obter(periodo).then(function (dados) {
      if (seq !== ultimaCarga) return;
      ultimosDados = dados;
      render(dados);
      el("dashboard-status").textContent = "Painel atualizado. Últimos " + periodo + " dias.";
    }).catch(function (err) {
      if (seq !== ultimaCarga) return;
      el("dashboard-erro").hidden = false;
      el("dashboard-status").textContent = "Falha ao atualizar. Os dados anteriores, quando disponíveis, foram mantidos.";
      ui.toast(err.message || "Não foi possível carregar o painel.", "error");
      if (ultimosDados) return;
      el("lista-tarefas").innerHTML = '<div class="empty empty--compact"><p>Não foi possível carregar as tarefas.</p></div>';
      el("tarefas-total").textContent = "Dados indisponíveis";
      el("lista-campanhas").innerHTML = '<div class="empty empty--compact"><p>Não foi possível carregar as mensagens.</p></div>';
      el("proximas-acoes").innerHTML = '<div class="empty empty--compact"><p>Agenda indisponível.</p></div>';
      el("grafico-evolucao").innerHTML = '<div class="empty empty--compact"><p>Não foi possível carregar o gráfico.</p></div>';
      el("legenda-distribuicao").innerHTML = '<li>Distribuição indisponível</li>';
    }).then(function () {
      if (seq !== ultimaCarga) return;
      main.classList.remove("is-refreshing");
      main.setAttribute("aria-busy", "false");
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

  function abrirConversa(tipo, todasPendencias) {
    var cfg = CONVERSAS[tipo];
    if (!cfg) return;
    var estado = { q: "", responsavel: "" };
    var lista = null;
    var resultado = null;
    var seqLista = 0;

    Promise.all([
      api.configuracoes.obter(),
      api.dashboard.conversas(tipo, { perPage: 100, periodo: todasPendencias ? undefined : periodo })
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
        return api.dashboard.conversas(tipo, { q: estado.q, responsavel: estado.responsavel, perPage: 100, periodo: todasPendencias ? undefined : periodo }).then(function (novo) {
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
        abrirConversa(alerta.getAttribute("data-abrir-conversa"), true);
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
        check.checked = false;
        ui.toast(err.message || "Não foi possível concluir a tarefa.", "error");
      });
    });

    document.querySelectorAll(".dashboard [data-nova-tarefa]").forEach(function (nova) {
      nova.addEventListener("click", function () {
        leadUI.abrirTarefa({ onSaved: function () { carregar(); } });
      });
    });
    document.querySelectorAll(".dashboard [data-periodo]").forEach(function (select) {
      select.addEventListener("change", function () {
        periodo = select.value;
        document.querySelectorAll(".dashboard [data-periodo]").forEach(function (outro) { outro.value = periodo; });
        carregar();
      });
    });
    document.querySelector("[data-dash-retry]").addEventListener("click", carregar);
    var chart = el("grafico-evolucao");
    if (window.ResizeObserver) {
      var largura = 0;
      new ResizeObserver(u.debounce(function () {
        if (!ultimosDados || chart.clientWidth === largura) return;
        largura = chart.clientWidth;
        Painel.dashboardCharts.linhas(chart, ultimosDados.metricas.serie);
      }, 120)).observe(chart);
    }
  }

  bind();
  carregar();
})(window.Painel);
