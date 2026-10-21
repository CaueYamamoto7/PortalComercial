/* ==========================================================================
   Painel Comercial — Gráficos leves (SVG/HTML, sem dependências)
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function compacto(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(".", ",") + " mi";
    if (v >= 10000) return Math.round(v / 1000) + " mil";
    if (v >= 1000) return (v / 1000).toFixed(1).replace(".", ",") + " mil";
    return String(v);
  }

  function maximoBonito(max) {
    if (!max) return 10;
    var bruto = max / 5;
    var exp = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10));
    var f = bruto / exp;
    var passo = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return Math.ceil(max / (passo * exp)) * passo * exp;
  }

  function volume(container, serie, opts) {
    opts = opts || {};
    if (!container) return;
    container.innerHTML = "";
    if (!serie || !serie.length) {
      container.innerHTML = '<div class="chart__empty">Sem dados no período selecionado.</div>';
      return;
    }

    var W = Math.max(320, Math.round(container.clientWidth || 780));
    var H = opts.altura || 250;
    var P = { l: 38, r: 10, t: 14, b: 28 };
    var innerW = W - P.l - P.r;
    var innerH = H - P.t - P.b;
    var max = 0;
    serie.forEach(function (p) { max = Math.max(max, p.valor || 0); });
    var topo = maximoBonito(max);
    var ticks;
    if (topo <= 5) {
      ticks = Math.max(1, Math.round(topo));
    } else {
      topo = Math.ceil(topo / 4) * 4;
      ticks = 4;
    }

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": opts.ariaLabel || "Gráfico de barras" });

    for (var t = 0; t <= ticks; t++) {
      var y = P.t + (innerH / ticks) * t;
      var valor = topo - (topo / ticks) * t;
      svg.appendChild(el("line", {
        x1: P.l, y1: y, x2: W - P.r, y2: y,
        stroke: "var(--chart-grid)", "stroke-width": 1,
        "stroke-dasharray": t === ticks ? "0" : "3 3"
      }));
      var texto = el("text", {
        x: P.l - 9, y: y + 3.5, "text-anchor": "end",
        fill: "var(--ink-300)", "font-family": "var(--font-mono)", "font-size": "9"
      });
      texto.textContent = compacto(Math.round(valor));
      svg.appendChild(texto);
    }

    var band = innerW / serie.length;
    var barW = Math.max(5, Math.min(28, band * 0.5));
    var raio = Math.min(4, barW / 2);
    var passoRotulo = Math.ceil(serie.length / (W < 460 ? 4 : 8));
    var espacoRotulo = W < 460 ? 54 : 46;
    var ultimoRotulo = -Infinity;

    serie.forEach(function (p, i) {
      var centro = P.l + band * i + band / 2;
      var altura = ((p.valor || 0) / topo) * innerH;
      var x = centro - barW / 2;
      var yBase = P.t + innerH;

      if (altura > 0) {
        var r = Math.min(raio, altura / 2);
        var path = "M" + x + "," + yBase +
          " L" + x + "," + (yBase - altura + r) +
          " Q" + x + "," + (yBase - altura) + " " + (x + r) + "," + (yBase - altura) +
          " L" + (x + barW - r) + "," + (yBase - altura) +
          " Q" + (x + barW) + "," + (yBase - altura) + " " + (x + barW) + "," + (yBase - altura + r) +
          " L" + (x + barW) + "," + yBase + " Z";
        svg.appendChild(el("path", { d: path, fill: p.cor || opts.cor || "var(--brand-500)", opacity: "0.9" }));
      }

      var hit = el("rect", { x: P.l + band * i, y: P.t, width: band, height: innerH + P.b, fill: "transparent" });
      hit.setAttribute("data-index", i);
      svg.appendChild(hit);

      var mostrar = serie.length <= 8 || i === 0 || i === serie.length - 1 || i % passoRotulo === 0;
      if (mostrar && centro - ultimoRotulo >= espacoRotulo) {
        var rotulo = el("text", {
          x: centro, y: H - 8, "text-anchor": "middle",
          fill: "var(--ink-300)", "font-family": "var(--font-sans)", "font-size": "9"
        });
        rotulo.textContent = p.label;
        svg.appendChild(rotulo);
        ultimoRotulo = centro;
      }
    });

    container.appendChild(svg);

    var tip = document.createElement("div");
    tip.className = "chart-tooltip";
    container.appendChild(tip);

    svg.querySelectorAll("[data-index]").forEach(function (hit) {
      hit.addEventListener("mouseenter", function () {
        var i = Number(hit.getAttribute("data-index"));
        var p = serie[i];
        var rect = svg.getBoundingClientRect();
        var cx = (P.l + band * i + band / 2) / W * rect.width;
        var topoPx = (P.t + innerH - ((p.valor || 0) / topo) * innerH) / H * rect.height;
        tip.innerHTML = '<div class="chart-tooltip__title">' + p.label + "</div>" +
          '<div class="chart-tooltip__row"><span>' + (opts.rotulo || "Total") + "</span><strong>" + u.formatarNumero(p.valor || 0) + "</strong></div>" +
          (p.detalhe ? '<div class="chart-tooltip__row"><span>' + (opts.rotuloDetalhe || "Ganhos") + "</span><strong>" + u.formatarNumero(p.detalhe) + "</strong></div>" : "");
        tip.style.left = cx + "px";
        tip.style.top = Math.max(0, topoPx) + "px";
        tip.classList.add("is-visible");
      });
      hit.addEventListener("mouseleave", function () { tip.classList.remove("is-visible"); });
    });
  }

  function donut(container, segmentos, total, opts) {
    if (!container) return;
    opts = opts || {};
    container.querySelectorAll("svg").forEach(function (s) { s.remove(); });
    var size = 140;
    var r = 54;
    var stroke = 14;
    var c = 2 * Math.PI * r;
    var svg = el("svg", { viewBox: "0 0 " + size + " " + size, role: "img", "aria-label": opts.ariaLabel || "Distribuição" });

    svg.appendChild(el("circle", {
      cx: size / 2, cy: size / 2, r: r, fill: "none",
      stroke: "var(--surface-3)", "stroke-width": stroke
    }));

    var soma = total || segmentos.reduce(function (s, x) { return s + x.valor; }, 0) || 1;
    var offset = 0;
    segmentos.forEach(function (seg) {
      var frac = seg.valor / soma;
      var comprimento = Math.max(0, frac * c - 2.5);
      svg.appendChild(el("circle", {
        cx: size / 2, cy: size / 2, r: r, fill: "none",
        stroke: seg.cor, "stroke-width": stroke,
        "stroke-dasharray": comprimento + " " + (c - comprimento),
        "stroke-dashoffset": -offset, "stroke-linecap": "butt"
      }));
      offset += frac * c;
    });

    container.appendChild(svg);
  }

  function sparkline(container, valores, opts) {
    if (!container || !valores || !valores.length) return;
    opts = opts || {};
    var W = 66;
    var H = 22;
    var min = Math.min.apply(null, valores);
    var max = Math.max.apply(null, valores);
    var range = max - min || 1;
    var pontos = valores.map(function (v, i) {
      var x = (i / Math.max(1, valores.length - 1)) * (W - 2) + 1;
      var y = H - 3 - ((v - min) / range) * (H - 6);
      return [x, y];
    });
    var d = pontos.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ");
    var cor = opts.cor || "var(--brand-500)";
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" });
    var id = "spark-" + Math.random().toString(36).slice(2, 7);
    var defs = el("defs", {});
    var grad = el("linearGradient", { id: id, x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(el("stop", { offset: "0%", "stop-color": cor, "stop-opacity": ".22" }));
    grad.appendChild(el("stop", { offset: "100%", "stop-color": cor, "stop-opacity": "0" }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(el("path", { d: d + " L" + (W - 1) + "," + H + " L1," + H + " Z", fill: "url(#" + id + ")" }));
    svg.appendChild(el("path", {
      d: d, fill: "none", stroke: cor, "stroke-width": "1.5",
      "stroke-linecap": "round", "stroke-linejoin": "round"
    }));
    container.innerHTML = "";
    container.appendChild(svg);
  }

  function funnel(container, etapas, opts) {
    if (!container) return;
    opts = opts || {};
    var max = Math.max.apply(null, etapas.map(function (e) { return e.valor; }).concat([1]));
    container.innerHTML = etapas.map(function (e) {
      var pct = max ? Math.max(4, (e.valor / max) * 100) : 4;
      return '<button class="funnel-row" type="button" data-etapa="' + u.escaparHTML(e.id || e.nome) + '"' +
        (opts.interativo ? "" : " tabindex=\"-1\"") + ">" +
        '<span class="funnel-row__label"><i style="background:' + e.cor + '"></i>' + u.escaparHTML(e.nome) + "</span>" +
        '<span class="funnel-row__track"><i style="width:' + pct + "%;background:" + e.cor + '"></i></span>' +
        '<strong class="funnel-row__value">' + u.formatarNumero(e.valor) + "</strong>" +
        "</button>";
    }).join("");
  }

  function hbar(container, itens, opts) {
    if (!container) return;
    opts = opts || {};
    var max = Math.max.apply(null, itens.map(function (i) { return i.valor; }).concat([1]));
    container.innerHTML = itens.map(function (i) {
      var pct = Math.max(3, (i.valor / max) * 100);
      return '<div class="hbar-row">' +
        '<span class="hbar-row__label">' + (i.cor ? '<i style="background:' + i.cor + '"></i>' : "") + u.escaparHTML(i.label) + "</span>" +
        '<span class="hbar-row__track"><i style="width:' + pct + "%;background:" + (i.cor || opts.cor || "var(--brand-500)") + '"></i></span>' +
        '<strong class="hbar-row__value">' + u.formatarNumero(i.valor) + (opts.sufixo || "") + "</strong>" +
        "</div>";
    }).join("") || '<div class="chart__empty">Sem dados para exibir.</div>';
  }

  Painel.charts = {
    volume: volume,
    donut: donut,
    sparkline: sparkline,
    funnel: funnel,
    hbar: hbar,
    compacto: compacto
  };
})(window.Painel);
