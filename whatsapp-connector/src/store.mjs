import { DatabaseSync } from 'node:sqlite';

export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, phone TEXT NOT NULL, external_id TEXT NOT NULL, status TEXT NOT NULL, timestamp INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS activity (phone TEXT PRIMARY KEY, manual INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0, incoming INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS cancelled (phone TEXT PRIMARY KEY);`);
    const columns = this.db.prepare('PRAGMA table_info(outbox)').all().map(row => row.name);
    if (!columns.includes('delivery')) {
      this.db.exec("ALTER TABLE outbox ADD COLUMN delivery TEXT NOT NULL DEFAULT 'unconfirmed'; ALTER TABLE outbox ADD COLUMN error TEXT NOT NULL DEFAULT ''; ALTER TABLE outbox ADD COLUMN jid TEXT;");
    }
    for (const row of this.db.prepare("SELECT id FROM outbox WHERE status = 'sent' AND delivery = 'unconfirmed'").all()) {
      this.db.prepare("UPDATE outbox SET status = 'uncertain', error = 'legacy_unconfirmed' WHERE id = ?").run(row.id);
      this.publish(row.id);
    }
    this.db.exec('CREATE TABLE IF NOT EXISTS phone_aliases (canonical TEXT PRIMARY KEY, original TEXT NOT NULL)');
  }
  events() { return this.db.prepare('SELECT payload FROM events ORDER BY rowid LIMIT 100').all().map(row => JSON.parse(row.payload)); }
  ack(id) { this.db.prepare('DELETE FROM events WHERE id = ?').run(id); }
  event(event) {
    const added = this.db.prepare('INSERT OR IGNORE INTO events VALUES (?, ?)').run(event.id, JSON.stringify(event));
    if (!added.changes || event.automated) return;
    this.db.prepare('INSERT OR IGNORE INTO activity (phone) VALUES (?)').run(event.phone);
    if (event.fromMe) this.db.prepare('UPDATE activity SET manual = MAX(manual, ?) WHERE phone = ?').run(event.timestamp, event.phone);
    else {
      this.db.prepare('UPDATE activity SET incoming = MAX(incoming, ?) WHERE phone = ?').run(event.timestamp, event.phone);
      if (!event.text || /\b(n[aã]o (quero|tenho interesse|me (mande|envie|contate))|pare|parar|remov[ae]|exclu[ai]|sair|cancelar|descadastr|n[uú]mero errado)/iu.test(event.text)) {
        this.db.prepare('UPDATE activity SET blocked = 1 WHERE phone = ?').run(event.phone);
      }
    }
  }
  cancel(phone) { this.db.prepare('INSERT OR IGNORE INTO cancelled VALUES (?)').run(phone); }
  incoming(phone) { return this.db.prepare('SELECT incoming FROM activity WHERE phone = ?').get(phone)?.incoming || 0; }
  allowed(phone, since, context) {
    if (this.db.prepare('SELECT phone FROM cancelled WHERE phone = ?').get(phone)) return false;
    const row = this.db.prepare('SELECT * FROM activity WHERE phone = ?').get(phone);
    return !row || (!row.blocked && row.manual < since && (context || row.incoming < since));
  }
  automated(id) { return Boolean(this.db.prepare('SELECT id FROM outbox WHERE external_id = ?').get(id)); }
  result(id) { return this.db.prepare('SELECT status, timestamp, delivery, error FROM outbox WHERE id = ?').get(id) || { status: 'unknown' }; }
  alias(canonical, original) {
    const prior = this.db.prepare('SELECT original FROM phone_aliases WHERE canonical = ?').get(canonical);
    if (prior && prior.original !== original) return false;
    this.db.prepare('INSERT OR IGNORE INTO phone_aliases VALUES (?, ?)').run(canonical, original);
    return true;
  }
  original(phone) { return this.db.prepare('SELECT original FROM phone_aliases WHERE canonical = ?').get(phone)?.original || phone; }
  resolved(id, jid) { this.db.prepare('UPDATE outbox SET jid = ? WHERE id = ?').run(jid, id); }
  claim(id, phone, externalId) {
    return this.db.prepare("INSERT OR IGNORE INTO outbox (id, phone, external_id, status, timestamp) VALUES (?, ?, ?, 'uncertain', ?)").run(id, phone, externalId, Math.floor(Date.now() / 1000)).changes > 0;
  }
  submitted(id) { this.db.prepare("UPDATE outbox SET delivery = 'submitted' WHERE id = ? AND delivery = 'unconfirmed'").run(id); }
  publish(id) {
    const result = this.result(id);
    const event = { id: `receipt:${id}:${result.delivery}:${result.error}`, kind: 'receipt', job: id, ...result };
    this.db.prepare('INSERT OR IGNORE INTO events VALUES (?, ?)').run(event.id, JSON.stringify(event));
  }
  fail(id, code, definitive = false) {
    this.db.prepare("UPDATE outbox SET error = ?, status = ? WHERE id = ? AND status <> 'sent'").run(code, definitive ? 'failed' : 'uncertain', id);
    this.publish(id);
  }
  receipt(externalId, delivery = 'server_ack') {
    const row = this.db.prepare('SELECT id, delivery FROM outbox WHERE external_id = ?').get(externalId);
    if (!row) return;
    const rank = { unconfirmed: 0, submitted: 1, server_ack: 2, delivered: 3, read: 4 };
    if ((rank[delivery] || 0) <= (rank[row.delivery] || 0)) return;
    this.db.prepare("UPDATE outbox SET status = 'sent', delivery = ?, error = '' WHERE id = ?").run(delivery, row.id);
    this.publish(row.id);
  }
  close() { this.db.close(); }
}
