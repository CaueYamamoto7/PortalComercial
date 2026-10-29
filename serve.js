/* Servidor estático local para desenvolvimento do Portal Comercial.
   Uso: node serve.js [porta]
   Abra http://127.0.0.1:4173 no navegador. */

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.argv[2] || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

http.createServer((req, res) => {
  let filePath = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (filePath === "/") filePath = "/index.html";
  const file = path.join(root, filePath);

  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative) || /^(backend|whatsapp-connector|node_modules|\.)/.test(relative)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo não encontrado: " + filePath);
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log("Portal Comercial disponível em http://127.0.0.1:" + port);
});
