/* Gráficos exclusivos do dashboard; reutiliza a rosca SVG compartilhada. */
(function (Painel) {
  "use strict";
  var u = Painel.util;
  var NS = "http://www.w3.org/2000/svg";
  var series = [
    { chave: "novos", nome: "Novos contatos", cor: "#668cab" },
    { chave: "enviadas", nome: "Mensagens enviadas", cor: "#104b3b" },
    { chave: "recebidas", nome: "Respostas recebidas", cor: "#51977a" }
  ];
  var categorias = [
    { chave: "sem_mensagem", nome: "Sem mensagem", cor: "#92b6d3" },
    { chave: "aguardando", nome: "Aguardando", cor: "#e7c67e" },
    { chave: "responder", nome: "Responder", cor: "#104b3b" },
    { chave: "em_conversa", nome: "Em conversa", cor: "#74b79a" },
    { chave: "cliente", nome: "Clientes", cor: "#b6d7a8" },
    { chave: "recusado", nome: "Não contactar", cor: "#c8d1cd" }
  ];
  function svgEl(tag, attrs, texto) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    if (texto !== undefined) node.textContent = texto;
    return node;
  }
  function dataLabel(data) { return data.slice(8, 10) + "/" + data.slice(5, 7); }
  function linhas(container, dados) {
    container.replaceChildren();
    if (!dados.length) {
      container.innerHTML = '<div class="empty empty--compact"><p>Sem atividade registrada no período.</p></div>';
      return;
    }
    var W = Math.max(280, container.clientWidth), H = 235;
    var P = { l: 29, r: 12, t: 15, b: 25 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var max = 0;
    dados.forEach(function (dia) { series.forEach(function (s) { max = Math.max(max, dia[s.chave]); }); });
    var teto = Math.max(4, Math.ceil(max / 4) * 4);
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Evolução diária de novos contatos, mensagens enviadas e respostas recebidas. Os valores estão na tabela abaixo." });
    for (var t = 0; t <= 4; t++) {
      var y = P.t + ih * t / 4;
      svg.appendChild(svgEl("line", { x1: P.l, y1: y, x2: W - P.r, y2: y, stroke: "#e9efec", "stroke-dasharray": "3 4" }));
      svg.appendChild(svgEl("text", { x: P.l - 8, y: y + 3, "text-anchor": "end", fill: "#65776b", "font-size": 10 }, Painel.charts.compacto(teto * (4 - t) / 4)));
    }
    function x(i) { return P.l + iw * i / Math.max(1, dados.length - 1); }
    function yValor(valor) { return P.t + ih - (valor / teto * ih); }
    series.forEach(function (s) {
      var path = dados.map(function (dia, i) { return (i ? "L" : "M") + x(i).toFixed(2) + "," + yValor(dia[s.chave]).toFixed(2); }).join(" ");
      svg.appendChild(svgEl("path", { d: path, fill: "none", stroke: s.cor, "stroke-width": 2.3, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    });
    var passo = Math.ceil(dados.length / (W < 400 ? 4 : 6));
    dados.forEach(function (dia, i) {
      if (i % passo === 0 || i === dados.length - 1 && dados.length - 1 - Math.floor((dados.length - 1) / passo) * passo > passo / 2) {
        svg.appendChild(svgEl("text", { x: x(i), y: H - 4, "text-anchor": "middle", fill: "#65776b", "font-size": 10 }, dataLabel(dia.data)));
      }
      var largura = iw / Math.max(1, dados.length - 1);
      var hit = svgEl("rect", { x: Math.max(P.l, x(i) - largura / 2), y: P.t, width: largura, height: ih, fill: "transparent" });
      hit.appendChild(svgEl("title", {}, dataLabel(dia.data) + " · " + series.map(function (s) { return s.nome + ": " + dia[s.chave]; }).join(" · ")));
      svg.appendChild(hit);
    });
    container.appendChild(svg);
    if (!max) {
      var nota = document.createElement("p");
      nota.className = "dashboard-note";
      nota.textContent = "Nenhuma atividade registrada neste período.";
      container.appendChild(nota);
    }
  }
  function render(metricas) {
    var dados = metricas.serie || [];
    linhas(document.getElementById("grafico-evolucao"), dados);
    document.getElementById("dados-evolucao").innerHTML = '<table><caption class="sr-only">Atividade diária registrada</caption><thead><tr><th scope="col">Data</th><th scope="col">Novos</th><th scope="col">Enviadas</th><th scope="col">Respostas</th></tr></thead><tbody>' + dados.map(function (d) {
      return "<tr><th scope=\"row\">" + u.escaparHTML(dataLabel(d.data)) + "</th><td>" + d.novos + "</td><td>" + d.enviadas + "</td><td>" + d.recebidas + "</td></tr>";
    }).join("") + "</tbody></table>";
    var distribuicao = metricas.distribuicao || {};
    var segmentos = categorias.map(function (c) { return { valor: distribuicao[c.chave] || 0, cor: c.cor }; });
    var total = segmentos.reduce(function (s, c) { return s + c.valor; }, 0);
    Painel.charts.donut(document.getElementById("grafico-distribuicao"), segmentos, total, { ariaLabel: total ? "Distribuição dos contatos. Valores e percentuais na legenda." : "Nenhum contato criado no período" });
    document.getElementById("distribuicao-total").textContent = u.formatarNumero(total);
    document.getElementById("legenda-distribuicao").innerHTML = categorias.map(function (c) {
      var valor = distribuicao[c.chave] || 0;
      return '<li><i class="dot" style="background:' + c.cor + '"></i><span>' + c.nome + "</span><strong>" + u.formatarNumero(valor) + "</strong><small>" + (total ? Math.round(valor / total * 100) : 0) + "%</small></li>";
    }).join("");
  }
  Painel.dashboardCharts = { render: render, linhas: linhas };
})(window.Painel);
