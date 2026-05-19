// ============================================
// Database Module - SQLite via sql.js (WASM, tanpa native addon)
// ============================================
// Reads schema/*.json → creates tables → provides CRUD operations
// ============================================

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { HUB_TYPES, isAllowed } = require('./upload-types');
const bcrypt = require('bcryptjs');
const pgDriver = require('./database/pg-driver');

const DB_PATH = path.join(__dirname, 'data.db');
const SCHEMA_DIR = path.join(__dirname, 'schema');

let sqlDb = null;
let db = null;
let dialect = 'sqlite';

function isPostgres() {
  return dialect === 'postgres';
}

// Normalisasi hasil query (pg mengembalikan bigint sebagai string)
function normalizeRow(row) {
  if (!row || !isPostgres()) return row;
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === 'bigint') out[key] = Number(out[key]);
  }
  return out;
}

function normalizeRows(rows) {
  return (rows || []).map(normalizeRow);
}

async function q(stmt, method, ...params) {
  const result = stmt[method](...params);
  return result instanceof Promise ? result : result;
}

function persistDb() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, Buffer.from(data));
  fs.renameSync(tmpPath, DB_PATH);
}

function getLastInsertRowid() {
  const row = sqlDb.exec('SELECT last_insert_rowid() AS id');
  if (!row[0]?.values[0]) return 0;
  return row[0].values[0][0];
}

// sql.js named binds require keys with @ / : / $ prefix (e.g. @stage), not bare names
function toNamedBindParams(obj) {
  const bound = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@') || key.startsWith(':') || key.startsWith('$')) {
      bound[key] = value;
    } else {
      bound[`@${key}`] = value;
    }
  }
  return bound;
}

function bindStatement(stmt, params) {
  if (!params || (Array.isArray(params) && params.length === 0)) return;
  if (params.length === 1 && params[0] != null && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    stmt.bind(toNamedBindParams(params[0]));
    return;
  }
  if (params.length === 1 && Array.isArray(params[0])) {
    stmt.bind(params[0]);
    return;
  }
  stmt.bind(params);
}

function createStatement(sql) {
  return {
    all(...params) {
      const stmt = sqlDb.prepare(sql);
      try {
        bindStatement(stmt, params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
    get(...params) {
      const rows = this.all(...params);
      return rows[0];
    },
    run(...params) {
      const stmt = sqlDb.prepare(sql);
      try {
        bindStatement(stmt, params);
        stmt.step();
        const result = {
          changes: sqlDb.getRowsModified(),
          lastInsertRowid: getLastInsertRowid()
        };
        persistDb();
        return result;
      } finally {
        stmt.free();
      }
    }
  };
}

function createDbWrapper() {
  return {
    exec(sql) {
      sqlDb.exec(sql);
      persistDb();
    },
    pragma(statement) {
      try {
        sqlDb.run(`PRAGMA ${statement}`);
      } catch {
        /* pragma opsional (mis. WAL) */
      }
    },
    prepare(sql) {
      return createStatement(sql);
    },
    transaction(fn) {
      return async (...args) => {
        sqlDb.run('BEGIN');
        try {
          const result = await Promise.resolve(fn(...args));
          sqlDb.run('COMMIT');
          persistDb();
          return result;
        } catch (e) {
          try { sqlDb.run('ROLLBACK'); } catch { /* ignore */ }
          throw e;
        }
      };
    }
  };
}

// SQLite type mapping from schema field types
function mapFieldType(field) {
  const raw = String(field.type || 'text').toUpperCase();
  const sqlDirect = {
    INTEGER: 'INTEGER',
    TEXT: 'TEXT',
    REAL: 'REAL',
    BLOB: 'BLOB',
    BOOLEAN: 'INTEGER',
    DATE: 'TEXT',
    DATETIME: 'TEXT'
  };
  if (sqlDirect[raw]) return sqlDirect[raw];

  const typeMap = {
    number: field.name.includes('price') || field.name.includes('amount') || field.name.includes('value') || field.name.includes('revenue') ? 'REAL' : 'INTEGER',
    text: 'TEXT',
    email: 'TEXT',
    password: 'TEXT',
    textarea: 'TEXT',
    url: 'TEXT',
    boolean: 'INTEGER',
    date: 'TEXT',
    datetime: 'TEXT',
    time: 'TEXT',
    select: 'TEXT',
    radio: 'TEXT',
    checkbox: 'INTEGER',
    file: 'TEXT',
    image: 'TEXT',
    json: 'TEXT',
    enum: 'TEXT'
  };
  return typeMap[field.type] || 'TEXT';
}

function getFieldDefault(field) {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.default !== undefined) return field.default;
  return undefined;
}

function formatDefault(defVal) {
  if (defVal === undefined) return undefined;
  if (typeof defVal === 'boolean') return defVal ? 1 : 0;
  if (typeof defVal === 'string') return `'${String(defVal).replace(/'/g, "''")}'`;
  return defVal;
}

// Generate CREATE TABLE SQL from schema JSON
function schemaToCreateSQL(schema) {
  const pk = schema.primaryKey || 'id';
  const lines = [];

  for (const field of schema.fields) {
    const isPk = field.name === pk || field.primaryKey;
    if (isPk) {
      lines.push(
        isPostgres()
          ? `  "${field.name}" SERIAL PRIMARY KEY`
          : `  "${field.name}" INTEGER PRIMARY KEY AUTOINCREMENT`
      );
      continue;
    }

    let col = `  "${field.name}" ${mapFieldType(field)}`;
    if (field.required) col += ' NOT NULL';
    const defVal = getFieldDefault(field);
    if (defVal !== undefined) {
      col += ` DEFAULT ${formatDefault(defVal)}`;
    }
    lines.push(col);
  }

  if (schema.timestamps) {
    if (schema.timestamps.createdAt) {
      lines.push(
        isPostgres()
          ? `  "${schema.timestamps.createdAt}" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
          : `  "${schema.timestamps.createdAt}" DATETIME DEFAULT CURRENT_TIMESTAMP`
      );
    }
    if (schema.timestamps.updatedAt) {
      lines.push(
        isPostgres()
          ? `  "${schema.timestamps.updatedAt}" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
          : `  "${schema.timestamps.updatedAt}" DATETIME DEFAULT CURRENT_TIMESTAMP`
      );
    }
  }

  return `CREATE TABLE IF NOT EXISTS "${schema.name}" (\n${lines.join(',\n')}\n);`;
}

// Tambah kolom baru dari schema ke tabel yang sudah ada (migrasi ringan)
async function syncSchemaColumns(schemas) {
  for (const schema of Object.values(schemas)) {
    let existing = [];
    try {
      if (isPostgres()) {
        const rows = await q(
          db.prepare(`
            SELECT column_name AS name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ?
          `),
          'all',
          schema.name
        );
        existing = rows.map((c) => c.name);
      } else {
        existing = db.prepare(`PRAGMA table_info("${schema.name}")`).all().map((c) => c.name);
      }
    } catch {
      continue;
    }
    if (existing.length === 0) continue;

    const pk = schema.primaryKey || 'id';
    for (const field of schema.fields) {
      if (field.name === pk || field.autoIncrement) continue;
      if (existing.includes(field.name)) continue;

      let col = `"${field.name}" ${mapFieldType(field)}`;
      const defVal = getFieldDefault(field);
      if (defVal !== undefined) {
        col += ` DEFAULT ${formatDefault(defVal)}`;
      }
      try {
        const alterSql = isPostgres()
          ? `ALTER TABLE "${schema.name}" ADD COLUMN IF NOT EXISTS ${col}`
          : `ALTER TABLE "${schema.name}" ADD COLUMN ${col}`;
        await q(db.prepare(alterSql), 'run');
        console.log(`[DB] Migrated column ${schema.name}.${field.name}`);
      } catch (e) {
        console.warn(`[DB] Skip migrate ${schema.name}.${field.name}:`, e.message);
      }
    }
  }
}

// Load all schemas from /schema folder
function loadSchemas() {
  const schemas = {};
  if (!fs.existsSync(SCHEMA_DIR)) return schemas;

  const files = fs.readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
      if (content.name) {
        schemas[content.name] = content;
      }
    } catch (e) {
      console.warn(`Failed to parse schema file ${file}:`, e.message);
    }
  }
  return schemas;
}

