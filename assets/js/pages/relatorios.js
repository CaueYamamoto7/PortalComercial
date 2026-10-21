/* ==========================================================================
   Painel Comercial — Relatórios
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var ui = Painel.ui;
  var api = Painel.api;

  var estado = { periodo: "30", sistema: "", origem: "", responsavel: "" };
  var ultimoRelatorio = null;

  function el(id) { return document.getElementById(id); }

  function preencherFiltros(cfg) {
    el("rel-sistema").innerHTML = '<option value="">Todos os sistemas</option>' +
      cfg.sistemas.filter(function (s) { return s.ativo; }).map(function (s) { return '<option value="' + s.id + '">' + u.escaparHTML(s.nome) + "</option>"; }).join("");
    el("rel-origem").innerHTML = '<option value="">Todas as origens</option>' +
      cfg.origens.filter(function (o) { return o.ativo; }).map(function (o) { return '<option value="' + o.id + '">' + u.escaparHTML(o.nome) + "</option>"; }).join("");
    el("rel-responsavel").innerHTML = '<option value="">Todos os responsáveis</option>' +
      cfg.equipe.filter(function (m) { return m.status === "ativo"; }).map(function (m) { return '<option value="' + u.escaparHTML(m.nome) + '">' + u.escaparHTML(m.nome) + "</option>"; }).join("");
  }

  function renderKpis(dados) {
    var valores = {
      total: dados.stats.total,
      ganhos: dados.stats.ganhos,
      conversao: u.formatarNumero(dados.stats.taxaConversao, 1) + "%",
      atrasados: dados.stats.atrasados
    };
    Object.keys(valores).forEach(function (k) {
      var node = document.querySelector('[data-rkpi="' + k + '"]');
      if (node) node.textContent = valores[k];
    });
    var hints = {
      total: dados.stats.abertos + " em aberto",
      ganhos: dados.stats.perdidos + " perdido(s)",
      conversao: dados.stats.ganhos + " de " + (dados.stats.ganhos + dados.stats.perdidos) + " decididos",
      atrasados: dados.stats.followupsHoje + " para hoje"
    };
    Object.keys(hints).forEach(function (k) {
      var node = document.querySelector('[data-rkpi-hint="' + k + '"]');
      if (node) node.textContent = hints[k];
    });
  }

  function renderSistemas(dados) {
    Painel.charts.hbar(el("rel-sistemas"), dados.porSistema.map(function (s) {
      return { label: s.nome, valor: s.total, cor: s.cor };
    }));
    el("rel-sistemas-tabela").innerHTML = '<table><thead><tr><th>Sistema</th><th>Leads</th><th>Ganhos</th><th>Conversão</th></tr></thead><tbody>' +
      dados.porSistema.map(function (s) {
        return "<tr><td><span class=\"chart-dot\" style=\"background:" + s.cor + "\"></span>" + u.escaparHTML(s.nome) + "</td><td>" + s.total + "</td><td>" + s.ganhos + "</td><td><strong>" + u.formatarNumero(s.taxa, 1) + "%</strong></td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderResponsaveis(dados) {
    var total = dados.stats.total || 1;
    el("rel-responsaveis").innerHTML = dados.porResponsavel.map(function (r) {
      return '<tr><td><div class="cell-main"><span class="avatar avatar--sm ' + u.tomAvatar(r.nome) + '">' + u.escaparHTML(r.iniciais || u.iniciais(r.nome)) + "</span><span><strong>" + u.escaparHTML(r.nome) + "</strong></span></div></td>" +
        '<td class="td--right">' + r.total + "</td>" +
        '<td class="td--right">' + r.ganhos + "</td>" +
        '<td><div class="conv-cell"><span class="progress progress--sm"><span class="progress__bar" style="width:' + r.taxa + '%"></span></span><strong>' + u.formatarNumero(r.taxa, 1) + "%</strong></div></td>" +
        '<td class="td--right">' + u.formatarPercentual(r.total, total, 1) + "</td></tr>";
    }).join("") || '<tr><td colspan="5"><div class="empty empty--compact"><p>Sem dados para os filtros.</p></div></td></tr>';
  }

  function renderMensagens(dados) {
    var m = dados.mensagens;
    var taxa = m.enviados ? u.percentual(m.entregues, m.enviados) : 0;
    el("rel-mensagens").innerHTML =
      '<div class="report-msg-stat"><span class="report-msg-stat__icon">' + ui.icone("users") + '</span><div><strong>' + u.formatarNumero(m.publico) + "</strong><span>pessoas no público</span></div></div>" +
      '<div class="report-msg-stat"><span class="report-msg-stat__icon">' + ui.icone("send") + '</span><div><strong>' + u.formatarNumero(m.enviados) + "</strong><span>mensagens enviadas</span></div></div>" +
      '<div class="report-msg-stat"><span class="report-msg-stat__icon is-success">' + ui.icone("check-circle") + '</span><div><strong>' + u.formatarNumero(m.entregues) + "</strong><span>entregues · " + u.formatarNumero(taxa, 1) + "%</span></div></div>" +
      '<div class="report-msg-stat"><span class="report-msg-stat__icon is-danger">' + ui.icone("alert-circle") + '</span><div><strong>' + u.formatarNumero(m.falhas) + "</strong><span>falhas de entrega</span></div></div>" +
      '<div class="report-msg-stat"><span class="report-msg-stat__icon">' + ui.icone("message-circle") + '</span><div><strong>' + u.formatarNumero(dados.campanhas) + "</strong><span>campanhas no período</span></div></div>";
  }

  function render(dados) {
    ultimoRelatorio = dados;
    renderKpis(dados);
    Painel.charts.funnel(el("rel-funil"), dados.porEtapa);
    renderSistemas(dados);
    Painel.charts.hbar(el("rel-origens"), dados.porOrigem.map(function (o) {
      return { label: o.nome, valor: o.total };
    }));
    if (dados.motivos.length) {
      Painel.charts.hbar(el("rel-motivos"), dados.motivos, { cor: "var(--danger-500)" });
    } else {
      el("rel-motivos").innerHTML = '<div class="chart__empty">Nenhuma oportunidade perdida no período.</div>';
    }
    renderResponsaveis(dados);
    renderMensagens(dados);
    el("rel-periodo-label").textContent = estado.periodo === "365" ? "Últimos 12 meses" : "Últimos " + estado.periodo + " dias";
  }

  function carregar() {
    return api.relatorios.obter(estado).then(render).catch(function (err) {
      ui.toast(err.message || "Não foi possível carregar o relatório.", "error");
    });
  }

  function exportar() {
    if (!ultimoRelatorio) return;
    var d = ultimoRelatorio;
    var linhas = [];
    function add(secao, indicador, valor) { linhas.push({ secao: secao, indicador: indicador, valor: valor }); }
    add("Resumo", "Período", estado.periodo === "365" ? "12 meses" : estado.periodo + " dias");
    add("Resumo", "Leads no período", d.stats.total);
    add("Resumo", "Em aberto", d.stats.abertos);
    add("Resumo", "Ganhos", d.stats.ganhos);
    add("Resumo", "Perdidos", d.stats.perdidos);
    add("Resumo", "Taxa de conversão (%)", u.formatarNumero(d.stats.taxaConversao, 1));
    add("Resumo", "Follow-ups atrasados", d.stats.atrasados);
    d.porSistema.forEach(function (s) {
      add("Por sistema", s.nome + " — leads", s.total);
      add("Por sistema", s.nome + " — ganhos", s.ganhos);
      add("Por sistema", s.nome + " — conversão (%)", u.formatarNumero(s.taxa, 1));
    });
    d.porOrigem.forEach(function (o) {
      add("Por origem", o.nome + " — leads", o.total);
      add("Por origem", o.nome + " — ganhos", o.ganhos);
    });
    d.porResponsavel.forEach(function (r) {
      add("Por responsável", r.nome + " — leads", r.total);
      add("Por responsável", r.nome + " — ganhos", r.ganhos);
      add("Por responsável", r.nome + " — conversão (%)", u.formatarNumero(r.taxa, 1));
    });
    d.motivos.forEach(function (m) { add("Motivos de perda", m.label, m.valor); });
    add("Mensagens", "Pessoas no público", d.mensagens.publico);
    add("Mensagens", "Enviadas", d.mensagens.enviados);
    add("Mensagens", "Entregues", d.mensagens.entregues);
    add("Mensagens", "Falhas", d.mensagens.falhas);
    add("Mensagens", "Campanhas", d.campanhas);

    u.baixarCSV("relatorio-comercial-" + u.paraInputDate(new Date()) + ".csv", [
      { label: "Seção", value: function (l) { return l.secao; } },
      { label: "Indicador", value: function (l) { return l.indicador; } },
      { label: "Valor", value: function (l) { return l.valor; } }
    ], linhas);
    ui.toast("Relatório exportado.", "success");
  }

  function bind() {
    document.querySelectorAll("[data-periodo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("[data-periodo]").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        estado.periodo = btn.getAttribute("data-periodo");
        carregar();
      });
    });
    [["sistema", "rel-sistema"], ["origem", "rel-origem"], ["responsavel", "rel-responsavel"]].forEach(function (par) {
      el(par[1]).addEventListener("change", function (e) {
        estado[par[0]] = e.target.value;
        carregar();
      });
    });
    document.querySelector("[data-limpar]").addEventListener("click", function () {
      estado.sistema = "";
      estado.origem = "";
      estado.responsavel = "";
      ["rel-sistema", "rel-origem", "rel-responsavel"].forEach(function (id) { el(id).value = ""; });
      carregar();
    });
    document.querySelector("[data-exportar]").addEventListener("click", exportar);
  }

  bind();
  api.configuracoes.obter().then(function (cfg) {
    preencherFiltros(cfg);
    carregar();
  }).catch(function (err) {
    ui.toast(err.message || "Não foi possível carregar os filtros.", "error");
  });
})(window.Painel);
