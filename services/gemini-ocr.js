/**
 * OCR via Google Gemini Vision — butuh GOOGLE_API_KEY di .env
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

/** Default hemat kuota free tier */
const DEFAULT_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash-lite';

/** Fallback vision/OCR — tetap dari yang paling ringan dulu */
const FALLBACK_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash'
];

const KTP_FIELD_KEYS = [
  'nik', 'nama', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'alamat', 'rt_rw',
  'kelurahan', 'kecamatan', 'agama', 'status_perkawinan', 'pekerjaan', 'kewarganegaraan',
  'berlaku_hingga', 'raw_text'
];

const NOT_FOUND_HINT = 'Model tidak ditemukan di API key ini. Cek GET /api/ocr/models';

const KTP_OCR_PROMPT = [
  'OCR kartu e-KTP Indonesia.',
  'Kembalikan SATU objek JSON saja — tanpa markdown, tanpa ```, tanpa teks di luar JSON.',
  'Hanya key ini (string, kosong jika tidak terbaca):',
  'nik, nama, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, rt_rw, kelurahan, kecamatan,',
  'agama, status_perkawinan, pekerjaan, kewarganegaraan, berlaku_hingga, raw_text.',
  'nik: tepat 16 digit angka. raw_text: semua teks yang terbaca dari KTP (plain text, bukan JSON lagi).',
  'Jangan tambah field lain (misalnya foto, url).'
].join(' ');

function modelCandidates(preferred) {
  const list = [preferred, process.env.GEMINI_OCR_MODEL, DEFAULT_MODEL, ...FALLBACK_MODELS]
    .map((m) => String(m || '').trim())
    .filter(Boolean);
  return [...new Set(list)];
}

function isConfigured() {
  return Boolean(String(process.env.GOOGLE_API_KEY || '').trim());
}

function getGenAI() {
  const key = String(process.env.GOOGLE_API_KEY || '').trim();
  if (!key) {
    throw new Error('GOOGLE_API_KEY belum di-set. Isi di .env.local lalu restart server.');
  }
  return new GoogleGenerativeAI(key);
}

function isQuotaOrRateError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('429')
    || msg.includes('quota')
    || msg.includes('rate limit')
    || msg.includes('resource_exhausted');
}

function isModelNotFoundError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('404') || msg.includes('not found') || msg.includes('is not supported');
}

function extractUsageMetadata(response) {
  const u = response?.usageMetadata;
  if (!u) {
    return { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  }
  return {
    promptTokenCount: Number(u.promptTokenCount) || 0,
    candidatesTokenCount: Number(u.candidatesTokenCount) || 0,
    totalTokenCount: Number(u.totalTokenCount) || 0,
    cachedContentTokenCount: Number(u.cachedContentTokenCount) || 0
  };
}

function mergeUsage(...items) {
  const out = {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
    cachedContentTokenCount: 0,
    requestCount: 0
  };
  for (const u of items) {
    if (!u) continue;
    out.promptTokenCount += u.promptTokenCount || 0;
    out.candidatesTokenCount += u.candidatesTokenCount || 0;
    out.totalTokenCount += u.totalTokenCount || 0;
    out.cachedContentTokenCount += u.cachedContentTokenCount || 0;
    out.requestCount += u.requestCount != null ? u.requestCount : 1;
  }
  return out;
}

function formatGeminiError(err, triedModels = []) {
  if (isModelNotFoundError(err)) {
    return new Error(
      `Model Gemini tidak tersedia (${triedModels.join(', ') || 'unknown'}). ${NOT_FOUND_HINT}`
    );
  }
  if (isQuotaOrRateError(err)) {
    const retryMatch = String(err?.message || '').match(/retry in ([\d.]+)s/i);
    const waitHint = retryMatch ? ` Coba lagi setelah ~${Math.ceil(Number(retryMatch[1]))} detik.` : '';
    return new Error(
      'Kuota/rate limit API Gemini (free tier) terlampaui.'
      + waitHint
      + ' Model dicoba: '
      + triedModels.join(', ')
      + '. Set GEMINI_OCR_MODEL=gemini-2.5-flash-lite di .env.local.'
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

function stripMarkdownFences(text) {
  let s = String(text || '').trim();
  for (let i = 0; i < 6; i++) {
    const wrapped = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (wrapped) {
      s = wrapped[1].trim();
      continue;
    }
    const inner = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (inner && s.startsWith('```')) {
      s = inner[1].trim();
      continue;
    }
    break;
  }
  return s;
}

function extractJsonSubstring(text) {
  const s = stripMarkdownFences(text);
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Objek JSON tidak ditemukan dalam respons model');
  }
  return s.slice(start, end + 1);
}

function normalizeKtpFields(obj, fallbackRaw = '') {
  const src = obj && typeof obj === 'object' ? obj : {};
  const out = {};
  for (const key of KTP_FIELD_KEYS) {
    const val = src[key];
    out[key] = val == null ? '' : String(val).trim();
  }
  if (!out.raw_text) {
    out.raw_text = fallbackRaw ? stripMarkdownFences(fallbackRaw) : '';
  }
  if (out.nik) {
    const digits = out.nik.replace(/\D/g, '');
    out.nik = digits.length >= 16 ? digits.slice(0, 16) : digits;
  }
  return out;
}

/** Parse respons model → objek KTP (tangani ```json dan JSON bersarang di raw_text) */
function parseKtpResponse(text) {
  const original = String(text || '').trim();
  let jsonStr = extractJsonSubstring(original);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const innerRaw = parsed.raw_text;
        if (typeof innerRaw === 'string' && innerRaw.includes('{') && innerRaw.includes('nik')) {
          try {
            return normalizeKtpFields(parseKtpResponse(innerRaw), original);
          } catch {
            /* pakai objek luar */
          }
        }
        return normalizeKtpFields(parsed, original);
      }
    } catch (err) {
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/\u201c|\u201d/g, '"')
        .replace(/\u2018|\u2019/g, "'");
      if (attempt === 3) throw err;
    }
  }
  throw new Error('Gagal parse JSON KTP');
}

