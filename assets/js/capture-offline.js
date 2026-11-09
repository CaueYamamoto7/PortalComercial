(function (Painel) {
  "use strict";

  var database;
  function open() {
    if (database) return database;
    database = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("Armazenamento offline indisponível neste navegador.")); return; }
      var request = indexedDB.open("assinasoft-capture", 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        db.createObjectStore("leads", { keyPath: "id" });
        db.createObjectStore("catalogs", { keyPath: "userId" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    }).catch(function (error) { database = null; throw error; });
    return database;
  }

  function operation(store, mode, action) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(store, mode);
        var request = action(transaction.objectStore(store));
        var result;
        request.onsuccess = function () { result = request.result; };
        request.onerror = function () { reject(request.error); };
        transaction.oncomplete = function () { resolve(result); };
        transaction.onabort = function () { reject(transaction.error || new Error("Não foi possível salvar no aparelho.")); };
      });
    });
  }

  function uuid() {
    if (!window.crypto || !crypto.randomUUID) throw new Error("Identificador seguro indisponível neste navegador.");
    return crypto.randomUUID();
  }

  Painel.captureOffline = {
    save: function (userId, data) {
      var item = { id: uuid(), userId: userId, data: data, createdAt: new Date().toISOString(), status: "pending", error: "" };
      return operation("leads", "readwrite", function (store) { return store.add(item); }).then(function () { return item; });
    },
    list: function (userId) {
      return operation("leads", "readonly", function (store) { return store.getAll(); }).then(function (items) {
        return items.filter(function (item) { return item.userId === userId; }).sort(function (a, b) { return a.createdAt.localeCompare(b.createdAt); });
      });
    },
    update: function (item) { return operation("leads", "readwrite", function (store) { return store.put(item); }); },
    remove: function (id) { return operation("leads", "readwrite", function (store) { return store.delete(id); }); },
    saveCatalog: function (userId, data) {
      return operation("catalogs", "readwrite", function (store) { return store.put({ userId: userId, data: data, savedAt: Date.now() }); });
    },
    getCatalog: function (userId) {
      return operation("catalogs", "readonly", function (store) { return store.get(userId); });
    }
  };
})(window.Painel);
