/* ==========================================================================
   Portal Comercial — Login
   ========================================================================== */

(function (Painel) {
  "use strict";

  var form = document.getElementById("login-form");
  if (!form) return;

  var email = document.getElementById("email");
  var senha = document.getElementById("senha");
  var lembrar = document.getElementById("lembrar");
  var botao = document.getElementById("btn-entrar");
  var erro = document.getElementById("login-error");
  var erroTexto = document.getElementById("login-error-text");
  var campoEmail = document.getElementById("field-email");
  var campoSenha = document.getElementById("field-senha");
  var destino = Painel.auth.destino(new URLSearchParams(window.location.search).get("next"));

  function limparErros() {
    erro.classList.remove("is-visible");
    campoEmail.classList.remove("has-error");
    campoSenha.classList.remove("has-error");
  }

  function mostrarErro(msg, campo) {
    erroTexto.textContent = msg;
    erro.classList.add("is-visible");
    if (campo) campo.classList.add("has-error");
  }

  document.getElementById("toggle-senha").addEventListener("click", function () {
    var visivel = senha.type === "text";
    senha.type = visivel ? "password" : "text";
    this.setAttribute("aria-label", visivel ? "Mostrar senha" : "Ocultar senha");
    this.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-' + (visivel ? "eye" : "eye-off") + '"></use></svg>';
    senha.focus();
  });

  [email, senha].forEach(function (input) {
    input.addEventListener("input", limparErros);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    limparErros();

    var valorEmail = email.value.trim();
    var valorSenha = senha.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valorEmail)) {
      mostrarErro("Informe um e-mail válido.", campoEmail);
      email.focus();
      return;
    }
    if (valorSenha.length < 8) {
      mostrarErro("A senha deve ter pelo menos 8 caracteres.", campoSenha);
      senha.focus();
      return;
    }

    botao.classList.add("is-loading");
    botao.disabled = true;
    Painel.auth.entrar(valorEmail, valorSenha, lembrar.checked).then(function (sessao) {
      window.location.href = sessao && sessao.mustChangePassword ? "conta.html" : destino;
    }).catch(function (err) {
      botao.classList.remove("is-loading");
      botao.disabled = false;
      mostrarErro(err.message || "Não foi possível entrar. Tente novamente.");
    });
  });
})(window.Painel);
