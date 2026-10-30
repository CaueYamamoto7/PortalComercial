const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const authSource = fs.readFileSync(path.join(__dirname, "../assets/js/auth.js"), "utf8");

async function abrirLogin(next, sessaoLocal) {
  const redirects = [];
  let sessao = sessaoLocal ? { nome: "Usuário" } : null;
  const Painel = {
    config: {
      apiBase: "/api",
      company: "AssinaSoft",
      paginasInternas: ["/", "/leads", "/cadastro-lead", "/pipeline", "/followups", "/mensagens", "/relatorios", "/configuracoes", "/conta"],
      storage: { session: "sessao" }
    },
    store: {
      disponivel: true,
      getSession: () => sessao,
      setSession: (nova) => { sessao = nova; },
      clearSession: () => { sessao = null; }
    },
    api: { bootstrap: () => Promise.resolve({ usuario: { nome: "Usuário" } }) }
  };
  const window = {
    Painel,
    location: {
      pathname: "/login",
      origin: "http://localhost:8080",
      search: next ? "?next=" + encodeURIComponent(next) : "",
      replace: (destino) => redirects.push(destino)
    },
    sessionStorage: { getItem: () => null, removeItem: () => {} },
    localStorage: { getItem: () => null }
  };
  const document = { documentElement: { getAttribute: () => "guest", classList: { toggle: () => {} } } };

  vm.runInNewContext(authSource, { window, document, URL, URLSearchParams, Promise, Date });
  await new Promise((resolve) => setImmediate(resolve));
  return { redirects, destino: Painel.auth.destino };
}

test("sessão já válida mantém o destino do QR após abrir o login", async () => {
  const { redirects } = await abrirLogin("/cadastro-lead", true);
  assert.deepEqual(redirects, ["/cadastro-lead"]);
});

test("destino preserva parâmetros e rejeita outro domínio", async () => {
  const { destino } = await abrirLogin(null, false);
  assert.equal(destino("/leads?novo=1"), "/leads?novo=1");
  assert.equal(destino("https://exemplo.invalid/cadastro-lead"), "/");
});

test("formulário sem sessão envia o destino ao login", () => {
  const redirects = [];
  const Painel = {
    config: { apiBase: "/api", storage: {} },
    store: { disponivel: true, getSession: () => null }
  };
  const window = {
    Painel,
    location: {
      pathname: "/cadastro-lead",
      search: "?origem=qr",
      replace: (destino) => redirects.push(destino)
    },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    localStorage: { getItem: () => null }
  };
  const document = { documentElement: { getAttribute: () => "required" } };

  vm.runInNewContext(authSource, { window, document, URL, URLSearchParams, Promise, Date });
  assert.deepEqual(redirects, ["/login?next=%2Fcadastro-lead%3Forigem%3Dqr"]);
});
