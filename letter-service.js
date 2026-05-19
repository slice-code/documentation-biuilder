'use strict';

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const FILES_DIR = path.join(__dirname, 'files');

/** Urutan field biodata → placeholder legacy value1, value2, … */
const BIODATA_VALUE_ORDER = [
  'id_biodata', 'nama', 'nama_mandarin', 'jeniskelamin', 'tanggaldaftar', 'tgllahir',
  'tempatlahir', 'warganegara', 'agama', 'statusnikah', 'tinggi', 'berat', 'pendidikan',
  'alamat', 'provinsi', 'kota', 'kecamatan', 'kelurahan', 'hp', 'email',
  'negara1', 'negara2', 'kode_sponsor', 'statusaktif', 'keterangan',
  'namaayah', 'namaibu', 'namasuami', 'namaistri',
  'namamajikan', 'kode_agen', 'nopaspor', 'nodisnaker', 'novisa'
];

function escapeXmlText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateId(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function splitDateParts(val) {
  if (!val) return { tgl: '', bln: '', thn: '' };
  const s = String(val).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y) return { tgl: '', bln: '', thn: '' };
  return { tgl: d || '', bln: m || '', thn: y || '' };
}

function flattenObject(obj, prefix, out) {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    const key = prefix ? `${prefix}_${k}` : k;
    if (v == null) return;
    if (typeof v === 'object' && !Array.isArray(v)) {
      flattenObject(v, key, out);
    } else if (Array.isArray(v)) {
      out[key] = v.length ? JSON.stringify(v) : '';
    } else {
      out[key] = v;
    }
  });
}

/** Konteks merge untuk template Word — ${key} dan {key} */
function buildMergeContext(detail, fiskal) {
  const p = detail?.personal || {};
  const f = detail?.family || {};
  const m = detail?.majikan || {};
  const pas = detail?.paspor || {};
  const v = detail?.visa || {};
  const d = detail?.disnaker || {};
  const med = detail?.medical || {};
  const sk = detail?.skck || {};
  const parts = splitDateParts(p.tanggaldaftar || p.tglinput);

  const ctx = {
    nama: p.nama,
    nama_mandarin: p.nama_mandarin,
    namamandarin: p.nama_mandarin,
    id_biodata: p.id_biodata,
    idtki: p.id_biodata,
    jeniskelamin: p.jeniskelamin,
    jeniskelaminindo: String(p.jeniskelamin || '').toUpperCase(),
    tanggaldaftar: formatDateId(p.tanggaldaftar),
    tgllahir: formatDateId(p.tgllahir),
    tempatlahir: p.tempatlahir,
    warganegara: p.warganegara,
    agama: p.agama,
    alamat: p.alamat,
    hp: p.hp,
    email: p.email,
    negara1: p.negara1,
    negara2: p.negara2,
    kode_sponsor: p.kode_sponsor,
    statusaktif: p.statusaktif,
    keterangan: p.keterangan,
    namaayah: f.namaayah,
    namaibu: f.namaibu,
    namasuami: f.namasuami,
    namaistri: f.namaistri,
    namamajikan: m.namamajikan,
    namaagen: m.kode_agen,
    kode_agen: m.kode_agen,
    nopaspor: pas.nopaspor,
    nodisnaker: d.nodisnaker,
    tgldisnaker: formatDateId(d.tgldisnaker),
    novisa: v.novisa,
    tanggalterbang: formatDateId(v.tanggalterbang),
    noskck: sk.noskck,
    tgl: parts.tgl,
    bln: parts.bln,
    thn: parts.thn,
    tgl_cetak: formatDateId(new Date().toISOString()),
    tanggal_cetak: formatDateId(new Date().toISOString())
  };

  flattenObject(fiskal, 'fiskal', ctx);
  flattenObject(med, 'medical', ctx);

  BIODATA_VALUE_ORDER.forEach((field, idx) => {
    const n = idx + 1;
    let val = '';
    if (field in p) val = p[field];
    else if (field in f) val = f[field];
    else if (field in m) val = m[field];
    else if (field in pas) val = pas[field];
    else if (field in v) val = v[field];
    else if (field in d) val = d[field];
    ctx[`value${n}`] = val != null ? String(val) : '';
    ctx[`Value${n}`] = ctx[`value${n}`];
  });

  return ctx;
}