/** Clone tanpa schema/*.json: buat tabel users agar auth & seed tidak gagal */
async function ensureMinimalUsersTableIfMissing() {
  if (!db) return;
  try {
    let exists = false;
    if (isPostgres()) {
      const row = await q(
        db.prepare(
          `SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`
        ),
        'get'
      );
      exists = !!row;
    } else {
      const row = await q(
        db.prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1`),
        'get'
      );
      exists = !!row;
    }
    if (exists) return;

    const sql = isPostgres()
      ? `CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" TEXT DEFAULT 'admin',
  "status" TEXT DEFAULT 'active',
  "phone" TEXT DEFAULT ''
);`
      : `CREATE TABLE IF NOT EXISTS "users" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" TEXT DEFAULT 'admin',
  "status" TEXT DEFAULT 'active',
  "phone" TEXT DEFAULT ''
);`;

    if (isPostgres()) await db.exec(sql);
    else {
      db.exec(sql);
      persistDb();
    }
    console.log('[DB] Tabel users minimal dibuat (belum ada schema JSON)');
  } catch (e) {
    console.warn('[DB] ensureMinimalUsersTableIfMissing:', e.message);
  }
}

async function initSqlite() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = createDbWrapper();
  db.pragma('foreign_keys = ON');
  dialect = 'sqlite';

  const schemas = loadSchemas();
  const tableNames = [];

  for (const [name, schema] of Object.entries(schemas)) {
    const sql = schemaToCreateSQL(schema);
    console.log(`[DB] Creating table if not exists: ${name}`);
    db.exec(sql);
    tableNames.push(name);
  }

  await ensureMinimalUsersTableIfMissing();

  await syncSchemaColumns(schemas);
  await ensureIndexes();
  _papHeaderPkCol = null;
  _papDetailPkCol = null;

  console.log(`[DB] SQLite ready at ${DB_PATH} (tables: ${tableNames.join(', ')})`);
  await seedSampleData();
  await backfillActivityDueDates();
  persistDb();
  return db;
}

async function initPostgres() {
  dialect = 'postgres';
  db = await pgDriver.connect();
  sqlDb = null;
  persistDb = () => {};

  const schemas = loadSchemas();
  const tableNames = [];

  for (const [name, schema] of Object.entries(schemas)) {
    const sql = schemaToCreateSQL(schema);
    console.log(`[DB] Creating table if not exists: ${name}`);
    await db.exec(sql);
    tableNames.push(name);
  }

  await ensureMinimalUsersTableIfMissing();

  await syncSchemaColumns(schemas);
  await ensureIndexes();
  _papHeaderPkCol = null;
  _papDetailPkCol = null;

  console.log(`[DB] PostgreSQL ready (tables: ${tableNames.join(', ')})`);
  await seedSampleData();
  await backfillActivityDueDates();
  return db;
}

// Initialize database: open connection + create tables from schemas
async function init() {
  if (pgDriver.usePostgres()) {
    return initPostgres();
  }
  return initSqlite();
}

const DUPLICATE_ID_BIODATA_MSG = 'ID Biodata sudah digunakan. Gunakan kode unik (contoh: FF-0002).';

/** Normalisasi kode TKI agar konsisten (trim + huruf besar) */
function normalizeIdBiodata(value) {
  return String(value == null ? '' : value).trim().toUpperCase();
}

function isUniqueConstraintError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (err?.code === '23505') return true;
  return msg.includes('unique constraint') || msg.includes('duplicate key') || msg.includes('unique failed');
}

/** Cegah duplikat id_biodata di tabel personal */
async function assertPersonalIdBiodataUnique(idBiodata, excludeRowId = null) {
  const normalized = normalizeIdBiodata(idBiodata);
  if (!normalized) throw new Error('ID Biodata wajib diisi');

  const existing = await getByField('personal', 'id_biodata', normalized);
  if (existing) {
    const isSameRow = excludeRowId != null && Number(existing.id) === Number(excludeRowId);
    if (!isSameRow) {
      throw new Error(DUPLICATE_ID_BIODATA_MSG);
    }
  }
  return normalized;
}

async function ensureUniquePersonalIdBiodataIndex() {
  try {
    const dupSql = isPostgres()
      ? `SELECT id_biodata FROM personal WHERE TRIM(COALESCE(id_biodata, '')) != ''
         GROUP BY id_biodata HAVING COUNT(*)::int > 1 LIMIT 5`
      : `SELECT id_biodata FROM personal WHERE TRIM(COALESCE(id_biodata, '')) != ''
         GROUP BY id_biodata HAVING COUNT(*) > 1 LIMIT 5`;
    const dups = await q(db.prepare(dupSql), 'all');
    if (dups.length > 0) {
      const ids = dups.map((d) => d.id_biodata).join(', ');
      console.warn(`[DB] Duplikat id_biodata masih ada (${ids}) — perbaiki data lalu restart untuk unique index.`);
      return;
    }
    const sql = 'CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_id_biodata_unique ON personal(id_biodata)';
    if (isPostgres()) await db.exec(sql);
    else db.exec(sql);
  } catch (e) {
    console.warn('[DB] Unique index personal.id_biodata:', e.message);
  }
}

// Index performa — domain TKI Flamboyan
async function ensureIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_personal_statusaktif ON personal(statusaktif)',
    'CREATE INDEX IF NOT EXISTS idx_personal_statterbang ON personal(statterbang)',
    'CREATE INDEX IF NOT EXISTS idx_family_id_biodata ON family(id_biodata)',
    'CREATE INDEX IF NOT EXISTS idx_visa_id_biodata ON visa(id_biodata)',
    'CREATE INDEX IF NOT EXISTS idx_majikan_id_biodata ON majikan(id_biodata)',
    'CREATE INDEX IF NOT EXISTS idx_disnaker_id_biodata ON disnaker(id_biodata)'
  ];
  for (const sql of indexes) {
    try {
      if (isPostgres()) await db.exec(sql);
      else db.exec(sql);
    } catch { /* tabel belum ada */ }
  }
  await ensureUniquePersonalIdBiodataIndex();
}

const AUDIT_TABLES = new Set([
  'personal', 'family', 'visa', 'majikan', 'disnaker', 'medical', 'paspor', 'dokumen'
]);

async function insertAuditLog(entityType, entityId, action, oldVals, newVals, userId = 1) {
  try {
    await q(db.prepare(`
      INSERT INTO activity_logs (entity_type, entity_id, action, old_values, new_values, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `), 'run',
      entityType,
      entityId,
      action,
      oldVals ? JSON.stringify(oldVals) : null,
      newVals ? JSON.stringify(newVals) : null,
      userId
    );
  } catch (e) {
    console.warn('[DB] Audit log skipped:', e.message);
  }
}

function prepareRowData(table, data) {
  const d = { ...data };
  if (table === 'deal_products') {
    const qty = parseFloat(d.quantity) || 1;
    const price = parseFloat(d.unit_price) || 0;
    const disc = parseFloat(d.discount) || 0;
    d.total_price = Math.max(0, qty * price - disc);
  }
  if (table === 'quotes') {
    const sub = parseFloat(d.subtotal) || 0;
    const tax = parseFloat(d.tax) || 0;
    d.total = sub + tax;
  }
  return d;
}

// Data contoh TKI Flamboyan (hanya jika tabel kosong)
async function seedSampleData() {
  try {
    const userCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM users'), 'get')).c);
    if (userCount === 0) {
      await q(db.prepare(`INSERT INTO users (name, email, role, phone, password, status) VALUES (?, ?, ?, ?, ?, ?)`), 'run',
        'Administrator', 'admin@gmail.com', 'admin', '', bcrypt.hashSync('gugus$123$', 10), 'active');
      await q(db.prepare(`INSERT INTO users (name, email, role, phone, password, status) VALUES (?, ?, ?, ?, ?, ?)`), 'run',
        'Staff Operasional', 'staff@flamboyan.local', 'staff', '', bcrypt.hashSync('staff123', 10), 'active');
    }

    const sektorCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM datasektor'), 'get')).c);
    if (sektorCount === 0) {
      const sektors = [
        ['FF', 'Female Formal', '女性正式', 'P', 2],
        ['MF', 'Male Formal', '男性正式', 'L', 0],
        ['FI', 'Female Informal', '女性非正式', 'P', 0],
        ['MI', 'Male Informal', '男性非正式', 'L', 0],
        ['JP', 'Panti Jompo', '養老院', 'P', 0],
        ['FH', 'Female Farming', '女性農場', 'P', 0],
        ['MH', 'Male Farming', '男性農場', 'L', 0],
        ['MC', 'Male Construction', '男性建築', 'L', 0],
        ['HM', 'Hotel Male', '飯店男', 'L', 0],
        ['HF', 'Hotel Female', '飯店女', 'P', 0],
        ['HK', 'Hongkong', '香港', 'P', 0],
        ['IM', 'Informal Malaysia', '馬來西亞非正式', 'P', 0]
      ];
      const insSektor = db.prepare(`INSERT INTO datasektor (kode_jenis, isi, isi_taiwan, jeniskelamin, no_urut, status) VALUES (?, ?, ?, ?, ?, 'aktif')`);
      for (const row of sektors) {
        await q(insSektor, 'run', ...row);
      }
    }

    await seedMenuMapping();
    await patchMenuMappingUploadTab();
    await patchMenuMappingIMSector();
    await patchMenuMappingBiodataExtras();
    await seedMasterReferenceData();

    // Seed katalog template Word/Excel dari folder files/
    const letterTplCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM letter_templates'), 'get')).c);
    if (letterTplCount === 0) {
      const letterTemplates = [
        ['biodata_word', 'Biodata Word', 'biodata', 'word', 'biodata/admin_print_biodata.docx', '', 'detailbio_print'],
        ['biodata_im', 'Biodata Informal', 'biodata', 'word', 'biodata/admin_print_biodata_im.docx', 'FI,MI,IM', 'detailbio_print'],
        ['biodata_jp', 'Biodata JP', 'biodata', 'word', 'biodata/admin_print_biodata_jp.docx', 'JP', 'detailbio_print'],
        ['biodata_male', 'Biodata Male', 'biodata', 'word', 'biodata/admin_print_biodata_male.docx', 'MF,MH,MC', 'detailbio_print'],
        ['biodata_cong_yi', 'Biodata Chongyi', 'biodata', 'word', 'biodatacongyi.docx', '', 'biodata_cong_yi'],
        ['biodata_baru', 'Biodata Baru', 'biodata', 'word', 'biodatabaru.docx', '', 'tambahbio'],
        ['biodata_hm', 'Biodata HM', 'biodata', 'word', 'biodata/hm.docx', 'HM', 'detailpersonal'],
        ['biodata_los', 'Letter of State', 'biodata', 'word', 'biodata/los.docx', 'HM,HF', 'detailpersonal'],
        ['biodata_los_lpk', 'Letter of State LPK', 'biodata', 'word', 'biodata/los-lpk.docx', 'HM,HF', 'detailpersonal'],
        ['kirim_biodata_tw', 'Kirim Biodata Taiwan', 'biodata', 'word', 'kirim_biodata_ke_taiwan.docx', '', 'printout'],
        ['pk', 'PK Surat', 'surat', 'word', 'pk.docx', '', 'printout'],
        ['perjanjian_tka', 'Perjanjian TKA', 'surat', 'word', 'PERJANJIAN TKA DAN AGEN TAIWAN.docx', '', 'surat_perjanjian'],
        ['surat_pernyataan_tka', 'Surat Pernyataan TKI', 'surat', 'word', 'SURAT PERNYATAAN TKA.docx', '', 'surat_pernyataan'],
        ['kontrak_kerja', 'Kontrak Kerja', 'surat', 'word', 'KONTRAK KERJA.docx', '', 'surat_kerja'],
        ['rekom_paspor', 'Rekom Paspor', 'surat', 'word', 'rekom_paspor.docx', '', 'pembuatan_paspor'],
        ['ketadm', 'Keterangan Admin UJK', 'surat', 'word', 'ketadm_print.docx', '', 'cetak_ketadm'],
        ['dl004_baru', 'DL004 Baru', 'disnaker', 'word', 'disnaker/dl004_baru.docx', '', 'surat_disnaker'],
        ['dl004_lama', 'DL004 Lama', 'disnaker', 'word', 'disnaker/dl004_lama.docx', '', 'surat_disnaker'],
        ['dokformal', 'Dokumen Formal', 'disnaker', 'word', 'dokformal.docx', 'FF,MF,FH', 'format_disnaker_formal'],
        ['dokinformal', 'Dokumen Informal', 'disnaker', 'word', 'dokinformal.docx', 'FI,MI,IM', 'format_disnaker_informal'],
        ['apendik_a', 'Apendik A', 'visa', 'word', 'apendik_a.docx', '', 'apendik'],
        ['apendik_b', 'Apendik B', 'visa', 'word', 'apendik_b.docx', '', 'apendik'],
        ['apendik_c', 'Apendik C', 'visa', 'word', 'apendik_c.docx', '', 'apendik'],
        ['apendik_d', 'Apendik D', 'visa', 'word', 'apendik_d.docx', '', 'apendik'],
        ['document_send_tw', 'Document Send Taiwan', 'visa', 'word', 'document_send_taiwan.docx', '', 'detailvisa'],
        ['document_sebelum_terbang', 'Document Sebelum Terbang', 'visa', 'word', 'document_sebelum_terbang.docx', '', 'detailvisa'],
        ['spbg_formal', 'SPBG Formal', 'spbg', 'word', 'spbg/spbg_formal.docx', 'FF,MF', 'detailmajikan_spbg'],
        ['spbg_formal_jawa', 'SPBG Formal Jawa', 'spbg', 'word', 'spbg/spbg_formal_jawa.docx', 'FF,MF', 'detailmajikan_spbg'],
        ['spbg_informal_jawa', 'SPBG Informal Jawa', 'spbg', 'word', 'spbg/spbg_informal_jawa.docx', 'FI,MI', 'detailmajikan_spbg'],
        ['spbg_inf_luar_jawa', 'SPBG Inf Luar Jawa', 'spbg', 'word', 'spbg/SPBG_INF_LUAR_PULAU_JAWA.docx', 'FI,MI', 'detailmajikan_spbg'],
        ['pp_formal', 'PP Formal', 'opp', 'word', 'pp/formal.docx', 'FF,MF', 'pembuatan_opp'],
        ['pp_informal', 'PP Informal', 'opp', 'word', 'pp/informal.docx', 'FI,MI', 'pembuatan_opp'],
        ['pp_hongkong', 'PP Hongkong', 'opp', 'word', 'pp/hongkong.docx', 'HK', 'pembuatan_opp'],
        ['pp_malaysia', 'PP Malaysia', 'opp', 'word', 'pp/malaysia.docx', 'IM', 'pembuatan_opp'],
        ['blk_jadwal1', 'BLK Jadwal 1', 'blk', 'word', 'blk_jadwal1.docx', '', 'blk_jadwal'],
        ['blk_sertifikat', 'BLK Sertifikat', 'blk', 'word', 'blk_sertifikat_formal.docx', '', 'blk_sertifikat'],
        ['blk_ujk', 'BLK UJK Print', 'blk', 'word', 'ujk_print.docx', '', 'ujk_print'],
        ['blk_kb', 'BLK KB', 'blk', 'word', 'blk_kb/blk_kb.docx', '', 'blkijin'],
        ['brifing_tpl', 'Briefing Terbang', 'blk', 'word', 'brifing/brifing_template.docx', '', 'brifing'],
        ['kwitansi_pt', 'Kwitansi PT', 'keuangan', 'word', 'biodata/kwitansi_pt.docx', '', 'invoice'],
        ['kwitansi', 'Kwitansi', 'keuangan', 'word', 'kwitansi.docx', '', 'invoice'],
        ['invoice_tpl', 'Invoice', 'keuangan', 'word', 'invoice/invoice.docx', '', 'invoice'],
        ['perincian_fee_terbang', 'Perincian Fee Terbang', 'keuangan', 'word', 'perincian_tki_terbang_pembayaran_bank.docx', '', 'new_perincian_keuangan_pt'],
        ['laprekdisnaker', 'Laporan Rekap Disnaker', 'laporan', 'word', 'laprekdisnaker_print.docx', '', 'cetak_laprekdisnaker'],
        ['laporan_registrasi', 'Laporan Registrasi', 'laporan', 'word', 'laporan_registrasi.docx', '', 'laporan'],
        ['majikan_printlist', 'Daftar Majikan', 'laporan', 'word', 'majikan_printlist.docx', '', 'majikans'],
        ['pgm_formal_xls', 'PGM Formal Excel', 'laporan', 'xlsx', 'dew_pgm_formal.xlsx', 'FF,MF', 'admin_mark2'],
        ['pgm_informal_xls', 'PGM Informal Excel', 'laporan', 'xlsx', 'dew_pgm_informal.xlsx', 'FI,MI', 'abc']
      ];
      const insLetter = db.prepare(
        `INSERT INTO letter_templates (kode, nama, kategori, engine, file_path, sektor, modul_legacy, aktif) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      );
      for (const row of letterTemplates) {
        await q(insLetter, 'run', ...row);
      }
    }

    try {
      const printSuratService = require('./print-surat-service');
      await syncPrintSuratLetterTemplates(printSuratService.loadConfig());
    } catch (e) {
      console.warn('[DB] sync print surat templates:', e.message);
    }

    const personalCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM personal'), 'get')).c);
    await ensurePjtkiAdmin();

    if (personalCount === 0) {
      const today = new Date().toISOString().slice(0, 10);
      const tkis = [
        ['FF-0001', 'Siti Aminah', 'P', 'SP01', today, 'PROSES', 0, 'Taiwan'],
        ['FF-0002', 'Dewi Lestari', 'P', 'SP01', today, 'TERPILIH', 0, 'Taiwan'],
        ['FI-0001', 'Rina Wulandari', 'P', 'SP01', today, 'PROSES', 0, 'Taiwan'],
        ['MF-0001', 'Budi Santoso', 'L', 'SP01', today, 'PROSES', 0, 'Taiwan'],
        ['JP-0001', 'Maya Sari', 'P', 'SP01', today, 'TERBANG', 1, 'Taiwan']
      ];
      const insPersonal = db.prepare(`INSERT INTO personal (id_biodata, nama, jeniskelamin, kode_sponsor, tanggaldaftar, statusaktif, statterbang, negara1) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const row of tkis) {
        await q(insPersonal, 'run', ...row);
      }

      await q(db.prepare(`INSERT INTO family (id_biodata, nama_bapak, nama_ibu) VALUES (?, ?, ?)`), 'run', 'FF-0001', 'Ahmad', 'Siti');
      await q(db.prepare(`INSERT INTO dokumen (id_biodata, ktp, kk) VALUES (?, ?, ?)`), 'run', 'FF-0001', 'ktp_ff0001.jpg', 'kk_ff0001.jpg');

      await q(db.prepare(`INSERT INTO disnaker (id_biodata, nodisnaker, tglonline) VALUES (?, ?, ?)`), 'run', 'FF-0001', 'DSK-2026-001', today);
      await q(db.prepare(`INSERT INTO medical (id_biodata, jenismedical, tanggal, nama) VALUES (?, ?, ?, ?)`), 'run', 'FF-0001', 'Pra-medical', today, 'RS Mitra');
      await q(db.prepare(`INSERT INTO paspor (id_biodata, nopaspor, tglterbit, statuspengajuan) VALUES (?, ?, ?, ?)`), 'run', 'FF-0001', 'A1234567', today, 'Terbit');
      await q(db.prepare(`INSERT INTO majikan (id_biodata, kode_agen, namamajikan, tglterpilih) VALUES (?, ?, ?, ?)`), 'run', 'FF-0001', 'AG001', 'Wang Family', today);
      await q(db.prepare(`INSERT INTO visa (id_biodata, novisa, statuskocokan, tanggalterbang, statusterbang) VALUES (?, ?, ?, ?, ?)`), 'run',
        'JP-0001', 'VISA-JP-001', 'Selesai', today, 'Terbang');
    }
  } catch (e) {
    console.warn('[DB] Seed skipped:', e.message);
  }
}

// Seed master data referensi (plan §8.3, Fase 1)
async function seedMasterReferenceData() {
  try {
    const sponsorCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM datasponsor'), 'get')).c);
    if (sponsorCount === 0) {
      await q(db.prepare(`INSERT INTO datasponsor (kode_sponsor, isi, mandarin, status) VALUES (?, ?, ?, 'aktif')`), 'run',
        'SP01', 'Sponsor Utama', '主要贊助商');
    }

    const groupCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM datagroup'), 'get')).c);
    if (groupCount === 0) {
      await q(db.prepare(`INSERT INTO datagroup (kode_group, nama, alamat, status) VALUES (?, ?, ?, ?)`), 'run',
        'GRP01', 'Group Utama', 'Surabaya', 2);
    }

    const agenCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM dataagen'), 'get')).c);
    if (agenCount === 0) {
      await q(db.prepare(`INSERT INTO dataagen (kode_agen, nama, alamat, kode_group, status) VALUES (?, ?, ?, ?, 'aktif')`), 'run',
        'AG001', 'Agen Taiwan A', 'Surabaya', 'GRP01');
    }

    const bilingualTables = {
      datanegara: [['Taiwan', '台灣'], ['Indonesia', '印尼'], ['Hong Kong', '香港']],
      databank: [['BCA', ''], ['Bank Mandiri', '']],
      dataagama: [['Islam', '伊斯蘭教'], ['Kristen', '基督教'], ['Katolik', '天主教']],
      datamedical: [['Pra-medical', '體檢前'], ['Full medical', '全檢']],
      datapendidikan: [['SMA', '高中'], ['SMK', '職高'], ['S1', '大學']],
      sektortugas: [['Merawat lansia', '照顧老人'], ['Memasak', '煮飯']],
      dataprovinsi: [['Jawa Timur', ''], ['Jawa Tengah', '']],
      dataskill: [['Memasak', '烹飪'], ['Mencuci', '洗衣']],
      datahubungan: [['Ayah', '父親'], ['Ibu', '母親'], ['Suami', '丈夫'], ['Istri', '妻子']],
      datahobi: [['Memasak', '烹飪'], ['Menyanyi', '唱歌']],
      datamata: [['Normal', '正常'], ['Minus', '近視']],
      datalokasikerja: [['Taiwan', '台灣'], ['Hong Kong', '香港']],
      dataairport: [['Soekarno-Hatta', ''], ['Juanda', '']],
      dataalasan: [['Ekonomi', '經濟'], ['Keluarga', '家庭']],
      dataposisi: [['Caregiver', '護工'], ['PRT', '家務']],
      kategoriskill: [['Rumah Tangga', '家務'], ['Perawatan', '護理']],
      datajagaanak: [['Bayi', '嬰兒'], ['Balita', '幼兒']],
      setting_pendidikan: [['SMA', '高中'], ['SMK', '職高']]
    };

    for (const [table, rows] of Object.entries(bilingualTables)) {
      const c = Number((await q(db.prepare(`SELECT COUNT(*) as c FROM "${table}"`), 'get')).c);
      if (c > 0) continue;
      const ins = db.prepare(`INSERT INTO "${table}" (isi, mandarin) VALUES (?, ?)`);
      for (const [isi, mandarin] of rows) {
        await q(ins, 'run', isi, mandarin || '');
      }
    }

    const katCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM kategoripekerjaan'), 'get')).c);
    let katId = null;
    if (katCount === 0) {
      const r = await q(db.prepare(`INSERT INTO kategoripekerjaan (isi, mandarin) VALUES (?, ?)`), 'run', 'Perawatan', '護理');
      katId = r.lastInsertRowid;
      await q(db.prepare(`INSERT INTO kategoripekerjaan (isi, mandarin) VALUES (?, ?)`), 'run', 'Rumah Tangga', '家務');
    } else {
      const row = await q(db.prepare('SELECT id FROM kategoripekerjaan ORDER BY id LIMIT 1'), 'get');
      katId = row?.id;
    }

    const pekerjaanCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM datapekerjaan'), 'get')).c);
    if (pekerjaanCount === 0 && katId != null) {
      await q(db.prepare(`INSERT INTO datapekerjaan (id_kategori, isi, mandarin) VALUES (?, ?, ?)`), 'run',
        katId, 'Caregiver', '護工');
    }

    const majikanCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM datamajikan'), 'get')).c);
    if (majikanCount === 0) {
      const sektor = await q(db.prepare(`SELECT id FROM datasektor WHERE kode_jenis = 'FF' LIMIT 1`), 'get');
      const sektorId = sektor?.id || null;
      await q(db.prepare(
        `INSERT INTO datamajikan (kode_majikan, namamajikan, nama, datasektor_id, kode_agen, status) VALUES (?, ?, ?, ?, ?, 'aktif')`
      ), 'run', 'MJ001', 'Wang Family', 'Wang Family', sektorId, 'AG001');
    }

    // Master lembaga PAP/KTKLN (datanamapap) — untuk field "Kepada (Lembaga)" di Print Surat
    if (getTableNames().includes('datanamapap')) {
      const papCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM datanamapap'), 'get')).c);
      if (papCount === 0) {
        const lembagaPap = [
          ['Kantor Dagang dan Ekonomi Indonesia (KDEI) di Taipei', '駐台北印尼經濟貿易辦事處'],
          ['Kantor Perwakilan Biro Penghubung BRIN di Taipei', '印尼台北科學技術辦事處'],
          ['Perwakilan BP2MI di Taipei', '印尼台北勞工辦事處'],
          ['Direktorat Jenderal Pembinaan Penempatan dan Perlindungan PMI', '勞工部勞動力發展署'],
          ['Dinas Tenaga Kerja dan Transmigrasi Provinsi Jawa Timur', '東爪哇省勞工與移民廳'],
          ['PT Flamboyan Gemajasa', '鳳凰花人力仲介'],
          ['Asosiasi Pekerja Migran Indonesia (APMI)', '印尼移工協會'],
          ['Kantor Taipei Economic and Trade Office (KDEI)', '台北經貿辦']
        ];
        const insPap = db.prepare('INSERT INTO datanamapap (isi, mandarin) VALUES (?, ?)');
        for (const [isi, mandarin] of lembagaPap) {
          await q(insPap, 'run', isi, mandarin || '');
        }
        console.log('[DB] Seed datanamapap (lembaga PAP/KTKLN):', lembagaPap.length, 'baris');
      }
    }

    // Master nama asuransi (datanamaasuransi) — form asuransi DIS
    if (getTableNames().includes('datanamaasuransi')) {
      const asuransiCount = Number((await q(db.prepare('SELECT COUNT(*) as c FROM datanamaasuransi'), 'get')).c);
      if (asuransiCount === 0) {
        const asuransiRows = [
          ['PT Asuransi Jiwa Manulife Indonesia', '宏利人壽'],
          ['PT Asuransi Allianz Life Indonesia', '安聯人壽'],
          ['PT Prudential Life Assurance', '保誠人壽'],
          ['PT Chubb General Insurance Indonesia', '安達保險'],
          ['PT Asuransi Sinarmas', '金光保險'],
          ['PT Asuransi Astra Buana', 'Astra保險']
        ];
        const insAs = db.prepare('INSERT INTO datanamaasuransi (isi, mandarin) VALUES (?, ?)');
        for (const [isi, mandarin] of asuransiRows) {
          await q(insAs, 'run', isi, mandarin || '');
        }
        console.log('[DB] Seed datanamaasuransi:', asuransiRows.length, 'baris');
      }
    }
  } catch (e) {
    console.warn('[DB] seedMasterReferenceData skipped:', e.message);
  }
}

// Seed menu_mapping per sektor (plan §8A.5a — menudalam)
async function seedMenuMapping() {
  try {
    const count = Number((await q(db.prepare('SELECT COUNT(*) as c FROM menu_mapping'), 'get')).c);
    if (count > 0) return;

    const formalMenus = [
      ['Personal', 'personal', 'fas fa-user', 1],
      ['Keluarga', 'family', 'fas fa-people-roof', 2],
      ['Pengalaman Kerja', 'working', 'fas fa-briefcase', 3],
      ['Skill & Kondisi', 'skillcondition', 'fas fa-heart-pulse', 4],
      ['Permintaan Kerja', 'request', 'fas fa-clipboard-list', 5],
      ['PPTK', 'pptk', 'fas fa-file-signature', 6],
      ['Vaksin', 'vaksin', 'fas fa-syringe', 7],
      ['Dokumen', 'dokumen', 'fas fa-folder-open', 8]
    ];
    const informalMenus = [
      ['Personal', 'personal', 'fas fa-user', 1],
      ['Keluarga', 'family', 'fas fa-people-roof', 2],
      ['Pengalaman', 'pengalaman', 'fas fa-route', 3],
      ['Tugas RT', 'tugas', 'fas fa-list-check', 4],
      ['Ket. Tugas', 'kettugas', 'fas fa-clipboard', 5],
      ['Vaksin', 'vaksin', 'fas fa-syringe', 6],
      ['Dokumen', 'dokumen', 'fas fa-folder-open', 7]
    ];
    const jpMenus = [
      ['Personal', 'personal', 'fas fa-user', 1],
      ['Keluarga', 'family', 'fas fa-people-roof', 2],
      ['Pengalaman Kerja', 'working', 'fas fa-briefcase', 3],
      ['Skill & Kondisi', 'skillcondition', 'fas fa-heart-pulse', 4],
      ['Interview', 'interview', 'fas fa-comments', 5],
      ['PPTK', 'pptk', 'fas fa-file-signature', 6],
      ['Vaksin', 'vaksin', 'fas fa-syringe', 7],
      ['Dokumen', 'dokumen', 'fas fa-folder-open', 8]
    ];

    const formalSectors = ['FF', 'MF', 'FH', 'MI', 'MC', 'MH', 'HM', 'HF', 'HK'];
    const informalSectors = ['FI', 'IM'];

    const ins = db.prepare(
      `INSERT INTO menu_mapping (kode_sektor, label_menu, url_menu, icon_menu, urutan, aktif, parent_id, role)
       VALUES (?, ?, ?, ?, ?, 1, 0, 'all')`
    );

    for (const code of formalSectors) {
      for (const row of formalMenus) {
        await q(ins, 'run', code, row[0], row[1], row[2], row[3]);
      }
    }
    for (const code of informalSectors) {
      for (const row of informalMenus) {
        await q(ins, 'run', code, row[0], row[1], row[2], row[3]);
      }
    }
    for (const row of jpMenus) {
      await q(ins, 'run', 'JP', row[0], row[1], row[2], row[3]);
    }
  } catch (e) {
    console.warn('[DB] seedMenuMapping skipped:', e.message);
  }
}

// Tambah tab Upload di menu_mapping (Fase 1) jika belum ada
async function patchMenuMappingUploadTab() {
  try {
    const exists = await q(
      db.prepare(`SELECT COUNT(*) as c FROM menu_mapping WHERE url_menu = 'upload'`),
      'get'
    );
    if (Number(exists.c) > 0) return;

    const sectors = await q(
      db.prepare(`SELECT DISTINCT kode_sektor FROM menu_mapping`),
      'all'
    );
    const ins = db.prepare(
      `INSERT INTO menu_mapping (kode_sektor, label_menu, url_menu, icon_menu, urutan, aktif, parent_id, role)
       VALUES (?, 'Upload Dokumen', 'upload', 'fas fa-cloud-arrow-up', 90, 1, 0, 'all')`
    );
    for (const row of sectors) {
      await q(ins, 'run', row.kode_sektor);
    }
  } catch (e) {
    console.warn('[DB] patchMenuMappingUploadTab:', e.message);
  }
}

/** Selaraskan IM dengan menudalam.php — informal, bukan formal (plan §8A.5a) */
async function patchMenuMappingIMSector() {
  try {
    const imCount = await q(
      db.prepare(`SELECT COUNT(*) as c FROM menu_mapping WHERE kode_sektor = 'IM'`),
      'get'
    );
    if (!Number(imCount.c)) return;

    const formalOnIm = await q(
      db.prepare(
        `SELECT COUNT(*) as c FROM menu_mapping WHERE kode_sektor = 'IM' AND url_menu IN ('working','skillcondition','request','pptk')`
      ),
      'get'
    );
    if (!Number(formalOnIm.c)) return;

    await q(
      db.prepare(`DELETE FROM menu_mapping WHERE kode_sektor = 'IM' AND url_menu IN ('working','skillcondition','request','pptk')`),
      'run'
    );

    const informalMenus = [
      ['Pengalaman', 'pengalaman', 'fas fa-route', 3],
      ['Tugas RT', 'tugas', 'fas fa-list-check', 4],
      ['Ket. Tugas', 'kettugas', 'fas fa-clipboard', 5]
    ];
    const ins = db.prepare(
      `INSERT INTO menu_mapping (kode_sektor, label_menu, url_menu, icon_menu, urutan, aktif, parent_id, role)
       VALUES ('IM', ?, ?, ?, ?, 1, 0, 'all')`
    );
    for (const row of informalMenus) {
      const ex = await q(
        db.prepare(`SELECT id FROM menu_mapping WHERE kode_sektor = 'IM' AND url_menu = ? LIMIT 1`),
        'get',
        row[1]
      );
      if (!ex) await q(ins, 'run', row[0], row[1], row[2], row[3]);
    }
  } catch (e) {
    console.warn('[DB] patchMenuMappingIMSector:', e.message);
  }
}

/** Tab experience, upload_arc, upload_keterangan per matriks sektor (plan §8A.5a) */
async function patchMenuMappingBiodataExtras() {
  try {
    const formalSectors = ['FF', 'MF', 'FH', 'MI', 'MC', 'MH', 'HM', 'HF', 'HK', 'JP'];
    const arcSectors = ['FF', 'MF', 'FH', 'FI', 'IM', 'JP', 'MI', 'MC', 'MH', 'HM', 'HF', 'HK'];
    const ketSectors = ['FF', 'MF', 'FH', 'FI', 'IM', 'JP', 'MI', 'MC', 'MH', 'HM', 'HF', 'HK'];

    const ins = db.prepare(
      `INSERT INTO menu_mapping (kode_sektor, label_menu, url_menu, icon_menu, urutan, aktif, parent_id, role)
       VALUES (?, ?, ?, ?, ?, 1, 0, 'all')`
    );

    for (const code of formalSectors) {
      const ex = await q(
        db.prepare(`SELECT id FROM menu_mapping WHERE kode_sektor = ? AND url_menu = 'experience' LIMIT 1`),
        'get',
        code
      );
      if (!ex) {
        await q(ins, 'run', code, 'Pengalaman Skill', 'experience', 'fas fa-star-half-stroke', 45);
      }
    }

    for (const code of arcSectors) {
      const ex = await q(
        db.prepare(`SELECT id FROM menu_mapping WHERE kode_sektor = ? AND url_menu = 'upload_arc' LIMIT 1`),
        'get',
        code
      );
      if (!ex) {
        await q(ins, 'run', code, 'Upload ARC', 'upload_arc', 'fas fa-id-card', 91);
      }
    }

    for (const code of ketSectors) {
      const ex = await q(
        db.prepare(`SELECT id FROM menu_mapping WHERE kode_sektor = ? AND url_menu = 'upload_keterangan' LIMIT 1`),
        'get',
        code
      );
      if (!ex) {
        await q(ins, 'run', code, 'Surat Keterangan', 'upload_keterangan', 'fas fa-file-lines', 92);
      }
    }
  } catch (e) {
    console.warn('[DB] patchMenuMappingBiodataExtras:', e.message);
  }
}

async function listByIdBiodata(table, idBiodata) {
  try {
    const rows = await q(
      db.prepare(`SELECT * FROM "${table}" WHERE "id_biodata" = ? ORDER BY id DESC`),
      'all',
      idBiodata
    );
    return normalizeRows(rows);
  } catch {
    return [];
  }
}

// Generate id_biodata baru & baris terkait (alur tambahbio)
async function createTkiBiodata(payload = {}) {
  const kodeSektor = String(payload.kode_sektor || '').trim().toUpperCase();
  const nama = String(payload.nama || '').trim();
  if (!kodeSektor || !nama) {
    throw new Error('Sektor dan nama wajib diisi');
  }

  const sektorRow = await getByField('datasektor', 'kode_jenis', kodeSektor);
  if (!sektorRow) throw new Error(`Sektor ${kodeSektor} tidak ditemukan`);

  const nextNo = (Number(sektorRow.no_urut) || 0) + 1;
  const idBiodata = `${kodeSektor}-${String(nextNo).padStart(4, '0')}`;

  await assertPersonalIdBiodataUnique(idBiodata);

  await q(db.prepare(`UPDATE datasektor SET no_urut = ? WHERE kode_jenis = ?`), 'run', nextNo, kodeSektor);

  const today = new Date().toISOString().slice(0, 10);
  const jk = payload.jeniskelamin || sektorRow.jeniskelamin || 'P';

  await create('personal', {
    id_biodata: idBiodata,
    nama,
    jeniskelamin: jk,
    kode_sponsor: payload.kode_sponsor || '',
    tanggaldaftar: today,
    tglinput: today,
    statusaktif: 'PROSES',
    statterbang: 0,
    negara1: payload.negara1 || 'Taiwan',
    warganegara: 'Indonesia'
  });

  await create('dokumen', {
    id_biodata: idBiodata,
    ktp: 'profile.jpg',
    kk: 'profile.jpg',
    akte: 'profile.jpg',
    ijazah: 'profile.jpg'
  });

  await create('skck', { id_biodata: idBiodata });

  await ensureMarkProgressForTki(idBiodata);

  return { id_biodata: idBiodata, kode_sektor: kodeSektor };
}

/** Baris progress marketing kosong per TKI (plan §8A.2 — markb..markg + marka) */
const MARK_PROGRESS_TABLES = ['marka', 'markb', 'markc', 'marke', 'markf', 'markg'];

async function ensureMarkProgressForTki(idBiodata) {
  const id = String(idBiodata || '').trim();
  if (!id) return;
  for (const table of MARK_PROGRESS_TABLES) {
    try {
      const existing = await getByField(table, 'id_biodata', id);
      if (!existing) {
        await create(table, { id_biodata: id, status: '' });
      }
    } catch (e) {
      console.warn(`[DB] ensureMarkProgressForTki ${table}:`, e.message);
    }
  }
}

async function getMenuMappingBySektor(kodeSektor) {
  const kode = String(kodeSektor || '').trim().toUpperCase().slice(0, 2);
  if (!kode) return [];
  try {
    const rows = await q(
      db.prepare(
        `SELECT id, kode_sektor, label_menu, url_menu, icon_menu, urutan, aktif
         FROM menu_mapping WHERE kode_sektor = ? AND aktif = 1 ORDER BY urutan ASC, id ASC`
      ),
      'all',
      kode
    );
    return normalizeRows(rows);
  } catch {
    return [];
  }
}

// Get the raw sql.js handle
function getDb() {
  return sqlDb;
}

// Get schema for a table
function getSchema(tableName) {
  const schemas = loadSchemas();
  return schemas[tableName] || null;
}

// Get all table names that have schemas
function getTableNames() {
  return Object.keys(loadSchemas());
}

// ============================================
// Generic CRUD operations
// ============================================

// List rows with pagination and search
async function list(table, options = {}) {
  const { page = 1, perPage = 10, search = '', searchFields = [], sort = '', order = 'asc', filters = {} } = options;

  const conditions = [];
  const params = {};

  if (filters.id_biodata) {
    conditions.push(`"id_biodata" = @id_biodata`);
    params.id_biodata = filters.id_biodata;
  }

  if (filters.id_biodata_prefix) {
    const prefix = String(filters.id_biodata_prefix).trim().toUpperCase();
    conditions.push(`"id_biodata" LIKE @id_biodata_prefix`);
    params.id_biodata_prefix = `${prefix}%`;
  }

  if (search && searchFields.length > 0) {
    const searchConds = searchFields.map((f, i) => {
      params[`search${i}`] = `%${search}%`;
      const col = isPostgres() ? `"${f}"::text` : `"${f}"`;
      return `${col} LIKE @search${i}`;
    });
    conditions.push(`(${searchConds.join(' OR ')})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSQL = `SELECT COUNT(*) as total FROM "${table}" ${whereClause}`;
  const countRow = await q(db.prepare(countSQL), 'get', params);
  const total = Number(countRow.total);

  let orderClause = '';
  if (sort) {
    const dir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    orderClause = `ORDER BY "${sort}" ${dir}`;
  } else {
    orderClause = 'ORDER BY id DESC';
  }

  const limit = Math.max(1, parseInt(perPage, 10) || 10);
  const offset = Math.max(0, (parseInt(page, 10) || 1) - 1) * limit;

  const dataSQL = `SELECT * FROM "${table}" ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
  const data = normalizeRows(await q(db.prepare(dataSQL), 'all', params));

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  };
}

// Get single row by id
async function getById(table, id) {
  const pk = await resolveTablePkColumn(table);
  const row = await q(db.prepare(`SELECT * FROM "${table}" WHERE "${pk}" = ?`), 'get', id);
  return normalizeRow(row);
}

// Ambil satu baris berdasarkan kolom teks (mis. id_biodata)
async function getByField(table, field, value) {
  if (!value) return null;
  try {
    const row = await q(db.prepare(`SELECT * FROM "${table}" WHERE "${field}" = ? LIMIT 1`), 'get', value);
    return normalizeRow(row);
  } catch {
    return null;
  }
}

// Insert a new row
async function create(table, data, auditOpts = {}) {
  data = prepareRowData(table, data);
  const schema = getSchema(table);
  const pk = schema?.primaryKey || 'id';

  if (table === 'personal' && data.id_biodata !== undefined) {
    data.id_biodata = await assertPersonalIdBiodataUnique(data.id_biodata);
  }

  // Filter out the primary key (autoIncrement) and unknown columns
  const validFields = schema ? schema.fields.map(f => f.name).filter(f => f !== pk) : Object.keys(data);
  let fields = validFields.filter(f => data[f] !== undefined);

  // For required (NOT NULL) fields not provided, supply a default to avoid constraint errors
  if (schema) {
    for (const field of schema.fields) {
      if (field.name === pk) continue;
      if (field.required && !fields.includes(field.name)) {
        fields.push(field.name);
        if (field.defaultValue !== undefined) {
          data[field.name] = field.defaultValue;
        } else if (field.type === 'number') {
          data[field.name] = 0;
        } else {
          data[field.name] = '';
        }
      }
    }
  }

  // Add updatedAt timestamp if schema has it
  if (schema?.timestamps?.updatedAt && !fields.includes(schema.timestamps.updatedAt)) {
    fields.push(schema.timestamps.updatedAt);
    data[schema.timestamps.updatedAt] = new Date().toISOString();
  }
  if (schema?.timestamps?.createdAt && !fields.includes(schema.timestamps.createdAt)) {
    fields.push(schema.timestamps.createdAt);
    data[schema.timestamps.createdAt] = new Date().toISOString();
  }

  ({ data, fields } = await applyDbNotNullDefaults(table, data, fields));

  const placeholders = fields.map(f => `@${f}`);
  const sql = `INSERT INTO "${table}" (${fields.map(f => `"${f}"`).join(', ')}) VALUES (${placeholders.join(', ')})`;

  const params = {};
  for (const f of fields) {
    params[f] = data[f] !== undefined ? data[f] : null;
  }

  let result;
  try {
    result = await q(db.prepare(sql), 'run', params);
  } catch (err) {
    if (table === 'personal' && isUniqueConstraintError(err)) {
      throw new Error(DUPLICATE_ID_BIODATA_MSG);
    }
    throw err;
  }
  const row = normalizeRow({ id: result.lastInsertRowid, ...data });

  if (AUDIT_TABLES.has(table) && !auditOpts.skipAudit) {
    await insertAuditLog(table, row.id, 'create', null, row, auditOpts.userId || 1);
  }

  return row;
}

// Update a row by id
async function update(table, id, data, auditOpts = {}) {
  data = prepareRowData(table, data);
  const schema = getSchema(table);
  const pk = await resolveTablePkColumn(table);
  const oldRow = AUDIT_TABLES.has(table) && !auditOpts.skipAudit ? await getById(table, id) : null;

  if (table === 'personal' && data.id_biodata !== undefined) {
    data.id_biodata = await assertPersonalIdBiodataUnique(data.id_biodata, id);
  }

  // Remove pk from update fields
  const fields = Object.keys(data).filter(f => f !== pk);

  // Auto-update updatedAt
  if (schema?.timestamps?.updatedAt) {
    const uaField = schema.timestamps.updatedAt;
    if (!fields.includes(uaField)) {
      fields.push(uaField);
      data[uaField] = new Date().toISOString();
    }
  }

  if (fields.length === 0) return null;

  const setClause = fields.map(f => `"${f}" = @${f}`).join(', ');
  const sql = `UPDATE "${table}" SET ${setClause} WHERE "${pk}" = @_pk_`;

  const params = { _pk_: id };
  for (const f of fields) {
    params[f] = data[f] !== undefined ? data[f] : null;
  }

  let result;
  try {
    result = await q(db.prepare(sql), 'run', params);
  } catch (err) {
    if (table === 'personal' && isUniqueConstraintError(err)) {
      throw new Error(DUPLICATE_ID_BIODATA_MSG);
    }
    throw err;
  }
  if (!result.changes) return null;
  const updated = await getById(table, id);

  if (oldRow && AUDIT_TABLES.has(table) && !auditOpts.skipAudit) {
    await insertAuditLog(table, id, 'update', oldRow, updated, auditOpts.userId || 1);
  }

  return updated;
}

// Delete a row by id
async function remove(table, id, auditOpts = {}) {
  const pk = await resolveTablePkColumn(table);
  const oldRow = AUDIT_TABLES.has(table) && !auditOpts.skipAudit ? await getById(table, id) : null;
  const result = await q(db.prepare(`DELETE FROM "${table}" WHERE "${pk}" = ?`), 'run', id);

  if (result.changes > 0 && oldRow && AUDIT_TABLES.has(table) && !auditOpts.skipAudit) {
    await insertAuditLog(table, id, 'delete', oldRow, null, auditOpts.userId || 1);
  }

  return result.changes > 0;
}

// Kanban: kelompokkan baris per kolom stage/status
async function listKanban(table, groupField, options = {}) {
  const { valueField = 'value', columnKeys = [] } = options;
  const rows = normalizeRows(await q(db.prepare(`SELECT * FROM "${table}" ORDER BY id DESC`), 'all'));
  const data = {};
  const totals = {};

  columnKeys.forEach(key => {
    data[key] = [];
    totals[key] = { count: 0, value: 0 };
  });

  const unassignedKey = '_unassigned';
  data[unassignedKey] = [];
  totals[unassignedKey] = { count: 0, value: 0 };

  rows.forEach(row => {
    let key = row[groupField];
    if (!key || !columnKeys.includes(key)) {
      key = unassignedKey;
    }
    if (!data[key]) {
      data[key] = [];
      totals[key] = { count: 0, value: 0 };
    }
    data[key].push(row);
    totals[key].count += 1;
    totals[key].value += parseFloat(row[valueField]) || 0;
  });

  if (data[unassignedKey].length === 0) {
    delete data[unassignedKey];
    delete totals[unassignedKey];
  }

  return { data, totals };
}

// Update kolom pipeline (stage / status)
async function updatePipelineField(table, id, fieldName, value) {
  return update(table, id, { [fieldName]: value });
}

// Reorder: pastikan semua id ada di stage yang sama
async function reorderInStage(table, ids, stageField, stageValue) {
  if (!Array.isArray(ids) || !ids.length) return { success: true, updated: 0 };
  let updated = 0;
  const stmt = db.prepare(`UPDATE "${table}" SET "${stageField}" = ? WHERE id = ?`);
  const tx = db.transaction(async (idList) => {
    for (const id of idList) {
      const r = await q(stmt, 'run', stageValue, id);
      updated += r.changes;
    }
  });
  await tx(ids);
  return { success: true, updated };
}

// Timeline 360° — aktivitas + audit log per entitas
async function getEntityTimeline(entityType, entityId, limit = 40) {
  const items = [];
  const fkMap = {
    customers: 'customer_id',
    leads: 'lead_id',
    deals: 'deal_id'
  };

  const fk = fkMap[entityType];
  if (fk) {
    try {
      const acts = await q(db.prepare(`
        SELECT * FROM activities WHERE "${fk}" = ? ORDER BY datetime(created_at) DESC LIMIT ?
      `), 'all', entityId, limit);
      acts.forEach((a) => items.push({
        kind: 'activity',
        date: a.created_at || a.due_date,
        title: a.title,
        subtitle: `${a.activity_type} · ${a.status}`,
        data: a
      }));
    } catch { /* ignore */ }
  }

  if (entityType === 'companies') {
    try {
      const acts = await q(db.prepare(`
        SELECT a.* FROM activities a
        INNER JOIN customers c ON c.id = a.customer_id
        WHERE c.company_id = ?
        ORDER BY datetime(a.created_at) DESC LIMIT ?
      `), 'all', entityId, limit);
      acts.forEach((a) => items.push({
        kind: 'activity',
        date: a.created_at,
        title: a.title,
        subtitle: `${a.activity_type} · ${a.status}`,
        data: a
      }));
    } catch { /* ignore */ }
  }

  try {
    const logs = await q(db.prepare(`
      SELECT * FROM activity_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY datetime(created_at) DESC LIMIT ?
    `), 'all', entityType, entityId, limit);
    logs.forEach((l) => items.push({
      kind: 'log',
      date: l.created_at,
      title: `Log: ${l.action}`,
      subtitle: l.entity_type,
      data: l
    }));
  } catch { /* ignore */ }

  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return items.slice(0, limit);
}

// Isi due_date untuk aktivitas lama yang belum punya jadwal
async function backfillActivityDueDates() {
  try {
    const schemas = loadSchemas();
    if (!schemas.activities) return;

    const nullDueSql = isPostgres()
      ? `SELECT id FROM activities WHERE due_date IS NULL`
      : `SELECT id FROM activities WHERE due_date IS NULL OR trim(due_date) = ''`;
    const rows = await q(db.prepare(nullDueSql), 'all');
    if (!rows.length) return;
    const stmt = db.prepare('UPDATE activities SET due_date = ? WHERE id = ?');
    const base = new Date();
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const d = new Date(base.getFullYear(), base.getMonth(), 1 + (i % 25), 9 + (i % 8), 0, 0);
      const iso = d.toISOString().slice(0, 19).replace('T', ' ');
      await q(stmt, 'run', iso, row.id);
    }
    console.log(`[DB] Backfilled due_date for ${rows.length} activities`);
  } catch (e) {
    console.warn('[DB] backfillActivityDueDates:', e.message);
  }
}

// Kalender aktivitas per bulan (due_date, fallback created_at)
async function getCalendarEvents(year, month) {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  try {
    const calendarSql = isPostgres()
      ? `
      SELECT id, activity_code, title, activity_type, status, priority, due_date, created_at
      FROM activities
      WHERE to_char(COALESCE(due_date, created_at), 'YYYY-MM') = ?
      ORDER BY COALESCE(due_date, created_at) ASC
    `
      : `
      SELECT id, activity_code, title, activity_type, status, priority, due_date, created_at
      FROM activities
      WHERE substr(COALESCE(NULLIF(trim(due_date), ''), created_at), 1, 7) = ?
      ORDER BY COALESCE(NULLIF(trim(due_date), ''), created_at) ASC
    `;
    return normalizeRows(await q(db.prepare(calendarSql), 'all', ym));
  } catch {
    return [];
  }
}

async function dbScalar(sql, field, ...params) {
  const row = await q(db.prepare(sql), 'get', ...params);
  if (!row || row[field] == null) return 0;
  return Number(row[field]);
}

async function dbAllRows(sql, ...params) {
  return normalizeRows(await q(db.prepare(sql), 'all', ...params));
}

// Laporan penjualan ringkas (KPI + agregasi untuk UI report CRM)
async function getSalesReport() {
  const report = {
    pipelineByStage: [],
    leadsBySource: [],
    quotesByStatus: [],
    topDeals: [],
    revenueWon: 0,
    revenueOpen: 0,
    weightedPipeline: 0,
    dealsWon: 0,
    dealsLost: 0,
    dealsOpen: 0,
    winRate: 0,
    avgDealSize: 0,
    totalLeads: 0,
    leadsConverted: 0,
    leadConversionRate: 0,
    totalQuotes: 0,
    quotesValue: 0,
    generatedAt: new Date().toISOString()
  };

  try {
    report.pipelineByStage = await dbAllRows(`
      SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as total
      FROM deals GROUP BY stage ORDER BY total DESC
    `);
  } catch { /* ignore */ }

  try {
    report.leadsBySource = await dbAllRows(`
      SELECT COALESCE(NULLIF(trim(source), ''), 'Tidak diketahui') as source, COUNT(*) as count
      FROM leads GROUP BY source ORDER BY count DESC LIMIT 8
    `);
  } catch { /* ignore */ }

  try {
    report.quotesByStatus = await dbAllRows(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM quotes GROUP BY status ORDER BY total DESC
    `);
    report.totalQuotes = await dbScalar('SELECT COUNT(*) as c FROM quotes', 'c');
    report.quotesValue = await dbScalar('SELECT COALESCE(SUM(total), 0) as t FROM quotes', 't');
  } catch { /* ignore */ }

  try {
    report.topDeals = await dbAllRows(`
      SELECT deal_code, title, value, stage, customer_name, probability
      FROM deals ORDER BY value DESC LIMIT 10
    `);
    report.revenueWon = await dbScalar(`SELECT COALESCE(SUM(value), 0) as t FROM deals WHERE stage = 'closed_won'`, 't');
    report.revenueOpen = await dbScalar(`
      SELECT COALESCE(SUM(value), 0) as t FROM deals
      WHERE stage NOT IN ('closed_won', 'closed_lost')
    `, 't');
    report.dealsWon = await dbScalar(`SELECT COUNT(*) as c FROM deals WHERE stage = 'closed_won'`, 'c');
    report.dealsLost = await dbScalar(`SELECT COUNT(*) as c FROM deals WHERE stage = 'closed_lost'`, 'c');
    report.dealsOpen = await dbScalar(`
      SELECT COUNT(*) as c FROM deals WHERE stage NOT IN ('closed_won', 'closed_lost')
    `, 'c');
    const closed = report.dealsWon + report.dealsLost;
    report.winRate = closed > 0 ? Math.round((report.dealsWon / closed) * 100) : 0;
    report.avgDealSize = await dbScalar('SELECT COALESCE(AVG(value), 0) as a FROM deals WHERE value > 0', 'a');
    report.weightedPipeline = await dbScalar(`
      SELECT COALESCE(SUM(value * COALESCE(probability, 10) / 100.0), 0) as w
      FROM deals WHERE stage NOT IN ('closed_won', 'closed_lost')
    `, 'w');
  } catch { /* ignore */ }

  try {
    report.totalLeads = await dbScalar('SELECT COUNT(*) as c FROM leads', 'c');
    report.leadsConverted = await dbScalar('SELECT COUNT(*) as c FROM leads WHERE is_converted = 1', 'c');
    report.leadConversionRate = report.totalLeads > 0
      ? Math.round((report.leadsConverted / report.totalLeads) * 100)
      : 0;
  } catch { /* ignore */ }

  return report;
}