async function generateVision(modelName, instruction, buffer, mimeType, options = {}) {
  const { jsonMode = false } = options;
  const config = jsonMode ? { responseMimeType: 'application/json' } : {};
  const m = getGenAI().getGenerativeModel({
    model: modelName,
    generationConfig: config
  });
  const result = await m.generateContent([
    { text: instruction },
    {
      inlineData: {
        mimeType,
        data: buffer.toString('base64')
      }
    }
  ]);
  const text = result?.response?.text?.();
  const usage = extractUsageMetadata(result?.response);
  usage.requestCount = 1;
  return {
    text: typeof text === 'string' ? text.trim() : '',
    modelUsed: modelName,
    usage
  };
}

async function runVisionWithFallback(instruction, buffer, mimeType, preferredModel, { jsonMode = false } = {}) {
  const candidates = modelCandidates(preferredModel);
  const tried = [];
  let lastErr = null;

  const usageAttempts = [];

  for (const modelName of candidates) {
    tried.push(modelName);
    try {
      const out = await generateVision(modelName, instruction, buffer, mimeType, { jsonMode });
      return { ...out, usage: mergeUsage(...usageAttempts, out.usage) };
    } catch (err) {
      lastErr = err;
      if (jsonMode) {
        try {
          const out = await generateVision(modelName, instruction, buffer, mimeType, { jsonMode: false });
          return { ...out, usage: mergeUsage(...usageAttempts, out.usage) };
        } catch (err2) {
          lastErr = err2;
        }
      }
      if (!isQuotaOrRateError(lastErr) && !isModelNotFoundError(lastErr)) break;
    }
  }

  throw formatGeminiError(lastErr, tried);
}

/**
 * Ekstrak teks dari gambar (buffer) — auto fallback model jika 429
 */
async function ocrFromImage(opts = {}) {
  const { buffer, mimeType = 'image/jpeg', prompt, model } = opts;
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Buffer gambar wajib');
  }
  const instruction = prompt || [
    'Ekstrak semua teks yang terbaca dari gambar ini.',
    'Kembalikan teks polos saja (tanpa markdown), pertahankan baris baru jika ada.',
    'Jika tidak ada teks, kembalikan string kosong.'
  ].join(' ');

  const { text, usage, modelUsed } = await runVisionWithFallback(
    instruction,
    buffer,
    mimeType,
    model,
    { jsonMode: false }
  );
  return { text, usage, modelUsed };
}

/**
 * OCR KTP — JSON terstruktur (responseMimeType + parser tahan markdown)
 */
async function ocrKtpFromImage(opts = {}) {
  const { buffer, mimeType = 'image/jpeg', model } = opts;
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Buffer gambar wajib');
  }

  const { text, modelUsed, usage } = await runVisionWithFallback(
    KTP_OCR_PROMPT,
    buffer,
    mimeType,
    model,
    { jsonMode: true }
  );

  try {
    const fields = parseKtpResponse(text);
    return { fields, raw: text, modelUsed, usage };
  } catch (parseErr) {
    return {
      fields: {
        ...normalizeKtpFields({}, text),
        parse_error: true,
        parse_message: parseErr.message
      },
      raw: text,
      modelUsed,
      usage
    };
  }
}

/** Daftar model yang mendukung generateContent (dari API Google) */
async function listAvailableModels() {
  const key = String(process.env.GOOGLE_API_KEY || '').trim();
  if (!key) return [];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Gagal list models');
  return (json.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({
      id: m.name.replace(/^models\//, ''),
      displayName: m.displayName || m.name
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getRecommendedOcrModels() {
  return [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash'
  ];
}

module.exports = {
  isConfigured,
  ocrFromImage,
  ocrKtpFromImage,
  parseKtpResponse,
  extractUsageMetadata,
  mergeUsage,
  listAvailableModels,
  getRecommendedOcrModels,
  DEFAULT_MODEL,
  FALLBACK_MODELS,
  KTP_FIELD_KEYS
};
