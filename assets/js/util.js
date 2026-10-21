/* ==========================================================================
   Painel Comercial — Utilitários compartilhados
   ========================================================================== */

(function (Painel) {
  "use strict";

  var fmtNumero = new Intl.NumberFormat("pt-BR");
  var fmtDataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  var fmtDataMedia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
  var fmtDataLonga = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  var fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
  var fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
  var fmtSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  var DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function toDate(value) {
    if (value instanceof Date) return value;
    if (!value) return null;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var p = value.split("-");
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatarNumero(n, casas) {
    if (n === null || n === undefined || isNaN(n)) return "0";
    if (casas !== undefined) {
      return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
      }).format(n);
    }
    return fmtNumero.format(n);
  }

  function formatarData(value, estilo) {
    var d = toDate(value);
    if (!d) return "—";
    switch (estilo) {
      case "longa": return fmtDataLonga.format(d);
      case "media": return fmtDataMedia.format(d).replace(".", "");
      case "hora": return fmtHora.format(d);
      case "dataHora": return fmtDataHora.format(d);
      case "semana": return fmtSemana.format(d).replace(".", "");
      case "iso": return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      default: return fmtDataCurta.format(d);
    }
  }

  function formatarDataHoraCurta(value) {
    var d = toDate(value);
    if (!d) return "—";
    return fmtDataCurta.format(d) + " · " + fmtHora.format(d);
  }

  function tempoRelativo(value) {
    var d = toDate(value);
    if (!d) return "—";
    var diff = Math.round((Date.now() - d.getTime()) / 1000);
    var futuro = diff < 0;
    diff = Math.abs(diff);
    if (diff < 60) return "agora";
    if (diff < 3600) return (futuro ? "em " : "há ") + Math.floor(diff / 60) + " min";
    if (diff < 86400) return (futuro ? "em " : "há ") + Math.floor(diff / 3600) + " h";
    var dias = Math.floor(diff / 86400);
    if (dias === 1) return futuro ? "amanhã" : "ontem";
    if (dias < 30) return (futuro ? "em " : "há ") + dias + " dias";
    if (dias < 60) return futuro ? "em 1 mês" : "há 1 mês";
    return (futuro ? "em " : "há ") + Math.floor(dias / 30) + " meses";
  }

  function percentual(parte, total, casas) {
    if (!total) return 0;
    var v = (parte / total) * 100;
    return Number(v.toFixed(casas === undefined ? 1 : casas));
  }

  function formatarPercentual(parte, total, casas) {
    return formatarNumero(percentual(parte, total, casas), casas === undefined ? 1 : casas) + "%";
  }

  /* Telefones ------------------------------------------------------------- */

  function somenteDigitos(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function normalizarTelefone(v) {
    var d = somenteDigitos(v).replace(/^0+/, "");
    if (!d) return "";
    if (d.indexOf("55") === 0 && (d.length === 12 || d.length === 13)) return d;
    if (d.length === 10 || d.length === 11) return "55" + d;
    return d;
  }

  function telefoneValido(v) {
    var d = normalizarTelefone(v);
    if (!/^55\d{10,11}$/.test(d)) return false;
    var ddd = Number(d.substr(2, 2));
    if (ddd < 11 || ddd > 99) return false;
    var numero = d.substr(4);
    if (numero.length === 9 && numero.charAt(0) !== "9") return false;
    if (numero.length === 8 && Number(numero.charAt(0)) < 2) return false;
    return true;
  }

  function formatarTelefone(v) {
    var d = normalizarTelefone(v);
    if (d.length === 13) return "+55 (" + d.substr(2, 2) + ") " + d.substr(4, 5) + "-" + d.substr(9, 4);
    if (d.length === 12) return "+55 (" + d.substr(2, 2) + ") " + d.substr(4, 4) + "-" + d.substr(8, 4);
    if (d.length === 11) return "(" + d.substr(0, 2) + ") " + d.substr(2, 5) + "-" + d.substr(7, 4);
    return d || "—";
  }

  /* Texto ----------------------------------------------------------------- */

  function iniciais(nome) {
    var partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    if (partes.length === 1) return partes[0].substr(0, 2).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  function primeiroNome(nome) {
    return String(nome || "").trim().split(/\s+/)[0] || "";
  }

  var TONS = ["", "avatar--sand", "avatar--blue", "avatar--rose", "avatar--slate"];
  function tomAvatar(nome) {
    var s = String(nome || "");
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return TONS[h % TONS.length];
  }

  function escaparHTML(v) {
    return String(v === null || v === undefined ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizarTexto(v) {
    return String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizarChave(v) {
    return normalizarTexto(v).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function truncar(v, max) {
    var s = String(v || "");
    return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
  }

  function plural(n, singular, plural) {
    return n === 1 ? singular : (plural || singular + "s");
  }

  /* Datas ----------------------------------------------------------------- */

  function diasAtras(n, hora, minuto) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    if (hora !== undefined) d.setHours(hora, minuto || 0, 0, 0);
    return d.toISOString();
  }

  function horasAtras(n) {
    return new Date(Date.now() - n * 3600000).toISOString();
  }

  function diasFrente(n, hora, minuto) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    if (hora !== undefined) d.setHours(hora, minuto || 0, 0, 0);
    return d.toISOString();
  }

  function inicioDoDia(value) {
    var d = toDate(value) || new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function fimDoDia(value) {
    var d = toDate(value) || new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function mesmoDia(a, b) {
    var da = toDate(a);
    var db = toDate(b);
    if (!da || !db) return false;
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  }

  function diferencaDias(a, b) {
    var da = inicioDoDia(a);
    var db = inicioDoDia(b);
    return Math.round((da - db) / 86400000);
  }

  function paraInputDate(value) {
    var d = toDate(value);
    if (!d) return "";
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function paraInputDateTime(value) {
    var d = toDate(value);
    if (!d) return "";
    return paraInputDate(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function rotuloDia(value) {
    var d = toDate(value);
    if (!d) return "—";
    return DIAS[d.getDay()].slice(0, 3);
  }

  function rotuloPrazo(value) {
    var d = toDate(value);
    if (!d) return "Sem data";
    var diff = diferencaDias(d, new Date());
    if (diff === 0) return "Hoje";
    if (diff === 1) return "Amanhã";
    if (diff === -1) return "Ontem";
    if (diff < 0) return Math.abs(diff) + " dias atrasado";
    if (diff < 7) return "Em " + diff + " dias";
    return fmtDataCurta.format(d);
  }

  /* Variáveis de mensagem ------------------------------------------------- */

  var VARIAVEIS = [
    { chave: "nome", label: "Nome completo" },
    { chave: "primeiro_nome", label: "Primeiro nome" },
    { chave: "empresa", label: "Empresa" },
    { chave: "cargo", label: "Cargo" },
    { chave: "cidade", label: "Cidade" },
    { chave: "telefone", label: "Telefone" },
    { chave: "email", label: "E-mail" },
    { chave: "sistema_interesse", label: "Sistema de interesse" },
    { chave: "responsavel", label: "Responsável" }
  ];

  function valorVariavel(lead, chave) {
    if (!lead) return "";
    if (chave === "primeiro_nome") return primeiroNome(lead.nome);
    if (chave === "telefone") return formatarTelefone(lead.telefone);
    if (chave === "sistema_interesse") {
      return (lead.sistemasNomes || []).join(", ") || "nossos sistemas";
    }
    return lead[chave] || "";
  }

  function renderizarMensagem(conteudo, lead, fallback) {
    return String(conteudo || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, function (m, chave) {
      var valor = valorVariavel(lead, chave.toLowerCase());
      if (!valor && fallback) valor = fallback;
      return valor || m;
    });
  }

  function extrairVariaveis(conteudo) {
    var encontradas = [];
    String(conteudo || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, function (m, chave) {
      var c = chave.toLowerCase();
      if (encontradas.indexOf(c) === -1) encontradas.push(c);
      return m;
    });
    return encontradas;
  }

  function contarSegmentos(texto) {
    var len = String(texto || "").length;
    if (!len) return 0;
    return Math.ceil(len / 160) || 1;
  }

  /* CSV ------------------------------------------------------------------- */

  function parseMatrizCSV(texto, separador) {
    var t = String(texto || "").replace(/^\uFEFF/, "");
    var sep = separador || detectarSeparador(t.split(/\r?\n/)[0] || "");
    var matriz = [];
    var linha = [];
    var campo = "";
    var aspas = false;

    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (aspas) {
        if (ch === '"') {
          if (t.charAt(i + 1) === '"') { campo += '"'; i++; }
          else aspas = false;
        } else {
          campo += ch;
        }
      } else if (ch === '"') {
        aspas = true;
      } else if (ch === sep) {
        linha.push(campo.trim());
        campo = "";
      } else if (ch === "\n") {
        linha.push(campo.trim());
        if (linha.some(function (c) { return c !== ""; })) matriz.push(linha);
        linha = [];
        campo = "";
      } else if (ch !== "\r") {
        campo += ch;
      }
    }
    linha.push(campo.trim());
    if (linha.some(function (c) { return c !== ""; })) matriz.push(linha);
    return { matriz: matriz, separador: sep };
  }

  function detectarSeparador(linha) {
    var pv = (linha.match(/;/g) || []).length;
    var v = (linha.match(/,/g) || []).length;
    var t = (linha.match(/\t/g) || []).length;
    if (t > pv && t > v) return "\t";
    return pv >= v ? ";" : ",";
  }

  function parseCSV(texto) {
    var parsed = parseMatrizCSV(texto);
    if (!parsed.matriz.length) return { headers: [], rows: [], total: 0, matriz: [] };
    var headers = parsed.matriz[0].map(normalizarChave);
    var rows = parsed.matriz.slice(1).map(function (cols) {
      var obj = {};
      headers.forEach(function (h, idx) { obj[h] = cols[idx] === undefined ? "" : cols[idx]; });
      return obj;
    });
    return { headers: headers, rows: rows, total: rows.length, matriz: parsed.matriz, separador: parsed.separador };
  }

  function csvEscape(valor) {
    var s = String(valor === null || valor === undefined ? "" : valor);
    if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function gerarCSV(colunas, linhas) {
    var out = [colunas.map(function (c) { return csvEscape(c.label); }).join(";")];
    linhas.forEach(function (linha) {
      out.push(colunas.map(function (c) {
        var v = typeof c.value === "function" ? c.value(linha) : linha[c.key];
        return csvEscape(v);
      }).join(";"));
    });
    return "\uFEFF" + out.join("\r\n");
  }

  function baixarArquivo(nome, conteudo, mime) {
    var blob = new Blob([conteudo], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function baixarCSV(nome, colunas, linhas) {
    baixarArquivo(nome, gerarCSV(colunas, linhas), "text/csv;charset=utf-8");
  }

  /* Diversos -------------------------------------------------------------- */

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 250);
    };
  }

  function uid(prefixo) {
    return (prefixo || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function clonar(obj) {
    if (obj === undefined) return undefined;
    return JSON.parse(JSON.stringify(obj));
  }

  function paginar(itens, page, perPage) {
    var total = itens.length;
    var paginas = Math.max(1, Math.ceil(total / perPage));
    var atual = Math.min(Math.max(1, page || 1), paginas);
    var inicio = (atual - 1) * perPage;
    return {
      data: itens.slice(inicio, inicio + perPage),
      meta: { page: atual, perPage: perPage, total: total, paginas: paginas }
    };
  }

  function ordenar(itens, campo, direcao) {
    var dir = direcao === "desc" ? -1 : 1;
    return itens.slice().sort(function (a, b) {
      var va = a[campo];
      var vb = b[campo];
      if (va === null || va === undefined) va = "";
      if (vb === null || vb === undefined) vb = "";
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb, "pt-BR", { sensitivity: "base" }) * dir;
      }
      return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
    });
  }

  Painel.util = {
    formatarNumero: formatarNumero,
    formatarData: formatarData,
    formatarDataHoraCurta: formatarDataHoraCurta,
    tempoRelativo: tempoRelativo,
    percentual: percentual,
    formatarPercentual: formatarPercentual,
    somenteDigitos: somenteDigitos,
    normalizarTelefone: normalizarTelefone,
    telefoneValido: telefoneValido,
    formatarTelefone: formatarTelefone,
    iniciais: iniciais,
    primeiroNome: primeiroNome,
    tomAvatar: tomAvatar,
    escaparHTML: escaparHTML,
    normalizarTexto: normalizarTexto,
    normalizarChave: normalizarChave,
    truncar: truncar,
    plural: plural,
    diasAtras: diasAtras,
    horasAtras: horasAtras,
    diasFrente: diasFrente,
    inicioDoDia: inicioDoDia,
    fimDoDia: fimDoDia,
    mesmoDia: mesmoDia,
    diferencaDias: diferencaDias,
    paraInputDate: paraInputDate,
    paraInputDateTime: paraInputDateTime,
    rotuloDia: rotuloDia,
    rotuloPrazo: rotuloPrazo,
    VARIAVEIS: VARIAVEIS,
    valorVariavel: valorVariavel,
    renderizarMensagem: renderizarMensagem,
    extrairVariaveis: extrairVariaveis,
    contarSegmentos: contarSegmentos,
    parseCSV: parseCSV,
    parseMatrizCSV: parseMatrizCSV,
    gerarCSV: gerarCSV,
    baixarCSV: baixarCSV,
    baixarArquivo: baixarArquivo,
    debounce: debounce,
    uid: uid,
    clonar: clonar,
    paginar: paginar,
    ordenar: ordenar
  };
})(window.Painel);