function resolveTemplateFile(relPath) {
  const safe = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!safe || safe.includes('..')) throw new Error('Path template tidak valid');
  const full = path.join(FILES_DIR, safe);
  if (!fs.existsSync(full)) {
    const alt = path.join(FILES_DIR, path.basename(safe));
    if (fs.existsSync(alt)) return alt;
    throw new Error(`File template tidak ditemukan: ${safe}`);
  }
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(FILES_DIR))) {
    throw new Error('Path template ditolak');
  }
  return resolved;
}

function mergeDocxFile(filePath, context) {
  const buf = fs.readFileSync(filePath);
  return mergeDocxBuffer(buf, context);
}

function mergeDocxBuffer(buffer, context) {
  const zip = new PizZip(buffer);
  const data = {};
  for (const [k, v] of Object.entries(context || {})) {
    data[k] = v === undefined || v === null ? '' : v;
  }

  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '${', end: '}' }
    });
    doc.render(data);
    let out = doc.getZip();
    return mergeCurlyPlaceholders(out, data);
  } catch (e) {
    if (e && e.properties && e.properties.errors) {
      const msg = e.properties.errors.map((x) => x.message).join('; ');
      throw new Error(`Template Word: ${msg}`);
    }
    return mergeCurlyPlaceholders(new PizZip(buffer), data);
  }
}

/** Placeholder legacy {nama} / {idtki} */
function mergeCurlyPlaceholders(zip, data) {
  const xmlFiles = zip.file(/word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/);
  xmlFiles.forEach((file) => {
    let xml = file.asText();
    Object.keys(data).forEach((key) => {
      const val = escapeXmlText(data[key]);
      xml = xml.split(`{${key}}`).join(val);
    });
    zip.file(file.name, xml);
  });
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function pickBiodataTemplateKode(sektor) {
  const s = String(sektor || '').toUpperCase().slice(0, 2);
  if (s === 'JP') return 'biodata_jp';
  if (['FI', 'MI', 'IM'].includes(s)) return 'biodata_im';
  if (['HM', 'HF'].includes(s)) return 'biodata_los';
  if (['MF', 'MH', 'MC'].includes(s)) return 'biodata_male';
  return 'biodata_word';
}

/** Template biodata Word utama (bukan LOS) — parity detailpersonal → printout/biodata_word */
function pickBiodataDocKode(sektor) {
  const s = String(sektor || '').toUpperCase().slice(0, 2);
  if (s === 'JP') return 'biodata_jp';
  if (['FI', 'MI', 'IM'].includes(s)) return 'biodata_im';
  if (['MF', 'MH', 'MC'].includes(s)) return 'biodata_male';
  if (['HM', 'HF'].includes(s)) return 'biodata_hm';
  return 'biodata_word';
}

function templateMatchesSektor(tplSektor, sektor) {
  const filter = String(tplSektor || '').trim();
  if (!filter) return true;
  const code = String(sektor || '').toUpperCase().slice(0, 2);
  return filter.split(',').map((x) => x.trim().toUpperCase()).includes(code);
}

function mergeHtmlTemplate(html, context) {
  let out = String(html || '');
  Object.keys(context).forEach((key) => {
    const val = String(context[key] ?? '');
    out = out.split(`\${${key}}`).join(val);
    out = out.split(`{{${key}}}`).join(val);
    out = out.split(`{${key}}`).join(val);
  });
  return out;
}

module.exports = {
  FILES_DIR,
  buildMergeContext,
  resolveTemplateFile,
  mergeDocxFile,
  mergeDocxBuffer,
  pickBiodataTemplateKode,
  pickBiodataDocKode,
  templateMatchesSektor,
  mergeHtmlTemplate,
  formatDateId
};
