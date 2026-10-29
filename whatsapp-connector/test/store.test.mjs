import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';

test('outbox survives restart, publishes receipts and never resends', () => {
  const dir = mkdtempSync(join(process.env.OPENCODE_TMP || tmpdir(), 'wa-test-'));
  const path = join(dir, 'queue.sqlite');
  let store = new Store(path);
  try {
    assert.equal(store.claim('job', '5511999999999', 'msg'), true);
    store.submitted('job');
    assert.equal(store.result('job').status, 'uncertain');
    assert.equal(store.result('job').delivery, 'submitted');
    store.close(); store = new Store(path);
    assert.equal(store.claim('job', '5511999999999', 'other'), false);
    store.receipt('msg', 'server_ack');
    assert.equal(store.result('job').status, 'sent');
    assert.equal(store.result('job').delivery, 'server_ack');
    assert.ok(store.events().some(event => event.kind === 'receipt' && event.job === 'job'));
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('a delivery receipt never downgrades a confirmed message', () => {
  const store = new Store(':memory:');
  try {
    store.claim('job', '5511999999999', 'msg');
    store.receipt('msg', 'read');
    store.receipt('msg', 'server_ack');
    assert.equal(store.result('job').delivery, 'read');
  } finally { store.close(); }
});

test('legacy sent rows are downgraded to unconfirmed instead of trusted', async () => {
  const dir = mkdtempSync(join(process.env.OPENCODE_TMP || tmpdir(), 'wa-legacy-'));
  const path = join(dir, 'queue.sqlite');
  let store = new Store(path);
  try {
    store.close();
    const { DatabaseSync } = await import('node:sqlite');
    const raw = new DatabaseSync(path);
    raw.prepare("INSERT INTO outbox (id, phone, external_id, status, timestamp) VALUES ('legacy', '5511999999999', 'old', 'sent', 1)").run();
    raw.close();
    store = new Store(path);
    assert.equal(store.result('legacy').status, 'uncertain');
    assert.equal(store.result('legacy').error, 'legacy_unconfirmed');
  } finally {
    store.close();
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch { /* Windows keeps WAL handles briefly */ }
  }
});

test('a canonical number cannot be reached through two spellings', () => {
  const store = new Store(':memory:');
  try {
    assert.equal(store.alias('554388604583', '554388604583'), true);
    assert.equal(store.alias('554388604583', '5543988604583'), false);
    assert.equal(store.original('554388604583'), '554388604583');
  } finally { store.close(); }
});


test('manual intervention and opt-out stop scheduled sending', () => {
  const store = new Store(':memory:');
  try {
    store.event({ id: 'in', phone: '5511999999999', timestamp: 101, fromMe: false, text: 'Tudo bem' });
    assert.equal(store.allowed('5511999999999', 100, true), true);
    assert.equal(store.allowed('5511999999999', 100, false), false);
    store.event({ id: 'out', phone: '5511999999999', timestamp: 102, fromMe: true, text: 'Olá' });
    assert.equal(store.allowed('5511999999999', 100, true), false);
    store.event({ id: 'refusal', phone: '5511888888888', timestamp: 103, fromMe: false, text: 'Não tenho interesse' });
    assert.equal(store.allowed('5511888888888', 100, true), false);
    store.cancel('5511777777777');
    assert.equal(store.allowed('5511777777777', 100, true), false);
  } finally { store.close(); }
});

test('automated echo does not count as operator intervention; events are durable until ack', () => {
  const store = new Store(':memory:');
  try {
    const event = { id: 'echo', phone: '5511999999999', timestamp: 101, fromMe: true, automated: true, text: 'Olá' };
    store.event(event); store.event(event);
    assert.equal(store.events().length, 1);
    assert.equal(store.allowed(event.phone, 100, true), true);
    store.ack(event.id);
    assert.equal(store.events().length, 0);
  } finally { store.close(); }
});
