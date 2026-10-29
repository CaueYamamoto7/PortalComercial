import http from 'node:http';
import { mkdir, chmod, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, jidNormalizedUser, normalizeMessageContent } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { Store } from './store.mjs';

const token = process.env.WHATSAPP_CONNECTOR_TOKEN || '';
if (token.length < 32 || token.startsWith('replace-')) throw new Error('Configure um token aleatório com pelo menos 32 caracteres.');
const directory = resolve(process.env.DATA_DIR || './data');
await mkdir(join(directory, 'auth'), { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const store = new Store(join(directory, 'queue.sqlite'));
const logger = pino({ level: 'silent' });
let socket, status = 'disconnected', qr = null, phone = null, connecting = false, stopped = false, reconnect;
let eventChain = Promise.resolve();

async function connect() {
  if (connecting || status === 'connecting' || status === 'connected' || status === 'qr') return;
  connecting = true; stopped = false; status = 'connecting';
  try {
    const { state, saveCreds } = await useMultiFileAuthState(join(directory, 'auth'));
    const current = makeWASocket({ auth: state, logger, syncFullHistory: false, markOnlineOnConnect: false });
    socket = current;
    current.ev.on('creds.update', saveCreds);
    current.ev.on('connection.update', async update => {
      if (socket !== current) return;
      if (update.qr) { qr = await QRCode.toDataURL(update.qr); status = 'qr'; }
      if (update.connection === 'open') {
        qr = null; status = 'connected'; phone = jidNormalizedUser(current.user.id).split('@')[0];
      }
      if (update.connection === 'close') {
        qr = null; phone = null; status = 'disconnected'; connecting = false;
        const code = update.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          await rm(join(directory, 'auth'), { recursive: true, force: true });
          await mkdir(join(directory, 'auth'), { recursive: true, mode: 0o700 });
        }
        if (!stopped && code !== DisconnectReason.loggedOut && code !== DisconnectReason.connectionReplaced) {
          clearTimeout(reconnect);
          reconnect = setTimeout(() => connect().catch(() => { status = 'disconnected'; }), 5000);
        }
      }
    });
    current.ev.on('messages.upsert', ({ type, messages }) => {
      if (type !== 'notify') return; // Never automate history synchronization.
      eventChain = eventChain.then(async () => {
        for (const item of messages) {
          let jid = item.key.remoteJid;
          if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue;
          if (jid.endsWith('@lid')) {
            jid = item.key.remoteJidAlt || await current.signalRepository.lidMapping.getPNForLID(jid);
          }
          if (!jid?.endsWith('@s.whatsapp.net')) continue;
          const number = store.original(jidNormalizedUser(jid).split('@')[0]);
          const content = normalizeMessageContent(item.message);
          if (!content || content.protocolMessage || content.reactionMessage) continue;
          const text = content.conversation || content.extendedTextMessage?.text || '';
          const automated = Boolean(item.key.fromMe && store.automated(item.key.id));
          store.event({
            id: `${jid}:${item.key.id}`, phone: number, fromMe: Boolean(item.key.fromMe), automated,
            text, timestamp: Number(item.messageTimestamp || Math.floor(Date.now() / 1000))
          });
        }
      }).catch(() => console.error('Falha ao processar evento; verifique a sessão do conector.'));
    });
    current.ev.on('messages.update', updates => {
      for (const update of updates) {
        const value = update.update.status;
        if (value >= 2) store.receipt(update.key.id, value >= 4 ? 'read' : value === 3 ? 'delivered' : 'server_ack');
      }
    });
    current.ws.on('CB:ack,class:message', node => {
      if (!node.attrs.error) store.receipt(node.attrs.id, 'server_ack');
      else {
        const row = store.db.prepare('SELECT id FROM outbox WHERE external_id = ?').get(node.attrs.id);
        if (row) store.fail(row.id, `whatsapp_ack_${String(node.attrs.error).replace(/[^a-z0-9_-]/gi, '').slice(0, 40)}`, true);
      }
    });
    current.ev.on('message-receipt.update', updates => {
      for (const { key, receipt } of updates) {
        if (receipt.readTimestamp || receipt.playedTimestamp) store.receipt(key.id, 'read');
        else if (receipt.receiptTimestamp) store.receipt(key.id, 'delivered');
      }
    });
  } catch (error) {
    status = 'disconnected';
    throw error;
  } finally { connecting = false; }
}

function authorized(request) {
  const supplied = Buffer.from(request.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
async function body(request) {
  let text = '';
  for await (const chunk of request) {
    text += chunk;
    if (Buffer.byteLength(text) > 32000) throw new Error('Payload excessivo');
  }
  return JSON.parse(text || '{}');
}
const server = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  const send = (code, data) => { response.writeHead(code); response.end(JSON.stringify(data)); };
  if (!authorized(request)) return send(401, { error: 'Unauthorized' });
  const path = new URL(request.url, 'http://localhost').pathname;
  try {
    if (request.method === 'GET') {
      if (path === '/status') return send(200, { status, qr, phone });
      if (path === '/events') { await eventChain; return send(200, { events: store.events() }); }
      if (path.startsWith('/result/')) return send(200, store.result(path.slice(8)));
    }
    if (request.method === 'POST') {
      const data = await body(request);
      if (path === '/connect') { await connect(); return send(200, { status }); }
      if (path === '/resolve' && /^[1-9]\d{9,14}$/.test(data.phone)) {
        if (status !== 'connected') return send(503, { error: 'Disconnected' });
        const [contact] = await socket.onWhatsApp(`${data.phone}@s.whatsapp.net`);
        return send(200, { exists: Boolean(contact?.exists), jid: contact?.jid || null, self: contact?.jid ? jidNormalizedUser(contact.jid) === jidNormalizedUser(socket.user.id) : false });
      }
      if (path === '/disconnect') {
        stopped = true; clearTimeout(reconnect);
        if (socket) await socket.logout();
        status = 'disconnected'; qr = null; phone = null;
        return send(200, { status });
      }
      if (path === '/events/ack') { for (const id of (data.ids || []).slice(0, 100)) store.ack(String(id)); return send(200, { ok: true }); }
      if (path === '/cancel' && /^[1-9]\d{9,14}$/.test(data.phone)) {
        store.cancel(data.phone); return send(200, { ok: true });
      }
      if (path === '/send') {
        if (!/^wa_[a-f0-9]{24}-(greeting|context)$/.test(data.id) || !/^[1-9]\d{9,14}$/.test(data.phone) ||
            typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4000 || !Number.isSafeInteger(Number(data.since))) {
          return send(400, { error: 'Invalid payload' });
        }
        const previous = store.result(data.id);
        if (previous.status !== 'unknown') return send(200, previous);
        if (status !== 'connected') return send(503, { error: 'Disconnected' });
        await eventChain;
        if (!store.allowed(data.phone, Number(data.since), data.context === true)) return send(200, { status: 'manual' });
        if (data.context === true && store.incoming(data.phone) > Number(data.lastReplyAt || 0)) return send(200, { status: 'changed' });
        const externalId = randomBytes(16).toString('hex').toUpperCase();
        if (!store.claim(data.id, data.phone, externalId)) return send(200, store.result(data.id));
        try {
          const [contact] = await socket.onWhatsApp(`${data.phone}@s.whatsapp.net`);
          if (!contact?.exists || !contact.jid) {
            store.fail(data.id, 'number_not_registered', true);
            return send(200, store.result(data.id));
          }
          const canonical = jidNormalizedUser(contact.jid);
          if (canonical === jidNormalizedUser(socket.user.id)) {
            store.fail(data.id, 'self_contact', true);
            return send(200, store.result(data.id));
          }
          if (!store.alias(canonical.split('@')[0], data.phone)) {
            store.fail(data.id, 'duplicate_canonical_number', true);
            return send(200, store.result(data.id));
          }
          store.resolved(data.id, canonical);
          await eventChain;
          if (!store.allowed(data.phone, Number(data.since), data.context === true)) {
            store.fail(data.id, 'operator_intervened', true);
            return send(200, store.result(data.id));
          }
          await socket.sendMessage(canonical, { text: data.text }, { messageId: externalId });
          store.submitted(data.id);
        } catch (error) {
          const code = String(error?.output?.statusCode || error?.code || 'transport_error').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
          store.fail(data.id, code);
          console.error(JSON.stringify({ event: 'send_error', job: data.id, code }));
        }
        return send(200, store.result(data.id));
      }
    }
    send(404, { error: 'Not found' });
  } catch { send(500, { error: 'Connector operation failed' }); }
});
server.requestTimeout = 45000;
server.listen(Number(process.env.PORT || 3100), process.env.HOST || '127.0.0.1', () => console.log('WhatsApp connector iniciado.'));
// Restore a previously linked session after restart; QR is exposed only to authenticated administrators.
await connect();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopped = true; clearTimeout(reconnect); socket?.end(undefined); server.close(); store.close(); process.exit(0);
});
