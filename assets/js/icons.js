/* ==========================================================================
   Portal Comercial - Biblioteca de ícones
   Wrapper local para o sprite oficial da Lucide Icons.
   Versão vendorizada: assets/vendor/lucide/sprite.svg (Lucide 1.61.0).
   ========================================================================== */

(function (Painel) {
  "use strict";

  var SPRITE = "assets/vendor/lucide/sprite.svg";

  /*
   * Nomes usados pelo painel -> nomes oficiais da Lucide.
   * A API Painel.icons.icone() é mantida para não espalhar detalhes da
   * biblioteca pelos componentes e páginas.
   */
  var ALIASES = {
    grid: "layout-grid",
    chart: "chart-no-axes-column",
    "bar-chart": "chart-no-axes-column-increasing",
    "check-circle": "circle-check",
    "alert-circle": "circle-alert",
    "alert-triangle": "triangle-alert",
    help: "circle-question-mark",
    more: "ellipsis",
    filter: "funnel",
    external: "external-link",
    refresh: "refresh-cw",
    sliders: "sliders-horizontal",
    logout: "log-out",
    message: "message-square",
    edit: "pencil"
  };

  function nomeOficial(nome) {
    return ALIASES[nome] || nome;
  }

  function icone(nome, classe) {
    var id = nomeOficial(String(nome || "circle").replace(/^#?i-/, ""));
    return '<svg class="icon ' + (classe || "") + '" aria-hidden="true" focusable="false">' +
      '<use href="' + SPRITE + "#" + id + '"></use></svg>';
  }

  /*
   * Mantido por compatibilidade com versões anteriores do shell.
   * O sprite agora é externo e oficial; não há mais paths desenhados aqui.
   */
  function sprite() {
    return "";
  }

  function instalar() {
    var usos = document.querySelectorAll('use[href^="#i-"], use[xlink\\:href^="#i-"]');
    Array.prototype.forEach.call(usos, function (use) {
      var href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
      var antigo = href.replace(/^#i-/, "");
      var novo = SPRITE + "#" + nomeOficial(antigo);
      use.setAttribute("href", novo);
      use.removeAttribute("xlink:href");
    });
  }

  Painel.icons = {
    mapa: ALIASES,
    icone: icone,
    sprite: sprite,
    instalar: instalar
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalar);
  } else {
    instalar();
  }
})(window.Painel);
