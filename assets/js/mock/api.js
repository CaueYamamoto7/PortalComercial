/* ==========================================================================
   Painel Comercial — API de demonstração (localStorage)
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var DB = null;

  function carregar() {
    if (DB) return DB;
    var salvo = Painel.store.getDB();
    if (salvo && salvo.__v === Painel.seed.__v && salvo.leads) {
      DB = salvo;
    } else {
      DB = u.clonar(Painel.seed);
      persistir();
    }
    return DB;
  }

  function persistir() {
    if (DB) Painel.store.setDB(DB);
  }

  function responder(fn) {
    return new Promise(function (resolve, reject) {
      var atraso = Painel.config.latenciaMock;
      var min = atraso[0];
      var max = atraso[1];
      var delay = Math.round(min + Math.random() * (max - min));
      setTimeout(function () {
        try {
          resolve(u.clonar(fn()));
        } catch (e) {
          reject(e);
        }
      }, delay);
    });
  }

  function erro(mensagem, campo) {
    var e = new Error(mensagem);
    e.campo = campo || null;
    return e;
  }

  /* Helpers --------------------------------------------------------------- */

  function sistemaPorId(id) {
    return carregar().sistemas.filter(function (s) { return s.id === id; })[0] || null;
  }

  function etapaPorId(id) {
    return carregar().etapas.filter(function (e) { return e.id === id; })[0] || null;
  }

  function tipoDoLead(lead) {
    var etapa = etapaPorId(lead.etapaId);
    return etapa ? etapa.tipo : "aberto";
  }

  function emailValido(valor) {
    return /^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/.test(String(valor || ""));
  }

  function resumoConversa(lead, etapa, interacoes) {
    var mensagens = (interacoes || []).filter(function (i) {
      return i.leadId === lead.id && i.tipo === "mensagem";
    }).sort(function (a, b) { return new Date(a.data) - new Date(b.data); });

    var enviadas = mensagens.filter(function (i) { return (i.direcao || "saida") === "saida"; });
    var recebidas = mensagens.filter(function (i) { return i.direcao === "entrada"; });
    var ultima = mensagens[mensagens.length - 1] || null;
    var ultimaDirecao = ultima ? (ultima.direcao || "saida") : null;
    var cliente = etapa && etapa.tipo === "ganho";
    var recusado = lead.naoContatar || (etapa && etapa.tipo === "perdido");
    var encerrado = etapa && etapa.tipo !== "aberto";
    var status;

    if (recusado) status = "recusado";
    else if (cliente) status = "cliente";
    else if (!enviadas.length) status = "sem_mensagem";
    else if (ultimaDirecao === "entrada") status = "responder";
    else if (recebidas.length) status = "em_conversa";
    else status = "aguardando";

    return {
      status: status,
      enviadas: enviadas.length,
      recebidas: recebidas.length,
      respondeu: recebidas.length > 0,
      conversaAberta: !encerrado && recebidas.length > 0,
      ultimaDirecao: ultimaDirecao,
      ultimaMensagemEm: ultima ? ultima.data : null,
      ultimaMensagem: ultima ? {
        texto: ultima.descricao || ultima.titulo || "",
        data: ultima.data,
        direcao: ultimaDirecao
      } : null,
      podeEnviar: !recusado
    };
  }

  function origemPorId(id) {
    return carregar().origens.filter(function (o) { return o.id === id; })[0] || null;
  }

  function enriquecerLead(lead) {
    var sistemas = (lead.sistemaIds || []).map(sistemaPorId).filter(Boolean);
    var etapa = etapaPorId(lead.etapaId) || carregar().etapas[0];
    var origem = origemPorId(lead.origemId);
    var proximo = lead.proximoContato ? new Date(lead.proximoContato) : null;
    var atrasado = !!(proximo && proximo < new Date() && ["aberto"].indexOf(etapa.tipo) !== -1);
    return Object.assign({}, lead, {
      sistemas: sistemas,
      sistemasNomes: sistemas.map(function (s) { return s.nome; }),
      etapa: etapa,
      origem: origem,
      proximoContatoAtrasado: atrasado,
      diasParaContato: proximo ? u.diferencaDias(proximo, new Date()) : null,
      conversa: resumoConversa(lead, etapa, carregar().interacoes)
    });
  }

  function enriquecerTarefa(tarefa) {
    var lead = carregar().leads.filter(function (l) { return l.id === tarefa.leadId; })[0];
    return Object.assign({}, tarefa, {
      lead: lead ? enriquecerLead(lead) : null,
      atrasada: tarefa.status === "pendente" && new Date(tarefa.data) < new Date()
    });
  }

  function leadAberto(lead) {
    var etapa = etapaPorId(lead.etapaId);
    return !etapa || etapa.tipo === "aberto";
  }

  function inicioPeriodo(periodo) {
    var dias = Number(periodo) || 30;
    var d = new Date();
    d.setDate(d.getDate() - (dias - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function dentroPeriodo(data, periodo) {
    if (!data) return false;
    var d = new Date(data);
    return d >= inicioPeriodo(periodo);
  }

  function estatisticasBase(leads) {
    var agora = new Date();
    var total = leads.length;
    var abertos = leads.filter(leadAberto);
    var ganhos = leads.filter(function (l) { return tipoDoLead(l) === "ganho"; }).length;
    var perdidos = leads.filter(function (l) { return tipoDoLead(l) === "perdido"; }).length;
    var decididos = ganhos + perdidos;
    return {
      total: total,
      abertos: abertos.length,
      ganhos: ganhos,
      perdidos: perdidos,
      taxaConversao: decididos ? u.percentual(ganhos, decididos) : 0,
      emNegociacao: leads.filter(function (l) { return l.etapaId === "et_negociacao"; }).length,
      emProposta: leads.filter(function (l) { return l.etapaId === "et_proposta"; }).length,
      atrasados: abertos.filter(function (l) { return l.proximoContato && new Date(l.proximoContato) < agora; }).length,
      followupsHoje: abertos.filter(function (l) { return l.proximoContato && u.mesmoDia(l.proximoContato, agora); }).length,
      naoContatar: leads.filter(function (l) { return l.naoContatar; }).length
    };
  }

  function filtrosFacets(leads) {
    var tags = [];
    leads.forEach(function (l) {
      (l.tags || []).forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
    });
    return {
      etapas: carregar().etapas.slice().sort(function (a, b) { return a.ordem - b.ordem; }),
      sistemas: carregar().sistemas.filter(function (s) { return s.ativo; }),
      origens: carregar().origens.filter(function (o) { return o.ativo; }),
      responsaveis: carregar().equipe.filter(function (m) { return m.status === "ativo"; }),
      tags: tags.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); })
    };
  }

  function filtrarLeads(params) {
    var leads = carregar().leads.slice();
    var q = u.normalizarTexto(params.q || "");

    if (q) {
      leads = leads.filter(function (l) {
        var sistemas = (l.sistemaIds || []).map(function (id) {
          var s = sistemaPorId(id);
          return s ? s.nome : "";
        }).join(" ");
        var alvo = u.normalizarTexto([
          l.nome, l.empresa, l.cargo, l.email, l.cidade, l.uf, l.responsavel,
          l.observacoes, l.origemDetalhe, (l.tags || []).join(" "), sistemas
        ].join(" "));
        return alvo.indexOf(q) !== -1 || u.somenteDigitos(l.telefone).indexOf(u.somenteDigitos(params.q)) !== -1;
      });
    }
    if (params.etapa) {
      if (params.etapa === "abertos") leads = leads.filter(leadAberto);
      else leads = leads.filter(function (l) { return l.etapaId === params.etapa; });
    }
    if (params.sistema) leads = leads.filter(function (l) { return (l.sistemaIds || []).indexOf(params.sistema) !== -1; });
    if (params.origem) leads = leads.filter(function (l) { return l.origemId === params.origem; });
    if (params.responsavel) leads = leads.filter(function (l) { return l.responsavel === params.responsavel; });
    if (params.prioridade) leads = leads.filter(function (l) { return l.prioridade === params.prioridade; });
    if (params.possuiSistema) leads = leads.filter(function (l) { return l.possuiSistema === params.possuiSistema; });
    if (params.tag) leads = leads.filter(function (l) { return (l.tags || []).indexOf(params.tag) !== -1; });
    if (params.naoContatar === "1") leads = leads.filter(function (l) { return l.naoContatar; });
    if (params.naoContatar === "0") leads = leads.filter(function (l) { return !l.naoContatar; });
    if (params.atrasados === "1") {
      var agora = new Date();
      leads = leads.filter(function (l) { return leadAberto(l) && l.proximoContato && new Date(l.proximoContato) < agora; });
    }
    if (params.ids) {
      var ids = String(params.ids).split(",");
      leads = leads.filter(function (l) { return ids.indexOf(l.id) !== -1; });
    }
    return leads;
  }

  /* Leads ----------------------------------------------------------------- */

  function listarLeads(params) {
    params = params || {};
    var todos = carregar().leads;
    var leads = filtrarLeads(params);
    var campo = params.sort || "atualizadoEm";
    var direction = params.direction || "desc";
    if (campo === "nome" || campo === "empresa" || campo === "prioridade" || campo === "criadoEm") {
      leads = u.ordenar(leads, campo, direction);
    } else {
      leads = u.ordenar(leads, campo, direction);
    }

    var page = Number(params.page) || 1;
    var perPage = Number(params.perPage) || Painel.config.paginacao.leads;
    var pagina = u.paginar(leads, page, perPage);
    return {
      data: pagina.data.map(enriquecerLead),
      meta: pagina.meta,
      stats: estatisticasBase(todos),
      facets: filtrosFacets(todos)
    };
  }

  function obterLead(id) {
    var lead = carregar().leads.filter(function (l) { return l.id === id; })[0];
    if (!lead) throw erro("Lead não encontrado.");
    var interacoes = carregar().interacoes
      .filter(function (i) { return i.leadId === id; })
      .sort(function (a, b) { return new Date(b.data) - new Date(a.data); });
    var tarefas = carregar().tarefas
      .filter(function (t) { return t.leadId === id; })
      .sort(function (a, b) { return new Date(a.data) - new Date(b.data); })
      .map(enriquecerTarefa);
    return { lead: enriquecerLead(lead), interacoes: interacoes, tarefas: tarefas };
  }

  function normalizarSistemaIds(valor) {
    if (Array.isArray(valor)) return valor.filter(Boolean);
    return String(valor || "").split(/[,;|]/).map(function (v) { return v.trim(); }).filter(Boolean);
  }

  function normalizarTags(valor) {
    if (Array.isArray(valor)) return valor.map(function (t) { return String(t).trim(); }).filter(Boolean);
    return String(valor || "").split(/[,;|]/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function validarLead(dados, idAtual) {
    if (!String(dados.nome || "").trim()) throw erro("Informe o nome do lead.", "nome");
    if (!String(dados.telefone || "").trim()) throw erro("Informe o telefone do lead.", "telefone");
    var telefone = u.normalizarTelefone(dados.telefone);
    if (!u.telefoneValido(telefone)) throw erro("Telefone inválido. Use DDD + número.", "telefone");
    if (dados.email && !emailValido(dados.email)) {
      throw erro("Informe um e-mail válido.", "email");
    }
    var duplicado = carregar().leads.some(function (l) {
      return l.id !== idAtual && u.normalizarTelefone(l.telefone) === telefone;
    });
    if (duplicado) throw erro("Já existe um lead com este telefone.", "telefone");
    return telefone;
  }

  function montarLead(dados, existente) {
    var base = existente || {};
    var etapas = carregar().etapas;
    var primeiro = etapas.filter(function (e) { return e.tipo === "aberto"; })
      .sort(function (a, b) { return a.ordem - b.ordem; })[0] ||
      etapas.slice().sort(function (a, b) { return a.ordem - b.ordem; })[0];
    var responsavel = String(dados.responsavel || base.responsavel || "Marina Costa").trim();
    return {
      id: base.id,
      nome: String(dados.nome || "").trim(),
      empresa: String(dados.empresa || "").trim(),
      cargo: String(dados.cargo || "").trim(),
      telefone: u.normalizarTelefone(dados.telefone),
      email: String(dados.email || "").trim().toLowerCase(),
      cidade: String(dados.cidade || "").trim(),
      uf: String(dados.uf || "").trim().toUpperCase().slice(0, 2),
      origemId: dados.origemId || base.origemId || "org_outro",
      origemDetalhe: String(dados.origemDetalhe || "").trim(),
      sistemaIds: normalizarSistemaIds(dados.sistemaIds !== undefined ? dados.sistemaIds : base.sistemaIds),
      possuiSistema: ["sim", "nao", "nao_informado"].indexOf(dados.possuiSistema) !== -1 ? dados.possuiSistema : (base.possuiSistema || "nao_informado"),
      sistemaAtual: String(dados.sistemaAtual || "").trim(),
      etapaId: dados.etapaId || base.etapaId || (primeiro ? primeiro.id : "et_novo"),
      prioridade: ["alta", "media", "baixa"].indexOf(dados.prioridade) !== -1 ? dados.prioridade : (base.prioridade || "media"),
      responsavel: responsavel,
      proximoContato: dados.proximoContato ? new Date(dados.proximoContato).toISOString() : (dados.proximoContato === "" ? null : (base.proximoContato || null)),
      ultimoContato: base.ultimoContato || null,
      observacoes: String(dados.observacoes || "").trim(),
      tags: normalizarTags(dados.tags !== undefined ? dados.tags : base.tags),
      naoContatar: dados.naoContatar !== undefined ? !!dados.naoContatar : !!base.naoContatar,
      criadoEm: base.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      motivoPerda: String(dados.motivoPerda || base.motivoPerda || "").trim()
    };
  }

  function criarLead(dados) {
    var telefone = validarLead(dados, null);
    var lead = montarLead(dados, null);
    lead.id = u.uid("ld");
    lead.telefone = telefone;
    carregar().leads.unshift(lead);
    carregar().interacoes.push({
      id: u.uid("it"), leadId: lead.id, tipo: "nota", titulo: "Lead cadastrado",
      descricao: "Lead criado manualmente no Painel Comercial.", data: lead.criadoEm, usuario: lead.responsavel
    });
    persistir();
    return enriquecerLead(lead);
  }

  function atualizarLead(id, dados) {
    var lead = carregar().leads.filter(function (l) { return l.id === id; })[0];
    if (!lead) throw erro("Lead não encontrado.");
    var telefone = validarLead(dados, id);
    var etapaAntes = lead.etapaId;
    var atualizado = montarLead(dados, lead);
    atualizado.telefone = telefone;
    Object.keys(atualizado).forEach(function (k) { lead[k] = atualizado[k]; });
    if (etapaAntes !== lead.etapaId) {
      registrarInteracao(lead, "etapa", "Etapa alterada", "Lead movido para " + etapaPorId(lead.etapaId).nome + ".", { silencioso: true });
    }
    persistir();
    return enriquecerLead(lead);
  }

  function moverLead(id, etapaId) {
    var lead = carregar().leads.filter(function (l) { return l.id === id; })[0];
    if (!lead) throw erro("Lead não encontrado.");
    var etapa = etapaPorId(etapaId);
    if (!etapa) throw erro("Etapa inválida.");
    if (lead.etapaId === etapaId) return enriquecerLead(lead);
    lead.etapaId = etapaId;
    lead.atualizadoEm = new Date().toISOString();
    if (etapa.tipo === "ganho" || etapa.tipo === "perdido") lead.proximoContato = null;
    carregar().interacoes.push({
      id: u.uid("it"), leadId: lead.id, tipo: "etapa", titulo: "Etapa alterada",
      descricao: "Lead movido para " + etapa.nome + ".", data: new Date().toISOString(), usuario: lead.responsavel
    });
    persistir();
    return enriquecerLead(lead);
  }

  function removerLead(id) {
    var db = carregar();
    var antes = db.leads.length;
    db.leads = db.leads.filter(function (l) { return l.id !== id; });
    if (db.leads.length === antes) throw erro("Lead não encontrado.");
    db.interacoes = db.interacoes.filter(function (i) { return i.leadId !== id; });
    db.tarefas = db.tarefas.filter(function (t) { return t.leadId !== id; });
    persistir();
    return { removido: true };
  }

  function buscarIdPorNome(lista, valor) {
    if (!valor) return null;
    var alvo = u.normalizarTexto(valor);
    var item = lista.filter(function (x) {
      return x.id === valor || u.normalizarTexto(x.nome) === alvo;
    })[0];
    return item ? item.id : null;
  }

  function importarLeads(linhas) {
    var db = carregar();
    var importados = 0, duplicados = 0, invalidos = 0, detalhes = [];
    var primeiraEtapa = db.etapas.filter(function (e) { return e.tipo === "aberto"; })
      .sort(function (a, b) { return a.ordem - b.ordem; })[0] ||
      db.etapas.slice().sort(function (a, b) { return a.ordem - b.ordem; })[0];

    (linhas || []).forEach(function (linha, idx) {
      var nome = String(linha.nome || linha.name || "").trim();
      var telefoneOriginal = linha.telefone || linha.phone || linha.celular || linha.whatsapp || "";
      var telefone = u.normalizarTelefone(telefoneOriginal);
      if (!nome || !u.telefoneValido(telefone)) {
        invalidos++;
        detalhes.push({ linha: idx + 2, motivo: !nome ? "Nome ausente" : "Telefone inválido" });
        return;
      }
      if (db.leads.some(function (l) { return u.normalizarTelefone(l.telefone) === telefone; })) {
        duplicados++;
        detalhes.push({ linha: idx + 2, motivo: "Telefone já cadastrado" });
        return;
      }
      var email = String(linha.email || linha.e_mail || linha.mail || "").trim().toLowerCase();
      if (email && !emailValido(email)) {
        invalidos++;
        detalhes.push({ linha: idx + 2, motivo: "E-mail inválido" });
        return;
      }
      var sistemaIds = [];
      var sistemasTexto = String(linha.sistemas_interesse || linha.sistemas || linha.sistema || "");
      String(sistemasTexto).split(/[,;|]/).forEach(function (nomeSis) {
        var id = buscarIdPorNome(db.sistemas, nomeSis.trim());
        if (id && sistemaIds.indexOf(id) === -1) sistemaIds.push(id);
      });
      var origemId = buscarIdPorNome(db.origens, linha.origem) || "org_outro";
      var etapaId = buscarIdPorNome(db.etapas, linha.etapa) || (primeiraEtapa ? primeiraEtapa.id : "et_novo");
      var responsavel = String(linha.responsavel || "").trim();
      if (!db.equipe.some(function (m) { return u.normalizarTexto(m.nome) === u.normalizarTexto(responsavel); })) {
        responsavel = "Marina Costa";
      }
      var possui = u.normalizarTexto(linha.possui_sistema || linha.possui || "");
      var possuiSistema = possui.indexOf("sim") === 0 ? "sim" : possui.indexOf("nao") === 0 || possui.indexOf("não") === 0 ? "nao" : "nao_informado";
      var prioridade = u.normalizarTexto(linha.prioridade || "media");
      if (["alta", "media", "baixa"].indexOf(prioridade) === -1) prioridade = "media";
      var proximo = linha.proximo_contato ? new Date(linha.proximo_contato) : null;
      var lead = {
        id: u.uid("ld"),
        nome: nome,
        empresa: String(linha.empresa || linha.company || "").trim(),
        cargo: String(linha.cargo || "").trim(),
        telefone: telefone,
        email: email,
        cidade: String(linha.cidade || "").trim(),
        uf: String(linha.uf || linha.estado || "").trim().toUpperCase().slice(0, 2),
        origemId: origemId,
        origemDetalhe: String(linha.evento || linha.origem_detalhe || "").trim(),
        sistemaIds: sistemaIds,
        possuiSistema: possuiSistema,
        sistemaAtual: String(linha.sistema_atual || "").trim(),
        etapaId: etapaId,
        prioridade: prioridade,
        responsavel: responsavel,
        proximoContato: proximo && !isNaN(proximo.getTime()) ? proximo.toISOString() : null,
        ultimoContato: null,
        observacoes: String(linha.observacoes || linha.notas || "").trim(),
        tags: normalizarTags(linha.tags || "Importado"),
        naoContatar: false,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        motivoPerda: ""
      };
      db.leads.push(lead);
      db.interacoes.push({
        id: u.uid("it"), leadId: lead.id, tipo: "nota", titulo: "Lead importado",
        descricao: "Cadastro criado por importação de planilha.", data: lead.criadoEm, usuario: lead.responsavel
      });
      importados++;
    });

    persistir();
    return { importados: importados, duplicados: duplicados, invalidos: invalidos, detalhes: detalhes };
  }

  /* Interações e tarefas -------------------------------------------------- */

  function registrarInteracao(lead, tipo, titulo, descricao, extra) {
    var db = carregar();
    var data = (extra && extra.data) || new Date().toISOString();
    var item = {
      id: u.uid("it"), leadId: lead.id, tipo: tipo, titulo: titulo,
      descricao: descricao, data: data, usuario: lead.responsavel
    };
    if (extra && extra.canal) item.canal = extra.canal;
    if (extra && extra.direcao) item.direcao = extra.direcao;
    db.interacoes.push(item);
    if (!extra || !extra.silencioso) {
      lead.ultimoContato = data;
      lead.atualizadoEm = data;
      persistir();
    }
    return item;
  }

  function criarInteracao(leadId, dados) {
    var lead = carregar().leads.filter(function (l) { return l.id === leadId; })[0];
    if (!lead) throw erro("Lead não encontrado.");
    if (!String(dados.descricao || "").trim() && !String(dados.titulo || "").trim()) {
      throw erro("Escreva a interação.");
    }
    var item = registrarInteracao(lead, dados.tipo || "nota", dados.titulo || "Interação", String(dados.descricao || "").trim(), { data: dados.data, canal: dados.canal, direcao: dados.direcao });
    if (dados.proximoContato !== undefined) {
      lead.proximoContato = dados.proximoContato ? new Date(dados.proximoContato).toISOString() : null;
      persistir();
    }
    return item;
  }

  function listarTarefas(params) {
    params = params || {};
    var db = carregar();
    var tarefas = db.tarefas.map(enriquecerTarefa);
    if (params.status) tarefas = tarefas.filter(function (t) { return t.status === params.status; });
    if (params.responsavel) tarefas = tarefas.filter(function (t) { return t.responsavel === params.responsavel; });
    if (params.leadId) tarefas = tarefas.filter(function (t) { return t.leadId === params.leadId; });
    tarefas = u.ordenar(tarefas, "data", "asc");

    var agora = new Date();
    var stats = {
      atrasadas: tarefas.filter(function (t) { return t.status === "pendente" && t.atrasada; }).length,
      hoje: tarefas.filter(function (t) { return t.status === "pendente" && !t.atrasada && u.mesmoDia(t.data, agora); }).length,
      semana: tarefas.filter(function (t) {
        if (t.status !== "pendente" || t.atrasada) return false;
        var d = new Date(t.data);
        return d >= agora && d <= u.fimDoDia(u.diasFrente(7));
      }).length,
      concluidas: tarefas.filter(function (t) { return t.status === "concluida"; }).length,
      total: tarefas.length
    };
    return { data: tarefas, stats: stats };
  }

  function criarTarefa(dados) {
    var lead = carregar().leads.filter(function (l) { return l.id === dados.leadId; })[0];
    if (!lead) throw erro("Selecione um lead.", "leadId");
    if (!String(dados.titulo || "").trim()) throw erro("Informe o título da tarefa.", "titulo");
    if (!dados.data) throw erro("Informe a data da tarefa.", "data");
    var tarefa = {
      id: u.uid("tk"), leadId: lead.id, titulo: String(dados.titulo).trim(),
      tipo: dados.tipo || "ligacao", data: new Date(dados.data).toISOString(),
      prioridade: dados.prioridade || lead.prioridade, status: "pendente",
      responsavel: dados.responsavel || lead.responsavel
    };
    carregar().tarefas.push(tarefa);
    lead.proximoContato = tarefa.data;
    lead.atualizadoEm = new Date().toISOString();
    persistir();
    return enriquecerTarefa(tarefa);
  }

  function concluirTarefa(id, concluida) {
    var tarefa = carregar().tarefas.filter(function (t) { return t.id === id; })[0];
    if (!tarefa) throw erro("Tarefa não encontrada.");
    tarefa.status = concluida ? "concluida" : "pendente";
    persistir();
    return enriquecerTarefa(tarefa);
  }

  function removerTarefa(id) {
    var db = carregar();
    var antes = db.tarefas.length;
    db.tarefas = db.tarefas.filter(function (t) { return t.id !== id; });
    if (db.tarefas.length === antes) throw erro("Tarefa não encontrada.");
    persistir();
    return { removido: true };
  }

  /* Pipeline --------------------------------------------------------------- */

  function listarPipeline(params) {
    params = params || {};
    var db = carregar();
    var leads = filtrarLeads(params).map(enriquecerLead);
    var etapas = db.etapas.slice().sort(function (a, b) { return a.ordem - b.ordem; }).map(function (etapa) {
      var itens = leads.filter(function (l) { return l.etapaId === etapa.id; });
      return Object.assign({}, etapa, {
        leads: u.ordenar(itens, "prioridade", "asc").sort(function (a, b) {
          var ordem = { alta: 0, media: 1, baixa: 2 };
          return (ordem[a.prioridade] || 1) - (ordem[b.prioridade] || 1);
        }),
        total: itens.length
      });
    });
    return { etapas: etapas, total: leads.length, facets: filtrosFacets(db.leads) };
  }

  /* Dashboard ------------------------------------------------------------- */

  function contarConversas(leads) {
    var contagem = {
      total: leads.length,
      semMensagem: 0,
      aguardando: 0,
      precisoResponder: 0,
      emConversa: 0,
      conversasAbertas: 0,
      clientes: 0,
      recusados: 0
    };
    leads.forEach(function (lead) {
      var conversa = enriquecerLead(lead).conversa;
      if (conversa.status === "sem_mensagem") contagem.semMensagem++;
      if (conversa.status === "aguardando") contagem.aguardando++;
      if (conversa.status === "responder") contagem.precisoResponder++;
      if (conversa.status === "em_conversa") contagem.emConversa++;
      if (conversa.status === "cliente") contagem.clientes++;
      if (conversa.status === "recusado") contagem.recusados++;
      if (conversa.conversaAberta) contagem.conversasAbertas++;
    });
    return contagem;
  }

  function filtrarConversa(lead, tipo) {
    var status = lead.conversa.status;
    if (tipo === "sem_mensagem") return status === "sem_mensagem";
    if (tipo === "aguardando") return status === "aguardando";
    if (tipo === "responder") return status === "responder";
    if (tipo === "abertas") return lead.conversa.conversaAberta;
    if (tipo === "clientes") return status === "cliente";
    if (tipo === "recusados") return status === "recusado";
    return true;
  }

  function listarConversas(tipo, params) {
    params = params || {};
    var q = u.normalizarTexto(params.q || "");
    var digitosBusca = u.somenteDigitos(params.q);
    var itens = carregar().leads.map(enriquecerLead).filter(function (lead) {
      if (!filtrarConversa(lead, tipo)) return false;
      if (params.responsavel && lead.responsavel !== params.responsavel) return false;
      if (params.prioridade && lead.prioridade !== params.prioridade) return false;
      if (q) {
        var alvo = u.normalizarTexto([
          lead.nome, lead.empresa, lead.telefone, lead.email, lead.cidade,
          lead.responsavel, (lead.tags || []).join(" "), (lead.sistemasNomes || []).join(" ")
        ].join(" "));
        if (alvo.indexOf(q) === -1 && (!digitosBusca || u.somenteDigitos(lead.telefone).indexOf(digitosBusca) === -1)) return false;
      }
      return true;
    });

    itens.sort(function (a, b) {
      if (!a.conversa.ultimaMensagemEm && !b.conversa.ultimaMensagemEm) {
        return new Date(a.criadoEm) - new Date(b.criadoEm);
      }
      var da = new Date(a.conversa.ultimaMensagemEm || a.criadoEm).getTime();
      var db = new Date(b.conversa.ultimaMensagemEm || b.criadoEm).getTime();
      return tipo === "responder" || tipo === "sem_mensagem" ? da - db : db - da;
    });

    var page = Number(params.page) || 1;
    var perPage = Number(params.perPage) || 100;
    var pagina = u.paginar(itens, page, perPage);
    return {
      tipo: tipo,
      data: pagina.data,
      meta: pagina.meta,
      total: itens.length,
      conversas: contarConversas(carregar().leads)
    };
  }

  function dashboard(periodo) {
    var db = carregar();
    periodo = periodo || "30";
    var stats = estatisticasBase(db.leads);

    var tarefas = db.tarefas.map(enriquecerTarefa).filter(function (t) {
      return t.status === "pendente" && t.lead && t.lead.etapa.tipo === "aberto";
    }).sort(function (a, b) { return new Date(a.data) - new Date(b.data); });

    var campanhas = u.ordenar(db.campanhas, "criadaEm", "desc").slice(0, 4);

    return {
      periodo: periodo,
      stats: stats,
      conversas: contarConversas(db.leads),
      tarefas: tarefas.slice(0, 6),
      tarefasTotal: tarefas.length,
      campanhas: campanhas
    };
  }

  /* Campanhas e templates ------------------------------------------------- */

  function listarCampanhas(params) {
    params = params || {};
    var itens = db().campanhas.slice();
    var q = u.normalizarTexto(params.q || "");
    if (q) itens = itens.filter(function (c) { return u.normalizarTexto(c.nome + " " + c.mensagem).indexOf(q) !== -1; });
    if (params.status) itens = itens.filter(function (c) { return c.status === params.status; });
    itens = u.ordenar(itens, "criadaEm", "desc");
    var page = Number(params.page) || 1;
    var perPage = Number(params.perPage) || Painel.config.paginacao.mensagens;
    var pagina = u.paginar(itens, page, perPage);
    var contagens = {
      todas: db().campanhas.length,
      concluida: db().campanhas.filter(function (c) { return c.status === "concluida"; }).length,
      em_andamento: db().campanhas.filter(function (c) { return c.status === "em_andamento"; }).length,
      agendada: db().campanhas.filter(function (c) { return c.status === "agendada"; }).length,
      falha: db().campanhas.filter(function (c) { return c.status === "falha"; }).length
    };
    return { data: pagina.data, meta: pagina.meta, contagens: contagens };
  }

  function db() {
    return carregar();
  }

  function criarCampanha(payload) {
    var db = carregar();
    if (!String(payload.nome || "").trim()) throw erro("Dê um nome para a campanha.", "nome");
    if (!String(payload.mensagem || "").trim()) throw erro("Escreva a mensagem.", "mensagem");
    var leadIds = (payload.leadIds || []).filter(function (id) {
      return db.leads.some(function (l) {
        var etapa = etapaPorId(l.etapaId);
        return l.id === id && !l.naoContatar && etapa && etapa.tipo === "aberto";
      });
    });
    if (!leadIds.length) throw erro("Selecione pelo menos um lead que aceite receber mensagens.", "leads");
    var agendada = payload.agendadaPara ? new Date(payload.agendadaPara) : null;
    var agora = new Date();
    var status = agendada && agendada > agora ? "agendada" : "concluida";
    var falhas = status === "concluida" ? Math.min(1, Math.floor(leadIds.length * 0.03)) : 0;
    var campanha = {
      id: u.uid("cp"),
      nome: String(payload.nome).trim(),
      templateId: payload.templateId || null,
      mensagem: String(payload.mensagem).trim(),
      status: status,
      canal: "WhatsApp",
      leadIds: leadIds,
      publico: leadIds.length,
      enviados: status === "concluida" ? leadIds.length : 0,
      entregues: status === "concluida" ? leadIds.length - falhas : 0,
      falhas: falhas,
      criadaEm: agora.toISOString(),
      agendadaPara: status === "agendada" ? agendada.toISOString() : null,
      responsavel: Painel.auth.usuario().nome
    };
    db.campanhas.unshift(campanha);
    if (status === "concluida") {
      leadIds.forEach(function (id) {
        var lead = db.leads.filter(function (l) { return l.id === id; })[0];
        if (!lead) return;
        lead.ultimoContato = agora.toISOString();
        lead.atualizadoEm = agora.toISOString();
        db.interacoes.push({
          id: u.uid("it"), leadId: lead.id, tipo: "mensagem",
          titulo: "Mensagem enviada — " + campanha.nome,
          descricao: "Mensagem enviada por WhatsApp na campanha “" + campanha.nome + "”.",
          data: agora.toISOString(), usuario: campanha.responsavel, canal: "WhatsApp", direcao: "saida"
        });
      });
    }
    persistir();
    return campanha;
  }

  function cancelarCampanha(id) {
    var campanha = carregar().campanhas.filter(function (c) { return c.id === id; })[0];
    if (!campanha) throw erro("Campanha não encontrada.");
    if (["agendada", "em_andamento"].indexOf(campanha.status) === -1) {
      throw erro("Esta campanha não pode mais ser cancelada.");
    }
    campanha.status = "cancelada";
    persistir();
    return campanha;
  }

  function enviarIndividual(leadId, payload) {
    var lead = carregar().leads.filter(function (l) { return l.id === leadId; })[0];
    if (!lead) throw erro("Lead não encontrado.");
    var etapa = etapaPorId(lead.etapaId);
    if (lead.naoContatar) throw erro("Este lead está marcado como “não contatar”.", "lead");
    if (etapa && etapa.tipo === "perdido") throw erro("Esta oportunidade foi encerrada como perdida. Reative o contato antes de enviar mensagens.", "lead");
    var mensagem = String(payload && payload.mensagem || "").trim();
    if (!mensagem) throw erro("Escreva a mensagem.", "mensagem");
    var agora = new Date().toISOString();
    var interacao = {
      id: u.uid("it"), leadId: lead.id, tipo: "mensagem",
      titulo: "Mensagem individual enviada",
      descricao: mensagem, data: agora, usuario: Painel.auth.usuario().nome,
      canal: "WhatsApp", direcao: "saida"
    };
    carregar().interacoes.push(interacao);
    lead.ultimoContato = agora;
    lead.atualizadoEm = agora;
    persistir();
    return interacao;
  }

  function listarTemplates() {
    return carregar().templates.slice().sort(function (a, b) { return new Date(b.atualizadoEm) - new Date(a.atualizadoEm); });
  }

  function salvarTemplate(dados) {
    var db = carregar();
    if (!String(dados.nome || "").trim()) throw erro("Informe o nome do template.", "nome");
    if (!String(dados.conteudo || "").trim()) throw erro("Escreva o conteúdo do template.", "conteudo");
    var existente = dados.id ? db.templates.filter(function (t) { return t.id === dados.id; })[0] : null;
    if (existente) {
      existente.nome = String(dados.nome).trim();
      existente.categoria = String(dados.categoria || "Geral").trim();
      existente.conteudo = String(dados.conteudo).trim();
      existente.atualizadoEm = new Date().toISOString();
      persistir();
      return existente;
    }
    var novo = {
      id: u.uid("tp"), nome: String(dados.nome).trim(),
      categoria: String(dados.categoria || "Geral").trim(),
      conteudo: String(dados.conteudo).trim(),
      atualizadoEm: new Date().toISOString(), usos: 0
    };
    db.templates.unshift(novo);
    persistir();
    return novo;
  }

  function removerTemplate(id) {
    var db = carregar();
    var antes = db.templates.length;
    db.templates = db.templates.filter(function (t) { return t.id !== id; });
    if (db.templates.length === antes) throw erro("Template não encontrado.");
    persistir();
    return { removido: true };
  }

  /* Relatórios ------------------------------------------------------------ */

  function relatorios(filtros) {
    filtros = filtros || {};
    var db = carregar();
    var leads = filtrarLeads(filtros).filter(function (l) {
      return !filtros.periodo || dentroPeriodo(l.criadoEm, filtros.periodo);
    });
    var stats = estatisticasBase(leads);
    var porSistema = db.sistemas.filter(function (s) { return s.ativo; }).map(function (s) {
      var doSistema = leads.filter(function (l) { return (l.sistemaIds || []).indexOf(s.id) !== -1; });
      var ganhos = doSistema.filter(function (l) { return tipoDoLead(l) === "ganho"; }).length;
      var decididos = doSistema.filter(function (l) { return ["ganho", "perdido"].indexOf(tipoDoLead(l)) !== -1; }).length;
      return { id: s.id, nome: s.nome, cor: s.cor, total: doSistema.length, ganhos: ganhos, taxa: decididos ? u.percentual(ganhos, decididos) : 0 };
    }).sort(function (a, b) { return b.total - a.total; });
    var porOrigem = db.origens.filter(function (o) { return o.ativo; }).map(function (o) {
      var daOrigem = leads.filter(function (l) { return l.origemId === o.id; });
      var ganhos = daOrigem.filter(function (l) { return tipoDoLead(l) === "ganho"; }).length;
      return { nome: o.nome, total: daOrigem.length, ganhos: ganhos };
    }).filter(function (o) { return o.total; }).sort(function (a, b) { return b.total - a.total; });
    var porResponsavel = db.equipe.filter(function (m) { return m.status === "ativo"; }).map(function (m) {
      var doResponsavel = leads.filter(function (l) { return l.responsavel === m.nome; });
      var ganhos = doResponsavel.filter(function (l) { return tipoDoLead(l) === "ganho"; }).length;
      var decididos = doResponsavel.filter(function (l) { return ["ganho", "perdido"].indexOf(tipoDoLead(l)) !== -1; }).length;
      return { nome: m.nome, iniciais: m.iniciais, total: doResponsavel.length, ganhos: ganhos, taxa: decididos ? u.percentual(ganhos, decididos) : 0 };
    }).sort(function (a, b) { return b.total - a.total; });
    var motivos = {};
    leads.filter(function (l) { return tipoDoLead(l) === "perdido"; }).forEach(function (l) {
      var m = l.motivoPerda || "Não informado";
      motivos[m] = (motivos[m] || 0) + 1;
    });
    var motivosLista = Object.keys(motivos).map(function (m) { return { label: m, valor: motivos[m] }; }).sort(function (a, b) { return b.valor - a.valor; });
    var porEtapa = db.etapas.slice().sort(function (a, b) { return a.ordem - b.ordem; }).map(function (e) {
      return { id: e.id, nome: e.nome, cor: e.cor, valor: leads.filter(function (l) { return l.etapaId === e.id; }).length };
    });
    var campanhas = db.campanhas.filter(function (c) { return !filtros.periodo || dentroPeriodo(c.criadaEm, filtros.periodo); });
    var mensagens = campanhas.reduce(function (acc, c) {
      acc.publico += c.publico || 0;
      acc.enviados += c.enviados || 0;
      acc.entregues += c.entregues || 0;
      acc.falhas += c.falhas || 0;
      return acc;
    }, { publico: 0, enviados: 0, entregues: 0, falhas: 0 });
    return {
      stats: stats,
      porSistema: porSistema,
      porOrigem: porOrigem,
      porResponsavel: porResponsavel,
      motivos: motivosLista,
      porEtapa: porEtapa,
      mensagens: mensagens,
      campanhas: campanhas.length
    };
  }

  /* Configurações --------------------------------------------------------- */

  function obterConfig() {
    var db = carregar();
    return {
      empresa: db.config.empresa,
      mensagens: db.config.mensagens,
      sistemas: db.sistemas,
      etapas: db.etapas.slice().sort(function (a, b) { return a.ordem - b.ordem; }),
      origens: db.origens,
      equipe: db.equipe,
      counts: {
        leads: db.leads.length,
        interacoes: db.interacoes.length,
        tarefas: db.tarefas.length,
        campanhas: db.campanhas.length,
        templates: db.templates.length
      },
      sessao: Painel.auth.usuario()
    };
  }

  function salvarConfig(secao, dados) {
    var db = carregar();
    if (!db.config[secao]) throw erro("Seção de configuração inválida.");
    Object.keys(dados).forEach(function (k) { db.config[secao][k] = dados[k]; });
    persistir();
    return db.config[secao];
  }

  function salvarSistema(dados) {
    var db = carregar();
    if (!String(dados.nome || "").trim()) throw erro("Informe o nome do sistema.", "nome");
    var duplicado = db.sistemas.some(function (s) {
      return s.id !== dados.id && u.normalizarTexto(s.nome) === u.normalizarTexto(dados.nome);
    });
    if (duplicado) throw erro("Já existe um sistema com este nome.", "nome");
    var sistema = dados.id ? db.sistemas.filter(function (s) { return s.id === dados.id; })[0] : null;
    if (sistema) {
      sistema.nome = String(dados.nome).trim();
      sistema.descricao = String(dados.descricao || "").trim();
      sistema.cor = dados.cor || sistema.cor;
      sistema.ativo = dados.ativo !== false;
    } else {
      sistema = {
        id: u.uid("sis"), nome: String(dados.nome).trim(),
        descricao: String(dados.descricao || "").trim(),
        cor: dados.cor || "#0B6B57", ativo: true
      };
      db.sistemas.push(sistema);
    }
    persistir();
    return sistema;
  }

  function removerSistema(id) {
    var db = carregar();
    var emUso = db.leads.some(function (l) { return (l.sistemaIds || []).indexOf(id) !== -1; });
    var sistema = db.sistemas.filter(function (s) { return s.id === id; })[0];
    if (!sistema) throw erro("Sistema não encontrado.");
    if (emUso) {
      sistema.ativo = false;
      persistir();
      return { arquivado: true };
    }
    db.sistemas = db.sistemas.filter(function (s) { return s.id !== id; });
    persistir();
    return { removido: true };
  }

  function salvarOrigem(dados) {
    var db = carregar();
    var nome = String(dados.nome || "").trim();
    if (!nome) throw erro("Informe o nome da origem.", "nome");
    var origem = dados.id ? db.origens.filter(function (o) { return o.id === dados.id; })[0] : null;
    var duplicada = db.origens.some(function (o) {
      return (!origem || o.id !== origem.id) && u.normalizarTexto(o.nome) === u.normalizarTexto(nome);
    });
    if (duplicada) throw erro("Já existe uma origem com este nome.", "nome");
    if (origem) {
      origem.nome = nome;
      origem.ativo = dados.ativo !== false;
    } else {
      origem = { id: u.uid("org"), nome: nome, ativo: true };
      db.origens.push(origem);
    }
    persistir();
    return origem;
  }

  function removerOrigem(id) {
    var db = carregar();
    var emUso = db.leads.some(function (l) { return l.origemId === id; });
    var origem = db.origens.filter(function (o) { return o.id === id; })[0];
    if (!origem) throw erro("Origem não encontrada.");
    if (emUso) {
      origem.ativo = false;
      persistir();
      return { arquivado: true };
    }
    db.origens = db.origens.filter(function (o) { return o.id !== id; });
    persistir();
    return { removido: true };
  }

  function salvarEtapa(dados) {
    var db = carregar();
    var nome = String(dados.nome || "").trim();
    if (!nome) throw erro("Informe o nome da etapa.", "nome");
    var etapa = dados.id ? db.etapas.filter(function (e) { return e.id === dados.id; })[0] : null;
    var duplicada = db.etapas.some(function (e) {
      return (!etapa || e.id !== etapa.id) && u.normalizarTexto(e.nome) === u.normalizarTexto(nome);
    });
    if (duplicada) throw erro("Já existe uma etapa com este nome.", "nome");

    var tipo = ["aberto", "ganho", "perdido"].indexOf(dados.tipo) !== -1
      ? dados.tipo
      : (etapa ? etapa.tipo : "aberto");
    if (etapa && etapa.tipo === "aberto" && tipo !== "aberto") {
      var outraAberta = db.etapas.some(function (e) { return e.id !== etapa.id && e.tipo === "aberto"; });
      if (!outraAberta) throw erro("O funil precisa ter pelo menos uma etapa em aberto.", "tipo");
    }

    if (etapa) {
      etapa.nome = nome;
      etapa.cor = dados.cor || etapa.cor;
      etapa.tipo = tipo;
    } else {
      var max = db.etapas.length ? Math.max.apply(null, db.etapas.map(function (e) { return e.ordem; })) : -1;
      etapa = {
        id: u.uid("et"), nome: nome,
        cor: dados.cor || "#0B6B57",
        tipo: tipo,
        ordem: max + 1
      };
      db.etapas.push(etapa);
    }
    persistir();
    return etapa;
  }

  function reordenarEtapas(ids) {
    var db = carregar();
    var posicao = {};
    (ids || []).forEach(function (id, idx) { posicao[id] = idx; });
    var ordenadas = db.etapas.slice().sort(function (a, b) {
      var pa = Object.prototype.hasOwnProperty.call(posicao, a.id) ? posicao[a.id] : a.ordem;
      var pb = Object.prototype.hasOwnProperty.call(posicao, b.id) ? posicao[b.id] : b.ordem;
      return pa - pb;
    });
    var abertas = ordenadas.filter(function (e) { return e.tipo === "aberto"; });
    var terminais = ordenadas.filter(function (e) { return e.tipo !== "aberto"; });
    abertas.concat(terminais).forEach(function (etapa, idx) { etapa.ordem = idx; });
    persistir();
    return db.etapas.slice().sort(function (a, b) { return a.ordem - b.ordem; });
  }

  function removerEtapa(id) {
    var db = carregar();
    var etapa = db.etapas.filter(function (e) { return e.id === id; })[0];
    if (!etapa) throw erro("Etapa não encontrada.");
    if (db.etapas.length <= 2) throw erro("O funil precisa ter pelo menos duas etapas.");
    var restantes = db.etapas.filter(function (e) { return e.id !== id; }).sort(function (a, b) { return a.ordem - b.ordem; });
    if (!restantes.some(function (e) { return e.tipo === "aberto"; })) {
      throw erro("O funil precisa ter pelo menos uma etapa em aberto.");
    }
    var destino = restantes.filter(function (e) { return e.tipo === "aberto"; })[0];
    var movidos = 0;
    db.leads.forEach(function (l) {
      if (l.etapaId === id) { l.etapaId = destino.id; movidos++; }
    });
    db.etapas = restantes;
    db.etapas.forEach(function (e, idx) { e.ordem = idx; });
    persistir();
    return { removido: true, movidos: movidos, destino: destino.nome };
  }

  function convidarMembro(dados) {
    var db = carregar();
    if (!String(dados.nome || "").trim()) throw erro("Informe o nome do membro.", "nome");
    var email = String(dados.email || "").trim().toLowerCase();
    if (!emailValido(email)) throw erro("Informe um e-mail válido.", "email");
    if (db.equipe.some(function (m) { return String(m.email || "").toLowerCase() === email; })) {
      throw erro("Já existe um membro com este e-mail.", "email");
    }
    var membro = {
      id: u.uid("us"), nome: String(dados.nome).trim(),
      email: email,
      perfil: dados.perfil || "Consultor comercial",
      status: "convite", iniciais: u.iniciais(dados.nome)
    };
    db.equipe.push(membro);
    persistir();
    return membro;
  }

  function removerMembro(id) {
    var db = carregar();
    var membro = db.equipe.filter(function (m) { return m.id === id; })[0];
    if (!membro) throw erro("Membro não encontrado.");
    if (membro.id === "us_001") throw erro("Não é possível remover a administradora da conta.");
    db.equipe = db.equipe.filter(function (m) { return m.id !== id; });
    persistir();
    return { removido: true };
  }

  /* Notificações e sistema ------------------------------------------------ */

  function listarNotificacoes() {
    var db = carregar();
    return db.notificacoes.slice().sort(function (a, b) { return new Date(b.data) - new Date(a.data); });
  }

  function marcarNotificacoesLidas() {
    var db = carregar();
    db.notificacoes.forEach(function (n) { n.lida = true; });
    persistir();
    return { ok: true };
  }

  function resetarDemo() {
    DB = u.clonar(Painel.seed);
    persistir();
    return { ok: true };
  }

  /* Fachada --------------------------------------------------------------- */

  Painel.apiMock = {
    modo: "mock",

    auth: {
      login: function (email, senha) { return Painel.auth.entrar(email, senha); },
      logout: function () { Painel.auth.sair(); }
    },

    dashboard: {
      obter: function (periodo) { return responder(function () { return dashboard(periodo); }); },
      conversas: function (tipo, params) { return responder(function () { return listarConversas(tipo, params); }); }
    },

    leads: {
      listar: function (params) { return responder(function () { return listarLeads(params); }); },
      obter: function (id) { return responder(function () { return obterLead(id); }); },
      criar: function (dados) { return responder(function () { return criarLead(dados); }); },
      atualizar: function (id, dados) { return responder(function () { return atualizarLead(id, dados); }); },
      mover: function (id, etapaId) { return responder(function () { return moverLead(id, etapaId); }); },
      remover: function (id) { return responder(function () { return removerLead(id); }); },
      importar: function (linhas) { return responder(function () { return importarLeads(linhas); }); }
    },

    interacoes: {
      criar: function (leadId, dados) { return responder(function () { return criarInteracao(leadId, dados); }); }
    },

    tarefas: {
      listar: function (params) { return responder(function () { return listarTarefas(params); }); },
      criar: function (dados) { return responder(function () { return criarTarefa(dados); }); },
      concluir: function (id, concluida) { return responder(function () { return concluirTarefa(id, concluida); }); },
      remover: function (id) { return responder(function () { return removerTarefa(id); }); }
    },

    pipeline: {
      obter: function (params) { return responder(function () { return listarPipeline(params); }); }
    },

    mensagens: {
      listar: function (params) { return responder(function () { return listarCampanhas(params); }); },
      criar: function (payload) { return responder(function () { return criarCampanha(payload); }); },
      cancelar: function (id) { return responder(function () { return cancelarCampanha(id); }); },
      enviarIndividual: function (leadId, payload) { return responder(function () { return enviarIndividual(leadId, payload); }); },
      templates: function () { return responder(function () { return listarTemplates(); }); },
      salvarTemplate: function (dados) { return responder(function () { return salvarTemplate(dados); }); },
      removerTemplate: function (id) { return responder(function () { return removerTemplate(id); }); }
    },

    relatorios: {
      obter: function (filtros) { return responder(function () { return relatorios(filtros); }); }
    },

    configuracoes: {
      obter: function () { return responder(function () { return obterConfig(); }); },
      salvar: function (secao, dados) { return responder(function () { return salvarConfig(secao, dados); }); },
      salvarSistema: function (dados) { return responder(function () { return salvarSistema(dados); }); },
      removerSistema: function (id) { return responder(function () { return removerSistema(id); }); },
      salvarOrigem: function (dados) { return responder(function () { return salvarOrigem(dados); }); },
      removerOrigem: function (id) { return responder(function () { return removerOrigem(id); }); },
      salvarEtapa: function (dados) { return responder(function () { return salvarEtapa(dados); }); },
      reordenarEtapas: function (ids) { return responder(function () { return reordenarEtapas(ids); }); },
      removerEtapa: function (id) { return responder(function () { return removerEtapa(id); }); },
      convidar: function (dados) { return responder(function () { return convidarMembro(dados); }); },
      removerMembro: function (id) { return responder(function () { return removerMembro(id); }); }
    },

    notificacoes: {
      listar: function () { return responder(function () { return listarNotificacoes(); }); },
      marcarLidas: function () { return responder(function () { return marcarNotificacoesLidas(); }); }
    },

    sistema: {
      resetar: function () { return responder(function () { return resetarDemo(); }); }
    }
  };
})(window.Painel);
