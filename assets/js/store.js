/* ==========================================================================
   Painel Comercial — Armazenamento local
   ========================================================================== */

(function (Painel) {
  "use strict";

  var memoria = {};

  var disponivel = (function () {
    try {
      var k = "__painel_teste__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function ler(chave) {
    try {
      if (disponivel) {
        var raw = window.localStorage.getItem(chave);
        return raw ? JSON.parse(raw) : null;
      }
      return Object.prototype.hasOwnProperty.call(memoria, chave) ? memoria[chave] : null;
    } catch (e) {
      return null;
    }
  }

  function gravar(chave, valor) {
    try {
      if (disponivel) {
        window.localStorage.setItem(chave, JSON.stringify(valor));
      } else {
        memoria[chave] = valor;
      }
      return true;
    } catch (e) {
      memoria[chave] = valor;
      return false;
    }
  }

  function remover(chave) {
    try {
      if (disponivel) window.localStorage.removeItem(chave);
      delete memoria[chave];
    } catch (e) {
      delete memoria[chave];
    }
  }

  Painel.store = {
    disponivel: disponivel,
    get: ler,
    set: gravar,
    remove: remover,

    getDB: function () {
      return ler(Painel.config.storage.db);
    },
    setDB: function (db) {
      return gravar(Painel.config.storage.db, db);
    },
    resetDB: function () {
      remover(Painel.config.storage.db);
    },

    getSession: function () {
      return ler(Painel.config.storage.session);
    },
    setSession: function (sessao) {
      return gravar(Painel.config.storage.session, sessao);
    },
    clearSession: function () {
      remover(Painel.config.storage.session);
    },

    limparTudo: function () {
      var prefixo = "assinasoft.";
      try {
        if (disponivel) {
          Object.keys(window.localStorage)
            .filter(function (k) { return k.indexOf(prefixo) === 0; })
            .forEach(function (k) { window.localStorage.removeItem(k); });
        }
      } catch (e) { /* ignora */ }
      memoria = {};
    }
  };
})(window.Painel);
