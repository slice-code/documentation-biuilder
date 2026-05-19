'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const XLSX = require('xlsx');
const letterService = require('./letter-service');

const FILES_DIR = letterService.FILES_DIR;
const CONFIG_PATH = path.join(__dirname, 'appjson', 'print-surat-templates.json');

let _config = null;

function loadConfig() {
  if (_config) return _config;
  try {
    _config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    _config = { templates: [], batchMap: {}, recordMap: {}, ijinBatch: {} };
  }
  return _config;
}

function stripHtml(s) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripBr(s) {
  return stripHtml(s);
}

/** Hindari teks "undefined" di Word jika placeholder tidak terisi */
function sanitizeMergeContext(ctx) {
  const out = {};
  for (const [key, val] of Object.entries(ctx || {})) {
    if (val === undefined || val === null) {
      out[key] = '';
    } else if (Array.isArray(val)) {
      out[key] = val.map((row) => {
        if (row && typeof row === 'object') {
          const r = {};
          Object.keys(row).forEach((k) => { r[k] = row[k] == null ? '' : row[k]; });
          return r;
        }
        return row == null ? '' : row;
      });
    } else if (typeof val === 'object') {
      out[key] = sanitizeMergeContext(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function splitDateParts(val) {
  if (!val) return { tgl: '', bln: '', thn: '' };
  const s = String(val).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y) return { tgl: '', bln: '', thn: '' };
  return { tgl: d || '', bln: m || '', thn: y || '' };
}

function buildBatchMergeContext(header, details, meta = {}) {
  const h = header || {};
  const rows = (details || []).map((d, i) => ({
    no: String(i + 1),
    id_biodata: d.id_biodata || '',
    nama: d.nama || '',
    nomor: d.nomor || h.nomor || '',
    tanggal: letterService.formatDateId(d.tanggal || h.tanggal)
  }));

  const ctx = {
    title: meta.title || 'Print Surat',
    nomor: h.nomor || '',
    nomorktkln: h.nomorktkln || '',
    kepada: stripHtml(h.kepada),
    daerah: h.daerah || '',
    jumlah: h.jumlah || String(rows.length),
    asuransi: h.asuransi || '',
    biaya: h.biaya || '',
    tanggal: letterService.formatDateId(h.tanggal),
    tanggalpap: letterService.formatDateId(h.tanggalpap),
    tglmulai: letterService.formatDateId(h.tglmulai),
    tglakhir: letterService.formatDateId(h.tglakhir),
    tgl_cetak: letterService.formatDateId(new Date().toISOString()),
    tanggal_cetak: letterService.formatDateId(new Date().toISOString()),
    jumlah_ctki: String(rows.length),
    ctki: rows,
    daftar_ctki: rows.map((r) => `${r.no}. ${r.id_biodata} — ${r.nama}`).join('\n')
  };
  Object.assign(ctx, splitDateParts(h.tanggal));
  return sanitizeMergeContext(ctx);
}

function resolveKodeForBatch(batchKey, type) {
  const cfg = loadConfig();
  const map = cfg.batchMap?.[batchKey];
  if (!map) return 'print_batch_generic';
  if (type && map.types?.[type]) return map.types[type];
  return map.defaultKode || 'print_batch_generic';
}

function resolveKodeForRecord(resource, idBiodata = '') {
  const cfg = loadConfig();
  const map = cfg.recordMap?.[resource];
  if (resource === 'pembuatan_opp' && map?.oppBySektor && idBiodata) {
    const ch = String(idBiodata).charAt(0).toUpperCase();
    if (ch === 'I' || ch === 'P') return 'print_pembuatan_opp_informal';
    if (ch === 'H' || ch === 'M') return 'print_pembuatan_opp_hk';
    return 'print_pembuatan_opp';
  }
  return map?.kode || 'print_batch_generic';
}

async function resolveKodeForRecordAsync(database, resource, id) {
  const cfg = loadConfig();
  const map = cfg.recordMap?.[resource];
  if (!map) return 'print_batch_generic';
  if (map.oppBySektor) {
    const row = await database.getById(resource, id);
    const idBio = row?.[map.tkiField] || row?.id_biodata || '';
    return resolveKodeForRecord(resource, idBio);
  }
  return map.kode || 'print_batch_generic';
}

function getTemplateDefByKode(kode) {
  const cfg = loadConfig();
  return (cfg.templates || []).find((t) => t.kode === kode) || null;
}

function listTemplateFilesOnDisk() {
  const out = [];
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) {
        if (name === '_build_docx_temp') return;
        walk(full, rel);
      } else if (/\.(docx|xlsx|xlsm)$/i.test(name)) {
        out.push(rel.replace(/\\/g, '/'));
      }
    }
  }
  walk(FILES_DIR, '');
  return out.sort();
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Isi placeholder .docx minimal per jenis surat (bukan satu template batch untuk semua) */
function minimalDocxDocumentXml(kode, title) {
  const safeTitle = escapeXml(title || 'Print Surat PJTKI');
  const lines = {
    print_rekom_ijin: [
      safeTitle,
      'Nomor: ${nomor}    Lampiran: ${lampiran}',
      'Perihal: ${perihal}',
      'Kepada: ${kepada}',
      'Imigrasi: ${imigrasi}    Daerah: ${daerah}    Tanggal: ${tanggal}',
      '',
      'Nama: ${nama}    ID: ${id_biodata}',
      'Tempat lahir: ${tempatlahir}    Tgl lahir: ${tgllahir}',
      'Jabatan: ${jabatan}',
      'Alamat: ${alamat}',
      'Tampilkan: ${tampilkan}',
      '',
      'Dicetak: ${tgl_cetak}'
    ],
    print_rekom_tabungan: [
      safeTitle,
      'Nomor: ${nomor}    Tanggal: ${tanggal}',
      'Kepada: ${kepada}',
      'Nama: ${nama}    ID: ${id_biodata}',
      'Alamat: ${alamat}',
      'Dicetak: ${tgl_cetak}'
    ]
  };
  const batchDefault = [
    safeTitle,
    'Nomor: ${nomor}  |  Daerah: ${daerah}  |  Tanggal: ${tanggal}',
    'Kepada: ${kepada}',
    'Asuransi: ${asuransi}  |  Biaya: ${biaya}  |  Jumlah TKI: ${jumlah_ctki}',
    'Daftar CTKI:',
    '${daftar_ctki}',
    'Dicetak: ${tgl_cetak}'
  ];
  const textLines = lines[kode] || batchDefault;
  const paragraphs = textLines
    .map((line) => {
      const t = escapeXml(line);
      return `    <w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${paragraphs}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;
}

/** Template minimal lama (salah) dipakai untuk rekom ijin — ganti otomatis */
function isWrongMinimalStub(fullPath, kode) {
  if (!fs.existsSync(fullPath)) return false;
  if (!['print_rekom_ijin', 'print_rekom_tabungan'].includes(kode)) return false;
  try {
    const buf = fs.readFileSync(fullPath);
    const PizZip = require('pizzip');
    const zip = new PizZip(buf);
    const xml = zip.file('word/document.xml')?.asText() || '';
    return xml.includes('jumlah_ctki') || xml.includes('Daftar CTKI');
  } catch {
    return false;
  }
}

/** Buat .docx minimal dari temp_docx_edit jika file belum ada di files/ */
function ensureMinimalDocx(targetRelPath, title, kode = '') {
  const full = path.join(FILES_DIR, targetRelPath);
  if (fs.existsSync(full) && !isWrongMinimalStub(full, kode)) return full;
  if (fs.existsSync(full) && isWrongMinimalStub(full, kode)) {
    try { fs.unlinkSync(full); } catch { /* ignore */ }
  }

  const srcPath = path.join(FILES_DIR, 'temp_docx_edit');
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Folder template dasar tidak ada: ${srcPath}`);
  }

  const body = minimalDocxDocumentXml(kode, title);

  const packDir = path.join(FILES_DIR, '_build_docx_temp');
  if (fs.existsSync(packDir)) fs.rmSync(packDir, { recursive: true, force: true });
  fs.cpSync(srcPath, packDir, { recursive: true });
  fs.writeFileSync(path.join(packDir, 'word', 'document.xml'), body, 'utf8');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  execSync(`cd "${packDir}" && zip -qr "${full}" .`, { stdio: 'pipe' });
  fs.rmSync(packDir, { recursive: true, force: true });
  return full;
}

function resolveTemplatePath(kode) {
  const def = getTemplateDefByKode(kode);
  const rel = def?.file_path || `print_surat/${kode}.docx`;
  try {
    return letterService.resolveTemplateFile(rel);
  } catch {
    if (!def || def.engine === 'word') {
      return ensureMinimalDocx(rel, def?.nama || kode, kode);
    }
    throw new Error(`Template tidak ditemukan: ${kode} (${rel})`);
  }
}

function mergeTemplate(kode, context) {
  const def = getTemplateDefByKode(kode);
  if (def?.engine === 'xlsx') {
    const filePath = letterService.resolveTemplateFile(def.file_path);
    return {
      buffer: fs.readFileSync(filePath),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ext: 'xlsx'
    };
  }
  const filePath = resolveTemplatePath(kode);
  const buffer = letterService.mergeDocxFile(filePath, sanitizeMergeContext(context));
  return {
    buffer,
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx'
  };
}

async function buildRecordContext(database, resource, id) {
  const cfg = loadConfig();
  const map = cfg.recordMap?.[resource];
  if (!map) throw new Error(`Resource print tidak dikenal: ${resource}`);
  const row = await database.getById(resource, id);
  if (!row) throw new Error('Data tidak ditemukan');
  const idTki = String(row[map.tkiField] || row.id_biodata || '').trim();
  if (!idTki) throw new Error('ID TKI wajib diisi pada data surat sebelum cetak');
  const detail = await database.getBiodataDetail(idTki);
  if (!detail) throw new Error('Biodata TKI tidak ditemukan');
  const fiskal = await database.getBiodataFiskal(idTki);
  const ctx = letterService.buildMergeContext(detail, fiskal);
  const kepada = stripHtml(row.kepada);
  Object.assign(ctx, {
    nomor: row.nomor || '',
    lampiran: row.lampiran || '',
    perihal: row.perihal || '',
    kepada,
    Kepada: kepada,
    imigrasi: row.imigrasi || '',
    daerah: row.daerah || '',
    tampilkan: row.tampilkan || '',
    tanggal: letterService.formatDateId(row.tanggal),
    tanggal_surat: letterService.formatDateId(row.tanggal),
    tglnya: letterService.formatDateId(row.tanggal),
    isi: stripHtml(row.isi || ''),
    peserta: stripHtml(row.peserta || ''),
    alasan: stripHtml(row.alasan || ''),
    jabatan: row.jabatan || ctx.jabatan || '',
    // Field batch — kosongkan agar tidak "undefined" di template lama
    asuransi: '',
    biaya: '',
    jumlah: '1',
    jumlah_ctki: '1',
    daftar_ctki: [ctx.nama, ctx.id_biodata].filter(Boolean).join(' — '),
    nomorktkln: '',
    tanggalpap: '',
    tglmulai: '',
    tglakhir: ''
  });
  if (row.jabatan) ctx.jabatan = row.jabatan;
  return sanitizeMergeContext(ctx);
}

/** Payload PDF ringkas per record (client pdfMake) — parity printdata/cetak2 */
async function buildRecordPdfPayload(database, resource, id) {
  const cfg = loadConfig();
  const map = cfg.recordMap?.[resource];
  if (!map) throw new Error(`Resource print tidak dikenal: ${resource}`);
  const ctx = await buildRecordContext(database, resource, id);
  return {
    resource,
    id,
    title: map.pdfTitle || map.nama || resource,
    header: {
      nomor: ctx.nomor,
      lampiran: ctx.lampiran,
      perihal: ctx.perihal,
      kepada: ctx.kepada,
      imigrasi: ctx.imigrasi,
      daerah: ctx.daerah,
      tanggal: ctx.tanggal,
      tampilkan: ctx.tampilkan
    },
    tki: {
      id_biodata: ctx.id_biodata,
      nama: ctx.nama,
      tempatlahir: ctx.tempatlahir,
      tgllahir: ctx.tgllahir,
      alamat: ctx.alamat,
      jabatan: ctx.jabatan
    },
    peserta: ctx.peserta,
    alasan: ctx.alasan
  };
}

function streamStaticTemplate(kode) {
  syncProductionTemplates();
  const def = getTemplateDefByKode(kode);
  if (!def) throw new Error(`Template tidak dikenal: ${kode}`);
  if (def.engine === 'xlsx') {
    const filePath = path.join(FILES_DIR, def.file_path);
    if (!fs.existsSync(filePath)) throw new Error(`File tidak ada: ${def.file_path}`);
    return {
      buffer: fs.readFileSync(filePath),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ext: 'xlsx',
      filename: path.basename(def.file_path)
    };
  }
  const filePath = letterService.resolveTemplateFile(def.file_path);
  return {
    buffer: fs.readFileSync(filePath),
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
    filename: path.basename(def.file_path)
  };
}

function buildIjinBatchContext(batchRow, personalRows) {
  return {
    tgl: letterService.formatDateId(batchRow.tgl),
    tipe: batchRow.tipe || '',
    tki_list: (personalRows || []).map((p, i) => ({
      no: String(i + 1),
      id_biodata: p.id_biodata || '',
      nama: p.nama || ''
    })),
    daftar_tki: (personalRows || []).map((p, i) => `${i + 1}. ${p.id_biodata} — ${p.nama}`).join('\n'),
    tgl_cetak: letterService.formatDateId(new Date().toISOString())
  };
}

const FLAMBOYAN_FILES = path.resolve(__dirname, '..', 'flamboyan-app', 'files');
const FLAMBOYAN_EXCEL = path.resolve(__dirname, '..', 'flamboyan-app', 'application', 'excel');

/** Salin template production dari flamboyan-app jika ada */
function syncProductionTemplates() {
  const copies = [
    [path.join(FLAMBOYAN_EXCEL, 'pengajuan-pinjaman.xlsx'), 'pengajuan-pinjaman.xlsx'],
    ['files/laporan.docx', 'print_surat/laporan.docx'],
    ['files/rekom_paspor.docx', 'rekom_paspor.docx'],
    ['files/perincian_tki_terbang_pembayaran_bank.docx', 'perincian_tki_terbang_pembayaran_bank.docx'],
    ['files/transfer_biaya_agensi2.docx', 'transfer_biaya_agensi2.docx'],
    ['files/penagihan_uang_tki_kabur_ke_agen.docx', 'penagihan_uang_tki_kabur_ke_agen.docx'],
    ['files/formulir_wintrust.xlsx', 'formulir_wintrust.xlsx'],
    ['files/brifing/brifing_template.docx', 'brifing/brifing_template.docx'],
    ['files/pp/formal.docx', 'pp/formal.docx'],
    ['files/pp/informal.docx', 'pp/informal.docx'],
    ['files/pp/hongkong.docx', 'pp/hongkong.docx'],
    ['files/disnaker/dl004_lama.docx', 'disnaker/dl004_lama.docx']
  ];
  for (const [relSrc, relDest] of copies) {
    const src = path.join(FLAMBOYAN_FILES, relSrc.replace(/^files\//, ''));
    const srcAlt = relSrc.startsWith('application/')
      ? path.join(FLAMBOYAN_EXCEL, path.basename(relSrc))
      : src;
    const from = fs.existsSync(srcAlt) ? srcAlt : (fs.existsSync(src) ? src : null);
    if (!from) continue;
    const dest = path.join(FILES_DIR, relDest);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const srcStat = fs.statSync(from);
    const shouldCopy = !fs.existsSync(dest)
      || isWrongMinimalStub(dest, '')
      || fs.statSync(dest).size < Math.min(srcStat.size * 0.85, 25000);
    if (shouldCopy) fs.copyFileSync(from, dest);
  }
}

function formatTglDmY(val) {
  if (!val) return '';
  const s = String(val).replace(/\./g, '-').slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function replacePlaceholdersInSheet(ws, map) {
  if (!ws || !ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.v == null) continue;
      let v = String(cell.v);
      let changed = false;
      for (const [key, val] of Object.entries(map)) {
        const ph = `{${key}}`;
        if (v.includes(ph)) {
          v = v.split(ph).join(val);
          changed = true;
        }
      }
      if (changed) {
        cell.v = v;
        cell.w = v;
      }
    }
  }
}

/** Export Excel pengajuan pinjaman — template files/pengajuan-pinjaman.xlsx */
async function exportSuratPengajuanExcel(database, id) {
  syncProductionTemplates();
  const payload = await database.getSuratPengajuanExportPayload(id);
  if (!payload) throw new Error('Data surat pengajuan tidak ditemukan');

  const templatePath = path.join(FILES_DIR, 'pengajuan-pinjaman.xlsx');
  if (!fs.existsSync(templatePath)) {
    throw new Error('Template Excel tidak ditemukan: files/pengajuan-pinjaman.xlsx');
  }

  const wb = XLSX.readFile(templatePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const tanggal = payload.header.tanggal || '';
  const singles = {
    tgl: formatTglDmY(tanggal),
    tgl2: letterService.formatDateId(tanggal),
    bank: payload.header.bank || ''
  };
  replacePlaceholdersInSheet(ws, singles);

  const startRow = 8;
  const colKeys = ['no', 'vid', 'nama', 'paspor', 'ibu', 'hp', 'negara', 'agen', 'majikan', 'status', 'pinjaman', 'load'];
  const colIndex = {};
  const headerScanRow = 8;
  for (let C = 0; C < 20; C++) {
    const addr = XLSX.utils.encode_cell({ r: headerScanRow, c: C });
    const v = ws[addr]?.v;
    if (v == null) continue;
    const s = String(v).trim();
    const m = s.match(/^\[([a-z_]+)\]$/i);
    if (m) colIndex[m[1].toLowerCase()] = C;
  }

  payload.rows.forEach((row, i) => {
    const R = startRow + i;
    const noVal = `=${i + 1} - 8`;
    const values = {
      no: noVal,
      vid: row.vid,
      nama: row.nama,
      paspor: row.paspor,
      ibu: row.ibu,
      hp: row.hp,
      negara: row.negara,
      agen: row.agen,
      majikan: row.majikan,
      status: row.status,
      pinjaman: row.pinjaman,
      load: row.load
    };
    colKeys.forEach((key) => {
      const C = colIndex[key];
      if (C === undefined) return;
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      ws[addr] = { t: 's', v: values[key] == null ? '' : String(values[key]) };
    });
  });

  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const endRow = startRow + Math.max(payload.rows.length, 1);
    if (endRow > range.e.r) range.e.r = endRow;
    ws['!ref'] = XLSX.utils.encode_range(range);
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return {
    buffer,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
    filename: `pengajuan_pinjaman_${id}.xlsx`
  };
}

/** Pastikan template .docx ada (minimal hanya jika belum ada / stub salah) */
function ensureRecordPrintTemplates() {
  const cfg = loadConfig();
  const kodes = new Set();
  Object.values(cfg.recordMap || {}).forEach((m) => { if (m.kode) kodes.add(m.kode); });
  (cfg.templates || []).forEach((t) => { if (t.kode && t.engine === 'word') kodes.add(t.kode); });
  for (const kode of kodes) {
    if (kode === 'print_batch_generic') continue;
    const def = getTemplateDefByKode(kode);
    if (!def?.file_path?.endsWith('.docx')) continue;
    const full = path.join(FILES_DIR, def.file_path);
    if (fs.existsSync(full) && !isWrongMinimalStub(full, kode) && fs.statSync(full).size > 20000) continue;
    try {
      ensureMinimalDocx(def.file_path, def.nama || kode, kode);
    } catch {
      /* temp_docx_edit wajib ada */
    }
  }
}

module.exports = {
  loadConfig,
  stripBr,
  buildBatchMergeContext,
  buildRecordContext,
  buildIjinBatchContext,
  resolveKodeForBatch,
  resolveKodeForRecord,
  resolveKodeForRecordAsync,
  buildRecordPdfPayload,
  streamStaticTemplate,
  getTemplateDefByKode,
  listTemplateFilesOnDisk,
  mergeTemplate,
  ensureMinimalDocx,
  syncProductionTemplates,
  exportSuratPengajuanExcel,
  ensureRecordPrintTemplates
};
