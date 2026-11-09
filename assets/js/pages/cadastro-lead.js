(function (Painel) {
  "use strict";
  var form = document.getElementById("capture-form");
  if (!form) return;
  var offline = Painel.captureOffline, api = Painel.api.leads, escape = Painel.util.escaparHTML;
  var feedback = document.getElementById("capture-feedback"), submit = document.getElementById("capture-submit");
  var source = document.getElementById("capture-source"), sourceBox = document.getElementById("capture-source-new");
  var sourceName = document.getElementById("capture-source-name"), details = document.getElementById("capture-details");
  var expand = document.getElementById("capture-expand"), queueStatus = document.getElementById("capture-queue-status");
  var queueItems = document.getElementById("capture-queue-items"), syncButton = document.getElementById("capture-sync");
  var lockedSource = null, unlockTimer = null, syncing = false, editing = null;

  function userId() { var s = Painel.auth.sessao(); return s && s.id ? String(s.id) : ""; }
  function inform(message, success) {
    feedback.textContent = message || "";
    feedback.classList.toggle("is-success", !!success);
    if (message) feedback.focus({ preventScroll: true });
  }
  function showDetails(show) {
    details.hidden = !show;
    expand.setAttribute("aria-expanded", String(show));
    document.getElementById("capture-expand-label").textContent = show ? "Ocultar detalhes" : "Adicionar mais detalhes";
  }
  function renderQueue() {
    if (!userId()) { queueStatus.textContent = "Entre na conta para acessar os cadastros deste aparelho."; return Promise.resolve(); }
    return offline.list(userId()).then(function (items) {
      var errors = items.filter(function (item) { return item.status === "error"; }).length;
      queueStatus.textContent = items.length ? items.length + " cadastro(s) aguardando envio" + (errors ? "; " + errors + " precisam de correção." : ".") : "Todos os cadastros deste aparelho foram enviados à base.";
      queueItems.innerHTML = items.map(function (item) {
        return '<div class="capture-queue-item"><strong>' + escape(item.data.nome) + '</strong><span>' +
          (item.status === "error" ? escape(item.error || "Precisa de correção.") : "Salvo neste aparelho; aguardando confirmação da base.") +
          '</span>' + (item.status === "error" ? '<button type="button" class="capture-button capture-button--plain" data-edit="' + escape(item.id) + '">Corrigir cadastro</button>' : "") + '</div>';
      }).join("");
    }).catch(function () { queueStatus.textContent = "Não foi possível consultar os cadastros salvos neste aparelho."; });
  }
  function syncQueue() {
    if (syncing || !userId() || !navigator.onLine) return Promise.resolve();
    syncing = true;
    syncButton.disabled = true;
    return offline.list(userId()).then(function (items) {
      return items.reduce(function (chain, item) {
        return chain.then(function () {
          if (item.status === "error" || (editing && editing.id === item.id)) return;
          return api.criarCadastro(Object.assign({}, item.data, { captureRequestId: item.id })).then(function () {
            return offline.remove(item.id).then(function () {
              inform("Lead confirmado na base.", true);
              return renderQueue();
            });
          }).catch(function (error) {
            if (!error.status || error.status === 401 || error.status === 419 || error.status >= 500) throw error;
            item.status = "error";
            item.error = error.message || "Verifique os dados do cadastro.";
            return offline.update(item).then(renderQueue);
          });
        });
      }, Promise.resolve());
    }).catch(function (error) {
      inform(error && error.status === 419 ? "A sessão precisa ser renovada para enviar os cadastros. Recarregue a página com internet." : "Envio interrompido. Os cadastros continuam salvos neste aparelho.");
    })
      .finally(function () { syncing = false; syncButton.disabled = false; renderQueue(); });
  }
  function fillForm(data) {
    form.reset();
    Object.keys(data).forEach(function (key) {
      if (key !== "sistemaIds" && form.elements[key]) form.elements[key].value = data[key] || "";
    });
    Array.prototype.forEach.call(form.querySelectorAll('input[name="sistemaIds"]'), function (input) {
      input.checked = (data.sistemaIds || []).indexOf(input.value) !== -1;
    });
    setTimeout(function () {
      showDetails(true);
      document.getElementById("capture-current-wrap").hidden = data.possuiSistema !== "sim";
    }, 0);
    form.elements.nome.focus();
  }
  queueItems.addEventListener("click", function (event) {
    var button = event.target.closest("[data-edit]");
    if (!button) return;
    offline.list(userId()).then(function (items) {
      var item = items.filter(function (candidate) { return candidate.id === button.getAttribute("data-edit"); })[0];
      if (!item) return;
      editing = item;
      fillForm(item.data);
      inform("Corrija os dados e salve novamente. O cadastro permanece neste aparelho até a confirmação da base.");
    });
  });
  syncButton.addEventListener("click", syncQueue);
  window.addEventListener("online", syncQueue);
  window.addEventListener("focus", syncQueue);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) syncQueue(); });
  window.setInterval(syncQueue, 30000);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/capture-sw.js").then(function () { return navigator.serviceWorker.ready; }).then(function () {
      document.getElementById("capture-offline-ready").textContent = "Página pronta para abrir sem internet neste aparelho.";
    }).catch(function () {
      document.getElementById("capture-offline-ready").textContent = "Não foi possível preparar a página offline. Mantenha-a aberta durante o evento.";
    });
  } else {
    document.getElementById("capture-offline-ready").textContent = "Este navegador não permite abrir a página offline.";
  }

  function loadAccount() {
    Painel.auth.verificar().then(function (session) {
      if (!session) return;
      document.getElementById("capture-user").textContent = session.nome || session.email;
      document.getElementById("capture-owner").textContent = session.nome || session.email;
      renderQueue().then(syncQueue);
    });
  }
  function loadCatalogs(selected) {
    var checked = Array.prototype.map.call(form.querySelectorAll('input[name="sistemaIds"]:checked'), function (item) { return item.value; });
    var selectedSource = selected || source.value;
    return api.catalogos().then(function (data) {
      if (userId()) offline.saveCatalog(userId(), data).catch(function () {});
      return data;
    }).catch(function (error) {
      if (error.status || !userId()) throw error;
      return offline.getCatalog(userId()).then(function (saved) {
        return saved ? saved.data : { origens: [], sistemas: [], origemCadastro: { ativa: false } };
      });
    }).then(function (data) {
      lockedSource = data.origemCadastro && data.origemCadastro.ativa && (!data.origemCadastro.ate || new Date(data.origemCadastro.ate).getTime() > Date.now()) ? data.origemCadastro.origemId : null;
      source.innerHTML = '<option value="">Selecione uma origem</option>' + (data.origens || []).filter(function (item) { return item.ativo; }).map(function (item) {
        return '<option value="' + escape(item.id) + '">' + escape(item.nome) + '</option>';
      }).join("");
      if (lockedSource || selectedSource) source.value = lockedSource || selectedSource;
      source.disabled = !!lockedSource;
      document.getElementById("capture-add-source").hidden = !!lockedSource;
      sourceBox.hidden = !!lockedSource;
      if (unlockTimer) clearTimeout(unlockTimer);
      if (lockedSource && data.origemCadastro.ate) {
        var remaining = new Date(data.origemCadastro.ate).getTime() - Date.now();
        if (remaining > 0) unlockTimer = setTimeout(function () { loadCatalogs().catch(function () {}); }, Math.min(remaining + 1000, 2147483647));
      }
      document.getElementById("capture-systems").innerHTML = (data.sistemas || []).filter(function (item) { return item.ativo; }).map(function (item) {
        return '<label><input type="checkbox" name="sistemaIds" value="' + escape(item.id) + '"' + (checked.indexOf(String(item.id)) >= 0 ? " checked" : "") + '><span>' + escape(item.nome) + '</span></label>';
      }).join("") || '<span class="capture-muted">Nenhum sistema disponível no momento.</span>';
      submit.disabled = false;
    });
  }
  document.getElementById("capture-logout").addEventListener("click", function () { Painel.auth.sair(); });
  expand.addEventListener("click", function () { showDetails(details.hidden); });
  document.getElementById("capture-clear").addEventListener("click", function () { editing = null; form.reset(); form.elements.nome.focus(); });
  document.getElementById("capture-add-source").addEventListener("click", function () { sourceBox.hidden = false; sourceName.focus(); });
  document.getElementById("capture-cancel-source").addEventListener("click", function () { sourceBox.hidden = true; sourceName.value = ""; });
  document.getElementById("capture-save-source").addEventListener("click", function () {
    var name = sourceName.value.trim();
    if (!name) { inform("Informe o nome da nova origem."); sourceName.focus(); return; }
    if (!navigator.onLine) { inform("É preciso estar conectado para criar uma origem."); return; }
    var button = this;
    button.disabled = true;
    api.criarOrigem(name).then(function (saved) {
      return loadCatalogs(saved.id).then(function () {
        sourceBox.hidden = true; sourceName.value = "";
        inform("Origem salva. Ela estará disponível nos próximos acessos.", true);
      });
    }).catch(function (error) { inform(error.message || "Não foi possível salvar a origem."); }).finally(function () { button.disabled = false; });
  });
  form.elements.possuiSistema.addEventListener("change", function () {
    var show = this.value === "sim";
    document.getElementById("capture-current-wrap").hidden = !show;
    if (!show) form.elements.sistemaAtual.value = "";
  });
  form.addEventListener("reset", function () {
    setTimeout(function () {
      document.getElementById("capture-current-wrap").hidden = true;
      if (lockedSource) source.value = lockedSource;
      showDetails(false); inform("");
    }, 0);
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var telefone = form.elements.telefone.value.trim(), email = form.elements.email.value.trim();
    var sistemas = Array.prototype.map.call(form.querySelectorAll('input[name="sistemaIds"]:checked'), function (item) { return item.value; });
    if (!form.elements.nome.value.trim()) { inform("Informe o nome do lead."); form.elements.nome.focus(); return; }
    if (!telefone && !email) { inform("Informe WhatsApp ou e-mail."); form.elements.telefone.focus(); return; }
    if (telefone && !Painel.util.telefoneValido(telefone)) { inform("WhatsApp inválido. Use DDD + número."); form.elements.telefone.focus(); return; }
    if (email && !form.elements.email.checkValidity()) { inform("Informe um e-mail válido."); form.elements.email.focus(); return; }
    var data = {
      nome: form.elements.nome.value.trim(), empresa: form.elements.empresa.value.trim(),
      cargo: form.elements.cargo.value.trim(), telefone: telefone, email: email,
      cidade: form.elements.cidade.value.trim(), origemId: source.value,
      sistemaIds: sistemas, possuiSistema: form.elements.possuiSistema.value,
      sistemaAtual: form.elements.sistemaAtual.value.trim(), observacoes: form.elements.observacoes.value.trim()
    };
    var account = userId();
    if (!account) { inform("Entre na conta antes de cadastrar um lead."); return; }
    submit.disabled = true; inform("");
    var save = editing ? offline.update(Object.assign(editing, { data: data, status: "pending", error: "" })) : offline.save(account, data);
    save.then(function () {
      editing = null; form.reset();
      inform("Lead salvo neste aparelho. Aguardando confirmação da base.", true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      form.elements.nome.focus({ preventScroll: true });
      return renderQueue().then(syncQueue);
    }).catch(function (error) {
      inform(error.message || "Não foi possível salvar neste aparelho. Os campos foram mantidos.");
    }).finally(function () { submit.disabled = false; });
  });
  loadAccount();
  renderQueue().then(syncQueue);
  loadCatalogs().catch(function (error) { inform(error.message || "Não foi possível carregar origens e sistemas."); });
})(window.Painel);