// Export CSV sederhana
async function exportTableCsv(table, options = {}) {
  const schema = getSchema(table);
  const searchFields = schema ? schema.fields
    .filter((f) => ['text', 'email', 'textarea', 'number'].includes(f.type))
    .map((f) => f.name) : [];

  const result = await list(table, {
    page: 1,
    perPage: 10000,
    search: options.search || '',
    searchFields,
    sort: options.sort || '',
    order: options.order || 'asc'
  });

  if (!result.data.length) return '';

  const cols = Object.keys(result.data[0]);
  const escape = (v) => {
    const s = v == null ? '' : String(v).replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [cols.join(',')];
  result.data.forEach((row) => {
    lines.push(cols.map((c) => escape(row[c])).join(','));
  });
  return lines.join('\n');
}

// Aktivitas terbaru untuk dashboard
async function getRecentActivities(limit = 8) {
  try {
    return await dbAllRows(`
      SELECT id, activity_code, title, activity_type, status, priority, due_date, created_at
      FROM activities
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ?
    `, limit);
  } catch {
    return [];
  }
}

// Konversi lead → customer (+ deal opsional)
async function convertLead(leadId, options = {}) {
  const lead = await getById('leads', leadId);
  if (!lead) return null;
  if (lead.is_converted) {
    throw new Error('Lead sudah dikonversi sebelumnya');
  }

  const createDeal = options.createDeal !== false;
  const txn = db.transaction(async () => {
    const codeSuffix = String(leadId).padStart(3, '0');
    const customer = await create('customers', {
      customer_code: `CU-LD-${codeSuffix}`,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email || '',
      phone: lead.phone || '',
      position: lead.position || '',
      status: 'active',
      source: lead.source || 'lead_conversion',
      notes: lead.notes || '',
      assigned_to: lead.assigned_to || 1,
      created_by: lead.created_by || 1
    });

    let deal = null;
    if (createDeal && Number(lead.estimated_value) > 0) {
      deal = await create('deals', {
        deal_code: `DL-LD-${codeSuffix}`,
        title: `Deal — ${lead.full_name || `${lead.first_name} ${lead.last_name}`}`,
        customer_id: customer.id,
        customer_name: lead.full_name || `${lead.first_name} ${lead.last_name}`.trim(),
        value: lead.estimated_value,
        stage: 'prospecting',
        priority: lead.priority || 'medium',
        currency: lead.currency || '$',
        status: 'open',
        probability: 30,
        assigned_to: lead.assigned_to || 1
      });
    }

    await update('leads', leadId, {
      is_converted: 1,
      status: 'won',
      converted_to_customer_id: customer.id,
      converted_to_deal_id: deal ? deal.id : null,
      converted_at: new Date().toISOString()
    }, { skipAudit: true });

    await create('activities', {
      activity_code: `ACT-CV-${Date.now()}`,
      title: `Lead dikonversi: ${lead.lead_code}`,
      activity_type: 'note',
      status: 'completed',
      priority: 'medium',
      customer_id: customer.id,
      lead_id: leadId,
      deal_id: deal ? deal.id : null,
      assigned_to: lead.assigned_to || 1,
      description: `Konversi otomatis dari lead ${lead.lead_code}`
    });

    return {
      customer: await getById('customers', customer.id),
      deal: deal ? await getById('deals', deal.id) : null,
      lead: await getById('leads', leadId)
    };
  });

  return txn();
}

// Ringkasan statistik untuk dashboard TKI
async function getDashboardStats() {
  const countTable = async (table) => {
    try {
      return await dbScalar(`SELECT COUNT(*) as c FROM "${table}"`, 'c');
    } catch {
      return 0;
    }
  };

  let proses = 0;
  let terbang = 0;
  let terpilih = 0;
  try {
    proses = await dbScalar(`SELECT COUNT(*) as c FROM personal WHERE statusaktif = 'PROSES'`, 'c');
    terpilih = await dbScalar(`SELECT COUNT(*) as c FROM personal WHERE statusaktif = 'TERPILIH'`, 'c');
    terbang = await dbScalar(`SELECT COUNT(*) as c FROM personal WHERE statterbang = 1`, 'c');
  } catch {
    /* ignore */
  }

  let bySektor = [];
  try {
    const sektorSql = isPostgres()
      ? `SELECT LEFT(id_biodata, 2) as sektor, COUNT(*)::int as count FROM personal GROUP BY LEFT(id_biodata, 2) ORDER BY count DESC`
      : `SELECT substr(id_biodata, 1, 2) as sektor, COUNT(*) as count FROM personal GROUP BY substr(id_biodata, 1, 2) ORDER BY count DESC`;
    bySektor = await dbAllRows(sektorSql);
  } catch {
    /* ignore */
  }

  let pending = 0;
  try {
    pending = await dbScalar(`SELECT COUNT(*) as c FROM personal WHERE statusaktif = 'PENDING'`, 'c');
  } catch {
    /* ignore */
  }

  let recentPersonal = [];
  try {
    recentPersonal = await dbAllRows(
      `SELECT id, id_biodata, nama, jeniskelamin, statusaktif, statterbang, tanggaldaftar, negara1
       FROM personal ORDER BY id DESC LIMIT 8`
    );
  } catch {
    /* ignore */
  }

  return {
    personal: await countTable('personal'),
    family: await countTable('family'),
    visa: await countTable('visa'),
    majikan: await countTable('majikan'),
    disnaker: await countTable('disnaker'),
    medical: await countTable('medical'),
    paspor: await countTable('paspor'),
    dokumen: await countTable('dokumen'),
    datasektor: await countTable('datasektor'),
    dataagen: await countTable('dataagen'),
    proses,
    terpilih,
    terbang,
    pending,
    bySektor,
    recentPersonal
  };
}

// Kolom file di tabel dokumen (identitas — satu baris per TKI)
const DOKUMEN_IDENTITAS_FIELDS = [
  'ktp', 'kk', 'akte', 'ijazah', 'si', 'sn', 'paspor', 'arc',
  'asuransi', 'medikal1', 'medikal2', 'medikal3', 'skck', 'fingerprint', 'visa', 'pap'
];

async function updateDokumenIdentitasFile(idBiodata, fieldName, filePath) {
  const id = String(idBiodata || '').trim();
  const field = String(fieldName || '').trim();
  if (!id) throw new Error('id_biodata wajib');
  if (!DOKUMEN_IDENTITAS_FIELDS.includes(field)) {
    throw new Error(`Kolom dokumen "${field}" tidak valid`);
  }

  let row = await getByField('dokumen', 'id_biodata', id);
  if (!row) {
    const payload = { id_biodata: id };
    payload[field] = filePath;
    return create('dokumen', payload);
  }
  return update('dokumen', row.id, { [field]: filePath });
}

async function clearDokumenIdentitasFile(idBiodata, fieldName) {
  return updateDokumenIdentitasFile(idBiodata, fieldName, '');
}

async function updatePersonalFoto(idBiodata, filePath) {
  const id = String(idBiodata || '').trim();
  if (!id) throw new Error('id_biodata wajib');
  const row = await getByField('personal', 'id_biodata', id);
  if (!row) throw new Error('Biodata tidak ditemukan');
  return update('personal', row.id, { foto: filePath || '' });
}

// Ringkasan upload per jenis (Fase 1 — satu layanan)
async function getUploadSummaryForBiodata(idBiodata) {
  const id = String(idBiodata || '').trim();
  if (!id) return [];

  const summary = [];
  for (const t of HUB_TYPES) {
    const type = t.type;
    if (!getTableNames().includes(type)) {
      summary.push({ type, label: t.label, count: 0, hasFile: false });
      continue;
    }
    try {
      const countRow = await q(
        db.prepare(`SELECT COUNT(*) as c FROM "${type}" WHERE id_biodata = ?`),
        'get',
        id
      );
      const fileRow = await q(
        db.prepare(
          `SELECT COUNT(*) as c FROM "${type}" WHERE id_biodata = ? AND file IS NOT NULL AND TRIM(file) != ''`
        ),
        'get',
        id
      );
      summary.push({
        type,
        label: t.label,
        count: Number(countRow.c) || 0,
        hasFile: Number(fileRow.c) > 0
      });
    } catch {
      summary.push({ type, label: t.label, count: 0, hasFile: false });
    }
  }
  return summary;
}

function pickFields(row, keys) {
  if (!row) return null;
  const out = {};
  keys.forEach((k) => {
    if (row[k] != null && row[k] !== '') out[k] = row[k];
  });
  return Object.keys(out).length ? out : null;
}

// Rekap FISKAL read-only (plan §8A.6c)
async function getBiodataFiskal(idBiodata) {
  const id = String(idBiodata || '').trim();
  const detail = await getBiodataDetail(id);
  if (!detail) return null;

  const p = detail.personal;
  const v = detail.visa;
  const uploadSummary = await getUploadSummaryForBiodata(id);
  const uploadFilled = uploadSummary.filter((u) => u.count > 0).length;

  let terbangInfo = null;
  if (v?.id_terbang) {
    terbangInfo = await getById('dataterbang', v.id_terbang);
  }

  return {
    id_biodata: id,
    generatedAt: new Date().toISOString(),
    personal: pickFields(p, ['nama', 'id_biodata', 'statusaktif', 'statterbang', 'negara1', 'kode_sponsor', 'tanggaldaftar']),
    family: detail.family ? pickFields(detail.family, ['namaayah', 'namaibu', 'namasuami', 'namaistri']) : null,
    dokumen: detail.dokumen ? pickFields(detail.dokumen, ['ktp', 'kk', 'akte', 'ijazah', 'paspor', 'arc', 'visa', 'skck']) : null,
    disnaker: pickFields(detail.disnaker, ['nodisnaker', 'tgldisnaker', 'status', 'keterangan']),
    medical: {
      medical1: pickFields(detail.medical, ['jenismedical', 'tanggal', 'nomor', 'nama']),
      medical2: pickFields(detail.medical2, ['jenismedical', 'tanggal', 'nomor', 'nama']),
      medical3: pickFields(detail.medical3, ['jenismedical', 'tanggal', 'nomor', 'nama'])
    },
    paspor: {
      aktif: pickFields(detail.paspor, ['nopaspor', 'tglterbit', 'statuspengajuan', 'statusterima']),
      lama: pickFields(detail.pasporlama, ['nopaspor', 'tglterbit', 'keterangan'])
    },
    majikan: pickFields(detail.majikan, ['namamajikan', 'kode_agen', 'tglterpilih', 'status']),
    visa: pickFields(v, [
      'novisa', 'statuskocokan', 'statuspap', 'statusktkln', 'tanggalterbang',
      'statusterbang', 'airport', 'tiket', 'id_terbang'
    ]),
    terbang: terbangInfo ? pickFields(terbangInfo, ['isi', 'mandarin', 'tanggal']) : null,
    skck: pickFields(detail.skck, ['noskck', 'tglterbit', 'status', 'keterangan']),
    skckPolres: pickFields(detail.skckPolres, ['pengajuan', 'statuspengajuan']),
    signingbank: pickFields(detail.signingbank, ['bank', 'status', 'tgl_signing', 'keterangan']),
    legalitas: pickFields(detail.legalitas, ['tgl_legal', 'nama_legal', 'hub_legal', 'notelp']),
    bukaRekening: pickFields(detail.bukaRekening, ['bank', 'norek', 'tgl_buka', 'status']),
    asuransiHotel: pickFields(detail.asuransiHotel, ['dakt', 'daki', 'aju_ht', 'idhotel']),
    isichongyi: pickFields(detail.isichongyi, ['kbm', 'kbi', 'sbt', 'hub']),
    upload: {
      jenisTerisi: uploadFilled,
      jenisTotal: uploadSummary.length,
      visaArrival: uploadSummary.find((u) => u.type === 'upload_visaarrival') || null
    }
  };
}

// Event keberangkatan — update visa + personal.statterbang (plan Fase 1)
async function recordVisaDeparture(payload = {}) {
  const id = String(payload.id_biodata || '').trim();
  if (!id) throw new Error('id_biodata wajib');

  const personal = await getByField('personal', 'id_biodata', id);
  if (!personal) throw new Error('Biodata tidak ditemukan');

  const tanggal = payload.tanggalterbang || new Date().toISOString().slice(0, 10);
  let visa = await getByField('visa', 'id_biodata', id);

  const visaData = {
    id_biodata: id,
    tanggalterbang: tanggal,
    statusterbang: payload.statusterbang || 'Sudah terbang',
    airport: payload.airport || '',
    tiket: payload.tiket || '',
    id_terbang: payload.id_terbang != null && payload.id_terbang !== '' ? Number(payload.id_terbang) : null
  };

  if (visa?.id) {
    visa = await update('visa', visa.id, visaData);
  } else {
    visa = await create('visa', visaData);
  }

  await update('personal', personal.id, {
    statterbang: 1,
    statusaktif: personal.statusaktif === 'TERBANG' ? 'TERBANG' : (payload.statusaktif || 'TERBANG')
  });

  return { id_biodata: id, visa, statterbang: 1, tanggalterbang: tanggal };
}

// Ringkasan biodata satu TKI (personal + relasi inti)
async function getBiodataDetail(idBiodata) {
  const id = String(idBiodata || '').trim();
  if (!id) return null;

  const personal = await getByField('personal', 'id_biodata', id);
  if (!personal) return null;

  await ensureMarkProgressForTki(id);

  const [
    family, dokumen, disnaker, medical, medical2, medical3, paspor, pasporlama,
    majikan, visa, skck, skckPolres, signingbank, legalitas, bukaRekening, asuransiHotel, isichongyi,
    pap, bankTki,
    marka, markaBiotoagen, markb, markc, marke, markf, markg,
    working, skillcondition, pengalaman, request, pptk, tugas, kettugas, interview, vaksin, keadaanTki
  ] = await Promise.all([
    getByField('family', 'id_biodata', id),
    getByField('dokumen', 'id_biodata', id),
    getByField('disnaker', 'id_biodata', id),
    getByField('medical', 'id_biodata', id),
    getByField('medical2', 'id_biodata', id),
    getByField('medical3', 'id_biodata', id),
    getByField('paspor', 'id_biodata', id),
    getByField('pasporlama', 'id_biodata', id),
    getByField('majikan', 'id_biodata', id),
    getByField('visa', 'id_biodata', id),
    getByField('skck', 'id_biodata', id),
    getByField('skck_polres', 'id_biodata', id),
    getByField('signingbank', 'id_biodata', id),
    getByField('legalitas', 'id_biodata', id),
    getByField('buka_rekening_baru', 'id_biodata', id),
    getByField('asuransi_dan_hotel', 'id_biodata', id),
    getByField('isichongyi', 'id_biodata', id),
    getByField('pap', 'id_biodata', id),
    getByField('bank', 'id_biodata', id),
    getByField('marka', 'id_biodata', id),
    listByIdBiodata('marka_biotoagen', id),
    getByField('markb', 'id_biodata', id),
    getByField('markc', 'id_biodata', id),
    getByField('marke', 'id_biodata', id),
    getByField('markf', 'id_biodata', id),
    getByField('markg', 'id_biodata', id),
    listByIdBiodata('working', id),
    listByIdBiodata('skillcondition', id),
    listByIdBiodata('pengalaman', id),
    listByIdBiodata('request', id),
    listByIdBiodata('pptk', id),
    listByIdBiodata('tugas', id),
    listByIdBiodata('kettugas', id),
    listByIdBiodata('interview', id),
    listByIdBiodata('vaksin', id),
    listByIdBiodata('admin_keadaan_tki', id)
  ]);

  const sektor = id.slice(0, 2);
  const menuTabs = await getMenuMappingBySektor(sektor);

  return {
    personal,
    family,
    dokumen,
    disnaker,
    medical,
    medical2,
    medical3,
    paspor,
    pasporlama,
    majikan,
    visa,
    skck,
    skckPolres,
    signingbank,
    legalitas,
    bukaRekening,
    asuransiHotel,
    isichongyi,
    pap,
    bankTki,
    marka,
    markaBiotoagen,
    markb,
    markc,
    marke,
    markf,
    markg,
    working,
    skillcondition,
    pengalaman,
    request,
    pptk,
    tugas,
    kettugas,
    interview,
    vaksin,
    keadaanTki,
    menuTabs
  };
}

// Auth: cari user by email
async function findUserByEmail(email) {
  const row = await q(db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)'), 'get', email);
  return normalizeRow(row);
}

/** Akun admin utama PJTKI — selalu tersedia setelah init/seed */
async function ensurePjtkiAdmin() {
  const email = 'admin@gmail.com';
  const hash = bcrypt.hashSync('gugus$123$', 10);
  const existing = await findUserByEmail(email);
  if (existing) {
    await updateUserPassword(existing.id, hash);
    if (existing.status !== 'active') {
      await update('users', existing.id, { status: 'active' }, { skipAudit: true });
    }
    return existing;
  }
  return create('users', {
    name: 'Administrator PJTKI',
    email,
    role: 'admin',
    phone: '',
    password: hash,
    status: 'active'
  }, { skipAudit: true });
}

/** Jumlah baris per tabel cetak batch (legacy print_data hitung1–6 dan terkait) */
async function getPrintDataStats() {
  const tables = [
    'pembuatan_tabelpap',
    'pembuatan_tabelktkln',
    'pembuatan_tabelhapap',
    'pembuatan_tabeldis',
    'pembuatan_tabeldis2',
    'pembuatan_tabeldis3',
    'pembuatan_laporan',
    'surat_pengajuan',
    'pembuatan_tabungan',
    'pembuatan_ijin',
    'pembuatan_opp',
    'pembatalan_opp',
    'pembatalan_opp_sidoarjo',
    'pembatalan_pp',
    'pembatalan_gabungan',
    'berita_acara_ntb',
    'srat_jalan_ntb',
    'leg_pk',
    'penghapusan_pp',
    'pplk',
    'pembuatan_paspor',
    'pembuatan_paspor_malang_print',
    'surat_pernyataan_malang'
  ];
  const allowed = new Set(getTableNames());
  const stats = {};
  for (const table of tables) {
    if (!allowed.has(table)) continue;
    try {
      const row = await q(db.prepare(`SELECT COUNT(*) as c FROM "${table}"`), 'get');
      stats[table] = Number(row?.c || 0);
    } catch {
      stats[table] = 0;
    }
  }
  return stats;
}

/** Laporan print: TKI sudah medical, belum terbang */
async function getMedicalBelumTerbangReport() {
  const tables = getTableNames();
  if (!tables.includes('personal') || !tables.includes('medical')) return [];
  try {
    return await dbAllRows(`
      SELECT p.id_biodata, p.nama, p.statusaktif, p.negara1,
             MAX(m.tanggal) AS tgl_medical
      FROM personal p
      INNER JOIN medical m ON m.id_biodata = p.id_biodata
      WHERE COALESCE(p.statterbang, 0) = 0
      GROUP BY p.id_biodata, p.nama, p.statusaktif, p.negara1
      ORDER BY p.id_biodata
    `);
  } catch {
    return [];
  }
}

/** Laporan print: tgl online disnaker mendekati / lewat, belum terbang */
async function getExpireTglOnlineReport(daysAhead = 30) {
  const tables = getTableNames();
  if (!tables.includes('personal') || !tables.includes('disnaker')) return [];
  try {
    return await dbAllRows(`
      SELECT p.id_biodata, p.nama, d.nodisnaker, d.tglonline
      FROM personal p
      INNER JOIN disnaker d ON d.id_biodata = p.id_biodata
      WHERE d.tglonline IS NOT NULL AND TRIM(d.tglonline) != ''
        AND date(d.tglonline) <= date('now', '+' || ? || ' days')
        AND COALESCE(p.statterbang, 0) = 0
      ORDER BY d.tglonline ASC
    `, daysAhead);
  } catch {
    return [];
  }
}

async function updateUserPassword(userId, hashedPassword) {
  await q(db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?'), 'run', hashedPassword, userId);
}

/** Daftar template surat Word aktif (letter_templates) */
async function listLetterTemplates(filters = {}) {
  const { kategori, sektor } = filters;
  let sql = `SELECT * FROM letter_templates WHERE aktif = 1`;
  const params = [];
  if (kategori) {
    sql += ` AND kategori = ?`;
    params.push(String(kategori));
  }
  sql += ` ORDER BY kategori ASC, nama ASC`;
  const rows = await dbAllRows(sql, ...params);
  if (!sektor) return rows;
  const code = String(sektor).toUpperCase().slice(0, 2);
  return rows.filter((r) => {
    const f = String(r.sektor || '').trim();
    if (!f) return true;
    return f.split(',').map((x) => x.trim().toUpperCase()).includes(code);
  });
}

async function getLetterTemplateByKode(kode) {
  const k = String(kode || '').trim();
  if (!k) return null;
  return normalizeRow(await q(db.prepare('SELECT * FROM letter_templates WHERE kode = ? AND aktif = 1'), 'get', k));
}

async function listHtmlDocumentTemplates(filters = {}) {
  const { template_type } = filters;
  let sql = `SELECT id, name, description, template_type, page_size, orientation, is_active FROM document_templates WHERE is_active = 1`;
  const params = [];
  if (template_type) {
    sql += ` AND template_type = ?`;
    params.push(String(template_type));
  }
  sql += ` ORDER BY name ASC`;
  return dbAllRows(sql, ...params);
}

async function getHtmlDocumentTemplate(id) {
  const row = await getById('document_templates', id);
  if (!row || Number(row.is_active) !== 1) return null;
  return row;
}

let _papHeaderPkCol = null;
let _papDetailPkCol = null;

async function getTableColumnNames(tableName) {
  try {
    const info = await getTableColumnInfo(tableName);
    return info.map((c) => c.name);
  } catch {
    return [];
  }
}

/** Metadata kolom aktual di DB (untuk migrasi legacy vs schema JSON) */
async function getTableColumnInfo(tableName) {
  try {
    if (isPostgres()) {
      const rows = await q(
        db.prepare(`
          SELECT 
            c.column_name AS name, 
            c.data_type AS type, 
            c.is_nullable, 
            c.column_default AS dflt_value,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS pk
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public' 
              AND tc.table_name = $1
              AND tc.constraint_type = 'PRIMARY KEY'
          ) pk ON c.column_name = pk.column_name
          WHERE c.table_schema = 'public' AND c.table_name = $1
          ORDER BY c.ordinal_position
        `),
        'all',
        tableName
      );
      return rows.map((c) => ({
        name: c.name,
        type: c.type || 'text',
        notnull: String(c.is_nullable || '').toUpperCase() === 'NO',
        pk: Boolean(c.pk),
        dflt_value: c.dflt_value
      }));
    }
    return db.prepare(`PRAGMA table_info("${tableName}")`).all().map((c) => ({
      name: c.name,
      type: c.type || 'TEXT',
      notnull: Boolean(c.notnull),
      pk: Boolean(c.pk),
      dflt_value: c.dflt_value
    }));
  } catch {
    return [];
  }
}

/** PK sebenarnya di DB (schema bisa id_pembuatan, DB dev bisa id) */
async function resolveTablePkColumn(table) {
  const schema = getSchema(table);
  const cols = await getTableColumnNames(table);
  const candidates = [
    schema?.primaryKey,
    'id_surat_aju',
    'id_pembuatanpap',
    'id_pembuatan_desa',
    'id_pembuatan',
    'id'
  ].filter(Boolean);
  for (const c of candidates) {
    if (cols.includes(c)) return c;
  }
  return schema?.primaryKey || 'id';
}

function legacyNotNullDefault(col) {
  if (col.dflt_value != null && col.dflt_value !== '') {
    const raw = String(col.dflt_value);
    // Skip sequence defaults (PostgreSQL auto-increment)
    if (raw.toUpperCase().includes('NEXTVAL')) {
      return 0; // Will be handled by database sequence
    }
    if (raw.toUpperCase() === 'CURRENT_TIMESTAMP') {
      return new Date().toISOString();
    }
    return raw.replace(/^'(.*)'$/, '$1');
  }
  const t = String(col.type || '').toUpperCase();
  if (t.includes('INT') || t.includes('REAL') || t.includes('NUM')) return 0;
  if (t.includes('DATE') || t.includes('TIME')) return new Date().toISOString().slice(0, 10);
  return '';
}

/** Isi kolom NOT NULL di DB yang tidak ada di schema / payload (mis. id_biodata di header surat) */
async function applyDbNotNullDefaults(table, data, fields) {
  const dbCols = await getTableColumnInfo(table);
  const schema = getSchema(table);
  const outFields = [...fields];
  const outData = { ...data };

  for (const col of dbCols) {
    if (!col.notnull || col.pk) continue;
    if (outFields.includes(col.name)) continue;

    const schemaField = schema?.fields?.find((f) => f.name === col.name);
    // id_biodata wajib di tabel biodata (personal, visa, …) — jangan timpa nilai user
    if (col.name === 'id_biodata' && schemaField?.required) continue;

    outFields.push(col.name);
    if (col.name === 'id_biodata') {
      outData.id_biodata = '';
    } else {
      outData[col.name] = legacyNotNullDefault(col);
    }
  }
  return { data: outData, fields: outFields };
}

/** PK header PAP — DB lama: id; DB legacy MySQL: id_pembuatanpap */
async function resolvePapHeaderPkColumn() {
  if (_papHeaderPkCol) return _papHeaderPkCol;
  const cols = await getTableColumnNames('pembuatan_tabelpap');
  _papHeaderPkCol = cols.includes('id_pembuatanpap') ? 'id_pembuatanpap' : 'id';
  return _papHeaderPkCol;
}

async function resolvePapDetailPkColumn() {
  if (_papDetailPkCol) return _papDetailPkCol;
  const cols = await getTableColumnNames('detail_tabelpap');
  _papDetailPkCol = cols.includes('id_pembuatan') ? 'id_pembuatan' : 'id';
  return _papDetailPkCol;
}

async function papHeaderIdExpr(alias = 'p') {
  const col = await resolvePapHeaderPkColumn();
  return `${alias}.${col}`;
}

async function listPapBatches(options = {}) {
  const { page = 1, perPage = 25, search = '', idBiodata = '' } = options;
  const idExpr = await papHeaderIdExpr('p');
  const conditions = [];
  const params = [];

  if (idBiodata) {
    const bid = String(idBiodata).trim();
    const headerCols = await getTableColumnNames('pembuatan_tabelpap');
    const parts = [`EXISTS (SELECT 1 FROM detail_tabelpap d WHERE d.id_tabelpap = ${idExpr} AND d.id_biodata = ?)`];
    params.push(bid);
    if (headerCols.includes('id_biodata')) {
      parts.push(`TRIM(COALESCE(p.id_biodata, '')) = ?`);
      params.push(bid);
    }
    conditions.push(`(${parts.join(' OR ')})`);
  }

  if (search) {
    const s = `%${String(search).toLowerCase()}%`;
    conditions.push(`(
      lower(COALESCE(p.nomor,'')) LIKE ? OR lower(COALESCE(p.nomorktkln,'')) LIKE ?
      OR lower(COALESCE(p.daerah,'')) LIKE ? OR lower(COALESCE(p.kepada,'')) LIKE ?
      OR lower(COALESCE(p.tanggal,'')) LIKE ? OR lower(COALESCE(p.tanggalpap,'')) LIKE ?
    )`);
    params.push(s, s, s, s, s, s);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(DISTINCT ${idExpr}) AS total FROM pembuatan_tabelpap p ${where}`;
  const countRow = await q(db.prepare(countSql), 'get', ...params);
  const total = Number(countRow?.total || 0);

  const limit = Math.max(1, parseInt(perPage, 10) || 25);
  const offset = Math.max(0, (parseInt(page, 10) || 1) - 1) * limit;

  const dataSql = `
    SELECT p.*, ${idExpr} AS id_pembuatanpap,
      (SELECT COUNT(*) FROM detail_tabelpap d WHERE d.id_tabelpap = ${idExpr}) AS jumlah_ctki
    FROM pembuatan_tabelpap p
    ${where}
    ORDER BY ${idExpr} DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const data = normalizeRows(await q(db.prepare(dataSql), 'all', ...params));
  return {
    data,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / limit) || 1 }
  };
}

async function getPapBatch(id) {
  const idExpr = await papHeaderIdExpr('p');
  const row = normalizeRow(await q(
    db.prepare(`SELECT p.*, ${idExpr} AS id_pembuatanpap FROM pembuatan_tabelpap p WHERE ${idExpr} = ?`),
    'get',
    id
  ));
  return row;
}

async function createPapBatch(data) {
  const payload = {
    nomor: data.nomor || '',
    nomorktkln: data.nomorktkln || '',
    kepada: data.kepada || '',
    daerah: data.daerah || '',
    tanggal: data.tanggal || '',
    tanggalpap: data.tanggalpap || ''
  };
  const created = await create('pembuatan_tabelpap', payload);
  const id = created.id_pembuatanpap ?? created.id ?? created.lastInsertRowid;
  return getPapBatch(id);
}

async function updatePapBatch(id, data) {
  const row = await getPapBatch(id);
  if (!row) return null;
  const idExpr = await papHeaderIdExpr('pembuatan_tabelpap');
  await q(db.prepare(`
    UPDATE pembuatan_tabelpap SET
      nomor = ?, nomorktkln = ?, kepada = ?, daerah = ?, tanggal = ?, tanggalpap = ?
    WHERE ${idExpr} = ?
  `), 'run',
    data.nomor ?? row.nomor,
    data.nomorktkln ?? row.nomorktkln,
    data.kepada ?? row.kepada,
    data.daerah ?? row.daerah,
    data.tanggal ?? row.tanggal,
    data.tanggalpap ?? row.tanggalpap,
    id
  );
  return getPapBatch(id);
}

async function deletePapBatch(id) {
  const row = await getPapBatch(id);
  if (!row) return false;
  const pk = row.id_pembuatanpap;
  await q(db.prepare('DELETE FROM detail_tabelpap WHERE id_tabelpap = ?'), 'run', pk);
  const idExpr = await papHeaderIdExpr('pembuatan_tabelpap');
  await q(db.prepare(`DELETE FROM pembuatan_tabelpap WHERE ${idExpr} = ?`), 'run', pk);
  return true;
}

async function listPapDetails(idTabelpap) {
  const detailPk = await resolvePapDetailPkColumn();
  const cols = await getTableColumnNames('detail_tabelpap');
  if (!cols.includes('id_tabelpap')) return [];
  return dbAllRows(`
    SELECT d."${detailPk}" AS id_pembuatan, d.id_tabelpap, d.id_biodata, p.nama
    FROM detail_tabelpap d
    LEFT JOIN personal p ON p.id_biodata = d.id_biodata
    WHERE d.id_tabelpap = ?
    ORDER BY d."${detailPk}" DESC
  `, idTabelpap);
}

async function addPapDetail(idTabelpap, idBiodata) {
  const id = String(idBiodata || '').trim();
  if (!id) throw new Error('id_biodata wajib');
  const detailPk = await resolvePapDetailPkColumn();
  const exists = await q(
    db.prepare(`SELECT "${detailPk}" FROM detail_tabelpap WHERE id_tabelpap = ? AND id_biodata = ?`),
    'get',
    idTabelpap,
    id
  );
  if (exists) throw new Error('CTKI sudah ada di batch PAP ini');
  return create('detail_tabelpap', { id_tabelpap: idTabelpap, id_biodata: id });
}

async function updatePapDetail(idPembuatan, idBiodata) {
  const id = String(idBiodata || '').trim();
  if (!id) throw new Error('id_biodata wajib');
  const detailPk = await resolvePapDetailPkColumn();
  await q(db.prepare(`UPDATE detail_tabelpap SET id_biodata = ? WHERE "${detailPk}" = ?`), 'run', id, idPembuatan);
  return normalizeRow(await q(
    db.prepare(`SELECT * FROM detail_tabelpap WHERE "${detailPk}" = ?`),
    'get',
    idPembuatan
  ));
}

async function deletePapDetail(idPembuatan) {
  const detailPk = await resolvePapDetailPkColumn();
  await q(db.prepare(`DELETE FROM detail_tabelpap WHERE "${detailPk}" = ?`), 'run', idPembuatan);
  return true;
}

async function getPapPrintPayload(id, type = 'ppad') {
  const header = await getPapBatch(id);
  if (!header) return null;
  const details = await listPapDetails(header.id_pembuatanpap);
  return { type, header, details };
}

async function listNamapapOptions() {
  const tables = getTableNames();
  if (!tables.includes('datanamapap')) return [];
  const cols = await getTableColumnNames('datanamapap');
  const idCol = cols.includes('id') ? 'id' : cols.includes('id_namapap') ? 'id_namapap' : 'id';
  return dbAllRows(
    `SELECT "${idCol}" AS id, isi, mandarin FROM datanamapap WHERE TRIM(COALESCE(isi,'')) != '' ORDER BY isi ASC`
  );
}

/** Definisi batch print surat (header + detail CTKI) — parity modul surat_rekom_* legacy */
const PRINT_BATCH_DEFS = {
  pembuatan_tabelpap: {
    headerTable: 'pembuatan_tabelpap',
    detailTable: 'detail_tabelpap',
    detailFk: 'id_tabelpap',
    headerPkCandidates: ['id_pembuatanpap', 'id_pembuatan', 'id'],
    idResponseField: 'id_pembuatanpap',
    headerFields: ['nomor', 'nomorktkln', 'kepada', 'daerah', 'tanggal', 'tanggalpap'],
    searchFields: ['nomor', 'nomorktkln', 'kepada', 'daerah', 'tanggal', 'tanggalpap']
  },
  pembuatan_tabelktkln: {
    headerTable: 'pembuatan_tabelktkln',
    detailTable: 'detail_tabelktkln',
    detailFk: 'id_tabelktkln',
    headerPkCandidates: ['id_pembuatan', 'id'],
    idResponseField: 'id_pembuatan',
    headerFields: ['nomor', 'kepada', 'daerah', 'jumlah', 'tanggal'],
    searchFields: ['nomor', 'kepada', 'daerah', 'jumlah', 'tanggal']
  },
  pembuatan_tabeldis: {
    headerTable: 'pembuatan_tabeldis',
    detailTable: 'detail_tabeldis',
    detailFk: 'id_tabeldis',
    headerPkCandidates: ['id_pembuatan', 'id'],
    idResponseField: 'id_pembuatan',
    headerFields: ['daerah', 'tanggal', 'asuransi', 'biaya'],
    searchFields: ['daerah', 'tanggal', 'asuransi', 'biaya']
  },
  pembuatan_tabeldis2: {
    headerTable: 'pembuatan_tabeldis2',
    detailTable: 'detail_tabeldis2',
    detailFk: 'id_tabeldis2',
    headerPkCandidates: ['id_pembuatan', 'id'],
    idResponseField: 'id_pembuatan',
    headerFields: ['daerah', 'tanggal', 'asuransi', 'biaya'],
    searchFields: ['daerah', 'tanggal', 'asuransi', 'biaya']
  },
  pembuatan_tabeldis3: {
    headerTable: 'pembuatan_tabeldis3',
    detailTable: 'detail_tabeldis3',
    detailFk: 'id_tabeldis3',
    headerPkCandidates: ['id_pembuatan', 'id'],
    idResponseField: 'id_pembuatan',
    headerFields: ['daerah', 'tanggal', 'asuransi', 'biaya'],
    searchFields: ['daerah', 'tanggal', 'asuransi', 'biaya']
  },
  pembuatan_laporan: {
    headerTable: 'pembuatan_laporan',
    detailTable: 'detail_laporan',
    detailFk: 'id_laporan',
    headerPkCandidates: ['id_pembuatan', 'id'],
    idResponseField: 'id_pembuatan',
    headerFields: ['nomor', 'tanggal', 'tglmulai', 'tglakhir'],
    searchFields: ['nomor', 'tanggal', 'tglmulai', 'tglakhir']
  },
  pembuatan_tabelhapap: {
    headerTable: 'pembuatan_tabelhapap',
    detailTable: 'detail_tabelhapap',
    detailFk: 'id_tabelhapap',
    headerPkCandidates: ['id_pembuatan', 'id'],
    idResponseField: 'id_pembuatan',
    headerFields: ['daerah', 'tanggal'],
    searchFields: ['daerah', 'tanggal']
  },
  surat_pengajuan: {
    headerTable: 'surat_pengajuan',
    detailTable: 'surat_pengajuan_data',
    detailFk: 'aju_id',
    headerPkCandidates: ['id_surat_aju', 'id'],
    idResponseField: 'id_surat_aju',
    headerFields: ['pptkis', 'lembaga', 'no_surat', 'nomor', 'tanggal', 'kepada'],
    searchFields: ['pptkis', 'lembaga', 'no_surat', 'nomor', 'tanggal', 'kepada'],
    detailFields: ['id_biodata', 'jumlah_pinjaman', 'loan']
  }
};

const _batchMetaCache = {};

function pickPayloadFields(data, allowedCols, fieldNames) {
  const payload = {};
  for (const name of fieldNames) {
    if (!allowedCols.includes(name)) continue;
    if (data[name] !== undefined && data[name] !== null) payload[name] = data[name];
  }
  return payload;
}

/** Insert baris hanya kolom yang ada nilainya — hindari NOT NULL legacy (mis. id_biodata di header batch) */
async function insertDynamicRow(table, data) {
  let colInfo = await getTableColumnInfo(table);
  if (!colInfo.length) {
    const schema = getSchema(table);
    if (schema?.fields) {
      colInfo = schema.fields.map((f) => ({ name: f.name, notnull: Boolean(f.required), pk: false, type: f.type }));
    }
  }
  const cols = colInfo.map((c) => c.name);
  const keys = Object.keys(data).filter((k) => cols.includes(k) && data[k] !== undefined && data[k] !== null);
  const params = {};
  keys.forEach((k) => { params[k] = data[k]; });

  const schema = getSchema(table);
  for (const col of colInfo) {
    if (!col.notnull || col.pk || keys.includes(col.name)) continue;
    const schemaField = schema?.fields?.find((f) => f.name === col.name);
    if (col.name === 'id_biodata' && schemaField?.required) continue;
    keys.push(col.name);
    params[col.name] = col.name === 'id_biodata' ? '' : legacyNotNullDefault(col);
  }

  if (!keys.length) throw new Error('Tidak ada kolom untuk disimpan');
  const placeholders = keys.map((k) => `@${k}`).join(', ');
  const sql = `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${placeholders})`;
  const result = await q(db.prepare(sql), 'run', params);
  const insertId = result.lastInsertRowid;
  const pkCol = await resolveTablePkColumn(table);
  if (insertId) {
    return normalizeRow(await q(db.prepare(`SELECT * FROM ${table} WHERE "${pkCol}" = ?`), 'get', insertId));
  }
  return data;
}

async function resolvePrintBatchMeta(batchKey) {
  if (_batchMetaCache[batchKey]) return _batchMetaCache[batchKey];
  const def = PRINT_BATCH_DEFS[batchKey];
  if (!def) throw new Error(`Modul batch tidak dikenal: ${batchKey}`);

  const headerCols = await getTableColumnNames(def.headerTable);
  const headerPk = def.headerPkCandidates.find((c) => headerCols.includes(c)) || 'id';

  let detailPk = 'id_pembuatan';
  let detailFk = def.detailFk;
  let detailCols = [];
  if (def.detailTable) {
    detailCols = await getTableColumnNames(def.detailTable);
    if (detailCols.includes('id_pembuatan')) detailPk = 'id_pembuatan';
    else if (detailCols.includes('id_surat_pengajuan_data')) detailPk = 'id_surat_pengajuan_data';
    else if (detailCols.includes('id')) detailPk = 'id';
    if (!detailCols.includes(detailFk)) {
      const guessed = detailCols.find((c) => /^id_(tabel|laporan)/.test(c));
      if (guessed) detailFk = guessed;
    }
  }

  const idField = headerCols.includes(def.idResponseField)
    ? def.idResponseField
    : headerPk;

  const meta = {
    ...def,
    batchKey,
    headerPk,
    detailPk,
    detailFk,
    headerCols,
    detailCols,
    idField
  };
  _batchMetaCache[batchKey] = meta;
  return meta;
}

function getPrintBatchKeys() {
  return Object.keys(PRINT_BATCH_DEFS);
}

async function listPrintBatches(batchKey, options = {}) {
  const meta = await resolvePrintBatchMeta(batchKey);
  const { page = 1, perPage = 25, search = '', idBiodata = '' } = options;
  const idExpr = `p.${meta.headerPk}`;
  const conditions = [];
  const params = [];

  if (idBiodata && meta.detailTable && meta.detailCols.includes(meta.detailFk)) {
    const bid = String(idBiodata).trim();
    const parts = [
      `EXISTS (SELECT 1 FROM ${meta.detailTable} d WHERE d.${meta.detailFk} = ${idExpr} AND d.id_biodata = ?)`
    ];
    params.push(bid);
    if (meta.headerCols.includes('id_biodata')) {
      parts.push(`TRIM(COALESCE(p.id_biodata, '')) = ?`);
      params.push(bid);
    }
    conditions.push(`(${parts.join(' OR ')})`);
  }

  if (search && meta.searchFields?.length) {
    const s = `%${String(search).toLowerCase()}%`;
    const parts = meta.searchFields
      .filter((f) => meta.headerCols.includes(f))
      .map((f) => `lower(COALESCE(p.${f},'')) LIKE ?`);
    if (parts.length) {
      conditions.push(`(${parts.join(' OR ')})`);
      parts.forEach(() => params.push(s));
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(DISTINCT ${idExpr}) AS total FROM ${meta.headerTable} p ${where}`;
  const countRow = await q(db.prepare(countSql), 'get', ...params);
  const total = Number(countRow?.total || 0);

  const limit = Math.max(1, parseInt(perPage, 10) || 25);
  const offset = Math.max(0, (parseInt(page, 10) || 1) - 1) * limit;

  let detailCountSql = '0';
  if (meta.detailTable && meta.detailCols.includes(meta.detailFk)) {
    detailCountSql = `(SELECT COUNT(*) FROM ${meta.detailTable} d WHERE d.${meta.detailFk} = ${idExpr})`;
  }

  const dataSql = `
    SELECT p.*, ${idExpr} AS ${meta.idField}, ${detailCountSql} AS jumlah_ctki
    FROM ${meta.headerTable} p
    ${where}
    ORDER BY ${idExpr} DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const data = normalizeRows(await q(db.prepare(dataSql), 'all', ...params));
  return {
    data,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / limit) || 1 }
  };
}

async function getPrintBatch(batchKey, id) {
  const meta = await resolvePrintBatchMeta(batchKey);
  const idExpr = `p.${meta.headerPk}`;
  const row = normalizeRow(await q(
    db.prepare(`SELECT p.*, ${idExpr} AS ${meta.idField} FROM ${meta.headerTable} p WHERE ${idExpr} = ?`),
    'get',
    id
  ));
  return row;
}

async function createPrintBatch(batchKey, data) {
  const meta = await resolvePrintBatchMeta(batchKey);
  const payload = pickPayloadFields(data, meta.headerCols, meta.headerFields);
  const created = await insertDynamicRow(meta.headerTable, payload);
  const pkVal = created[meta.idField] ?? created[meta.headerPk] ?? created.id ?? created.lastInsertRowid;
  return getPrintBatch(batchKey, pkVal);
}

async function updatePrintBatch(batchKey, id, data) {
  const row = await getPrintBatch(batchKey, id);
  if (!row) return null;
  const meta = await resolvePrintBatchMeta(batchKey);
  const merged = { ...row, ...data };
  const payload = pickPayloadFields(merged, meta.headerCols, meta.headerFields);
  const sets = Object.keys(payload).map((f) => `${f} = ?`).join(', ');
  if (!sets) return getPrintBatch(batchKey, id);
  const vals = Object.values(payload);
  await q(
    db.prepare(`UPDATE ${meta.headerTable} SET ${sets} WHERE ${meta.headerPk} = ?`),
    'run',
    ...vals,
    id
  );
  return getPrintBatch(batchKey, id);
}

async function deletePrintBatch(batchKey, id) {
  const row = await getPrintBatch(batchKey, id);
  if (!row) return false;
  const meta = await resolvePrintBatchMeta(batchKey);
  const pk = row[meta.idField];
  if (meta.detailTable && meta.detailCols.includes(meta.detailFk)) {
    await q(
      db.prepare(`DELETE FROM ${meta.detailTable} WHERE ${meta.detailFk} = ?`),
      'run',
      pk
    );
  }
  await q(
    db.prepare(`DELETE FROM ${meta.headerTable} WHERE ${meta.headerPk} = ?`),
    'run',
    pk
  );
  return true;
}

async function listPrintBatchDetails(batchKey, headerId) {
  const meta = await resolvePrintBatchMeta(batchKey);
  if (!meta.detailTable || !meta.detailCols.includes(meta.detailFk)) return [];
  const extraCols = (meta.detailFields || [])
    .filter((f) => f !== 'id_biodata' && meta.detailCols.includes(f))
    .map((f) => `d.${f}`)
    .join(', ');
  const extraSql = extraCols ? `, ${extraCols}` : '';
  return dbAllRows(`
    SELECT d.${meta.detailPk} AS id_pembuatan, d.${meta.detailFk}, d.id_biodata, p.nama${extraSql}
    FROM ${meta.detailTable} d
    LEFT JOIN personal p ON p.id_biodata = d.id_biodata
    WHERE d.${meta.detailFk} = ?
    ORDER BY d.${meta.detailPk} DESC
  `, headerId);
}

async function addPrintBatchDetail(batchKey, headerId, body) {
  const meta = await resolvePrintBatchMeta(batchKey);
  const payload = body && typeof body === 'object' ? body : { id_biodata: body };
  const id = String(payload.id_biodata || '').trim();
  if (!id) throw new Error('id_biodata wajib');
  if (!meta.detailTable) throw new Error('Tabel detail tidak tersedia');

  const exists = await q(
    db.prepare(`SELECT ${meta.detailPk} FROM ${meta.detailTable} WHERE ${meta.detailFk} = ? AND id_biodata = ?`),
    'get',
    headerId,
    id
  );
  if (exists) throw new Error('CTKI sudah ada di batch ini');

  const insertData = { [meta.detailFk]: headerId, id_biodata: id };
  for (const f of meta.detailFields || []) {
    if (f === 'id_biodata' || f === meta.detailFk) continue;
    if (payload[f] !== undefined && meta.detailCols.includes(f)) {
      insertData[f] = payload[f];
    }
  }
  return insertDynamicRow(meta.detailTable, insertData);
}

async function updatePrintBatchDetail(batchKey, detailId, idBiodata) {
  const meta = await resolvePrintBatchMeta(batchKey);
  const id = String(idBiodata || '').trim();
  if (!id) throw new Error('id_biodata wajib');
  await q(
    db.prepare(`UPDATE ${meta.detailTable} SET id_biodata = ? WHERE ${meta.detailPk} = ?`),
    'run',
    id,
    detailId
  );
  return normalizeRow(await q(
    db.prepare(`SELECT * FROM ${meta.detailTable} WHERE ${meta.detailPk} = ?`),
    'get',
    detailId
  ));
}

async function deletePrintBatchDetail(batchKey, detailId) {
  const meta = await resolvePrintBatchMeta(batchKey);
  await q(
    db.prepare(`DELETE FROM ${meta.detailTable} WHERE ${meta.detailPk} = ?`),
    'run',
    detailId
  );
  return true;
}

async function getPrintBatchPayload(batchKey, id, type = 'default') {
  const meta = await resolvePrintBatchMeta(batchKey);
  const header = await getPrintBatch(batchKey, id);
  if (!header) return null;
  const details = await listPrintBatchDetails(batchKey, header[meta.idField]);
  return { type, batchKey, header, details, meta: { titleField: meta.idField } };
}

/** Sinkronkan katalog print surat ke letter_templates */
async function syncPrintSuratLetterTemplates(cfg) {
  const tables = getTableNames();
  if (!tables.includes('letter_templates') || !cfg?.templates?.length) return { synced: 0 };
  let synced = 0;
  const ins = db.prepare(
    `INSERT INTO letter_templates (kode, nama, kategori, engine, file_path, sektor, modul_legacy, aktif)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  );
  for (const t of cfg.templates) {
    const exists = await getLetterTemplateByKode(t.kode);
    if (exists) continue;
    await q(ins, 'run', t.kode, t.nama, t.kategori || 'print_surat', t.engine || 'word', t.file_path, '', t.modul_legacy || '');
    synced++;
  }
  return { synced };
}

async function listIjinBatches(options = {}) {
  const { page = 1, perPage = 25, search = '' } = options;
  if (!getTableNames().includes('surat_rekom_ijin_batch')) {
    return { data: [], pagination: { page, perPage, total: 0, totalPages: 1 } };
  }
  const conditions = [];
  const params = [];
  if (search) {
    conditions.push(`(lower(COALESCE(tgl,'')) LIKE ? OR lower(COALESCE(tipe,'')) LIKE ? OR lower(COALESCE(tki,'')) LIKE ?)`);
    const s = `%${String(search).toLowerCase()}%`;
    params.push(s, s, s);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = Number((await q(db.prepare(`SELECT COUNT(*) AS c FROM surat_rekom_ijin_batch ${where}`), 'get', ...params))?.c || 0);
  const limit = Math.max(1, parseInt(perPage, 10) || 25);
  const offset = Math.max(0, (parseInt(page, 10) || 1) - 1) * limit;
  const rows = normalizeRows(await q(
    db.prepare(`SELECT * FROM surat_rekom_ijin_batch ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`),
    'all',
    ...params
  )).map((r) => ({
    ...r,
    jumlah_ctki: parseIjinBatchTkiCsv(r.tki).length
  }));
  return {
    data: rows,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / limit) || 1 }
  };
}

async function getIjinBatch(id) {
  if (!getTableNames().includes('surat_rekom_ijin_batch')) return null;
  return normalizeRow(await q(db.prepare('SELECT * FROM surat_rekom_ijin_batch WHERE id = ?'), 'get', id));
}

async function createIjinBatch(data) {
  return create('surat_rekom_ijin_batch', {
    tgl: data.tgl || '',
    tki: data.tki || '',
    tipe: data.tipe || 'PORTRAIT'
  });
}

async function updateIjinBatch(id, data) {
  const row = await getIjinBatch(id);
  if (!row) return null;
  await update('surat_rekom_ijin_batch', id, {
    tgl: data.tgl ?? row.tgl,
    tki: data.tki ?? row.tki,
    tipe: data.tipe ?? row.tipe
  });
  return getIjinBatch(id);
}

async function deleteIjinBatch(id) {
  return remove('surat_rekom_ijin_batch', id);
}

function parseIjinBatchTkiCsv(tkiCsv) {
  return String(tkiCsv || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function serializeIjinBatchTkiCsv(ids) {
  return [...new Set((ids || []).map((x) => String(x).trim()).filter(Boolean))].join(',');
}

async function resolveIjinBatchPersonal(tkiCsv) {
  const ids = parseIjinBatchTkiCsv(tkiCsv);
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return dbAllRows(
    `SELECT id_biodata, nama FROM personal WHERE id_biodata IN (${placeholders})`,
    ...ids
  );
}

/** Daftar CTKI dalam batch ijin — parity detailtabelpap (bukan input CSV manual) */
async function listIjinBatchDetails(batchId) {
  const batch = await getIjinBatch(batchId);
  if (!batch) return null;
  const ids = parseIjinBatchTkiCsv(batch.tki);
  if (!ids.length) return { batch, details: [] };
  const placeholders = ids.map(() => '?').join(',');
  const rows = await dbAllRows(
    `SELECT p.id_biodata, p.nama, d.nodisnaker
     FROM personal p
     LEFT JOIN disnaker d ON d.id_biodata = p.id_biodata
     WHERE p.id_biodata IN (${placeholders})
     ORDER BY p.id_biodata`,
    ...ids
  );
  const byId = new Map(rows.map((r) => [r.id_biodata, r]));
  const details = ids.map((id, i) => {
    const r = byId.get(id) || { id_biodata: id, nama: '', nodisnaker: '' };
    return { no: i + 1, id_biodata: r.id_biodata, nama: r.nama || '', nodisnaker: r.nodisnaker || '' };
  });
  return { batch, details };
}

async function addIjinBatchDetail(batchId, idBiodata) {
  const batch = await getIjinBatch(batchId);
  if (!batch) return null;
  const id = String(idBiodata || '').trim();
  if (!id) throw new Error('ID biodata wajib');
  const ids = parseIjinBatchTkiCsv(batch.tki);
  if (ids.includes(id)) return listIjinBatchDetails(batchId);
  ids.push(id);
  await updateIjinBatch(batchId, { tki: serializeIjinBatchTkiCsv(ids) });
  return listIjinBatchDetails(batchId);
}

async function removeIjinBatchDetail(batchId, idBiodata) {
  const batch = await getIjinBatch(batchId);
  if (!batch) return null;
  const id = String(idBiodata || '').trim();
  const ids = parseIjinBatchTkiCsv(batch.tki).filter((x) => x !== id);
  await updateIjinBatch(batchId, { tki: serializeIjinBatchTkiCsv(ids) });
  return listIjinBatchDetails(batchId);
}

/** Data export Excel surat pengajuan bank — parity surat_pengajuan_keuangan/printxls_test */
async function getSuratPengajuanExportPayload(id) {
  const tables = getTableNames();
  if (!tables.includes('surat_pengajuan')) return null;

  const headerCols = await getTableColumnNames('surat_pengajuan');
  const pk = await resolveTablePkColumn('surat_pengajuan');
  const header = normalizeRow(
    await q(db.prepare(`SELECT * FROM surat_pengajuan WHERE "${pk}" = ?`), 'get', id)
  );
  if (!header) return null;

  const ajuId = header.id_surat_aju ?? header.id;
  const detailCols = tables.includes('surat_pengajuan_data')
    ? await getTableColumnNames('surat_pengajuan_data')
    : [];
  const legacyDetail = detailCols.includes('aju_id');

  const bank = header.lembaga || header.kepada || '';
  const tanggal = header.tanggal || header.tgl || '';
  const pptkis = header.pptkis || 'PT. FLAMBOYAN GEMAJASA ';

  function deriveStatus(idBiodata, fromDb) {
    if (fromDb) return fromDb;
    const brt = String(idBiodata || '').charAt(1);
    if (brt === 'F') return 'FORMAL';
    if (brt === 'I' || brt === 'P') return 'INFORMAL';
    return '';
  }

  let rows = [];

  if (legacyDetail) {
    const sql = `
      SELECT
        dis.nodisnaker AS vid,
        b.notelp AS hp,
        ds.bank AS status,
        b.warganegara AS negara,
        e.nodisnaker AS id,
        e.nama AS nama,
        COALESCE(dm.nama, m.namamajikan, '') AS majikan,
        c.nopaspor AS paspor,
        f.nama AS agen,
        a.jumlah_pinjaman AS pinjaman,
        a.loan AS load,
        fa.nama_ibu AS ibu
      FROM surat_pengajuan_data a
      LEFT JOIN personal b ON a.id_biodata = b.id_biodata
      LEFT JOIN paspor c ON a.id_biodata = c.id_biodata
      LEFT JOIN majikan m ON a.id_biodata = m.id_biodata
      LEFT JOIN datamajikan dm ON dm.id_majikan = m.kode_majikan
      LEFT JOIN disnaker e ON a.id_biodata = e.id_biodata
      LEFT JOIN dataagen f ON m.kode_agen = f.id_agen
      LEFT JOIN family fa ON fa.id_biodata = b.id_biodata
      LEFT JOIN disnaker dis ON dis.id_biodata = b.id_biodata
      LEFT JOIN datasektor ds ON ds.kode_jenis = CASE
        WHEN instr(b.id_biodata, '-') > 0 THEN substr(b.id_biodata, 1, instr(b.id_biodata, '-') - 1)
        ELSE b.id_biodata END
      WHERE a.aju_id = ?
    `;
    try {
      rows = await dbAllRows(sql, String(ajuId));
    } catch {
      rows = [];
    }
  }

  if (!rows.length && header.id_biodata) {
    const idBio = header.id_biodata;
    const sqlOne = `
      SELECT
        dis.nodisnaker AS vid,
        b.notelp AS hp,
        ds.bank AS status,
        b.warganegara AS negara,
        e.nodisnaker AS id,
        e.nama AS nama,
        COALESCE(dm.nama, m.namamajikan, '') AS majikan,
        c.nopaspor AS paspor,
        f.nama AS agen,
        '' AS pinjaman,
        '' AS load,
        fa.nama_ibu AS ibu
      FROM personal b
      LEFT JOIN paspor c ON b.id_biodata = c.id_biodata
      LEFT JOIN majikan m ON b.id_biodata = m.id_biodata
      LEFT JOIN datamajikan dm ON dm.id_majikan = m.kode_majikan
      LEFT JOIN disnaker e ON b.id_biodata = e.id_biodata
      LEFT JOIN dataagen f ON m.kode_agen = f.id_agen
      LEFT JOIN family fa ON fa.id_biodata = b.id_biodata
      LEFT JOIN disnaker dis ON dis.id_biodata = b.id_biodata
      LEFT JOIN datasektor ds ON ds.kode_jenis = CASE
        WHEN instr(b.id_biodata, '-') > 0 THEN substr(b.id_biodata, 1, instr(b.id_biodata, '-') - 1)
        ELSE b.id_biodata END
      WHERE b.id_biodata = ?
    `;
    try {
      const one = await dbAllRows(sqlOne, idBio);
      if (one.length) {
        rows = [{
          ...one[0],
          pinjaman: header.jumlah_pinjaman || header.isi || '',
          load: header.loan || ''
        }];
      }
    } catch {
      /* ignore */
    }
  }

  return {
    header: { bank, tanggal, pptkis },
    rows: rows.map((r) => ({
      vid: r.vid || '',
      hp: r.hp || '',
      status: deriveStatus(r.vid || r.id, r.status),
      negara: r.negara || '',
      id: r.id || '',
      nama: r.nama || '',
      majikan: r.majikan || '',
      paspor: r.paspor || '',
      agen: r.agen || '',
      pinjaman: r.pinjaman ?? '',
      load: r.load ?? '',
      ibu: r.ibu || ''
    }))
  };
}

// Bulk delete
async function bulkDelete(table, ids) {
  const pk = await resolveTablePkColumn(table);
  const placeholders = ids.map(() => '?').join(', ');
  const result = await q(db.prepare(`DELETE FROM "${table}" WHERE "${pk}" IN (${placeholders})`), 'run', ...ids);
  return result.changes;
}

module.exports = {
  init,
  getDb,
  getSchema,
  getTableNames,
  loadSchemas,
  schemaToCreateSQL,
  // CRUD
  list,
  getById,
  create,
  update,
  remove,
  bulkDelete,
  // Kanban
  listKanban,
  updatePipelineField,
  reorderInStage,
  getDashboardStats,
  getBiodataDetail,
  ensureMarkProgressForTki,
    getPrintDataStats,
    getMedicalBelumTerbangReport,
    getExpireTglOnlineReport,
  listPapBatches,
  getPapBatch,
  createPapBatch,
  updatePapBatch,
  deletePapBatch,
  listPapDetails,
  addPapDetail,
  updatePapDetail,
  deletePapDetail,
  getPapPrintPayload,
  getPrintBatchKeys,
  listPrintBatches,
  getPrintBatch,
  createPrintBatch,
  updatePrintBatch,
  deletePrintBatch,
  listPrintBatchDetails,
  addPrintBatchDetail,
  updatePrintBatchDetail,
  deletePrintBatchDetail,
  getPrintBatchPayload,
  syncPrintSuratLetterTemplates,
  listIjinBatches,
  getIjinBatch,
  createIjinBatch,
  updateIjinBatch,
  deleteIjinBatch,
  resolveIjinBatchPersonal,
  listIjinBatchDetails,
  addIjinBatchDetail,
  removeIjinBatchDetail,
  getSuratPengajuanExportPayload,
  listNamapapOptions,
  listLetterTemplates,
  getLetterTemplateByKode,
  listHtmlDocumentTemplates,
  getHtmlDocumentTemplate,
  getBiodataFiskal,
  getUploadSummaryForBiodata,
  recordVisaDeparture,
  updateDokumenIdentitasFile,
  clearDokumenIdentitasFile,
  updatePersonalFoto,
  DOKUMEN_IDENTITAS_FIELDS,
  patchMenuMappingUploadTab,
  patchMenuMappingIMSector,
  patchMenuMappingBiodataExtras,
  getByField,
  getMenuMappingBySektor,
  createTkiBiodata,
  listByIdBiodata,
  getRecentActivities,
  convertLead,
  getEntityTimeline,
  getCalendarEvents,
  getSalesReport,
  exportTableCsv,
  findUserByEmail,
  ensurePjtkiAdmin,
  updateUserPassword
};
