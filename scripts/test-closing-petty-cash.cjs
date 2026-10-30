const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const routePath = path.join(__dirname, '../app/api/closing-harian/process/route.ts');
const routeCode = ts.transpileModule(fs.readFileSync(routePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function sale(no_id, akun, subtotal, branch = 'JAKARTA', extra = {}) {
  return { no_id, id_transaksi: `INV-${no_id}`, akun, subtotal, id_cabang: branch,
    id_bahan: 'ITEM', model: 'Model', ukuran: 'M', qty: 1, harga: subtotal, ...extra };
}

function setup(sales, returns = [], failCashInsert = false) {
  const calls = [];
  const pending = [];
  const committed = [];
  let closed = false;
  const conn = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); committed.push(...pending.splice(0)); closed = true; },
    async rollback() { calls.push('rollback'); pending.length = 0; },
    release() { calls.push('release'); },
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('FROM tb_barang_keluar a')) return [closed ? [] : sales];
      if (sql.includes('FROM tb_retur r')) return [returns];
      if (sql.includes('MAX(CAST(no_penutupan')) return [[{ max_no: 637 }]];
      if (sql.includes('INSERT INTO tb_closing_harian (')) return [{ insertId: 42 }];
      if (sql.includes('MAX(id_petty)')) return [[{ max_id: `${params[0].slice(0, -1)}000009` }]];
      if (sql.includes('INSERT INTO tb_petty_cash')) {
        if (failCashInsert) throw new Error('Petty cash insert failed');
        pending.push(params);
      }
      if (sql.includes('SELECT * FROM tb_closing_harian')) return [[{ id: 42, no_penutupan: '638' }]];
      return [{ affectedRows: 1 }];
    },
  };
  const exports = {};
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/db': { default: { getConnection: async () => conn } },
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '@/lib/auth': { verifySessionToken: async () => null },
    '@/lib/branch': { getBranchCode: (branch) => branch || 'DEFAULT' },
  };
  vm.runInNewContext(routeCode, { exports, require: (id) => {
    assert.ok(mocks[id], `Unexpected dependency: ${id}`);
    return mocks[id];
  }, console: { error() {} } }, { filename: routePath });
  const run = (body = {}) => exports.POST({ json: async () => ({
    tgl_transaksi: '2026-10-12', kasir: 'Kasir Test', kas_pembukaan: 50000, ...body,
  }) });
  return { run, calls, committed };
}

test('closing records discounted cash once; excludes transfer, debt, opening cash and return deduction', async () => {
  const cash = sale(1, ' CASH ', 100000, 'JAKARTA', { disc: 5000, disc_invoice: 10000 });
  const context = setup([cash, { ...cash, no_id: 2, subtotal: 50000 },
    sale(3, 'TRANSFER', 200000), sale(4, 'HUTANG', 300000)],
  [{ no_id: 10, id_transaksi: 'RET-1', id_bahan: 'ITEM', qty: 1, subtotal: 20000 }]);
  const response = await context.run();
  assert.equal(response.status, 200);
  assert.equal(context.committed.length, 1);
  const entry = context.committed[0];
  assert.match(entry[0], /-000010$/);
  assert.equal(entry[1], '2026-10-12');
  assert.match(entry[2], /Closing Harian No\. 638/);
  assert.equal(entry[3], 135000);
  assert.equal(entry[4], 'Kasir Test');
  assert.equal(entry[5], 'JAKARTA');
  assert.equal(response.body.data.petty_cash[0].in_cash, 135000);
  assert.ok(context.calls.some((call) => call.sql?.includes('FROM tb_barang_keluar a') && call.sql.includes('FOR UPDATE')));
  const update = context.calls.find((call) => call.sql?.includes('UPDATE tb_barang_keluar'));
  assert.equal(JSON.stringify(update.params[2]), '[1,2,3,4]');
  const repeated = await context.run();
  assert.equal(repeated.status, 400);
  assert.equal(context.committed.length, 1);
});

test('all-branch closing creates cash in for each actual branch', async () => {
  const context = setup([sale(1, 'CASH', 100000), sale(2, 'cash', 250000, 'BANDUNG')]);
  await context.run({ id_cabang: 'ALL' });
  assert.deepEqual(context.committed.map((entry) => [entry[5], entry[3]]),
    [['JAKARTA', 100000], ['BANDUNG', 250000]]);
});

test('non-cash or zero-cash closing does not create a cash in entry', async () => {
  const context = setup([sale(1, 'TRANSFER', 100000), sale(2, 'HUTANG', 50000),
    sale(3, 'CASH', 10000, 'JAKARTA', { disc: 10000 })]);
  assert.equal((await context.run()).status, 200);
  assert.equal(context.committed.length, 0);
});

test('cash insert failure rolls back closing and releases connection', async () => {
  const context = setup([sale(1, 'CASH', 100000)], [], true);
  assert.equal((await context.run()).status, 500);
  assert.equal(context.committed.length, 0);
  assert.ok(context.calls.includes('rollback'));
  assert.ok(!context.calls.includes('commit'));
  assert.equal(context.calls.at(-1), 'release');
});

test('no unclosed sales does not create cash in', async () => {
  const context = setup([]);
  assert.equal((await context.run()).status, 400);
  assert.equal(context.committed.length, 0);
  assert.ok(!context.calls.some((call) => call.sql?.includes('INSERT INTO tb_petty_cash')));
});
