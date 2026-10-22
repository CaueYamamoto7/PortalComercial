/* ==========================================================================
   Painel Comercial — Leads
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var ui = Painel.ui;
  var api = Painel.api;
  var leadUI = Painel.leadUI;

  var estado = {
    page: 1,
    perPage: 12,
    q: "",
    etapa: "",
    sistema: "",
    origem: "",
    responsavel: "",
    prioridade: "",
    possuiSistema: "",
    naoContatar: "",
    atrasados: "",
    sort: "atualizadoEm",
    direction: "desc"
  };

  var selecionados = {};
  var idsPagina = [];
  var facetsCarregadas = false;

  function el(id) { return document.getElementById(id); }

  function params() {
    var p = {};
    Object.keys(estado).forEach(function (k) {
      if (estado[k] !== "" && estado[k] !== null && estado[k] !== undefined) p[k] = estado[k];
    });
    p.page = estado.page;
    p.perPage = estado.perPage;
    return p;
  }

  function possuiLabel(v) {
    if (v === "sim") return '<span class="badge badge--info">Sim</span>';
    if (v === "nao") return '<span class="badge badge--neutral">Não</span>';
    return '<span class="badge badge--neutral">Não inf.</span>';
  }

  function renderStats(stats) {
    var mapa = {
      total: stats.total,
      abertos: stats.abertos,
      atrasados: stats.atrasados,
      novosMes: stats.novosMes
    };
    Object.keys(mapa).forEach(function (k) {
      var node = document.querySelector('[data-stat="' + k + '"]');
      if (node) node.textContent = u.formatarNumero(mapa[k]);
    });
  }

  function preencherFacets(facets) {
    if (facetsCarregadas) return;
    facetsCarregadas = true;
    el("filtro-etapa").innerHTML = '<option value="">Todas as etapas</option><option value="abertos">Somente em aberto</option>' +
      facets.etapas.map(function (e) { return '<option value="' + e.id + '">' + u.escaparHTML(e.nome) + "</option>"; }).join("");
    el("filtro-sistema").innerHTML = '<option value="">Todos os sistemas</option>' +
      facets.sistemas.map(function (s) { return '<option value="' + s.id + '">' + u.escaparHTML(s.nome) + "</option>"; }).join("");
    el("filtro-origem").innerHTML = '<option value="">Todas as origens</option>' +
      facets.origens.map(function (o) { return '<option value="' + o.id + '">' + u.escaparHTML(o.nome) + "</option>"; }).join("");
    el("filtro-responsavel").innerHTML = '<option value="">Todos os responsáveis</option>' +
      facets.responsaveis.map(function (r) { return '<option value="' + u.escaparHTML(r.nome) + '">' + u.escaparHTML(r.nome) + "</option>"; }).join("");
  }

  function renderTabela(data) {
    var tbody = el("leads-tbody");
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty"><span class="empty__icon">' + ui.icone("inbox") + "</span>" +
        "<h3>Nenhum lead encontrado</h3><p>Ajuste os filtros ou importe uma planilha para começar.</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-novo>Cadastrar lead</button></div></td></tr>';
      return;
    }

    tbody.innerHTML = data.map(function (l) {
      var proximo = l.proximoContato
        ? '<span class="next-date' + (l.proximoContatoAtrasado ? " is-late" : "") + '"><strong>' + u.rotuloPrazo(l.proximoContato) + "</strong><small>" + u.formatarData(l.proximoContato) + "</small></span>"
        : '<span class="faint">—</span>';
      return '<tr data-lead-row="' + l.id + '">' +
        '<td class="td--check"><input class="row-check" type="checkbox" data-select="' + l.id + '"' + (selecionados[l.id] ? " checked" : "") + "></td>" +
        '<td><button class="cell-main cell-main--button" type="button" data-open="' + l.id + '">' +
          '<span class="avatar avatar--sm ' + u.tomAvatar(l.nome) + '">' + u.escaparHTML(u.iniciais(l.nome)) + "</span>" +
          "<span><strong>" + u.escaparHTML(l.nome) + "</strong><small>" + u.escaparHTML(l.empresa || "Sem empresa") + (l.cargo ? " · " + u.escaparHTML(l.cargo) : "") + "</small></span></button></td>" +
        '<td><div class="contact-cell"><strong>' + u.formatarTelefone(l.telefone) + "</strong><small>" + u.escaparHTML(l.email || "Sem e-mail") + "</small></div></td>" +
        "<td>" + leadUI.sistemaChips(l.sistemas, 2) + "</td>" +
        "<td>" + possuiLabel(l.possuiSistema) + "</td>" +
        "<td>" + leadUI.etapaBadge(l.etapa) + "</td>" +
        '<td><span class="resp-cell"><span class="avatar avatar--xs ' + u.tomAvatar(l.responsavel) + '">' + u.escaparHTML(u.iniciais(l.responsavel)) + "</span>" + u.escaparHTML(u.primeiroNome(l.responsavel)) + "</span></td>" +
        "<td>" + proximo + "</td>" +
        '<td class="td--actions"><div class="row-actions">' +
          '<button class="icon-btn icon-btn--sm" type="button" data-msg="' + l.id + '" title="Enviar mensagem" aria-label="Enviar mensagem para ' + u.escaparHTML(l.nome) + '"' + (l.naoContatar || (l.etapa && l.etapa.tipo === "perdido") ? " disabled" : "") + ">" + ui.icone("message-circle") + "</button>" +
          '<button class="icon-btn icon-btn--sm" type="button" data-menu="' + l.id + '" title="Mais ações" aria-label="Mais ações para ' + u.escaparHTML(l.nome) + '">' + ui.icone("more") + "</button>" +
        "</div></td>" +
      "</tr>";
    }).join("");
  }

  function renderPaginacao(meta) {
    var cont = el("leads-pagination");
    var info = el("leads-info");
    var inicio = meta.total ? (meta.page - 1) * meta.perPage + 1 : 0;
    var fim = Math.min(meta.page * meta.perPage, meta.total);
    info.innerHTML = "Mostrando <strong>" + inicio + "–" + fim + "</strong> de <strong>" + meta.total + "</strong> lead(s)";
    if (meta.paginas <= 1) { cont.innerHTML = ""; return; }

    var paginas = [];
    var atual = meta.page;
    for (var i = 1; i <= meta.paginas; i++) {
      if (i === 1 || i === meta.paginas || Math.abs(i - atual) <= 1) paginas.push(i);
      else if (paginas[paginas.length - 1] !== "…") paginas.push("…");
    }
    cont.innerHTML =
      '<button type="button" data-page="' + (atual - 1) + '"' + (atual === 1 ? " disabled" : "") + ' aria-label="Página anterior">' + ui.icone("chevron-left") + "</button>" +
      paginas.map(function (p) {
        if (p === "…") return '<span class="pagination__gap">…</span>';
        return '<button type="button" data-page="' + p + '"' + (p === atual ? ' class="is-active"' : "") + ">" + p + "</button>";
      }).join("") +
      '<button type="button" data-page="' + (atual + 1) + '"' + (atual === meta.paginas ? " disabled" : "") + ' aria-label="Próxima página">' + ui.icone("chevron-right") + "</button>";
  }

  function atualizarBulk() {
    var ids = Object.keys(selecionados).filter(function (k) { return selecionados[k]; });
    var bar = el("bulk-bar");
    el("bulk-count").textContent = ids.length;
    bar.classList.toggle("is-visible", ids.length > 0);
    var todos = el("selecionar-todos");
    if (todos) {
      todos.checked = idsPagina.length > 0 && idsPagina.every(function (id) { return !!selecionados[id]; });
      todos.indeterminate = idsPagina.some(function (id) { return !!selecionados[id]; }) && !todos.checked;
    }
  }

  function limparSelecao() {
    selecionados = {};
    atualizarBulk();
  }

  function carregar() {
    return api.leads.listar(params()).then(function (res) {
      preencherFacets(res.facets);
      renderStats(res.stats);
      renderTabela(res.data);
      renderPaginacao(res.meta);
      idsPagina = res.data.map(function (l) { return l.id; });
      atualizarBulk();
      ui.recarregarResumoSidebar();
      return res;
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar os leads.", "error");
      el("leads-tbody").innerHTML = '<tr><td colspan="9"><div class="empty"><p>Erro ao carregar os leads.</p></div></td></tr>';
    });
  }

  function recarregarPrimeira() {
    estado.page = 1;
    return carregar();
  }

  /* Exportação ------------------------------------------------------------- */

  var COLUNAS_EXPORT = [
    { label: "Nome", value: function (l) { return l.nome; } },
    { label: "Empresa", value: function (l) { return l.empresa; } },
    { label: "Cargo", value: function (l) { return l.cargo; } },
    { label: "WhatsApp", value: function (l) { return u.formatarTelefone(l.telefone); } },
    { label: "E-mail", value: function (l) { return l.email; } },
    { label: "Cidade", value: function (l) { return l.cidade; } },
    { label: "UF", value: function (l) { return l.uf; } },
    { label: "Origem", value: function (l) { return l.origem ? l.origem.nome : ""; } },
    { label: "Detalhe da origem", value: function (l) { return l.origemDetalhe; } },
    { label: "Sistemas", value: function (l) { return (l.sistemasNomes || []).join(", "); } },
    { label: "Possui sistema", value: function (l) { return l.possuiSistema === "sim" ? "Sim" : l.possuiSistema === "nao" ? "Não" : "Não informado"; } },
    { label: "Sistema atual", value: function (l) { return l.sistemaAtual; } },
    { label: "Etapa", value: function (l) { return l.etapa ? l.etapa.nome : ""; } },
    { label: "Prioridade", value: function (l) { return l.prioridade; } },
    { label: "Responsável", value: function (l) { return l.responsavel; } },
    { label: "Próximo contato", value: function (l) { return l.proximoContato ? u.formatarData(l.proximoContato) : ""; } },
    { label: "Último contato", value: function (l) { return l.ultimoContato ? u.formatarData(l.ultimoContato) : ""; } },
    { label: "Tags", value: function (l) { return (l.tags || []).join(", "); } },
    { label: "Observações", value: function (l) { return l.observacoes; } },
    { label: "Não contatar", value: function (l) { return l.naoContatar ? "Sim" : "Não"; } }
  ];

  function exportar(ids) {
    var p = params();
    p.page = 1;
    p.perPage = 1000;
    if (ids) p.ids = ids.join(",");
    api.leads.listar(p).then(function (res) {
      if (!res.data.length) {
        ui.toast("Nenhum lead para exportar com os filtros atuais.", "warning");
        return;
      }
      var nome = "leads-assinasoft-" + u.paraInputDate(new Date()) + ".csv";
      u.baixarCSV(nome, COLUNAS_EXPORT, res.data);
      ui.toast(res.data.length + " lead(s) exportado(s).", "success");
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível exportar.", "error");
    });
  }

  function abrirEdicao(id) {
    api.leads.obter(id).then(function (res) {
      leadUI.abrirFormulario(res.lead, {
        onSaved: function () {
          leadUI.invalidarListas();
          carregar();
        }
      });
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível abrir o lead.", "error");
    });
  }

  function abrirMenu(anchor, id) {
    var lead = null;
    ui.menu(anchor, [
      { label: "Enviar mensagem", icone: "message-circle", acao: function () { leadUI.abrirMensagem(id, { onSent: carregar }); } },
      { label: "Editar lead", icone: "pencil", acao: function () { abrirEdicao(id); } },
      { label: "Mover etapa", icone: "kanban", acao: function () { leadUI.abrirMudarEtapa([id], { onDone: function () { carregar(); } }); } },
      { label: "Agendar follow-up", icone: "calendar-plus", acao: function () { leadUI.abrirTarefa({ lead: lead, onSaved: carregar }); } },
      { divider: true },
      {
        label: "Excluir lead", icone: "trash", perigo: true, acao: function () {
          api.leads.obter(id).then(function (res) {
            lead = res.lead;
            return ui.confirmar({
              titulo: "Excluir lead",
              texto: "Excluir <strong>" + u.escaparHTML(lead.nome) + "</strong> e todo o histórico? Esta ação não pode ser desfeita.",
              acao: "Excluir",
              perigo: true
            });
          }).then(function (ok) {
            if (!ok) return;
            return api.leads.remover(id).then(function () {
              delete selecionados[id];
              ui.toast("Lead excluído.", "success");
              carregar();
            });
          }).catch(function (err) {
            ui.toast(err.message || "Não foi possível excluir.", "error");
          });
        }
      }
    ]);
    // Carrega os dados em segundo plano para a ação de agendamento.
    api.leads.obter(id).then(function (res) { lead = res.lead; }).catch(function () { });
  }

  /* Importação ------------------------------------------------------------- */

  var CAMPOS_IMPORT = [
    { key: "nome", label: "Nome", req: true, sinonimos: ["nome", "name", "contato", "lead", "cliente", "nome_do_contato"] },
    { key: "telefone", label: "WhatsApp", req: true, sinonimos: ["telefone", "phone", "celular", "whatsapp", "numero", "fone", "telefone_whatsapp", "whatsapp_celular"] },
    { key: "email", label: "E-mail", sinonimos: ["email", "e_mail", "mail"] },
    { key: "empresa", label: "Empresa", sinonimos: ["empresa", "company", "organizacao", "negocio", "razao_social"] },
    { key: "cargo", label: "Cargo", sinonimos: ["cargo", "funcao", "posicao", "cargo_funcao"] },
    { key: "cidade", label: "Cidade", sinonimos: ["cidade", "city", "municipio"] },
    { key: "uf", label: "UF", sinonimos: ["uf", "estado", "state"] },
    { key: "origem", label: "Origem", sinonimos: ["origem", "source", "canal", "fonte", "como_conheceu"] },
    { key: "origemDetalhe", label: "Detalhe da origem", sinonimos: ["evento", "origem_detalhe", "detalhe", "feira", "campanha"] },
    { key: "sistemas_interesse", label: "Sistemas de interesse", sinonimos: ["sistemas_interesse", "sistema", "sistemas", "produto", "interesse", "sistema_de_interesse"] },
    { key: "possui_sistema", label: "Possui sistema", sinonimos: ["possui_sistema", "possui", "ja_possui", "possui_sistema_parecido"] },
    { key: "sistema_atual", label: "Sistema atual", sinonimos: ["sistema_atual", "fornecedor", "ferramenta_atual"] },
    { key: "etapa", label: "Etapa", sinonimos: ["etapa", "stage", "fase", "status"] },
    { key: "prioridade", label: "Prioridade", sinonimos: ["prioridade", "priority"] },
    { key: "responsavel", label: "Responsável", sinonimos: ["responsavel", "owner", "vendedor", "consultor", "comercial"] },
    { key: "proximo_contato", label: "Próximo contato", sinonimos: ["proximo_contato", "data", "retorno", "follow_up", "proximo_followup"] },
    { key: "observacoes", label: "Observações", sinonimos: ["observacoes", "notas", "obs", "comentarios", "anotacoes"] },
    { key: "tags", label: "Tags", sinonimos: ["tags", "etiquetas", "segmento"] }
  ];

  var importacao = null;

  function parseDataFlexivel(valor) {
    if (!valor && valor !== 0) return "";
    if (valor instanceof Date) return isNaN(valor.getTime()) ? "" : valor.toISOString();
    if (typeof valor === "number" && window.XLSX && XLSX.SSF && XLSX.SSF.parse_date_code) {
      var dc = XLSX.SSF.parse_date_code(valor);
      if (dc) return new Date(dc.y, dc.m - 1, dc.d, dc.H || 10, dc.M || 0).toISOString();
    }
    var s = String(valor).trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      var iso = new Date(s);
      return isNaN(iso.getTime()) ? "" : iso.toISOString();
    }
    var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) {
      var ano = Number(m[3]);
      if (ano < 100) ano += 2000;
      var d = new Date(ano, Number(m[2]) - 1, Number(m[1]), 10, 0, 0);
      return isNaN(d.getTime()) ? "" : d.toISOString();
    }
    var d2 = new Date(s);
    return isNaN(d2.getTime()) ? "" : d2.toISOString();
  }

  function mostrarArquivo(file) {
    var area = document.getElementById("imp-area");
    var drop = document.getElementById("imp-drop");
    if (!area || !drop) return;
    drop.hidden = true;
    area.hidden = false;
    area.innerHTML = '<div class="import-loading"><span class="spinner"></span>Lendo <strong>' + u.escaparHTML(file.name) + "</strong>…</div>";

    var ext = (file.name.split(".").pop() || "").toLowerCase();
    var leitura;
    if (ext === "csv" || ext === "txt") {
      leitura = file.text().then(function (texto) {
        var parsed = u.parseMatrizCSV(texto);
        return { matriz: parsed.matriz, tipo: "csv" };
      });
    } else if (ext === "xlsx" || ext === "xls") {
      if (!window.XLSX) {
        return Promise.reject(new Error("A biblioteca de Excel não carregou. Use CSV ou recarregue a página."));
      }
      leitura = file.arrayBuffer().then(function (buffer) {
        var wb = XLSX.read(buffer, { type: "array", cellDates: true });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var matriz = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
        return { matriz: matriz, tipo: "xlsx" };
      });
    } else {
      area.innerHTML = '<div class="notice notice--danger">' + ui.icone("alert-triangle") + "<div><strong>Formato não suportado.</strong>Envie um arquivo CSV, XLSX ou XLS.</div></div>" +
        '<button class="btn btn--secondary btn--sm" type="button" data-outro-arquivo style="margin-top:12px">Escolher outro arquivo</button>';
      area.querySelector("[data-outro-arquivo]").addEventListener("click", function () {
        document.getElementById("imp-file").click();
      });
      return;
    }

    leitura.then(function (res) {
      var matriz = (res.matriz || []).filter(function (linha) {
        return linha.some(function (c) { return String(c === null || c === undefined ? "" : c).trim() !== ""; });
      });
      if (matriz.length < 2) throw new Error("A planilha precisa ter uma linha de cabeçalho e pelo menos um contato.");
      var labels = matriz[0].map(function (h, i) { return String(h || "Coluna " + (i + 1)).trim(); });
      var headers = labels.map(function (h) { return u.normalizarChave(h); });
      var rows = matriz.slice(1);
      if (rows.length > 5000) throw new Error("A planilha tem mais de 5.000 linhas. Divida o arquivo em partes.");

      var mapeamento = {};
      CAMPOS_IMPORT.forEach(function (campo) {
        var idx = -1;
        campo.sinonimos.some(function (sin) {
          var alvo = u.normalizarChave(sin);
          var exato = headers.indexOf(alvo);
          if (exato !== -1) { idx = exato; return true; }
          return false;
        });
        if (idx === -1) {
          campo.sinonimos.some(function (sin) {
            var alvo = u.normalizarChave(sin);
            var parcial = headers.findIndex(function (h) { return h && (h.indexOf(alvo) !== -1 || alvo.indexOf(h) !== -1); });
            if (parcial !== -1) { idx = parcial; return true; }
            return false;
          });
        }
        mapeamento[campo.key] = idx;
      });

      importacao = { headers: headers, labels: labels, rows: rows, mapeamento: mapeamento, arquivo: file.name, tipo: res.tipo };
      renderMapeamento();
    }).catch(function (err) {
      area.innerHTML = '<div class="notice notice--danger">' + ui.icone("alert-triangle") + "<div><strong>Não foi possível ler o arquivo.</strong>" + u.escaparHTML(err.message) + "</div></div>" +
        '<button class="btn btn--secondary btn--sm" type="button" data-outro-arquivo style="margin-top:12px">Escolher outro arquivo</button>';
      area.querySelector("[data-outro-arquivo]").addEventListener("click", function () {
        document.getElementById("imp-file").click();
      });
    });
  }

  function renderMapeamento() {
    var area = document.getElementById("imp-area");
    var imp = importacao;
    if (!area || !imp) return;
    var opcoesColuna = function (campo) {
      return '<option value="-1">Não importar</option>' + imp.labels.map(function (label, i) {
        return '<option value="' + i + '"' + (imp.mapeamento[campo.key] === i ? " selected" : "") + ">" + u.escaparHTML(label) + "</option>";
      }).join("");
    };

    area.innerHTML =
      '<div class="import-file"><span class="import-file__icon">' + ui.icone("file-spreadsheet") + "</span>" +
        "<div><strong>" + u.escaparHTML(imp.arquivo) + "</strong><span>" + imp.rows.length + " linha(s) · " + imp.labels.length + " coluna(s)</span></div>" +
        '<button class="btn btn--ghost btn--sm" type="button" data-outro-arquivo>Trocar arquivo</button>' +
      "</div>" +
      '<div class="import-layout">' +
        '<div><div class="form-section__title" style="margin-top:0">Relacione as colunas</div>' +
          '<p class="small muted" style="margin:-2px 0 12px">Nome e WhatsApp são obrigatórios. Você pode importar apenas parte das colunas.</p>' +
          '<div class="import-map">' + CAMPOS_IMPORT.map(function (campo) {
            return '<label class="import-map__row"><span>' + campo.label + (campo.req ? ' <em class="req">*</em>' : "") + "</span>" +
              '<select class="select select--sm" data-map="' + campo.key + '">' + opcoesColuna(campo) + "</select></label>";
          }).join("") + "</div></div>" +
        '<div><div class="form-section__title" style="margin-top:0">Prévia dos dados</div>' +
          '<div class="import-preview" id="import-preview"></div>' +
          '<p class="small muted" style="margin-top:10px">Linhas com telefone inválido ou já cadastrado serão ignoradas e aparecerão no resumo.</p>' +
        "</div>" +
      "</div>";

    area.querySelector("[data-outro-arquivo]").addEventListener("click", function () {
      document.getElementById("imp-file").click();
    });

    atualizarPrevia();
    atualizarBotaoImportar();
  }

  function valorPreview(valor) {
    if (valor instanceof Date) return u.formatarData(valor);
    var s = String(valor === null || valor === undefined ? "" : valor).trim();
    return s ? u.truncar(s, 42) : '<span class="faint">—</span>';
  }

  function atualizarPrevia() {
    if (!importacao) return;
    var preview = document.getElementById("import-preview");
    if (!preview) return;
    var campos = CAMPOS_IMPORT.filter(function (c) { return importacao.mapeamento[c.key] >= 0; });
    var linhas = importacao.rows.slice(0, 5);
    preview.innerHTML = '<table><thead><tr>' + campos.map(function (c) { return "<th>" + c.label + "</th>"; }).join("") + "</tr></thead><tbody>" +
      linhas.map(function (linha) {
        return "<tr>" + campos.map(function (c) {
          return "<td>" + valorPreview(linha[importacao.mapeamento[c.key]]) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table>";
  }

  function atualizarBotaoImportar() {
    var btn = document.querySelector("[data-importar-leads]");
    if (!btn) return;
    if (!importacao) { btn.disabled = true; return; }
    var nomeOk = importacao.mapeamento.nome >= 0;
    var telOk = importacao.mapeamento.telefone >= 0;
    btn.disabled = !(nomeOk && telOk);
    btn.title = btn.disabled ? "Relacione as colunas Nome e WhatsApp" : "";
  }

  function transformarLinhas() {
    var imp = importacao;
    return imp.rows.map(function (linha) {
      var obj = {};
      CAMPOS_IMPORT.forEach(function (campo) {
        var idx = imp.mapeamento[campo.key];
        if (idx >= 0) {
          var valor = linha[idx];
          if (campo.key === "proximo_contato") obj[campo.key] = parseDataFlexivel(valor);
          else obj[campo.key] = valor;
        }
      });
      return obj;
    });
  }

  function resultadoImportacao(res) {
    var area = document.getElementById("imp-area");
    var erros = (res.detalhes || []).slice(0, 8);
    area.innerHTML = '<div class="import-result">' +
      '<div class="import-result__icon">' + ui.icone("check-circle") + "</div>" +
      "<h3>Importação concluída</h3>" +
      '<p class="muted">' + res.importados + " lead(s) importado(s).</p>" +
      '<div class="import-result__stats">' +
        '<div><strong class="is-success">' + res.importados + "</strong><span>importados</span></div>" +
        '<div><strong class="is-warning">' + res.duplicados + "</strong><span>duplicados</span></div>" +
        '<div><strong class="is-danger">' + res.invalidos + "</strong><span>inválidos</span></div>" +
      "</div>" +
      (erros.length ? '<div class="import-errors"><strong>Algumas linhas não foram importadas:</strong><ul>' +
        erros.map(function (e) { return "<li>Linha " + e.linha + ": " + u.escaparHTML(e.motivo) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<button class="btn btn--secondary btn--sm" type="button" data-outro-arquivo style="margin-top:16px">Importar outra planilha</button>' +
    "</div>";
    area.querySelector("[data-outro-arquivo]").addEventListener("click", function () {
      document.getElementById("imp-file").click();
    });
  }

  function abrirImportacao() {
    importacao = null;
    var m = ui.modal({
      title: "Importar planilha",
      subtitle: "CSV, XLSX ou XLS — até 5.000 contatos",
      size: "lg",
      body:
        '<div class="import-intro">' +
          '<div id="imp-drop"><label class="dropzone" id="dropzone" for="imp-file">' +
            '<span class="dropzone__icon">' + ui.icone("upload") + "</span>" +
            "<strong>Arraste a planilha aqui ou clique para selecionar</strong>" +
            "<p>Formatos aceitos: .csv, .xlsx e .xls</p>" +
            '<input type="file" id="imp-file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">' +
          "</label>" +
          '<div class="import-tips">' +
            "<strong>Colunas recomendadas</strong>" +
            "<p>Nome, WhatsApp, E-mail, Empresa, Cargo, Cidade, UF, Origem, Evento, Sistemas de interesse, Possui sistema, Sistema atual, Etapa, Prioridade, Responsável, Próximo contato, Observações e Tags.</p>" +
            '<button class="text-link xs" type="button" data-modelo>Baixar modelo CSV</button>' +
          "</div></div>" +
          '<div id="imp-area" hidden></div>' +
        "</div>",
      footer: '<button class="btn btn--secondary" type="button" data-close>Cancelar</button>' +
        '<button class="btn btn--primary" type="button" data-importar-leads disabled>' + ui.icone("upload") + "Importar leads</button>"
    });

    m.el.querySelector("#imp-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) mostrarArquivo(file);
    });

    m.el.querySelector("#imp-area").addEventListener("change", function (e) {
      var select = e.target.closest("[data-map]");
      if (!select || !importacao) return;
      importacao.mapeamento[select.getAttribute("data-map")] = Number(select.value);
      atualizarPrevia();
      atualizarBotaoImportar();
    });

    var drop = m.el.querySelector("#dropzone");
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
    });
    drop.addEventListener("drop", function (e) {
      var file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) mostrarArquivo(file);
    });

    m.el.querySelector("[data-modelo]").addEventListener("click", baixarModelo);
    m.el.querySelector("[data-importar-leads]").addEventListener("click", function (e) {
      var btn = e.currentTarget;
      if (!importacao) return;
      btn.disabled = true;
      btn.classList.add("is-loading");
      api.leads.importar(transformarLinhas()).then(function (res) {
        ui.toast(res.importados + " lead(s) importado(s).", "success");
        leadUI.invalidarListas();
        estado.page = 1;
        selecionados = {};
        carregar();
        resultadoImportacao(res);
        btn.hidden = true;
        var footerCancelar = m.el.querySelector("[data-close]");
        if (footerCancelar) footerCancelar.textContent = "Concluir";
      }).catch(function (err) {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        ui.toast(err.message || "Não foi possível importar.", "error");
      });
    });
  }

  function baixarModelo() {
    var colunas = CAMPOS_IMPORT.map(function (c) { return { label: c.label, value: function (l) { return l[c.key] || ""; } }; });
    var exemplo = [{
      nome: "Maria Silva", telefone: "5511999999999", email: "maria@empresa.com.br",
      empresa: "Empresa Exemplo", cargo: "Diretora", cidade: "São Paulo", uf: "SP",
      origem: "Feira / evento", origemDetalhe: "Feira do Empreendedor 2026",
      sistemas_interesse: "AssinaPDF, AssinaDNS", possui_sistema: "Não",
      sistema_atual: "", etapa: "Novo", prioridade: "Média", responsavel: "Marina Costa",
      proximo_contato: "25/10/2026", observacoes: "Interesse em assinatura de contratos.",
      tags: "Feira 2026, Quente"
    }];
    u.baixarCSV("modelo-importacao-leads.csv", colunas, exemplo);
    ui.toast("Modelo CSV baixado.", "success");
  }

  /* Eventos ---------------------------------------------------------------- */

  function bind() {
    var busca = el("busca");
    busca.addEventListener("input", u.debounce(function () {
      estado.q = busca.value.trim();
      recarregarPrimeira();
    }, 280));

    ["etapa", "sistema", "origem", "responsavel", "prioridade", "possuiSistema"].forEach(function (campo) {
      var id = campo === "possuiSistema" ? "filtro-possui" : "filtro-" + campo;
      el(id).addEventListener("change", function (e) {
        estado[campo] = e.target.value;
        recarregarPrimeira();
      });
    });

    document.querySelectorAll("[data-quick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("[data-quick]").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        var q = btn.getAttribute("data-quick");
        estado.etapa = "";
        estado.atrasados = "";
        estado.naoContatar = "";
        if (q === "abertos") estado.etapa = "abertos";
        if (q === "atrasados") estado.atrasados = "1";
        if (q === "nao") estado.naoContatar = "1";
        recarregarPrimeira();
      });
    });

    document.querySelector("[data-limpar]").addEventListener("click", function () {
      estado.q = "";
      estado.etapa = "";
      estado.sistema = "";
      estado.origem = "";
      estado.responsavel = "";
      estado.prioridade = "";
      estado.possuiSistema = "";
      estado.naoContatar = "";
      estado.atrasados = "";
      busca.value = "";
      ["filtro-etapa", "filtro-sistema", "filtro-origem", "filtro-responsavel", "filtro-prioridade", "filtro-possui"].forEach(function (id) { el(id).value = ""; });
      document.querySelectorAll("[data-quick]").forEach(function (b) { b.classList.remove("is-active"); });
      document.querySelector('[data-quick=""]').classList.add("is-active");
      recarregarPrimeira();
    });

    document.querySelector("[data-exportar]").addEventListener("click", function () { exportar(null); });
    document.querySelector("[data-novo]").addEventListener("click", function () {
      leadUI.abrirFormulario(null, { onSaved: function () { leadUI.invalidarListas(); carregar(); } });
    });
    document.querySelector("[data-importar]").addEventListener("click", abrirImportacao);

    document.addEventListener("click", function (e) {
      var novoVazio = e.target.closest("[data-novo]");
      if (novoVazio && !e.target.closest(".page-head")) {
        leadUI.abrirFormulario(null, { onSaved: function () { leadUI.invalidarListas(); carregar(); } });
        return;
      }
      var pageBtn = e.target.closest("[data-page]");
      if (pageBtn) {
        estado.page = Number(pageBtn.getAttribute("data-page"));
        carregar();
      }
    });

    var tbody = el("leads-tbody");
    tbody.addEventListener("click", function (e) {
      var check = e.target.closest("[data-select]");
      if (check) {
        selecionados[check.getAttribute("data-select")] = check.checked;
        atualizarBulk();
        return;
      }
      var open = e.target.closest("[data-open]");
      if (open) { leadUI.abrirDetalhe(open.getAttribute("data-open"), { onChanged: carregar }); return; }
      var msg = e.target.closest("[data-msg]");
      if (msg) { leadUI.abrirMensagem(msg.getAttribute("data-msg"), { onSent: carregar }); return; }
      var menu = e.target.closest("[data-menu]");
      if (menu) { abrirMenu(menu, menu.getAttribute("data-menu")); return; }
      var row = e.target.closest("[data-lead-row]");
      if (row && !e.target.closest("button,input,a")) {
        leadUI.abrirDetalhe(row.getAttribute("data-lead-row"), { onChanged: carregar });
      }
    });

    tbody.addEventListener("change", function (e) {
      if (e.target.matches("[data-select]")) {
        selecionados[e.target.getAttribute("data-select")] = e.target.checked;
        atualizarBulk();
      }
    });

    el("selecionar-todos").addEventListener("change", function (e) {
      idsPagina.forEach(function (id) { selecionados[id] = e.target.checked; });
      el("leads-tbody").querySelectorAll("[data-select]").forEach(function (c) { c.checked = e.target.checked; });
      atualizarBulk();
    });

    document.querySelectorAll("[data-bulk]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ids = Object.keys(selecionados).filter(function (k) { return selecionados[k]; });
        if (!ids.length) return;
        var acao = btn.getAttribute("data-bulk");
        if (acao === "mensagem") {
          window.location.href = "mensagens.html?leads=" + encodeURIComponent(ids.join(","));
          return;
        }
        if (acao === "etapa") {
          leadUI.abrirMudarEtapa(ids, { onDone: function () { limparSelecao(); carregar(); } });
          return;
        }
        if (acao === "exportar") { exportar(ids); return; }
        if (acao === "nao") {
          ui.confirmar({
            titulo: "Marcar como não contatar",
            texto: "Os " + ids.length + " lead(s) selecionado(s) não receberão mensagens em campanhas ou envios individuais.",
            acao: "Marcar não contatar"
          }).then(function (ok) {
            if (!ok) return;
            api.leads.listar({ ids: ids.join(","), perPage: 1000 }).then(function (res) {
              return Promise.all(res.data.map(function (l) {
                return api.leads.atualizar(l.id, Object.assign({}, l, { naoContatar: true }));
              }));
            }).then(function () {
              ui.toast(ids.length + " lead(s) marcado(s) como não contatar.", "success");
              limparSelecao();
              carregar();
            }).catch(function (err) {
              ui.toast(err.message || "Não foi possível atualizar os leads.", "error");
            });
          });
          return;
        }
        if (acao === "excluir") {
          ui.confirmar({
            titulo: "Excluir leads",
            texto: "Excluir <strong>" + ids.length + " lead(s)</strong> e todo o histórico? Esta ação não pode ser desfeita.",
            acao: "Excluir leads",
            perigo: true
          }).then(function (ok) {
            if (!ok) return;
            Promise.all(ids.map(function (id) { return api.leads.remover(id); })).then(function () {
              ui.toast(ids.length + " lead(s) excluído(s).", "success");
              limparSelecao();
              carregar();
            }).catch(function (err) {
              ui.toast(err.message || "Não foi possível excluir os leads.", "error");
            });
          });
        }
      });
    });
  }

  /* Inicialização ---------------------------------------------------------- */

  bind();
  carregar().then(function () {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get("novo") === "1") {
      leadUI.abrirFormulario(null, { onSaved: function () { leadUI.invalidarListas(); carregar(); } });
    } else if (qs.get("importar") === "1") {
      abrirImportacao();
    } else if (qs.get("lead")) {
      leadUI.abrirDetalhe(qs.get("lead"), { onChanged: carregar });
    }
  });
})(window.Painel);
