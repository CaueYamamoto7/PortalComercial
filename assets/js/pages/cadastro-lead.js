(function (Painel) {
  "use strict";

  var form = document.getElementById("capture-form");
  if (!form) return;
  var feedback = document.getElementById("capture-feedback");
  var source = document.getElementById("capture-source");
  var sourceBox = document.getElementById("capture-source-new");
  var sourceName = document.getElementById("capture-source-name");
  var submit = document.getElementById("capture-submit");
  var escape = Painel.util.escaparHTML;

  function informar(message, success) {
    feedback.textContent = message || "";
    feedback.classList.toggle("is-success", !!success);
    if (message) feedback.focus({ preventScroll: true });
  }

  function carregarConta() {
    Painel.auth.verificar().then(function (session) {
      if (!session) return;
      document.getElementById("capture-user").textContent = session.nome || session.email;
      document.getElementById("capture-owner").textContent = session.nome || session.email;
    });
  }

  function carregarCatalogos(selected) {
    var checked = Array.prototype.map.call(form.querySelectorAll('input[name="sistemaIds"]:checked'), function (item) { return item.value; });
    var selectedSource = selected || source.value;
    return Painel.api.leads.catalogos().then(function (data) {
      source.innerHTML = '<option value="">Selecione uma origem</option>' + (data.origens || []).filter(function (item) { return item.ativo; }).map(function (item) {
        return '<option value="' + escape(item.id) + '">' + escape(item.nome) + '</option>';
      }).join("");
      if (selectedSource) source.value = selectedSource;
      document.getElementById("capture-systems").innerHTML = (data.sistemas || []).filter(function (item) { return item.ativo; }).map(function (item) {
        return '<label><input type="checkbox" name="sistemaIds" value="' + escape(item.id) + '"' + (checked.indexOf(String(item.id)) >= 0 ? ' checked' : '') + '><span>' + escape(item.nome) + '</span></label>';
      }).join("");
      if (!(data.sistemas || []).some(function (item) { return item.ativo; })) {
        document.getElementById("capture-systems").innerHTML = '<span class="capture-muted">Nenhum sistema ativo. Cadastre um sistema no painel antes de adicionar leads.</span>';
        submit.disabled = true;
      } else {
        submit.disabled = false;
      }
    });
  }

  document.getElementById("capture-logout").addEventListener("click", function () { Painel.auth.sair(); });
  document.getElementById("capture-clear").addEventListener("click", function () { form.reset(); form.elements.nome.focus(); });
  document.getElementById("capture-add-source").addEventListener("click", function () { sourceBox.hidden = false; sourceName.focus(); });
  document.getElementById("capture-cancel-source").addEventListener("click", function () { sourceBox.hidden = true; sourceName.value = ""; });
  document.getElementById("capture-save-source").addEventListener("click", function () {
    var name = sourceName.value.trim();
    if (!name) { informar("Informe o nome da nova origem."); sourceName.focus(); return; }
    var button = this;
    button.disabled = true;
    Painel.api.leads.criarOrigem(name).then(function (saved) {
      return carregarCatalogos(saved.id).then(function () {
        sourceBox.hidden = true;
        sourceName.value = "";
        informar("Origem salva. Ela estará disponível nos próximos acessos.", true);
      });
    }).catch(function (error) { informar(error.message || "Não foi possível salvar a origem."); }).finally(function () { button.disabled = false; });
  });
  form.elements.possuiSistema.addEventListener("change", function () {
    var show = this.value === "sim";
    document.getElementById("capture-current-wrap").hidden = !show;
    if (!show) form.elements.sistemaAtual.value = "";
  });
  form.addEventListener("reset", function () {
    setTimeout(function () { document.getElementById("capture-current-wrap").hidden = true; informar(""); }, 0);
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var telefone = form.elements.telefone.value.trim();
    var email = form.elements.email.value.trim();
    var sistemas = Array.prototype.map.call(form.querySelectorAll('input[name="sistemaIds"]:checked'), function (item) { return item.value; });
    if (!form.elements.nome.value.trim()) { informar("Informe o nome do lead."); form.elements.nome.focus(); return; }
    if (!sistemas.length) { informar("Selecione ao menos um sistema de interesse."); form.querySelector('input[name="sistemaIds"]')?.focus(); return; }
    if (!telefone && !email) { informar("Informe WhatsApp ou e-mail."); form.elements.telefone.focus(); return; }
    if (telefone && !Painel.util.telefoneValido(telefone)) { informar("WhatsApp inválido. Use DDD + número."); form.elements.telefone.focus(); return; }
    if (email && !form.elements.email.checkValidity()) { informar("Informe um e-mail válido."); form.elements.email.focus(); return; }
    var data = {
      nome: form.elements.nome.value.trim(), empresa: form.elements.empresa.value.trim(),
      cargo: form.elements.cargo.value.trim(), telefone: telefone, email: email,
      cidade: form.elements.cidade.value.trim(), origemId: source.value,
      sistemaIds: sistemas, possuiSistema: form.elements.possuiSistema.value,
      sistemaAtual: form.elements.sistemaAtual.value.trim(), observacoes: form.elements.observacoes.value.trim()
    };
    submit.disabled = true;
    informar("");
    Painel.api.leads.criar(data).then(function () {
      form.reset();
      informar("Lead cadastrado com sucesso. Você pode cadastrar o próximo.", true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      form.elements.nome.focus({ preventScroll: true });
    }).catch(function (error) {
      informar(error.message || "Não foi possível cadastrar o lead.");
      if (error.campo && form.elements[error.campo] && form.elements[error.campo].focus) form.elements[error.campo].focus();
    }).finally(function () { submit.disabled = false; });
  });

  carregarConta();
  carregarCatalogos().catch(function (error) { informar(error.message || "Não foi possível carregar origens e sistemas."); });
})(window.Painel);
