/**
 * Penyimpanan gambar untuk dokumentasi (publik, tanpa auth).
 * Berbeda dari upload-service.js yang mengikat ke id_biodata.
 *
 * Gambar disimpan ke data/doc-uploads/YYYY/MM/<nama>.ext
 * dan diserve melalui path publik /doc-uploads/...
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', 'data', 'doc-uploads');
const PUBLIC_PREFIX = '/doc-uploads/';

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg'
};

const ALLOWED_MIME = new Set(Object.keys(MIME_EXT));

function ensureRoot() {
  if (!fs.existsSync(ROOT)) {
    fs.mkdirSync(ROOT, { recursive: true });
  }
}

function safeBaseName(name) {
  return String(name || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
}

function buildStoredName(mime, originalName = '') {
  const ext = MIME_EXT[mime] || path.extname(originalName || '').toLowerCase() || '.bin';
  const stamp = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  const baseHint = safeBaseName(path.basename(originalName || '').replace(/\.[^.]+$/, ''));
  const prefix = baseHint ? `${baseHint}_` : 'img_';
  return `${prefix}${stamp}_${rand}${ext}`;
}

function todayFolder() {
  const d = new Date();
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return path.join(year, month);
}

/**
 * Simpan buffer image ke disk.
 * @param {Buffer} buffer
 * @param {string} mime
 * @param {string} originalName
 * @returns {string} Public URL (mis. /doc-uploads/2026/05/img_xxx.png)
 */
function saveImageBuffer(buffer, mime, originalName = '') {
  if (!buffer || !buffer.length) throw new Error('Buffer image kosong');
  const normalized = mime === 'image/jpg' ? 'image/jpeg' : mime;
  if (!ALLOWED_MIME.has(normalized)) {
    throw new Error(`Tipe image tidak didukung: ${normalized || 'unknown'}`);
  }

  ensureRoot();
  const folder = todayFolder();
  const dir = path.join(ROOT, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = buildStoredName(normalized, originalName);
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, buffer);

  return `${PUBLIC_PREFIX}${folder.replace(/\\/g, '/')}/${filename}`;
}

/**
 * Konversi data URI base64 ke file pada disk.
 * @param {string} dataUri "data:image/png;base64,...."
 * @returns {string} Public URL
 */
function saveBase64DataUri(dataUri) {
  const match = String(dataUri || '').match(/^data:([^;,]+)(?:;[^,]+)?,(.+)$/);
  if (!match) throw new Error('Bukan data URI yang valid');
  const mime = match[1];
  const isBase64 = /;base64,/i.test(dataUri);
  const payload = match[2];
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf-8');
  return saveImageBuffer(buffer, mime);
}

function isDataUri(value) {
  return typeof value === 'string' && /^data:image\/[a-zA-Z0-9+.-]+/.test(value);
}

/**
 * Resolve URL publik /doc-uploads/<path> ke absolute path pada disk.
 * Kembalikan null jika di luar root (mencegah path traversal).
 */
function resolvePublicPath(publicPath) {
  const rel = String(publicPath || '').replace(/^\/doc-uploads\//, '');
  if (!rel) return null;
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(path.resolve(ROOT))) return null;
  return abs;
}

module.exports = {
  ROOT,
  PUBLIC_PREFIX,
  ALLOWED_MIME,
  ensureRoot,
  saveImageBuffer,
  saveBase64DataUri,
  isDataUri,
  resolvePublicPath
};
