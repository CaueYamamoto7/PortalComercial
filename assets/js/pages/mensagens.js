(function (Painel) {
  "use strict";
  var api = Painel.api, escape = Painel.util.escaparHTML;
  var selected = new Set(), leads = [], page = 1, pages = 1, queuePage = 1, queuePages = 1;
  var tab = "new", busy = false, refreshBusy = false, searchSequence = 0, stages = [], options = null;
  var labels = { queued: "Saudação na fila", waiting: "Contatado / Aguardando", scheduled: "Resposta recebida — envio programado", manual: "Em conversa — operador", cancelled: "Cancelada", blocked: "Não contatar", uncertain: "Envio incerto — em reconciliação" };
  function el(id) { return document.getElementById(id); }
  function message(text) { el("wa-feedback").textContent = text; }
  function error(err) { message(err.message || "Não foi possível concluir a operação."); }
  function date(value) { return value ? new Date(Number(value) * 1000).toLocaleString("pt-BR") : "—"; }
  function phone(value) { var p = String(value || "").replace(/\D/g, ""); return p.length === 10 || p.length === 11 ? "55" + p : p; }
  function maxSelecionados() { return Math.max(1, Number(options && options.maxLeadsPerBatch) || 200); }
  function eligible(lead) {
    var propostaId = (options && options.etapaPropostaId) || "et_proposta";
    var contatadaId = (options && options.etapaContatadaId) || "et_contatado";
    var proposal = stages.find(function (s) { return s.id === propostaId; });
    return !lead.naoContatar && lead.etapa && lead.etapa.tipo === "aberto" && !lead.mensagensRecebidas && !lead.mensagensEnviadas &&
      lead.etapa.id !== contatadaId &&
      (!proposal || lead.etapa.ordem < proposal.ordem) && /^[1-9]\d{9,14}$/.test(phone(lead.telefone));
  }
  function selection() { el("wa-selected").textContent = selected.size + " selecionados (máximo " + maxSelecionados() + ")"; }
  function aplicarOpcoes() {
    if (!options) return;
    if (el("wa-greeting") && options.greetingTemplate) el("wa-greeting").value = options.greetingTemplate;
    if (el("wa-objective")) {
      if (options.maxObjectiveLength) el("wa-objective").maxLength = options.maxObjectiveLength;
      if (options.objectiveDefault && !el("wa-objective").value) el("wa-objective").value = options.objectiveDefault;
    }
    if (el("wa-delay-hint")) {
      var min = Math.max(1, Math.round((Number(options.delayMinSeconds) || 60) / 60));
      var max = Math.max(min, Math.round((Number(options.delayMaxSeconds) || 360) / 60));
      el("wa-delay-hint").textContent = "Ao responder: espera de " + min + "–" + max + " minutos, mensagem contextual e transferência ao operador. A IA utiliza os dados do lead e a resposta recebida.";
    }
    document.querySelectorAll("[data-wa-contatada]").forEach(function (node) { node.textContent = options.etapaContatada || "Contatado"; });
    document.querySelectorAll("[data-wa-proposta]").forEach(function (node) { node.textContent = options.etapaProposta || "Proposta"; });
  }
  function renderLeads() {
    el("wa-leads").innerHTML = leads.length ? leads.map(function (lead) {
      var ok = eligible(lead);
      return '<label class="wa-lead"><input type="checkbox" data-lead="' + escape(lead.id) + '" ' + (selected.has(lead.id) ? "checked " : "") + (ok ? "" : "disabled ") + '><div><strong>' + escape(lead.nome) + '</strong><small>' + escape(lead.empresa || lead.telefone) + '</small><small>' + escape(ok ? lead.etapa.nome : "Atendimento manual, já contatado ou indisponível") + '</small></div></label>';
    }).join("") : '<p class="faint">Nenhum contato encontrado.</p>';
    el("wa-page").textContent = page + " / " + pages;
    el("wa-prev").disabled = page <= 1; el("wa-next").disabled = page >= pages;
    selection();
  }
  async function loadLeads() {
    var seq = ++searchSequence;
    var result = await api.leads.listar({ q: el("wa-query").value, etapa: el("wa-stage").value, page: page, perPage: 30 });
    if (seq !== searchSequence) return;
    leads = result.data || []; pages = result.meta && result.meta.paginas || 1;
    renderLeads();
  }
  async function connection() {
    var result = await api.whatsapp.status();
    var names = { connected: "Conectado", connecting: "Conectando", disconnected: "Desconectado", qr: "Escaneie o QR code", unavailable: "Conector indisponível" };
    el("wa-status").textContent = (names[result.status] || result.status) + (result.phone ? " · " + result.phone : "");
    el("wa-worker").textContent = result.workerOnline ? "Fila ativa" : "Worker offline";
    el("wa-connection-error").textContent = result.message || "";
    el("wa-admin").hidden = !result.admin;
    el("wa-qr-wrap").hidden = !result.qr;
    if (result.qr && /^data:image\/png;base64,/.test(result.qr)) el("wa-qr").src = result.qr;
    else el("wa-qr").removeAttribute("src");
  }
  async function queue() {
    if (tab === "new") return;
    var current = tab, requestedPage = queuePage;
    var result = await api.whatsapp.listar({ status: tab === "history" ? "" : tab, page: queuePage });
    if (current !== tab || requestedPage !== queuePage) return;
    queuePages = Math.max(1, Math.ceil(result.total / 50));
    if (el("wa-queue").contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA") return;
    el("wa-queue").innerHTML = result.rows.length ? result.rows.map(function (row) {
      var active = ["queued", "waiting", "scheduled", "uncertain"].indexOf(row.status) >= 0;
      return '<article class="wa-item"><div class="row"><strong>' + escape(row.nome) + '</strong><span class="badge">' + escape(labels[row.status] || row.status) + '</span></div><small>' + escape(row.empresa || "") + ' · ' + escape(row.responsavel || "Sem responsável") + '</small>' +
        '<p class="small">Saudação: ' + escape(date(row.sent_at)) + (row.due_at && row.status === "scheduled" ? ' · Envio previsto: ' + escape(date(row.due_at)) : '') + '</p>' +
        (row.reply ? '<p><strong>Resposta:</strong> ' + escape(row.reply) + '</p>' : '') +
        (row.status === "scheduled" ? '<label class="field"><span class="field__label">Mensagem contextual (prévia editável)</span><textarea class="textarea" data-draft="' + escape(row.id) + '" maxlength="' + ((options && options.maxMessageLength) || 2000) + '" rows="3">' + escape(row.message || "") + '</textarea></label><button class="btn btn--secondary btn--sm" data-action="edit" data-id="' + escape(row.id) + '">Salvar texto</button>' : (row.message ? '<p><strong>Mensagem contextual:</strong> ' + escape(row.message) + '</p>' : '')) +
        (row.error ? '<p class="small">' + escape(row.error) + '</p>' : '') +
        '<div class="row"><a class="btn btn--secondary btn--sm" href="https://wa.me/' + encodeURIComponent(row.phone) + '" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>' +
        (active ? '<button class="btn btn--secondary btn--sm" data-action="manual" data-id="' + escape(row.id) + '">Assumir atendimento</button><button class="btn btn--secondary btn--sm" data-action="cancelled" data-id="' + escape(row.id) + '">Cancelar automação</button>' : '') +
        (row.id && row.status !== "blocked" ? '<button class="btn btn--secondary btn--sm" data-action="blocked" data-id="' + escape(row.id) + '">Não contatar</button>' : '') + '</div></article>';
    }).join("") : '<p class="faint">Nenhum contato nesta fila.</p>';
    el("wa-qpage").textContent = queuePage + " / " + queuePages + " · " + result.total + " contatos";
    el("wa-qprev").disabled = queuePage <= 1; el("wa-qnext").disabled = queuePage >= queuePages;
  }
  async function refresh() {
    if (refreshBusy) return;
    refreshBusy = true;
    try { await Promise.all([connection(), queue()]); } catch (err) { error(err); } finally { refreshBusy = false; }
  }
  function switchTab(value) {
    tab = value; queuePage = 1;
    el("wa-new").hidden = tab !== "new"; el("wa-queue-panel").hidden = tab === "new";
    document.querySelectorAll("[data-tab]").forEach(function (button) {
      button.classList.toggle("btn--primary", button.dataset.tab === tab);
      button.classList.toggle("btn--secondary", button.dataset.tab !== tab);
      button.setAttribute("aria-current", button.dataset.tab === tab ? "page" : "false");
      if (button.dataset.tab === tab) el("wa-queue-title").textContent = button.textContent;
    });
    queue().catch(error);
  }
  async function init() {
    document.querySelectorAll("[data-tab]").forEach(function (button) { button.onclick = function () { switchTab(button.dataset.tab); }; });
    el("wa-refresh").onclick = refresh;
    el("wa-search").onsubmit = function (event) { event.preventDefault(); page = 1; loadLeads().catch(error); };
    el("wa-prev").onclick = function () { page--; loadLeads().catch(error); };
    el("wa-next").onclick = function () { page++; loadLeads().catch(error); };
    el("wa-qprev").onclick = function () { queuePage--; queue().catch(error); };
    el("wa-qnext").onclick = function () { queuePage++; queue().catch(error); };
    el("wa-clear").onclick = function () { selected.clear(); renderLeads(); };
    el("wa-select-page").onclick = function () { leads.filter(eligible).forEach(function (lead) { if (selected.size < maxSelecionados()) selected.add(lead.id); }); renderLeads(); };
    el("wa-leads").onchange = function (event) {
      var id = event.target.dataset.lead;
      if (!id) return;
      if (event.target.checked && selected.size < maxSelecionados()) selected.add(id); else { selected.delete(id); event.target.checked = false; }
      selection();
    };
    el("wa-start").onsubmit = async function (event) {
      event.preventDefault(); if (busy) return;
      if (!selected.size) { message("Selecione pelo menos um lead."); return; }
      busy = true; el("wa-submit").disabled = true;
      try {
        var result = await api.whatsapp.criar({ leadIds: Array.from(selected), objective: el("wa-objective").value, consentSource: el("wa-consent").value });
        message(result.accepted + " contatos adicionados à fila. " + result.excluded.length + " excluídos." + (result.excluded.length ? " " + result.excluded.map(function (r) { return r.reason; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join("; ") : ""));
        selected.clear(); renderLeads(); switchTab("history");
      } catch (err) { error(err); } finally { busy = false; el("wa-submit").disabled = false; }
    };
    el("wa-queue").onclick = async function (event) {
      var button = event.target.closest("[data-action]"); if (!button) return;
      button.disabled = true;
      var draft = button.dataset.action === "edit" ? button.closest("article").querySelector("textarea").value : undefined;
      try { await api.whatsapp.action(button.dataset.id, button.dataset.action, draft); message(button.dataset.action === "edit" ? "Texto salvo." : "Atendimento atualizado."); await queue(); } catch (err) { error(err); button.disabled = false; }
    };
    ["connect", "disconnect"].forEach(function (action) {
      el("wa-" + action).onclick = async function () {
        var button = el("wa-" + action); button.disabled = true;
        try { await api.whatsapp.connect(action); await connection(); } catch (err) { error(err); } finally { button.disabled = false; }
      };
    });
    try {
      options = await api.whatsapp.options();
      aplicarOpcoes();
      var catalog = await api.catalogos(); stages = catalog.etapas || [];
      stages.forEach(function (stage) { var option = document.createElement("option"); option.value = stage.id; option.textContent = stage.nome; el("wa-stage").appendChild(option); });
      await loadLeads();
    } catch (err) { error(err); }
    await refresh();
    window.setInterval(function () { if (!document.hidden) refresh(); }, 5000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window.Painel = window.Painel || {});
