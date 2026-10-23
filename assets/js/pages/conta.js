/* ==========================================================================
   Painel Comercial - Minha conta
   ========================================================================== */

(function (Painel) {
  "use strict";

  var u = Painel.util;
  var ui = Painel.ui;

  function normalizar(texto) {
    return String(texto || "").trim();
  }

  function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function dadosPadrao() {
    var sessao = Painel.auth.usuario();
    return {
      perfil: {
        nome: sessao.nome || "",
        email: sessao.email || "",
        cargo: sessao.cargo || "",
        telefone: sessao.telefone || ""
      },
      preferencias: {
        notifLeads: true,
        notifFollowups: true,
        tabelaCompacta: false,
        idioma: "pt-BR",
        fuso: "America/Sao_Paulo"
      }
    };
  }

  function carregarDados(bootstrap) {
    var padrao = dadosPadrao();
    var sessao = (bootstrap && bootstrap.usuario) || Painel.auth.usuario();
    return {
      perfil: Object.assign({}, padrao.perfil, {
        nome: sessao.nome || "",
        email: sessao.email || "",
        cargo: sessao.cargo || "",
        telefone: sessao.telefone || ""
      }),
      preferencias: Object.assign({}, padrao.preferencias, (bootstrap && bootstrap.preferencias) || {})
    };
  }

  function campo(nome, raiz) {
    return (raiz || document).querySelector('[name="' + nome + '"]');
  }

  function marcarErro(input, erro) {
    var field = input.closest(".field");
    if (!field) return;
    field.classList.toggle("has-error", !!erro);
    input.setAttribute("aria-invalid", erro ? "true" : "false");
  }

  function limparErros(form) {
    form.querySelectorAll(".field.has-error").forEach(function (field) {
      field.classList.remove("has-error");
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (input) {
      input.setAttribute("aria-invalid", "false");
    });
  }

  function preencherResumo(perfil) {
    var sessao = Painel.auth.usuario();
    var iniciais = u.iniciais(perfil.nome) || sessao.iniciais || "MC";
    document.querySelectorAll("[data-conta-iniciais]").forEach(function (el) { el.textContent = iniciais; });
    document.querySelectorAll("[data-conta-nome]").forEach(function (el) { el.textContent = perfil.nome; });
    document.querySelectorAll("[data-conta-cargo]").forEach(function (el) { el.textContent = perfil.cargo || "Comercial"; });
    document.querySelectorAll("[data-conta-email]").forEach(function (el) { el.textContent = perfil.email; });
    document.querySelectorAll("[data-conta-empresa]").forEach(function (el) { el.textContent = sessao.empresa || Painel.config.company; });

    var desde = sessao.desde ? new Date(sessao.desde) : null;
    var desdeTexto = desde && !isNaN(desde.getTime())
      ? desde.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
      : "Hoje";
    document.querySelectorAll("[data-conta-desde]").forEach(function (el) { el.textContent = desdeTexto; });
    document.querySelectorAll("[data-conta-sessao]").forEach(function (el) {
      el.textContent = "Iniciada em " + desdeTexto + " neste navegador.";
    });
  }

  function preencherFormulario(dados) {
    var perfil = document.getElementById("form-perfil");
    if (perfil) {
      campo("nome", perfil).value = dados.perfil.nome;
      campo("email", perfil).value = dados.perfil.email;
      campo("cargo", perfil).value = dados.perfil.cargo || "";
      campo("telefone", perfil).value = dados.perfil.telefone ? u.formatarTelefone(dados.perfil.telefone) : "";
    }

    var prefs = dados.preferencias;
    document.querySelectorAll("[name=notifLeads]").forEach(function (el) { el.checked = !!prefs.notifLeads; });
    document.querySelectorAll("[name=notifFollowups]").forEach(function (el) { el.checked = !!prefs.notifFollowups; });
    document.querySelectorAll("[name=tabelaCompacta]").forEach(function (el) { el.checked = !!prefs.tabelaCompacta; });
    document.querySelectorAll("[name=idioma]").forEach(function (el) { el.value = prefs.idioma || "pt-BR"; });
    document.querySelectorAll("[name=fuso]").forEach(function (el) { el.value = prefs.fuso || "America/Sao_Paulo"; });
    document.documentElement.classList.toggle("tables-compact", !!prefs.tabelaCompacta);
    preencherResumo(dados.perfil);
  }

  function salvarPerfil() {
    var form = document.getElementById("form-perfil");
    if (!form) return;
    limparErros(form);

    var nome = normalizar(campo("nome", form).value);
    var email = normalizar(campo("email", form).value).toLowerCase();
    var cargo = normalizar(campo("cargo", form).value);
    var telefone = normalizar(campo("telefone", form).value);
    var valido = true;

    if (nome.length < 2) {
      marcarErro(campo("nome", form), true);
      valido = false;
    }
    if (!emailValido(email)) {
      marcarErro(campo("email", form), true);
      valido = false;
    }
    if (!valido) {
      (form.querySelector(".field.has-error input") || form.querySelector(".field.has-error")).focus();
      return;
    }

    var botao = document.querySelector("[data-salvar-perfil]");
    if (botao) {
      botao.disabled = true;
      botao.classList.add("is-loading");
    }

    Painel.api.conta.salvarPerfil({ nome: nome, email: email, cargo: cargo, telefone: telefone }).then(function (membro) {
      var perfil = {
        nome: membro.nome || nome,
        email: membro.email || email,
        cargo: membro.cargo || cargo,
        telefone: membro.telefone || telefone
      };
      campo("telefone", form).value = perfil.telefone ? u.formatarTelefone(perfil.telefone) : "";
      preencherResumo(perfil);

      var sessao = Painel.auth.usuario();
      sessao.nome = perfil.nome;
      sessao.email = perfil.email;
      sessao.cargo = perfil.cargo;
      sessao.telefone = perfil.telefone;
      sessao.iniciais = membro.iniciais || u.iniciais(nome);
      Painel.store.setSession(sessao);

      if (Painel.ui.renderSidebar) Painel.ui.renderSidebar();
      if (Painel.ui.renderTopbar) Painel.ui.renderTopbar();
      ui.toast("Perfil atualizado.", "success");
    }).catch(function (err) {
      if (err.campo === "email") marcarErro(campo("email", form), true);
      if (err.campo === "nome") marcarErro(campo("nome", form), true);
      if (err.campo === "telefone") marcarErro(campo("telefone", form), true);
      ui.toast(err.message || "Não foi possível salvar o perfil.", "error");
    }).then(function () {
      if (botao) {
        botao.disabled = false;
        botao.classList.remove("is-loading");
      }
    });
  }

  function salvarPreferencias() {
    var prefs = {};
    document.querySelectorAll("[name=notifLeads]").forEach(function (el) { prefs.notifLeads = !!el.checked; });
    document.querySelectorAll("[name=notifFollowups]").forEach(function (el) { prefs.notifFollowups = !!el.checked; });
    document.querySelectorAll("[name=tabelaCompacta]").forEach(function (el) { prefs.tabelaCompacta = !!el.checked; });
    var idioma = document.querySelector("[name=idioma]");
    var fuso = document.querySelector("[name=fuso]");
    prefs.idioma = idioma ? idioma.value : "pt-BR";
    prefs.fuso = fuso ? fuso.value : "America/Sao_Paulo";

    var botao = document.querySelector("[data-salvar-preferencias]");
    if (botao) {
      botao.disabled = true;
      botao.classList.add("is-loading");
    }

    Painel.api.conta.salvarPreferencias(prefs).then(function (salvas) {
      document.documentElement.classList.toggle("tables-compact", !!salvas.tabelaCompacta);
      ui.toast("Preferências salvas.", "success");
    }).catch(function (err) {
      ui.toast(err.message || "Não foi possível salvar as preferências.", "error");
    }).then(function () {
      if (botao) {
        botao.disabled = false;
        botao.classList.remove("is-loading");
      }
    });
  }

  function alterarSenha() {
    var form = document.getElementById("form-senha");
    if (!form) return;
    limparErros(form);

    var atual = campo("atual", form);
    var nova = campo("nova", form);
    var confirmacao = campo("confirmacao", form);
    var valido = true;

    if (normalizar(atual.value).length < 1) {
      marcarErro(atual, true);
      valido = false;
    }
    if (normalizar(nova.value).length < 8) {
      marcarErro(nova, true);
      valido = false;
    }
    if (nova.value !== confirmacao.value || !confirmacao.value) {
      marcarErro(confirmacao, true);
      valido = false;
    }
    if (atual.value && atual.value === nova.value) {
      marcarErro(nova, true);
      valido = false;
    }
    if (!valido) {
      (form.querySelector(".field.has-error input") || form.querySelector(".field.has-error")).focus();
      return;
    }

    var botao = document.querySelector("[data-alterar-senha]");
    if (botao) {
      botao.disabled = true;
      botao.classList.add("is-loading");
    }

    Painel.api.conta.alterarSenha({
      atual: atual.value,
      nova: nova.value,
      confirmacao: confirmacao.value
    }).then(function () {
      form.reset();
      ui.toast("Senha alterada. Use a nova senha no próximo login.", "success");
    }).catch(function (err) {
      if (err.campo === "atual") marcarErro(atual, true);
      if (err.campo === "nova") marcarErro(nova, true);
      if (err.campo === "confirmacao") marcarErro(confirmacao, true);
      ui.toast(err.message || "Não foi possível alterar a senha.", "error");
    }).then(function () {
      if (botao) {
        botao.disabled = false;
        botao.classList.remove("is-loading");
      }
    });
  }

  function bind() {
    var salvarPerfilBtn = document.querySelector("[data-salvar-perfil]");
    var salvarPrefsBtn = document.querySelector("[data-salvar-preferencias]");
    var alterarSenhaBtn = document.querySelector("[data-alterar-senha]");
    if (salvarPerfilBtn) salvarPerfilBtn.addEventListener("click", salvarPerfil);
    if (salvarPrefsBtn) salvarPrefsBtn.addEventListener("click", salvarPreferencias);
    if (alterarSenhaBtn) alterarSenhaBtn.addEventListener("click", alterarSenha);

    var formPerfil = document.getElementById("form-perfil");
    if (formPerfil) {
      formPerfil.addEventListener("input", function (e) {
        if (e.target.matches("input")) marcarErro(e.target, false);
      });
    }
    var formSenha = document.getElementById("form-senha");
    if (formSenha) {
      formSenha.addEventListener("input", function (e) {
        if (e.target.matches("input")) marcarErro(e.target, false);
      });
    }
  }

  function iniciar() {
    Painel.api.bootstrap().then(function (bootstrap) {
      preencherFormulario(carregarDados(bootstrap));
      bind();
    }).catch(function () {
      preencherFormulario(carregarDados(null));
      bind();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})(window.Painel);
