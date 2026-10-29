/* ==========================================================================
   Portal Comercial — Componentes de lead
   Formulário, detalhe, mensagem individual, tarefas e mudança de etapa.
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var icone = Painel.icons.icone;
  var cacheListas = null;

  function obterListas() {
    if (cacheListas) return Promise.resolve(cacheListas);
    return Painel.api.configuracoes.obter().then(function (cfg) {
      cacheListas = {
        etapas: cfg.etapas,
        sistemas: cfg.sistemas.filter(function (s) { return s.ativo; }),
        origens: cfg.origens.filter(function (o) { return o.ativo; }),
        equipe: cfg.equipe.filter(function (m) { return m.status === "ativo"; })
      };
      return cacheListas;
    });
  }

  function invalidarListas() {
    cacheListas = null;
  }

  function opcoes(lista, selecionado, placeholder) {
    return (placeholder ? '<option value="">' + u.escaparHTML(placeholder) + "</option>" : "") +
      (lista || []).map(function (item) {
        var valor = item.id !== undefined ? item.id : item.nome;
        var label = item.nome !== undefined ? item.nome : item.label;
        return '<option value="' + u.escaparHTML(valor) + '"' + (String(valor) === String(selecionado || "") ? " selected" : "") + ">" + u.escaparHTML(label) + "</option>";
      }).join("");
  }

  function etapaBadge(etapa) {
    if (!etapa) return "";
    var cor = u.corSegura(etapa.cor, "#64748B");
    return '<span class="badge badge--etapa" style="color:' + cor + ";background:" + cor + '18;border-color:' + cor + '33">' +
      '<span class="badge__dot" style="background:' + cor + '"></span>' + u.escaparHTML(etapa.nome) + "</span>";
  }

  function prioridadeBadge(prioridade) {
    var mapa = {
      alta: { label: "Alta", cls: "badge--danger" },
      media: { label: "Média", cls: "badge--warning" },
      baixa: { label: "Baixa", cls: "badge--neutral" }
    };
    var p = mapa[prioridade] || mapa.media;
    return '<span class="badge ' + p.cls + '">' + p.label + "</span>";
  }

  var CONVERSA = {
    sem_mensagem: { label: "Sem mensagem enviada", cls: "badge--neutral" },
    aguardando: { label: "Aguardando resposta", cls: "badge--warning" },
    responder: { label: "Precisa de resposta", cls: "badge--danger" },
    em_conversa: { label: "Em conversa", cls: "badge--info" },
    cliente: { label: "Cliente", cls: "badge--success" },
    recusado: { label: "Não enviar", cls: "badge--danger" }
  };

  function conversaBadge(status) {
    var c = CONVERSA[status] || CONVERSA.sem_mensagem;
    return '<span class="badge ' + c.cls + '">' + c.label + "</span>";
  }

  function sistemaChips(sistemas, max) {
    var lista = sistemas || [];
    var limite = max || lista.length;
    var visiveis = lista.slice(0, limite);
    var html = visiveis.map(function (s) {
      return '<span class="tag tag--sistema"><i style="background:' + u.corSegura(s.cor, "#0B6B57") + '"></i>' + u.escaparHTML(s.nome) + "</span>";
    }).join("");
    if (lista.length > limite) html += '<span class="tag tag--muted">+' + (lista.length - limite) + "</span>";
    return html || '<span class="faint xs">Não informado</span>';
  }

  function avatar(nome, grande) {
    return '<span class="avatar ' + (grande ? "avatar--lg " : "") + u.tomAvatar(nome) + '">' + u.escaparHTML(u.iniciais(nome)) + "</span>";
  }

  function linhaInfo(ico, label, valor, href) {
    var conteudo = valor
      ? (href ? '<a href="' + u.escaparHTML(href) + '">' + u.escaparHTML(valor) + "</a>" : u.escaparHTML(valor))
      : '<span class="faint">Não informado</span>';
    return '<div class="detail-info">' + icone(ico) + '<span><small>' + label + "</small><strong>" + conteudo + "</strong></span></div>";
  }

  /* Formulário ------------------------------------------------------------- */

  function formularioHTML(lead, listas) {
    lead = lead || {};
    var editando = !!lead.id;
    var possui = lead.possuiSistema || "nao_informado";
    var sistemasSelecionados = lead.sistemaIds || [];
    return '<form id="lead-form" class="lead-form" novalidate>' +
      '<div class="form-section">' +
        '<div class="form-section__title">Contato</div>' +
        '<div class="form-grid">' +
          '<label class="field field--full" data-field="nome"><span class="field__label">Nome <em class="field__req">*</em></span>' +
            '<input class="input" name="nome" value="' + u.escaparHTML(lead.nome || "") + '" placeholder="Nome completo" autocomplete="off">' +
            '<span class="field__error"></span></label>' +
          '<label class="field" data-field="empresa"><span class="field__label">Empresa</span>' +
            '<input class="input" name="empresa" value="' + u.escaparHTML(lead.empresa || "") + '" placeholder="Nome da empresa"></label>' +
          '<label class="field"><span class="field__label">Cargo</span>' +
            '<input class="input" name="cargo" value="' + u.escaparHTML(lead.cargo || "") + '" placeholder="Cargo ou função"></label>' +
          '<label class="field" data-field="telefone"><span class="field__label">WhatsApp <em class="field__req">*</em></span>' +
            '<input class="input" name="telefone" value="' + u.escaparHTML(lead.telefone ? u.formatarTelefone(lead.telefone) : "") + '" placeholder="(11) 99999-9999" inputmode="tel">' +
            '<span class="field__error"></span></label>' +
          '<label class="field" data-field="email"><span class="field__label">E-mail</span>' +
            '<input class="input" type="email" name="email" value="' + u.escaparHTML(lead.email || "") + '" placeholder="nome@empresa.com.br">' +
            '<span class="field__error"></span></label>' +
          '<label class="field"><span class="field__label">Cidade</span>' +
            '<input class="input" name="cidade" value="' + u.escaparHTML(lead.cidade || "") + '" placeholder="Cidade"></label>' +
          '<label class="field"><span class="field__label">UF</span>' +
            '<input class="input" name="uf" maxlength="2" value="' + u.escaparHTML(lead.uf || "") + '" placeholder="SP" style="text-transform:uppercase"></label>' +
        "</div>" +
      "</div>" +

      '<div class="form-section">' +
        '<div class="form-section__title">Origem e interesse</div>' +
        '<div class="form-grid">' +
          '<label class="field"><span class="field__label">Origem</span>' +
            '<select class="select" name="origemId">' + opcoes(listas.origens, lead.origemId, "Selecione") + "</select></label>" +
          '<label class="field"><span class="field__label">Detalhe da origem</span>' +
            '<input class="input" name="origemDetalhe" value="' + u.escaparHTML(lead.origemDetalhe || "") + '" placeholder="Ex.: Feira do Empreendedor 2026"></label>' +
          '<div class="field field--full"><span class="field__label">Sistemas de interesse</span>' +
            '<div class="system-picks">' + listas.sistemas.map(function (s) {
              var marcado = sistemasSelecionados.indexOf(s.id) !== -1;
              return '<label class="system-pick' + (marcado ? " is-checked" : "") + '">' +
                '<input type="checkbox" name="sistemaIds" value="' + s.id + '"' + (marcado ? " checked" : "") + ">" +
                '<i style="background:' + u.corSegura(s.cor, "#0B6B57") + '"></i><span>' + u.escaparHTML(s.nome) + "</span>" + icone("check") + "</label>";
            }).join("") + "</div></div>" +
          '<label class="field"><span class="field__label">Já possui sistema parecido?</span>' +
            '<select class="select" name="possuiSistema">' +
              '<option value="nao_informado"' + (possui === "nao_informado" ? " selected" : "") + ">Não informado</option>" +
              '<option value="nao"' + (possui === "nao" ? " selected" : "") + ">Não possui</option>" +
              '<option value="sim"' + (possui === "sim" ? " selected" : "") + ">Sim, possui</option>" +
            "</select></label>" +
          '<label class="field"><span class="field__label">Sistema / fornecedor atual</span>' +
            '<input class="input" name="sistemaAtual" value="' + u.escaparHTML(lead.sistemaAtual || "") + '" placeholder="Ex.: assinatura em outro fornecedor"></label>' +
        "</div>" +
      "</div>" +

      '<div class="form-section">' +
        '<div class="form-section__title">Funil e acompanhamento</div>' +
        '<div class="form-grid">' +
          '<label class="field"><span class="field__label">Etapa</span>' +
            '<select class="select" name="etapaId">' + opcoes(listas.etapas, lead.etapaId, "Selecione") + "</select></label>" +
          '<label class="field"><span class="field__label">Prioridade</span>' +
            '<select class="select" name="prioridade">' +
              '<option value="alta"' + (lead.prioridade === "alta" ? " selected" : "") + ">Alta</option>" +
              '<option value="media"' + (!lead.prioridade || lead.prioridade === "media" ? " selected" : "") + ">Média</option>" +
              '<option value="baixa"' + (lead.prioridade === "baixa" ? " selected" : "") + ">Baixa</option>" +
            "</select></label>" +
          '<label class="field"><span class="field__label">Responsável</span>' +
            '<select class="select" name="responsavel">' + opcoes(listas.equipe, lead.responsavel || "Marina Costa", "Selecione") + "</select></label>" +
          '<label class="field"><span class="field__label">Próximo contato</span>' +
            '<input class="input" type="date" name="proximoContato" value="' + u.paraInputDate(lead.proximoContato) + '"></label>' +
          '<label class="field field--full"><span class="field__label">Tags</span>' +
            '<input class="input" name="tags" value="' + u.escaparHTML((lead.tags || []).join(", ")) + '" placeholder="Separe por vírgula. Ex.: Feira 2026, Quente">' +
            '<span class="field__hint">Ajudam a filtrar e criar públicos para mensagens.</span></label>' +
        "</div>" +
      "</div>" +

      '<div class="form-section">' +
        '<div class="form-section__title">Observações</div>' +
        '<label class="field field--full"><span class="field__label">Anotações internas</span>' +
          '<textarea class="textarea" name="observacoes" rows="4" placeholder="Contexto da conversa, necessidades, objeções...">' + u.escaparHTML(lead.observacoes || "") + "</textarea></label>" +
        (editando ? '<label class="check check--box switch-row" style="margin-top:14px">' +
          '<input type="checkbox" name="naoContatar"' + (lead.naoContatar ? " checked" : "") + ">" +
          '<span class="switch"></span><span class="switch-row__text"><strong>Não contatar</strong>' +
          "<p>Impede o envio de mensagens em campanhas e individuais.</p></span></label>" : "") +
      "</div>" +
      "</form>";
  }

  function marcarErro(form, campo, mensagem) {
    var field = form.querySelector('[data-field="' + campo + '"]');
    if (!field) return;
    field.classList.add("has-error");
    var controle = field.querySelector("input, select, textarea");
    if (controle) controle.setAttribute("aria-invalid", "true");
    var el = field.querySelector(".field__error");
    if (el) el.textContent = mensagem;
  }

  function limparErros(form) {
    form.querySelectorAll(".field.has-error").forEach(function (f) { f.classList.remove("has-error"); });
    form.querySelectorAll("[aria-invalid]").forEach(function (c) { c.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".field__error").forEach(function (e) { e.textContent = ""; });
  }

  function focarPrimeiroErro(form) {
    var primeiroErro = form.querySelector('.field.has-error input, .field.has-error select, .field.has-error textarea');
    if (!primeiroErro) return;
    try { primeiroErro.focus({ preventScroll: true }); } catch (e) { primeiroErro.focus(); }
    primeiroErro.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function abrirFormulario(lead, opts) {
    opts = opts || {};
    return obterListas().then(function (listas) {
      var editando = !!(lead && lead.id);
      var d = Painel.ui.drawer({
        title: editando ? "Editar lead" : "Novo lead",
        subtitle: editando ? lead.nome : "Cadastre um contato na base comercial.",
        wide: true,
        body: formularioHTML(lead, listas),
        footer: '<button class="btn btn--secondary" type="button" data-cancelar>Cancelar</button>' +
          '<button class="btn btn--primary" type="button" data-salvar>' + icone("check") + (editando ? "Salvar alterações" : "Cadastrar lead") + "</button>"
      });

      var form = d.el.querySelector("#lead-form");
      var btnSalvar = d.el.querySelector("[data-salvar]");
      d.el.querySelector("[data-cancelar]").addEventListener("click", d.close);

      form.querySelectorAll(".system-pick input").forEach(function (input) {
        input.addEventListener("change", function () {
          input.closest(".system-pick").classList.toggle("is-checked", input.checked);
        });
      });

      form.addEventListener("input", function (e) {
        if (e.target.closest(".field")) {
          var campo = e.target.closest(".field");
          campo.classList.remove("has-error");
          var controle = campo.querySelector("input, select, textarea");
          if (controle) controle.removeAttribute("aria-invalid");
        }
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        salvar();
      });

      d.el.querySelector("[data-salvar]").addEventListener("click", function (e) {
        e.preventDefault();
        salvar();
      });

      d.el.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          salvar();
        }
      });

      function salvar() {
        limparErros(form);
        var dados = {
          nome: form.elements.nome.value.trim(),
          empresa: form.elements.empresa.value.trim(),
          cargo: form.elements.cargo.value.trim(),
          telefone: form.elements.telefone.value.trim(),
          email: form.elements.email.value.trim(),
          cidade: form.elements.cidade.value.trim(),
          uf: form.elements.uf.value.trim(),
          origemId: form.elements.origemId.value,
          origemDetalhe: form.elements.origemDetalhe.value.trim(),
          sistemaIds: Array.prototype.map.call(form.querySelectorAll('input[name="sistemaIds"]:checked'), function (i) { return i.value; }),
          possuiSistema: form.elements.possuiSistema.value,
          sistemaAtual: form.elements.sistemaAtual.value.trim(),
          etapaId: form.elements.etapaId.value,
          prioridade: form.elements.prioridade.value,
          responsavel: form.elements.responsavel.value,
          proximoContato: form.elements.proximoContato.value ? new Date(form.elements.proximoContato.value + "T10:00:00").toISOString() : "",
          observacoes: form.elements.observacoes.value.trim(),
          tags: form.elements.tags.value,
          naoContatar: form.elements.naoContatar ? form.elements.naoContatar.checked : !!(lead && lead.naoContatar)
        };

        var ok = true;
        if (!dados.nome) { marcarErro(form, "nome", "Informe o nome do lead."); ok = false; }
        if (!dados.telefone) { marcarErro(form, "telefone", "Informe o WhatsApp do lead."); ok = false; }
        else if (!u.telefoneValido(dados.telefone)) { marcarErro(form, "telefone", "Telefone inválido. Use DDD + número."); ok = false; }
        if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) { marcarErro(form, "email", "Informe um e-mail válido."); ok = false; }
        if (!ok) {
          focarPrimeiroErro(form);
          return;
        }

        btnSalvar.disabled = true;
        btnSalvar.classList.add("is-loading");
        var requisicao = editando ? Painel.api.leads.atualizar(lead.id, dados) : Painel.api.leads.criar(dados);

        requisicao.then(function (salvo) {
          invalidarListas();
          Painel.ui.toast(editando ? "Lead atualizado." : "Lead cadastrado.", "success");
          d.close();
          if (opts.onSaved) opts.onSaved(salvo);
        }).catch(function (err) {
          btnSalvar.disabled = false;
          btnSalvar.classList.remove("is-loading");
          if (err.campo) marcarErro(form, err.campo, err.message);
          if (err.campo) focarPrimeiroErro(form);
          Painel.ui.toast(err.message || "Não foi possível salvar o lead.", "error");
        });
      }
    }).catch(function (err) {
      Painel.ui.toast(err.message || "Não foi possível carregar o formulário.", "error");
    });
  }

  /* Detalhe --------------------------------------------------------------- */

  var ICONES_INTERACAO = {
    mensagem: "message-circle",
    ligacao: "phone-call",
    reuniao: "calendar",
    nota: "file-text",
    etapa: "corner-down-right",
    email: "mail"
  };

  function timelineHTML(interacoes) {
    if (!interacoes.length) return '<div class="empty empty--compact"><p>Nenhuma interação registrada.</p></div>';
    return '<div class="timeline">' + interacoes.map(function (i) {
      return '<div class="timeline__item">' +
        '<span class="timeline__icon timeline__icon--' + i.tipo + '">' + icone(ICONES_INTERACAO[i.tipo] || "circle") + "</span>" +
        '<div class="timeline__body"><div class="timeline__head"><strong>' + u.escaparHTML(i.titulo) + "</strong><time>" + u.tempoRelativo(i.data) + "</time></div>" +
        (i.descricao ? '<p style="white-space:pre-line">' + u.escaparHTML(i.descricao) + "</p>" : "") +
        '<small>' + u.escaparHTML(i.usuario || "") + (i.canal ? " · " + u.escaparHTML(i.canal) : "") + " · " + u.formatarDataHoraCurta(i.data) + "</small></div></div>";
    }).join("") + "</div>";
  }

  function tarefasHTML(tarefas) {
    if (!tarefas.length) return '<div class="empty empty--compact"><p>Nenhuma tarefa agendada.</p></div>';
    return '<div class="task-mini-list">' + tarefas.map(function (t) {
      return '<label class="task-mini' + (t.status === "concluida" ? " is-done" : "") + (t.atrasada ? " is-late" : "") + '">' +
        '<input type="checkbox" data-tarefa-check="' + t.id + '"' + (t.status === "concluida" ? " checked" : "") + ">" +
        '<span class="task-mini__check">' + icone("check") + "</span>" +
        '<span class="task-mini__text"><strong>' + u.escaparHTML(t.titulo) + "</strong><small>" + u.rotuloPrazo(t.data) + " · " + u.formatarData(t.data) + (t.atrasada ? " · atrasada" : "") + "</small></span>" +
        "</label>";
    }).join("") + "</div>";
  }

  function detalheHTML(dados) {
    var lead = dados.lead;
    var pendentes = (dados.tarefas || []).filter(function (t) { return t.status === "pendente"; });
    var proxima = pendentes[0];
    var conversa = lead.conversa || { status: "sem_mensagem", enviadas: 0, recebidas: 0 };
    var bloqueado = lead.naoContatar || (lead.etapa && lead.etapa.tipo === "perdido");
    return '<div class="lead-detail">' +
      '<div class="lead-hero">' + avatar(lead.nome, true) +
        '<div class="lead-hero__main"><div class="lead-hero__title"><h3>' + u.escaparHTML(lead.nome) + "</h3>" +
          (lead.naoContatar ? '<span class="badge badge--danger">Não contatar</span>' : "") + "</div>" +
          '<p>' + u.escaparHTML(lead.cargo || "Cargo não informado") + (lead.empresa ? " · " + u.escaparHTML(lead.empresa) : "") + "</p>" +
          '<div class="lead-hero__badges">' + etapaBadge(lead.etapa) + prioridadeBadge(lead.prioridade) + conversaBadge(conversa.status) +
            '<span class="badge badge--neutral">' + u.escaparHTML(lead.responsavel) + "</span></div>" +
          '<div class="lead-hero__sistemas">' + sistemaChips(lead.sistemas) + "</div>" +
        "</div>" +
        '<button class="btn btn--secondary btn--sm" type="button" data-detail-edit>' + icone("edit") + "Editar</button>" +
      "</div>" +

      (bloqueado ? '<div class="notice notice--danger">' + icone("alert-triangle") + "<div><strong>Contato bloqueado para envios.</strong> " + (lead.naoContatar ? "Marcado como “não contatar”." : "Oportunidade encerrada como perdida.") + " Para voltar a enviar mensagens, reative o contato no cadastro.</div></div>" : "") +

      '<div class="detail-grid">' +
        '<div class="detail-panel"><div class="detail-panel__head">' + icone("user") + "<h4>Contato</h4></div>" +
          linhaInfo("phone", "WhatsApp", u.formatarTelefone(lead.telefone)) +
          linhaInfo("mail", "E-mail", lead.email, lead.email ? "mailto:" + lead.email : null) +
          linhaInfo("map-pin", "Localização", [lead.cidade, lead.uf].filter(Boolean).join(" / ")) +
          linhaInfo("building", "Empresa", lead.empresa) +
          linhaInfo("briefcase", "Cargo", lead.cargo) +
        "</div>" +
        '<div class="detail-panel"><div class="detail-panel__head">' + icone("target") + "<h4>Interesse e funil</h4></div>" +
          '<div class="detail-line"><span>Sistemas</span><div class="tag-list">' + sistemaChips(lead.sistemas) + "</div></div>" +
          '<div class="detail-line"><span>Etapa</span><select class="select select--sm" data-detail-etapa>' + opcoes(dados.etapas || [], lead.etapaId, "") + "</select></div>" +
          '<div class="detail-line"><span>Possui sistema</span><strong>' + (lead.possuiSistema === "sim" ? "Sim" : lead.possuiSistema === "nao" ? "Não" : "Não informado") + "</strong></div>" +
          (lead.sistemaAtual ? '<div class="detail-line"><span>Sistema atual</span><strong>' + u.escaparHTML(lead.sistemaAtual) + "</strong></div>" : "") +
          '<div class="detail-line"><span>Origem</span><strong>' + u.escaparHTML(lead.origem ? lead.origem.nome : "—") + (lead.origemDetalhe ? " · " + u.escaparHTML(lead.origemDetalhe) : "") + "</strong></div>" +
          '<div class="detail-line"><span>Responsável</span><strong>' + u.escaparHTML(lead.responsavel) + "</strong></div>" +
        "</div>" +
      "</div>" +

      '<div class="detail-panel detail-conversa">' +
        '<div class="detail-panel__head">' + icone("message-circle") + "<h4>Conversa no WhatsApp</h4>" + conversaBadge(conversa.status) + "</div>" +
        '<div class="detail-line"><span>Status do contato</span><strong>' + (conversa.status === "recusado" ? "Não enviar mensagens" : conversa.status === "cliente" ? "Cliente fechado" : conversa.status === "sem_mensagem" ? "Primeiro contato pendente" : conversa.status === "responder" ? "Aguardando sua resposta" : conversa.status === "em_conversa" ? "Conversa ativa" : "Aguardando retorno") + "</strong></div>" +
        '<div class="detail-line"><span>Mensagens enviadas</span><strong>' + (conversa.enviadas || 0) + "</strong></div>" +
        '<div class="detail-line"><span>Mensagens recebidas</span><strong>' + (conversa.recebidas || 0) + "</strong></div>" +
        (conversa.ultimaMensagem
          ? '<div class="conv-last conv-last--' + u.escaparHTML(conversa.ultimaMensagem.direcao || "saida") + '"><small>Última mensagem · ' + u.tempoRelativo(conversa.ultimaMensagem.data) + (conversa.ultimaMensagem.direcao === "entrada" ? " · recebida" : " · enviada") + "</small><p>" + u.escaparHTML(conversa.ultimaMensagem.texto) + "</p></div>"
          : '<p class="small muted">Nenhuma mensagem registrada com este contato.</p>') +
        '<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn--secondary btn--sm" type="button" data-detail-resposta>' + icone("inbox") + "Registrar resposta recebida</button></div>" +
      "</div>" +

      '<div class="detail-panel detail-next">' +
        '<div class="detail-panel__head">' + icone("calendar-clock") + "<h4>Próximo contato</h4>" +
          '<button class="btn btn--ghost btn--sm" type="button" data-detail-task>' + icone("plus") + "Agendar follow-up</button></div>" +
        (proxima ? '<div class="next-contact ' + (proxima.atrasada ? "is-late" : "") + '"><span class="next-contact__date">' + u.rotuloPrazo(proxima.data) + "</span>" +
          "<div><strong>" + u.escaparHTML(proxima.titulo) + "</strong><small>" + u.formatarDataHoraCurta(proxima.data) + " · " + u.escaparHTML(proxima.responsavel) + "</small></div></div>"
          : '<p class="small muted">Nenhum follow-up pendente. Agende o próximo passo para manter o lead ativo.</p>') +
        tarefasHTML(dados.tarefas || []) +
      "</div>" +

      (lead.observacoes ? '<div class="detail-panel"><div class="detail-panel__head">' + icone("file-text") + "<h4>Observações</h4></div><p class=\"detail-note\">" + u.escaparHTML(lead.observacoes) + "</p></div>" : "") +

      '<div class="detail-panel">' +
        '<div class="detail-panel__head">' + icone("activity") + "<h4>Histórico</h4><span class=\"small faint\">" + dados.interacoes.length + " interação(ões)</span></div>" +
        '<details class="detail-compose"><summary>' + icone("plus") + "Registrar interação</summary>" +
          '<form class="compose-inline" data-form-interacao>' +
            '<div class="compose-inline__row">' +
              '<select class="select select--sm" name="tipo">' +
                '<option value="nota">Nota</option><option value="ligacao">Ligação</option>' +
                '<option value="reuniao">Reunião</option><option value="mensagem">Mensagem</option><option value="email">E-mail</option>' +
              "</select>" +
              '<input class="input input--sm" type="datetime-local" name="data" value="' + u.paraInputDateTime(new Date().toISOString()) + '">' +
            "</div>" +
            '<textarea class="textarea" name="descricao" rows="3" placeholder="O que aconteceu nesta interação?"></textarea>' +
            '<label class="check" style="margin:8px 0"><input type="checkbox" name="recebida"> Esta mensagem foi recebida do contato</label>' +
            '<div class="row" style="justify-content:flex-end"><button class="btn btn--primary btn--sm" type="submit">Registrar</button></div>' +
          "</form></details>" +
        timelineHTML(dados.interacoes) +
      "</div>" +

      '<div class="detail-meta">Criado em ' + u.formatarData(lead.criadoEm) + " · Atualizado em " + u.formatarDataHoraCurta(lead.atualizadoEm) +
        (lead.motivoPerda ? " · Motivo da perda: " + u.escaparHTML(lead.motivoPerda) : "") + "</div>" +
    "</div>";
  }

  function abrirDetalhe(id, opts) {
    opts = opts || {};
    return Promise.all([Painel.api.leads.obter(id), obterListas()]).then(function (res) {
      var dados = res[0];
      var listas = res[1];
      dados.etapas = listas.etapas;
      var d = Painel.ui.drawer({
        title: "Detalhes do lead",
        subtitle: dados.lead.empresa || dados.lead.nome,
        wide: true,
        body: detalheHTML(dados),
        footer: '<button class="btn btn--danger-soft btn--sm" type="button" data-detail-delete>' + icone("trash") + "Excluir</button>" +
          '<span class="spacer"></span>' +
          '<button class="btn btn--secondary" type="button" data-detail-task2>' + icone("calendar-plus") + "Agendar</button>" +
          '<button class="btn btn--primary" type="button" data-detail-msg' + (dados.lead.naoContatar || (dados.lead.etapa && dados.lead.etapa.tipo === "perdido") ? " disabled" : "") + ">" + icone("send") + "Enviar mensagem</button>"
      });

      var body = d.el.querySelector(".drawer__body");

      function recarregar() {
        return Painel.api.leads.obter(id).then(function (novo) {
          dados = novo;
          dados.etapas = listas.etapas;
          var scroll = body.scrollTop;
          body.innerHTML = detalheHTML(dados);
          body.scrollTop = scroll;
          var msgBtn = d.el.querySelector("[data-detail-msg]");
          if (msgBtn) msgBtn.disabled = dados.lead.naoContatar || (dados.lead.etapa && dados.lead.etapa.tipo === "perdido");
          if (opts.onChanged) opts.onChanged(dados.lead);
          Painel.ui.recarregarResumoSidebar();
        });
      }

      function editar() {
        d.close();
        abrirFormulario(dados.lead, {
          onSaved: function (lead) {
            if (opts.onChanged) opts.onChanged(lead);
            abrirDetalhe(id, opts);
          }
        });
      }

      function mensagem() {
        if (dados.lead.naoContatar || (dados.lead.etapa && dados.lead.etapa.tipo === "perdido")) return;
        abrirMensagem(dados.lead.id, {
          onSent: function () {
            recarregar();
            if (opts.onChanged) opts.onChanged(dados.lead);
          }
        });
      }

      function agendar() {
        abrirTarefa({
          lead: dados.lead,
          onSaved: function () {
            recarregar();
            if (opts.onChanged) opts.onChanged(dados.lead);
          }
        });
      }

      d.el.addEventListener("click", function (e) {
        if (e.target.closest("[data-detail-edit]")) { editar(); return; }
        if (e.target.closest("[data-detail-msg]")) { mensagem(); return; }
        if (e.target.closest("[data-detail-resposta]")) {
          abrirResposta(dados.lead.id, {
            onSaved: function () {
              recarregar();
              if (opts.onChanged) opts.onChanged(dados.lead);
            }
          });
          return;
        }
        if (e.target.closest("[data-detail-task]") || e.target.closest("[data-detail-task2]")) { agendar(); return; }
        if (e.target.closest("[data-detail-delete]")) {
          Painel.ui.confirmar({
            titulo: "Excluir lead",
            texto: "O lead <strong>" + u.escaparHTML(dados.lead.nome) + "</strong> e todo o histórico serão removidos. Esta ação não pode ser desfeita.",
            acao: "Excluir lead",
            perigo: true
          }).then(function (ok) {
            if (!ok) return;
            Painel.api.leads.remover(id).then(function () {
              d.close();
              Painel.ui.toast("Lead excluído.", "success");
              if (opts.onChanged) opts.onChanged(null);
              Painel.ui.recarregarResumoSidebar();
            }).catch(function (err) {
              Painel.ui.toast(err.message || "Não foi possível excluir.", "error");
            });
          });
        }
      });

      d.el.addEventListener("change", function (e) {
        if (e.target.matches("[data-detail-etapa]")) {
          var etapaId = e.target.value;
          Painel.api.leads.mover(id, etapaId).then(function (lead) {
            Painel.ui.toast("Lead movido para " + (lead.etapa ? lead.etapa.nome : "nova etapa") + ".", "success");
            recarregar().then(function () {
              var seletor = d.el.querySelector("[data-detail-etapa]");
              if (seletor) seletor.focus();
            });
          }).catch(function (err) {
            Painel.ui.toast(err.message || "Não foi possível mover o lead.", "error");
            recarregar().then(function () {
              var seletor = d.el.querySelector("[data-detail-etapa]");
              if (seletor) seletor.focus();
            });
          });
          return;
        }
        if (e.target.matches("[data-tarefa-check]")) {
          var tarefaId = e.target.getAttribute("data-tarefa-check");
          Painel.api.tarefas.concluir(tarefaId, e.target.checked).then(function () {
            Painel.ui.toast(e.target.checked ? "Tarefa concluída." : "Tarefa reaberta.", "success");
            recarregar().then(function () {
              var check = d.el.querySelector('[data-tarefa-check="' + CSS.escape(tarefaId) + '"]');
              if (check) check.focus();
            });
          }).catch(function (err) {
            Painel.ui.toast(err.message || "Não foi possível atualizar a tarefa.", "error");
            recarregar().then(function () {
              var check = d.el.querySelector('[data-tarefa-check="' + CSS.escape(tarefaId) + '"]');
              if (check) check.focus();
            });
          });
        }
      });

      d.el.addEventListener("submit", function (e) {
        var form = e.target.closest("[data-form-interacao]");
        if (!form) return;
        e.preventDefault();
        var tipo = form.elements.tipo.value;
        var descricao = form.elements.descricao.value.trim();
        if (!descricao) {
          Painel.ui.toast("Escreva a interação antes de registrar.", "warning");
          return;
        }
        var dataValor = form.elements.data.value;
        var recebida = tipo === "mensagem" && form.elements.recebida.checked;
        var btn = form.querySelector("button[type=submit]");
        btn.disabled = true;
        btn.classList.add("is-loading");
        Painel.api.interacoes.criar(id, {
          tipo: tipo,
          titulo: recebida ? "Mensagem recebida pelo WhatsApp" : tipo === "nota" ? "Nota interna" : tipo === "ligacao" ? "Ligação registrada" : tipo === "reuniao" ? "Reunião registrada" : tipo === "email" ? "E-mail registrado" : "Mensagem registrada",
          descricao: descricao,
          direcao: recebida ? "entrada" : (tipo === "mensagem" ? "saida" : undefined),
          canal: tipo === "mensagem" ? "WhatsApp" : undefined,
          data: dataValor ? new Date(dataValor).toISOString() : new Date().toISOString()
        }).then(function () {
          Painel.ui.toast("Interação registrada.", "success");
          recarregar();
        }).catch(function (err) {
          btn.disabled = false;
          btn.classList.remove("is-loading");
          Painel.ui.toast(err.message || "Não foi possível registrar.", "error");
        });
      });

    }).catch(function (err) {
      Painel.ui.toast(err.message || "Não foi possível abrir o lead.", "error");
    });
  }

  /* Mensagem individual ---------------------------------------------------- */

  function abrirMensagem(leadId, opts) {
    opts = opts || {};
    return Promise.all([Painel.api.leads.obter(leadId), Painel.api.mensagens.templates()]).then(function (res) {
      var lead = res[0].lead;
      var templates = res[1];
      var bloqueado = lead.naoContatar || (lead.etapa && lead.etapa.tipo === "perdido");
      var m = Painel.ui.modal({
        title: "Enviar mensagem",
        subtitle: "Mensagem individual pelo WhatsApp",
        size: "lg",
        body:
          '<div class="msg-recipient">' + avatar(lead.nome) +
            '<div><strong>' + u.escaparHTML(lead.nome) + "</strong><small>" + u.formatarTelefone(lead.telefone) + (lead.empresa ? " · " + u.escaparHTML(lead.empresa) : "") + "</small></div>" +
            (bloqueado ? '<span class="badge badge--danger">Não contatar</span>' : '<span class="badge badge--success">WhatsApp</span>') +
          "</div>" +
          (bloqueado ? '<div class="notice notice--danger">' + icone("alert-triangle") + "<div>Este lead está marcado como <strong>não contatar</strong>. Desmarque essa opção no cadastro para liberar o envio.</div></div>" : "") +
          '<div class="form-grid" style="margin-top:16px">' +
            '<label class="field field--full"><span class="field__label">Usar template</span>' +
              '<select class="select" data-msg-template><option value="">Mensagem livre</option>' + templates.map(function (t) {
                return '<option value="' + t.id + '">' + u.escaparHTML(t.nome) + " · " + u.escaparHTML(t.categoria) + "</option>";
              }).join("") + "</select></label>" +
            '<div class="field field--full"><span class="field__label">Mensagem</span>' +
              '<textarea class="textarea" data-msg-text rows="7" placeholder="Escreva sua mensagem...">' + (templates[0] ? u.escaparHTML(templates[0].conteudo) : "") + "</textarea>" +
              '<div class="msg-meta"><span data-msg-count>0 caracteres</span><span data-msg-segments>1 segmento</span><span class="spacer"></span><span>Use variáveis para personalizar</span></div>' +
              '<div class="variable-chips">' + u.VARIAVEIS.map(function (v) {
                return '<button type="button" class="tag tag--button" data-var="' + v.chave + '" title="' + v.label + '">{{' + v.chave + "}}</button>";
              }).join("") + "</div></div>" +
            '<div class="field field--full"><span class="field__label">Prévia para ' + u.escaparHTML(u.primeiroNome(lead.nome)) + "</span>" +
              '<div class="message-preview" data-msg-preview></div>' +
               '<span class="field__hint">Revise e confirme o envio no WhatsApp. A automação deste contato será encerrada. O histórico será sincronizado quando o conector receber o envio.</span></div>' +
          "</div>",
        footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button>' +
           '<button class="btn btn--primary" type="button" data-enviar' + (bloqueado ? " disabled" : "") + ">" + icone("send") + "Abrir no WhatsApp</button>"
      });

      var textarea = m.el.querySelector("[data-msg-text]");
      var preview = m.el.querySelector("[data-msg-preview]");
      var count = m.el.querySelector("[data-msg-count]");
      var segments = m.el.querySelector("[data-msg-segments]");
      var btn = m.el.querySelector("[data-enviar]");

      if (templates[0]) m.el.querySelector("[data-msg-template]").value = templates[0].id;

      function atualizar() {
        var texto = textarea.value;
        count.textContent = texto.length + " caractere" + (texto.length === 1 ? "" : "s");
        segments.textContent = u.contarSegmentos(texto) + " segmento" + (u.contarSegmentos(texto) === 1 ? "" : "s");
        var render = u.renderizarMensagem(texto, lead, "…");
        preview.innerHTML = render ? u.escaparHTML(render).replace(/\n/g, "<br>") : '<span class="faint">A prévia aparece aqui.</span>';
      }

      textarea.addEventListener("input", atualizar);
      m.el.querySelector("[data-msg-template]").addEventListener("change", function (e) {
        var t = templates.filter(function (x) { return x.id === e.target.value; })[0];
        if (t) {
          textarea.value = t.conteudo;
          atualizar();
        }
      });

      m.el.querySelectorAll("[data-var]").forEach(function (b) {
        b.addEventListener("click", function () {
          var texto = "{{" + b.getAttribute("data-var") + "}}";
          var start = textarea.selectionStart || 0;
          var end = textarea.selectionEnd || 0;
          textarea.value = textarea.value.slice(0, start) + texto + textarea.value.slice(end);
          textarea.focus();
          textarea.setSelectionRange(start + texto.length, start + texto.length);
          atualizar();
        });
      });

      atualizar();

      btn.addEventListener("click", function () {
        var mensagem = textarea.value.trim();
        if (!mensagem) {
          Painel.ui.toast("Escreva a mensagem antes de enviar.", "warning");
          textarea.focus();
          return;
        }
        btn.disabled = true;
        btn.classList.add("is-loading");
        var whatsappWindow = window.open("about:blank", "_blank");
        if (whatsappWindow) whatsappWindow.opener = null;
        var tpl = m.el.querySelector("[data-msg-template]").value;
        Painel.api.mensagens.enviarIndividual(lead.id, { mensagem: mensagem, templateId: tpl || null }).then(function (result) {
          if (whatsappWindow) whatsappWindow.location.replace(result.url);
          else window.location.href = result.url;
          m.close();
          Painel.ui.toast("Mensagem preparada. Confirme o envio no WhatsApp.", "success");
          if (opts.onSent) opts.onSent();
        }).catch(function (err) {
          if (whatsappWindow) whatsappWindow.close();
          btn.disabled = false;
          btn.classList.remove("is-loading");
          Painel.ui.toast(err.message || "Não foi possível enviar.", "error");
        });
      });
    }).catch(function (err) {
      Painel.ui.toast(err.message || "Não foi possível carregar a mensagem.", "error");
    });
  }

  /* Tarefa ----------------------------------------------------------------- */

  function abrirTarefa(opts) {
    opts = opts || {};
    return obterListas().then(function (listas) {
      var precisaEscolher = !opts.lead;
      var carregar = precisaEscolher
        ? Painel.api.leads.listar({ perPage: 500, etapa: "abertos", sort: "nome", direction: "asc" })
        : Promise.resolve({ data: [opts.lead] });

      return carregar.then(function (res) {
        var leads = res.data || [];
        if (!leads.length) {
          Painel.ui.toast("Cadastre ou selecione um lead para agendar.", "warning");
          return;
        }
        var lead = opts.lead || leads[0];
        var dataPadrao = opts.data || u.diasFrente(1, 9, 0);
        var m = Painel.ui.modal({
          title: "Agendar follow-up",
          subtitle: lead ? lead.nome : "Selecione o lead",
          body: '<form id="task-form" class="form-grid">' +
            (precisaEscolher ? '<label class="field field--full"><span class="field__label">Lead</span><select class="select" name="leadId">' +
              leads.map(function (l) {
                return '<option value="' + l.id + '">' + u.escaparHTML(l.nome) + (l.empresa ? " · " + u.escaparHTML(l.empresa) : "") + "</option>";
              }).join("") + "</select></label>" : '<input type="hidden" name="leadId" value="' + lead.id + '">') +
            '<label class="field field--full" data-field="titulo"><span class="field__label">Título <em class="field__req">*</em></span>' +
              '<input class="input" name="titulo" value="' + u.escaparHTML(opts.titulo || "Retomar contato com " + u.primeiroNome(lead.nome)) + '">' +
              '<span class="field__error"></span></label>' +
            '<label class="field"><span class="field__label">Tipo</span><select class="select" name="tipo">' +
              '<option value="ligacao">Ligação</option><option value="mensagem">Mensagem</option><option value="reuniao">Reunião</option><option value="outro">Outro</option></select></label>' +
            '<label class="field" data-field="data"><span class="field__label">Data e hora <em class="field__req">*</em></span>' +
              '<input class="input" type="datetime-local" name="data" value="' + u.paraInputDateTime(dataPadrao) + '">' +
              '<span class="field__error"></span></label>' +
            '<label class="field"><span class="field__label">Prioridade</span><select class="select" name="prioridade">' +
              '<option value="alta"' + (lead.prioridade === "alta" ? " selected" : "") + ">Alta</option>" +
              '<option value="media"' + (lead.prioridade === "media" ? " selected" : "") + ">Média</option>" +
              '<option value="baixa"' + (lead.prioridade === "baixa" ? " selected" : "") + ">Baixa</option></select></label>" +
            '<label class="field"><span class="field__label">Responsável</span><select class="select" name="responsavel">' +
              opcoes(listas.equipe, lead.responsavel, "Selecione") + "</select></label>" +
          "</form>",
          footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button>' +
            '<button class="btn btn--primary" type="button" data-salvar-tarefa>' + icone("calendar-check") + "Agendar</button>",
          onMount: function (layer, fechar) {
            var form = layer.querySelector("#task-form");
            var btn = layer.querySelector("[data-salvar-tarefa]");
            btn.addEventListener("click", function () {
              if (!form.reportValidity()) return;
              limparErros(form);
              var dados = {
                leadId: form.elements.leadId.value,
                titulo: form.elements.titulo.value.trim(),
                tipo: form.elements.tipo.value,
                data: form.elements.data.value ? new Date(form.elements.data.value).toISOString() : "",
                prioridade: form.elements.prioridade.value,
                responsavel: form.elements.responsavel.value
              };
              if (!dados.titulo) {
                marcarErro(form, "titulo", "Informe o título.");
                focarPrimeiroErro(form);
                return;
              }
              btn.disabled = true;
              btn.classList.add("is-loading");
              Painel.api.tarefas.criar(dados).then(function () {
                fechar();
                Painel.ui.toast("Follow-up agendado.", "success");
                Painel.ui.recarregarResumoSidebar();
                if (opts.onSaved) opts.onSaved();
              }).catch(function (err) {
                btn.disabled = false;
                btn.classList.remove("is-loading");
                if (err.campo) { marcarErro(form, err.campo, err.message); focarPrimeiroErro(form); }
                Painel.ui.toast(err.message || "Não foi possível agendar.", "error");
              });
            });
          }
        });
      });
    }).catch(function (err) {
      Painel.ui.toast(err.message || "Não foi possível abrir o agendamento.", "error");
    });
  }

  /* Resposta recebida ------------------------------------------------------ */

  function abrirResposta(leadId, opts) {
    opts = opts || {};
    return Painel.api.leads.obter(leadId).then(function (res) {
      var lead = res.lead;
      var m = Painel.ui.modal({
        title: "Registrar resposta recebida",
        subtitle: lead.nome + (lead.empresa ? " · " + lead.empresa : ""),
        size: "lg",
        body:
          '<div class="msg-recipient">' + avatar(lead.nome) +
            '<div><strong>' + u.escaparHTML(lead.nome) + "</strong><small>" + u.formatarTelefone(lead.telefone) + "</small></div>" +
            '<span class="badge badge--info">Mensagem recebida</span>' +
          "</div>" +
          '<label class="field field--full" style="margin-top:16px"><span class="field__label">O que o contato respondeu? <em class="field__req">*</em></span>' +
            '<textarea class="textarea" data-resposta-text rows="6" placeholder="Cole ou resuma a resposta recebida no WhatsApp...">' + u.escaparHTML(opts.mensagem || "") + "</textarea>" +
            '<span class="field__hint">Ao registrar, o contato passa para “Preciso responder” até você enviar a próxima mensagem.</span></label>',
        footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button>' +
          '<button class="btn btn--primary" type="button" data-salvar-resposta>' + icone("inbox") + "Registrar resposta</button>"
      });

      var textarea = m.el.querySelector("[data-resposta-text]");
      var btn = m.el.querySelector("[data-salvar-resposta]");
      textarea.focus();

      btn.addEventListener("click", function () {
        var texto = textarea.value.trim();
        if (!texto) {
          Painel.ui.toast("Escreva a resposta recebida.", "warning");
          textarea.focus();
          return;
        }
        btn.disabled = true;
        btn.classList.add("is-loading");
        Painel.api.interacoes.criar(leadId, {
          tipo: "mensagem",
          titulo: "Mensagem recebida pelo WhatsApp",
          descricao: texto,
          canal: "WhatsApp",
          direcao: "entrada"
        }).then(function () {
          m.close();
          Painel.ui.toast("Resposta registrada. O contato agora precisa da sua resposta.", "success");
          Painel.ui.recarregarResumoSidebar();
          if (opts.onSaved) opts.onSaved();
        }).catch(function (err) {
          btn.disabled = false;
          btn.classList.remove("is-loading");
          Painel.ui.toast(err.message || "Não foi possível registrar a resposta.", "error");
        });
      });
    }).catch(function (err) {
      Painel.ui.toast(err.message || "Não foi possível abrir o contato.", "error");
    });
  }

  /* Mudança de etapa em lote ----------------------------------------------- */

  function abrirMudarEtapa(ids, opts) {
    opts = opts || {};
    if (!ids || !ids.length) return;
    return obterListas().then(function (listas) {
      var m = Painel.ui.modal({
        title: "Mover leads de etapa",
        subtitle: ids.length + " lead(s) selecionado(s)",
        size: "sm",
        body: '<div class="field"><span class="field__label">Nova etapa</span><select class="select" data-nova-etapa>' +
          opcoes(listas.etapas, "", "Selecione a etapa") + "</select></div>" +
          '<p class="small muted" style="margin-top:10px;line-height:1.5">O histórico de cada lead será atualizado com a mudança de etapa.</p>',
        footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button>' +
          '<button class="btn btn--primary" type="button" data-mover disabled>Mover leads</button>'
      });
      var select = m.el.querySelector("[data-nova-etapa]");
      var btn = m.el.querySelector("[data-mover]");
      select.addEventListener("change", function () { btn.disabled = !select.value; });
      btn.addEventListener("click", function () {
        if (!select.value) return;
        btn.disabled = true;
        btn.classList.add("is-loading");
        Promise.all(ids.map(function (id) {
          return Painel.api.leads.mover(id, select.value).then(function () { return true; }).catch(function () { return false; });
        })).then(function (resultados) {
          var ok = resultados.filter(Boolean).length;
          m.close();
          Painel.ui.toast(ok + " lead(s) movido(s) de etapa.", ok === ids.length ? "success" : "warning");
          if (opts.onDone) opts.onDone();
        });
      });
    });
  }

  Painel.leadUI = {
    invalidarListas: invalidarListas,
    obterListas: obterListas,
    etapaBadge: etapaBadge,
    prioridadeBadge: prioridadeBadge,
    sistemaChips: sistemaChips,
    avatar: avatar,
    conversaBadge: conversaBadge,
    abrirFormulario: abrirFormulario,
    abrirDetalhe: abrirDetalhe,
    abrirMensagem: abrirMensagem,
    abrirResposta: abrirResposta,
    abrirTarefa: abrirTarefa,
    abrirMudarEtapa: abrirMudarEtapa
  };
})(window.Painel);
