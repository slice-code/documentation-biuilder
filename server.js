require('./load-env').loadLocalEnv();

const http = require('http');
const fs = require('fs');
const path = require('path');
const database = require('./database');
const auth = require('./auth');
const uploadService = require('./upload-service');
const { HUB_TYPES } = require('./upload-types');
const letterService = require('./letter-service');
const printSuratService = require('./print-surat-service');
const geminiOcr = require('./services/gemini-ocr');
const imageCompress = require('./services/image-compress');
const DocService = require('./services/doc-service');

const PORT = parseInt(process.env.PORT || '3004', 10);

// Request size limits
const MAX_REQUEST_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_JSON_SIZE = 1 * 1024 * 1024; // 1MB for JSON body

function readJsonBody(req, maxSize = MAX_JSON_SIZE) {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalSize = 0;
    
    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        reject(new Error(`Request body too large. Maximum size is ${maxSize / 1024 / 1024}MB`));
        req.destroy();  // Abort the request
        return;
      }
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    
    req.on('error', reject);
  });
}

// Rate limiting for login attempts
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  
  // Remove old attempts outside lockout window
  const recentAttempts = attempts.filter(t => now - t < LOGIN_LOCKOUT_DURATION);
  
  if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
    const oldestAttempt = recentAttempts[0];
    const timeRemaining = Math.ceil((LOGIN_LOCKOUT_DURATION - (now - oldestAttempt)) / 60000);
    return {
      allowed: false,
      retryAfterMinutes: timeRemaining
    };
  }
  
  // Record this attempt
  recentAttempts.push(now);
  loginAttempts.set(ip, recentAttempts);
  
  return { allowed: true };
}

function cleanupOldAttempts() {
  // Run cleanup every hour to prevent memory leaks
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts.entries()) {
    const recentAttempts = attempts.filter(t => now - t < LOGIN_LOCKOUT_DURATION);
    if (recentAttempts.length === 0) {
      loginAttempts.delete(ip);
    } else {
      loginAttempts.set(ip, recentAttempts);
    }
  }
}

// Cleanup every hour
setInterval(cleanupOldAttempts, 60 * 60 * 1000);

// Sanitize error messages for production (prevent info leakage)
function sanitizeError(error, isProduction = process.env.NODE_ENV === 'production') {
  if (!isProduction) {
    // In development, show full error for debugging
    return error.message || 'Unknown error';
  }
  
  // In production, sanitize sensitive information
  const message = error.message || 'Internal server error';
  
  // Remove SQL/database details
  if (message.includes('SQLITE') || message.includes('SQL') || message.includes('database')) {
    return 'Database error occurred';
  }
  
  // Remove file paths
  if (message.includes('/') || message.includes('\\')) {
    return 'Internal server error';
  }
  
  // Remove stack traces
  if (message.includes('at ') || message.includes('Stack')) {
    return 'Internal server error';
  }
  
  // Generic message for unknown errors
  return 'An unexpected error occurred';
}

// Security headers middleware
function addSecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');  // Prevent MIME sniffing
  res.setHeader('X-Frame-Options', 'DENY');  // Prevent clickjacking
  res.setHeader('X-XSS-Protection', '1; mode=block');  // XSS filter
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');  // Force HTTPS
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'");  // CSP
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');  // Control referrer
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');  // Restrict browser features
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

// ============================================
// Auth API — JWT di HttpOnly cookie
// POST /api/auth/login | POST /api/auth/logout | GET /api/auth/me
// ============================================

async function handleAuthRoutes(req, res) {
  const apiPath = req.url.split('?')[0];

  const json = (statusCode, data, extraHeaders = {}) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json', ...extraHeaders });
    res.end(JSON.stringify(data));
  };

  // POST /api/auth/login
  if (apiPath === '/api/auth/login' && req.method === 'POST') {
    readJsonBody(req).then(async (payload) => {
      // Get client IP for rate limiting
      const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      
      // Check rate limit
      const rateLimit = checkLoginRateLimit(clientIP);
      if (!rateLimit.allowed) {
        json(429, { 
          success: false, 
          error: `Terlalu banyak percobaan login. Silakan coba lagi dalam ${rateLimit.retryAfterMinutes} menit.` 
        });
        return;
      }
      
      // Sanitize and validate input
      const email = auth.sanitizeInput(payload.email, 255);
      const password = payload.password || '';

      // Validate email format
      if (!email || !auth.validateEmail(email)) {
        json(400, { success: false, error: 'Format email tidak valid' });
        return;
      }

      // Validate password
      const passwordValidation = auth.validatePassword(password);
      if (!passwordValidation.isValid) {
        json(400, { success: false, error: passwordValidation.errors[0] });
        return;
      }

      const user = await database.findUserByEmail(email);
      if (!user || user.status === 'inactive') {
        json(401, { success: false, error: 'Email atau password salah' });
        return;
      }

      const valid = await auth.verifyPassword(password, user.password);
      if (!valid) {
        json(401, { success: false, error: 'Email atau password salah' });
        return;
      }

      // Upgrade password plain-text ke bcrypt (DB lama)
      if (user.password && !user.password.startsWith('$2')) {
        await database.updateUserPassword(user.id, auth.hashPassword(password));
      }

      const token = auth.signToken(user);
      auth.setAuthCookie(res, token);
      json(200, { success: true, data: auth.toPublicUser(user) });
    }).catch((err) => {
      json(400, { success: false, error: err.message });
    });
    return true;
  }

  // POST /api/auth/logout
  if (apiPath === '/api/auth/logout' && req.method === 'POST') {
    auth.clearAuthCookie(res);
    json(200, { success: true, message: 'Logged out' });
    return true;
  }

  // GET /api/auth/me
  if (apiPath === '/api/auth/me' && req.method === 'GET') {
    try {
      const payload = auth.getUserFromRequest(req);
      if (!payload) {
        json(401, { success: false, error: 'Not authenticated' });
        return true;
      }
      const user = await database.getById('users', payload.sub);
      if (!user || user.status === 'inactive') {
        auth.clearAuthCookie(res);
        json(401, { success: false, error: 'Not authenticated' });
        return true;
      }
      json(200, { success: true, data: auth.toPublicUser(user) });
    } catch (err) {
      json(500, { success: false, error: err.message });
    }
    return true;
  }

  return false;
}

// Cek JWT cookie untuk API yang dilindungi
function isPublicApiRoute(pathname, method) {
  // Public: login endpoint
  if (pathname === '/api/auth/login' && method === 'POST') return true;
  
  // Public: documentation read access (GET only)
  if (method === 'GET' && pathname.startsWith('/api/docs')) return true;
  
  return false;
}

// API Role-based access control
const API_PERMISSIONS = {
  // Admin can do everything
  admin: {
    '*': ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  
  // Staff can read and create, but not delete or update users
  staff: {
    'users': ['GET'],  // Can only view users
    'personal': ['GET', 'POST', 'PUT', 'PATCH'],  // Can manage TKI data
    '*': ['GET', 'POST']  // Can read and create other resources
  },
  
  // Viewer can only read
  viewer: {
    '*': ['GET']  // Read-only access
  }
};

function checkApiPermission(user, resource, method) {
  if (!user || !user.role) return false;
  
  const role = user.role.toLowerCase();
  const permissions = API_PERMISSIONS[role];
  
  if (!permissions) return false;
  
  // Check specific resource permission
  if (permissions[resource]) {
    return permissions[resource].includes(method);
  }
  
  // Check wildcard permission
  if (permissions['*']) {
    return permissions['*'].includes(method);
  }
  
  return false;
}

function requireApiAuth(req, res) {
  if (!req.url.startsWith('/api/')) return true;
  const pathname = req.url.split('?')[0];
  if (isPublicApiRoute(pathname, req.method)) return true;

  const user = auth.getUserFromRequest(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
    return false;
  }
  
  // Check RBAC permissions for CRUD operations
  const match = pathname.match(/^\/api\/([a-zA-Z_][a-zA-Z0-9_]*)(?:\/([^/]+))?$/);
  if (match) {
    const resource = match[1];
    const method = req.method;
    
    if (!checkApiPermission(user, resource, method)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: 'Forbidden: You do not have permission to perform this action' 
      }));
      return false;
    }
  }
  
  req.authUser = user;
  return true;
}

// ============================================
// API Routes for appjson (Private - Not Public)
// ============================================
const appjsonDir = path.join(__dirname, 'appjson');

let pagesIndexCache = null;

/** Pastikan folder data proyek ada (clone baru sering tidak membawa folder kosong). */
function ensureProjectDataDirs() {
  const dirs = [appjsonDir, path.join(__dirname, 'schema'), path.join(__dirname, 'docs')];
  for (const d of dirs) {
    try {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    } catch (e) {
      console.warn('[init] mkdir gagal:', d, e.message);
    }
  }
}

function invalidatePagesIndex() {
  pagesIndexCache = null;
}

function buildPagesIndex() {
  if (pagesIndexCache) return pagesIndexCache;
  try {
    if (!fs.existsSync(appjsonDir)) fs.mkdirSync(appjsonDir, { recursive: true });
  } catch (e) {
    console.warn('[appjson] mkdir:', e.message);
  }
  const byPath = {};
  const list = [];
  let files = [];
  try {
    files = fs.readdirSync(appjsonDir).filter((f) => f.endsWith('.json') && f !== 'menu.json');
  } catch (e) {
    console.warn('[appjson] baca folder kosong/gagal, indeks halaman kosong:', e.message);
    pagesIndexCache = { list, byPath };
    return pagesIndexCache;
  }
  for (const file of files) {
    const name = file.replace('.json', '');
    const content = JSON.parse(fs.readFileSync(path.join(appjsonDir, file), 'utf8'));
    const entry = {
      name,
      path: content.path,
      type: content.type,
      title: content.config?.title || 'Untitled'
    };
    list.push(entry);
    if (content.path) byPath[content.path] = name;
  }
  pagesIndexCache = { list, byPath };
  return pagesIndexCache;
}

function readPageConfigFile(pageName) {
  const filePath = path.join(appjsonDir, `${pageName}.json`);
  if (!filePath.startsWith(appjsonDir) || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ============================================
// API Routes for schema (Private - Not Public)
// ============================================
const schemaDir = path.join(__dirname, 'schema');

async function handleApiRoutes(req, res) {
  // GET /api/schema - List all available schemas
  if (req.url === '/api/schema' && req.method === 'GET') {
    try {
      if (!fs.existsSync(schemaDir)) fs.mkdirSync(schemaDir, { recursive: true });
      let files = [];
      try {
        files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.json'));
      } catch {
        files = [];
      }
      const schemas = files.map(file => {
        const content = JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8'));
        return {
          name: content.name,
          label: content.label,
          icon: content.icon,
          fieldsCount: content.fields?.length || 0
        };
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: schemas }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/schema/:schemaName - Get specific schema
  if (req.url.startsWith('/api/schema/') && req.method === 'GET') {
    try {
      const schemaName = req.url.split('/api/schema/')[1].split('?')[0];
      const filePath = path.join(schemaDir, `${schemaName}.json`);
      
      // Security: Prevent directory traversal
      if (!filePath.startsWith(schemaDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Schema not found' }));
        return true;
      }
      
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: content }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/schema - Create new schema
  if (req.url === '/api/schema' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const fileName = data.name || 'schema';
        const filePath = path.join(schemaDir, `${fileName}.json`);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(schemaDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Access denied' }));
          return true;
        }
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Schema created', file: `${fileName}.json` }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return true;
      }
    });
    return true;
  }

  // PUT /api/schema/:schemaName - Update schema
  if (req.url.startsWith('/api/schema/') && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const schemaName = req.url.split('/api/schema/')[1].split('?')[0];
        const filePath = path.join(schemaDir, `${schemaName}.json`);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(schemaDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Access denied' }));
          return true;
        }
        
        const data = JSON.parse(body);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Schema updated' }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return true;
      }
    });
    return true;
  }

  // DELETE /api/schema/:schemaName - Delete schema
  if (req.url.startsWith('/api/schema/') && req.method === 'DELETE') {
    try {
      const schemaName = req.url.split('/api/schema/')[1].split('?')[0];
      const filePath = path.join(schemaDir, `${schemaName}.json`);
      
      // Security: Prevent directory traversal
      if (!filePath.startsWith(schemaDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Schema not found' }));
        return true;
      }
      
      fs.unlinkSync(filePath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Schema deleted' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/pages - Daftar halaman (ringan, dari cache indeks)
  if (req.url === '/api/pages' && req.method === 'GET') {
    try {
      const { list } = buildPagesIndex();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: list }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  const pagesApiPath = req.url.split('?')[0];

  function resolveBulkPaths(paths) {
    const index = buildPagesIndex();
    const data = [];
    for (const pagePath of paths) {
      const pageName = index.byPath[pagePath];
      if (!pageName) continue;
      const content = readPageConfigFile(pageName);
      if (content) data.push(content);
    }
    return data;
  }

  // POST /api/pages/bulk — body: { paths: ["/", "/personal", ...] }
  if (pagesApiPath === '/api/pages/bulk' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      try {
        const paths = Array.isArray(body.paths) ? body.paths : [];
        const data = resolveBulkPaths(paths);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    }).catch((err) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return true;
  }

  // GET /api/pages/bulk?paths=... (legacy)
  if (pagesApiPath === '/api/pages/bulk' && req.method === 'GET') {
    try {
      const q = req.url.includes('?') ? req.url.split('?')[1] : '';
      const params = new URLSearchParams(q);
      const pathsParam = params.get('paths') || '';
      const paths = pathsParam.split(',').map((p) => decodeURIComponent(p.trim())).filter(Boolean);
      const data = resolveBulkPaths(paths);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/pages/by-path?path=/dataagama
  if (pagesApiPath === '/api/pages/by-path' && req.method === 'GET') {
    try {
      const q = req.url.includes('?') ? req.url.split('?')[1] : '';
      const params = new URLSearchParams(q);
      const pagePath = decodeURIComponent(params.get('path') || '');
      if (!pagePath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'path wajib' }));
        return true;
      }
      const index = buildPagesIndex();
      const pageName = index.byPath[pagePath];
      if (!pageName) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Page not found' }));
        return true;
      }
      const content = readPageConfigFile(pageName);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: content }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  const apiPath = req.url.split('?')[0];
  const apiQuery = req.url.includes('?') ? req.url.split('?')[1] : '';
  const parseQuery = () => {
    const q = {};
    apiQuery.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return q;
  };

  // GET /api/timeline?entity_type=customers&entity_id=1
  if (apiPath === '/api/timeline' && req.method === 'GET') {
    try {
      const q = parseQuery();
      const entityType = q.entity_type;
      const entityId = parseInt(q.entity_id, 10);
      if (!entityType || !entityId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'entity_type dan entity_id wajib' }));
        return true;
      }
      const data = await database.getEntityTimeline(entityType, entityId, parseInt(q.limit, 10) || 40);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/calendar?year=2026&month=5
  if (apiPath === '/api/calendar' && req.method === 'GET') {
    try {
      const q = parseQuery();
      const now = new Date();
      const year = parseInt(q.year, 10) || now.getFullYear();
      const month = parseInt(q.month, 10) || (now.getMonth() + 1);
      const data = await database.getCalendarEvents(year, month);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data, year, month }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/reports/sales
  if (apiPath === '/api/reports/sales' && req.method === 'GET') {
    try {
      const data = await database.getSalesReport();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/export/:table — unduh CSV
  const exportMatch = apiPath.match(/^\/api\/export\/([a-zA-Z_][a-zA-Z0-9_]*)$/);
  if (exportMatch && req.method === 'GET') {
    const table = exportMatch[1];
    if (!database.getTableNames().includes(table)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Table not found' }));
      return true;
    }
    try {
      const q = parseQuery();
      const csv = await database.exportTableCsv(table, { search: q.search || '', sort: q.sort || '', order: q.order || 'asc' });
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}-export.csv"`
      });
      res.end('\uFEFF' + csv);
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/dashboard - Ringkasan TKI untuk halaman dashboard
  if (req.url === '/api/dashboard' && req.method === 'GET') {
    try {
      const data = await database.getDashboardStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/menu-mapping?sektor=FF — tab menudalam per sektor
  if (req.url.startsWith('/api/menu-mapping') && req.method === 'GET') {
    try {
      const qstr = req.url.split('?')[1] || '';
      const sektor = new URLSearchParams(qstr).get('sektor') || '';
      const data = await database.getMenuMappingBySektor(sektor);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/tki/create — buat TKI baru (tambahbio)
  if (req.url === '/api/tki/create' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const data = await database.createTkiBiodata(body);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/biodata/:id/fiskal — rekap administrasi read-only
  const biodataFiskalMatch = req.url.match(/^\/api\/biodata\/([^/]+)\/fiskal(?:\?.*)?$/);
  if (biodataFiskalMatch && req.method === 'GET') {
    try {
      const idBiodata = decodeURIComponent(biodataFiskalMatch[1]);
      const fiskal = await database.getBiodataFiskal(idBiodata);
      if (!fiskal) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Biodata tidak ditemukan' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: fiskal }));
      }
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // —— Cetak / export dokumen (plan §11 — template files/*.docx) ——
  const lettersPath = req.url.split('?')[0];

  if (lettersPath === '/api/letters/print-data-stats' && req.method === 'GET') {
    try {
      const stats = await database.getPrintDataStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: stats }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/reports/medical-belum-terbang' && req.method === 'GET') {
    try {
      const rows = await database.getMedicalBelumTerbangReport();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: rows }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/reports/expire-tgl-online' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const days = Math.min(365, Math.max(1, parseInt(q.get('days') || '30', 10) || 30));
      const rows = await database.getExpireTglOnlineReport(days);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: rows }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // —— Print batch generik (KTKLN, DIS, laporan, …) ——
  const batchMatch = lettersPath.match(/^\/api\/print\/batch\/([a-z0-9_]+)(?:\/(\d+))?(?:\/(details|pdf))?(?:\/(\d+))?$/i);
  if (batchMatch) {
    const batchKey = batchMatch[1];
    const batchId = batchMatch[2] || null;
    const batchSub = batchMatch[3] || null;
    const batchDetailId = batchMatch[4] || null;

    try {
      const keys = database.getPrintBatchKeys();
      if (!keys.includes(batchKey)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Modul batch tidak dikenal: ${batchKey}` }));
        return true;
      }

      if (!batchId && req.method === 'GET' && !batchSub) {
        const q = new URLSearchParams(req.url.split('?')[1] || '');
        const result = await database.listPrintBatches(batchKey, {
          page: parseInt(q.get('page') || '1', 10),
          perPage: parseInt(q.get('perPage') || '25', 10),
          search: q.get('search') || '',
          idBiodata: q.get('id_biodata') || ''
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...result }));
        return true;
      }

      if (!batchId && req.method === 'POST') {
        const body = await readJsonBody(req);
        const data = await database.createPrintBatch(batchKey, body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        return true;
      }

      if (batchId && !batchSub && req.method === 'GET') {
        const data = await database.getPrintBatch(batchKey, batchId);
        if (!data) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data tidak ditemukan' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data }));
        }
        return true;
      }

      if (batchId && !batchSub && req.method === 'PUT') {
        const body = await readJsonBody(req);
        const data = await database.updatePrintBatch(batchKey, batchId, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        return true;
      }

      if (batchId && !batchSub && req.method === 'DELETE') {
        await database.deletePrintBatch(batchKey, batchId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return true;
      }

      if (batchId && batchSub === 'details' && req.method === 'GET') {
        const rows = await database.listPrintBatchDetails(batchKey, batchId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: rows }));
        return true;
      }

      if (batchId && batchSub === 'details' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const row = await database.addPrintBatchDetail(batchKey, batchId, body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: row }));
        return true;
      }

      if (batchId && batchSub === 'details' && batchDetailId && req.method === 'PUT') {
        const body = await readJsonBody(req);
        const row = await database.updatePrintBatchDetail(batchKey, batchDetailId, body.id_biodata);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: row }));
        return true;
      }

      if (batchId && batchSub === 'details' && batchDetailId && req.method === 'DELETE') {
        await database.deletePrintBatchDetail(batchKey, batchDetailId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return true;
      }

      if (batchId && batchSub === 'pdf' && req.method === 'GET') {
        const q = new URLSearchParams(req.url.split('?')[1] || '');
        const type = q.get('type') || 'default';
        const payload = await database.getPrintBatchPayload(batchKey, batchId, type);
        if (!payload) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data tidak ditemukan' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: payload }));
        }
        return true;
      }

      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      return true;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // —— PAP batch (surat_rekom_tabelpap) ——
  const papMatch = lettersPath.match(/^\/api\/print\/pap(?:\/(\d+))?(?:\/(details|pdf|namapap))?(?:\/(\d+))?$/);
  if (papMatch) {
    const papId = papMatch[1] || null;
    const papSub = papMatch[2] || null;
    const papDetailId = papMatch[3] || null;

    try {
      if (!papId && req.method === 'GET' && !papSub) {
        const q = new URLSearchParams(req.url.split('?')[1] || '');
        const result = await database.listPapBatches({
          page: parseInt(q.get('page') || '1', 10),
          perPage: parseInt(q.get('perPage') || '25', 10),
          search: q.get('search') || '',
          idBiodata: q.get('id_biodata') || ''
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...result }));
        return true;
      }

      if (papSub === 'namapap' && req.method === 'GET') {
        const rows = await database.listNamapapOptions();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: rows }));
        return true;
      }

      if (!papId && req.method === 'POST') {
        const body = await readJsonBody(req);
        const data = await database.createPapBatch(body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        return true;
      }

      if (papId && !papSub && req.method === 'GET') {
        const data = await database.getPapBatch(papId);
        if (!data) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data PAP tidak ditemukan' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data }));
        }
        return true;
      }

      if (papId && !papSub && req.method === 'PUT') {
        const body = await readJsonBody(req);
        const data = await database.updatePapBatch(papId, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        return true;
      }

      if (papId && !papSub && req.method === 'DELETE') {
        await database.deletePapBatch(papId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return true;
      }

      if (papId && papSub === 'details' && req.method === 'GET') {
        const rows = await database.listPapDetails(papId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: rows }));
        return true;
      }

      if (papId && papSub === 'details' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const row = await database.addPapDetail(papId, body.id_biodata);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: row }));
        return true;
      }

      if (papId && papSub === 'details' && papDetailId && req.method === 'PUT') {
        const body = await readJsonBody(req);
        const row = await database.updatePapDetail(papDetailId, body.id_biodata);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: row }));
        return true;
      }

      if (papId && papSub === 'details' && papDetailId && req.method === 'DELETE') {
        await database.deletePapDetail(papDetailId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return true;
      }

      if (papId && papSub === 'pdf' && req.method === 'GET') {
        const q = new URLSearchParams(req.url.split('?')[1] || '');
        const type = q.get('type') || 'ppad';
        const payload = await database.getPapPrintPayload(papId, type);
        if (!payload) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data PAP tidak ditemukan' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: payload }));
        }
        return true;
      }
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/templates' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const rows = await database.listLetterTemplates({
        kategori: q.get('kategori') || '',
        sektor: q.get('sektor') || ''
      });
      const enriched = rows.map((t) => {
        let fileOk = false;
        try {
          letterService.resolveTemplateFile(t.file_path);
          fileOk = true;
        } catch {
          fileOk = false;
        }
        return { ...t, file_ok: fileOk };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: enriched }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/html-templates' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const rows = await database.listHtmlDocumentTemplates({
        template_type: q.get('template_type') || ''
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: rows }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/suggest-biodata' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const idBiodata = q.get('id_biodata') || '';
      const sektor = idBiodata.slice(0, 2);
      const kode = letterService.pickBiodataDocKode
        ? letterService.pickBiodataDocKode(sektor)
        : letterService.pickBiodataTemplateKode(sektor);
      const tpl = await database.getLetterTemplateByKode(kode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { kode, template: tpl } }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/html-render' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const templateId = q.get('id');
      const idBiodata = q.get('id_biodata') || '';
      if (!templateId || !idBiodata) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Parameter id dan id_biodata wajib' }));
        return true;
      }
      const tpl = await database.getHtmlDocumentTemplate(templateId);
      if (!tpl) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Template HTML tidak ditemukan' }));
        return true;
      }
      const detail = await database.getBiodataDetail(idBiodata);
      if (!detail) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Biodata tidak ditemukan' }));
        return true;
      }
      const fiskal = await database.getBiodataFiskal(idBiodata);
      const ctx = letterService.buildMergeContext(detail, fiskal);
      const html = letterService.mergeHtmlTemplate(tpl.content, ctx);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: { html, template: { id: tpl.id, name: tpl.name, template_type: tpl.template_type } }
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/files-list' && req.method === 'GET') {
    try {
      const files = printSuratService.listTemplateFilesOnDisk();
      const catalog = (printSuratService.loadConfig().templates || []).map((t) => ({
        ...t,
        exists: files.some((f) => f === t.file_path || f.endsWith('/' + path.basename(t.file_path)))
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { files, catalog } }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/generate-batch' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const batchKey = q.get('batchKey') || '';
      const id = q.get('id') || '';
      const type = q.get('type') || 'default';
      if (!batchKey || !id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'batchKey dan id wajib' }));
        return true;
      }
      const payload = await database.getPrintBatchPayload(batchKey, id, type);
      if (!payload?.header) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Data batch tidak ditemukan' }));
        return true;
      }
      const kode = printSuratService.resolveKodeForBatch(batchKey, type);
      const ctx = printSuratService.buildBatchMergeContext(payload.header, payload.details, { title: batchKey });
      const merged = printSuratService.mergeTemplate(kode, ctx);
      const safeName = `${batchKey}_${id}.${merged.ext}`;
      res.writeHead(200, {
        'Content-Type': merged.mime,
        'Content-Disposition': `attachment; filename="${safeName}"`
      });
      res.end(merged.buffer);
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/record-pdf' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const resource = q.get('resource') || '';
      const id = q.get('id') || '';
      if (!resource || !id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'resource dan id wajib' }));
        return true;
      }
      const data = await printSuratService.buildRecordPdfPayload(database, resource, id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  const staticTplMatch = lettersPath.match(/^\/api\/letters\/template\/([a-z0-9_]+)$/i);
  if (staticTplMatch && req.method === 'GET') {
    try {
      const key = staticTplMatch[1];
      const cfg = printSuratService.loadConfig();
      const kode = cfg.staticTemplates?.[key] || key;
      const merged = printSuratService.streamStaticTemplate(kode);
      res.writeHead(200, {
        'Content-Type': merged.mime,
        'Content-Disposition': `attachment; filename="${merged.filename}"`
      });
      res.end(merged.buffer);
      return true;
    } catch (error) {
      res.writeHead(error.message?.includes('tidak') ? 404 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  const suratPengajuanXlsMatch = lettersPath.match(/^\/api\/letters\/surat-pengajuan\/([^/]+)\/export-xlsx$/);
  if (suratPengajuanXlsMatch && req.method === 'GET') {
    try {
      const id = decodeURIComponent(suratPengajuanXlsMatch[1]);
      const merged = await printSuratService.exportSuratPengajuanExcel(database, id);
      res.writeHead(200, {
        'Content-Type': merged.mime,
        'Content-Disposition': `attachment; filename="${merged.filename}"`
      });
      res.end(merged.buffer);
      return true;
    } catch (error) {
      res.writeHead(error.message?.includes('tidak ditemukan') ? 404 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/wintrust-template' && req.method === 'GET') {
    try {
      printSuratService.syncProductionTemplates();
      const filePath = path.join(letterService.FILES_DIR, 'formulir_wintrust.xlsx');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Template Wintrust tidak ada' }));
        return true;
      }
      const buffer = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="formulir_wintrust.xlsx"'
      });
      res.end(buffer);
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/generate-record' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const resource = q.get('resource') || '';
      const id = q.get('id') || '';
      if (!resource || !id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'resource dan id wajib' }));
        return true;
      }
      const kode = await printSuratService.resolveKodeForRecordAsync(database, resource, id);
      const ctx = await printSuratService.buildRecordContext(database, resource, id);
      const merged = printSuratService.mergeTemplate(kode, ctx);
      const safeName = `${resource}_${id}.${merged.ext}`;
      res.writeHead(200, {
        'Content-Type': merged.mime,
        'Content-Disposition': `attachment; filename="${safeName}"`
      });
      res.end(merged.buffer);
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  const ijinBatchMatch = lettersPath.match(
    /^\/api\/letters\/ijin-batch(?:\/(\d+))?(?:\/(print|details)(?:\/([^/]+))?)?$/
  );
  if (ijinBatchMatch) {
    const batchId = ijinBatchMatch[1] || null;
    const sub = ijinBatchMatch[2] || null;
    const detailBioId = ijinBatchMatch[3] || null;
    try {
      if (!batchId && req.method === 'GET' && !sub) {
        const q = new URLSearchParams(req.url.split('?')[1] || '');
        const result = await database.listIjinBatches({
          page: parseInt(q.get('page') || '1', 10),
          perPage: parseInt(q.get('perPage') || '25', 10),
          search: q.get('search') || ''
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...result }));
        return true;
      }
      if (!batchId && req.method === 'POST') {
        const body = await readJsonBody(req);
        const data = await database.createIjinBatch(body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        return true;
      }
      if (batchId && !sub && req.method === 'GET') {
        const data = await database.getIjinBatch(batchId);
        if (!data) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data tidak ditemukan' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data }));
        }
        return true;
      }
      if (batchId && !sub && req.method === 'PUT') {
        const body = await readJsonBody(req);
        const data = await database.updateIjinBatch(batchId, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        return true;
      }
      if (batchId && !sub && req.method === 'DELETE') {
        await database.deleteIjinBatch(batchId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return true;
      }
      if (batchId && sub === 'details' && !detailBioId && req.method === 'GET') {
        const payload = await database.listIjinBatchDetails(batchId);
        if (!payload) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data tidak ditemukan' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: payload.details, batch: payload.batch }));
        }
        return true;
      }
      if (batchId && sub === 'details' && !detailBioId && req.method === 'POST') {
        const body = await readJsonBody(req);
        const payload = await database.addIjinBatchDetail(batchId, body.id_biodata);
        if (!payload) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data tidak ditemukan' }));
        } else {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: payload.details, batch: payload.batch }));
        }
        return true;
      }
      if (batchId && sub === 'details' && detailBioId && req.method === 'DELETE') {
        const payload = await database.removeIjinBatchDetail(batchId, detailBioId);
        if (!payload) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data tidak ditemukan' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: payload.details, batch: payload.batch }));
        }
        return true;
      }
      if (batchId && sub === 'print' && req.method === 'GET') {
        const row = await database.getIjinBatch(batchId);
        if (!row) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Data tidak ditemukan' }));
          return true;
        }
        const personal = await database.resolveIjinBatchPersonal(row.tki);
        const kode = printSuratService.loadConfig().ijinBatch?.templateKode || 'print_rekom_ijin_batch';
        const ctx = printSuratService.buildIjinBatchContext(row, personal);
        const merged = printSuratService.mergeTemplate(kode, ctx);
        res.writeHead(200, {
          'Content-Type': merged.mime,
          'Content-Disposition': `attachment; filename="ijin_batch_${batchId}.${merged.ext}"`
        });
        res.end(merged.buffer);
        return true;
      }
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (lettersPath === '/api/letters/generate' && req.method === 'GET') {
    try {
      const q = new URLSearchParams(req.url.split('?')[1] || '');
      const kode = q.get('kode') || '';
      const idBiodata = q.get('id_biodata') || '';
      if (!kode || !idBiodata) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Parameter kode dan id_biodata wajib' }));
        return true;
      }
      const tpl = await database.getLetterTemplateByKode(kode);
      if (!tpl) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Template tidak ditemukan' }));
        return true;
      }
      const detail = await database.getBiodataDetail(idBiodata);
      if (!detail) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Biodata tidak ditemukan' }));
        return true;
      }
      const fiskal = await database.getBiodataFiskal(idBiodata);
      const ctx = letterService.buildMergeContext(detail, fiskal);
      const filePath = letterService.resolveTemplateFile(tpl.file_path);
      const outBuf = letterService.mergeDocxFile(filePath, ctx);
      const safeName = `${kode}_${idBiodata.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
      res.writeHead(200, {
        'Content-Type': mimeTypes['.docx'],
        'Content-Disposition': `attachment; filename="${safeName}"`
      });
      res.end(outBuf);
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/biodata/:id_biodata - Detail biodata TKI + relasi inti
  const biodataMatch = req.url.match(/^\/api\/biodata\/([^/?]+)(?:\?.*)?$/);
  if (biodataMatch && req.method === 'GET') {
    try {
      const idBiodata = decodeURIComponent(biodataMatch[1]);
      const data = await database.getBiodataDetail(idBiodata);
      if (!data) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Biodata tidak ditemukan' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
      }
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/visa/depart — catat TKI terbang (Fase 1)
  if (req.url.split('?')[0] === '/api/visa/depart' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const data = await database.recordVisaDeparture(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // —— OCR Gemini (KTP) ——
  const ocrPath = apiPathname(req);

  if (ocrPath === '/api/ocr/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        configured: geminiOcr.isConfigured(),
        model: geminiOcr.DEFAULT_MODEL,
        recommended: geminiOcr.getRecommendedOcrModels()
      }
    }));
    return true;
  }

  if (ocrPath === '/api/ocr/models' && req.method === 'GET') {
    try {
      if (!geminiOcr.isConfigured()) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'GOOGLE_API_KEY belum dikonfigurasi.' }));
        return true;
      }
      const models = await geminiOcr.listAvailableModels();
      const recommended = new Set(geminiOcr.getRecommendedOcrModels());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          current: geminiOcr.DEFAULT_MODEL,
          recommended: geminiOcr.getRecommendedOcrModels(),
          models: models.map((m) => ({ ...m, recommended: recommended.has(m.id) }))
        }
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  if (ocrPath === '/api/ocr/ktp' && req.method === 'POST') {
    try {
      if (!geminiOcr.isConfigured()) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'GOOGLE_API_KEY belum dikonfigurasi (env.local / .env.local).'
        }));
        return true;
      }
      const { file } = await uploadService.parseMultipart(req);
      if (!file?.buffer?.length) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'File gambar wajib (field: image)' }));
        return true;
      }
      const maxBytes = 8 * 1024 * 1024;
      if (file.buffer.length > maxBytes) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Ukuran file maksimal 8 MB' }));
        return true;
      }
      const mime = String(file.mime || '').toLowerCase();
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowed.includes(mime)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Format tidak didukung. Gunakan JPEG, PNG, atau WebP.'
        }));
        return true;
      }
      const mimeNorm = mime === 'image/jpg' ? 'image/jpeg' : mime;
      const prepared = await imageCompress.compressForOcr(file.buffer, mimeNorm);
      const result = await geminiOcr.ocrKtpFromImage({
        buffer: prepared.buffer,
        mimeType: prepared.mimeType
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const parsedOk = !result.fields?.parse_error;
      res.end(JSON.stringify({
        success: true,
        data: result.fields,
        meta: {
          model: result.modelUsed || geminiOcr.DEFAULT_MODEL,
          raw_length: (result.raw || '').length,
          parsed: parsedOk,
          usage: result.usage || null,
          image: {
            original_bytes: prepared.originalSize,
            compressed_bytes: prepared.compressedSize,
            original_label: imageCompress.formatBytes(prepared.originalSize),
            compressed_label: imageCompress.formatBytes(prepared.compressedSize),
            width: prepared.width,
            height: prepared.height,
            format: 'webp',
            skipped_reencode: !!prepared.skipped
          }
        }
      }));
      return true;
    } catch (error) {
      const msg = error.message || String(error);
      const isQuota = /kuota|rate limit|429|quota/i.test(msg);
      res.writeHead(isQuota ? 429 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: msg, code: isQuota ? 'GEMINI_QUOTA' : 'OCR_ERROR' }));
      return true;
    }
  }

  // GET /api/documents/types — daftar jenis upload hub
  if (req.url.split('?')[0] === '/api/documents/types' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: HUB_TYPES }));
    return true;
  }

  // GET /api/documents/summary?id_biodata=FF-0001
  if (req.url.startsWith('/api/documents/summary') && req.method === 'GET') {
    try {
      const qstr = req.url.split('?')[1] || '';
      const idBiodata = new URLSearchParams(qstr).get('id_biodata') || '';
      const data = await database.getUploadSummaryForBiodata(idBiodata);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/documents/upload — multipart (Fase 1)
  if (req.url.split('?')[0] === '/api/documents/upload' && req.method === 'POST') {
    try {
      uploadService.ensureUploadRoot();
      const { fields, file } = await uploadService.parseMultipart(req);
      const idBiodata = String(fields.id_biodata || '').trim();
      const docType = String(fields.doc_type || fields.docType || '').trim();
      
      if (!uploadService.isAllowed(docType)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Jenis dokumen tidak dikenali' }));
        return true;
      }
      if (!idBiodata) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'id_biodata wajib' }));
        return true;
      }
      if (!file) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'File wajib diunggah' }));
        return true;
      }
      
      // SECURITY: Validate file size (max 10MB for documents)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.buffer.length > MAX_FILE_SIZE) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        }));
        return true;
      }
      
      // SECURITY: Validate file type (allow only images and PDF)
      const allowedMimes = [
        'image/jpeg',
        'image/png', 
        'image/webp',
        'application/pdf'
      ];
      if (!allowedMimes.includes(file.mime)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Jenis file tidak diizinkan. Hanya JPG, PNG, WebP, dan PDF' 
        }));
        return true;
      }
      
      // SECURITY: Validate file extension
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
      const fileExt = path.extname(file.filename).toLowerCase();
      if (!allowedExts.includes(fileExt)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Ekstensi file tidak diizinkan' 
        }));
        return true;
      }
      
      // Log upload
      console.log(`[UPLOAD] User: ${req.authUser?.email}, Type: ${docType}, Size: ${file.buffer.length} bytes`);

      const publicPath = uploadService.saveUploadFile(idBiodata, docType, file);
      const row = await database.create(docType, {
        id_biodata: idBiodata,
        namadok: fields.namadok || file.filename || docType,
        penting: fields.penting || '',
        cekdokumen: fields.cekdokumen || '',
        tglterima: fields.tglterima || new Date().toISOString().slice(0, 10),
        keterangan: fields.keterangan || '',
        file: publicPath
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: row }));
      return true;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/documents/dokumen-identitas — upload ke kolom dokumen.ktp, dokumen.kk, ...
  if (req.url.split('?')[0] === '/api/documents/dokumen-identitas' && req.method === 'POST') {
    try {
      uploadService.ensureUploadRoot();
      const { fields, file } = await uploadService.parseMultipart(req);
      const idBiodata = String(fields.id_biodata || '').trim();
      const field = String(fields.field || fields.kolom || '').trim();
      const allowed = database.DOKUMEN_IDENTITAS_FIELDS || [];
      if (!allowed.includes(field)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Jenis dokumen identitas tidak valid' }));
        return true;
      }
      if (!idBiodata) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'id_biodata wajib' }));
        return true;
      }
      if (!file) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'File wajib diunggah' }));
        return true;
      }
      
      // SECURITY: Validate file size (max 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.buffer.length > MAX_FILE_SIZE) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Ukuran file terlalu besar. Max ${MAX_FILE_SIZE/1024/1024}MB` }));
        return true;
      }
      
      // SECURITY: Validate file type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedMimes.includes(file.mime)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Jenis file tidak diizinkan' }));
        return true;
      }
      
      console.log(`[UPLOAD ID] User: ${req.authUser?.email}, Field: ${field}, Size: ${file.buffer.length}`);

      const publicPath = uploadService.saveDokumenIdentitasFile(idBiodata, field, file);
      const row = await database.updateDokumenIdentitasFile(idBiodata, field, publicPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { dokumen: row, field, file: publicPath } }));
      return true;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/documents/personal-foto — foto profil (kolom personal.foto)
  if (apiPathname(req) === '/api/documents/personal-foto' && req.method === 'POST') {
    try {
      uploadService.ensureUploadRoot();
      const { fields, file } = await uploadService.parseMultipart(req);
      const idBiodata = String(fields.id_biodata || '').trim();
      if (!idBiodata) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'id_biodata wajib' }));
        return true;
      }
      if (!file) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'File foto wajib diunggah' }));
        return true;
      }
      const mime = String(file.mime || '').toLowerCase();
      if (!mime.startsWith('image/')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Hanya file gambar (JPG, PNG, WebP) yang diizinkan' }));
        return true;
      }

      const publicPath = uploadService.savePersonalFotoFile(idBiodata, file);
      const row = await database.updatePersonalFoto(idBiodata, publicPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { personal: row, foto: publicPath } }));
      return true;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // DELETE /api/documents/personal-foto
  if (apiPathname(req) === '/api/documents/personal-foto' && req.method === 'DELETE') {
    try {
      const body = await readJsonBody(req);
      const idBiodata = String(body.id_biodata || '').trim();
      const row = await database.updatePersonalFoto(idBiodata, '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: row }));
      return true;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // DELETE /api/documents/dokumen-identitas — hapus referensi file (kolom dikosongkan)
  if (req.url.split('?')[0] === '/api/documents/dokumen-identitas' && req.method === 'DELETE') {
    try {
      const body = await readJsonBody(req);
      const idBiodata = String(body.id_biodata || '').trim();
      const field = String(body.field || '').trim();
      const row = await database.clearDokumenIdentitasFile(idBiodata, field);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: row }));
      return true;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/menu - Get menu configuration
  if (req.url === '/api/menu' && req.method === 'GET') {
    try {
      const menuPath = path.join(appjsonDir, 'menu.json');
      if (!fs.existsSync(menuPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Menu configuration not found' }));
        return true;
      }
      const content = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: content }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // GET /api/pages/:pageName - Get specific page config
  if (pagesApiPath.startsWith('/api/pages/') && req.method === 'GET') {
    const pageName = pagesApiPath.slice('/api/pages/'.length);
    if (pageName === 'bulk' || pageName === 'by-path') {
      return false;
    }
    try {
      const filePath = path.join(appjsonDir, `${pageName}.json`);
      
      // Security: Prevent directory traversal
      if (!filePath.startsWith(appjsonDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Page not found' }));
        return true;
      }
      
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: content }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // POST /api/pages - Create new page config
  if (req.url === '/api/pages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const fileName = data.path.replace(/^\//, '').replace(/\//g, '-') || 'page';
        const filePath = path.join(appjsonDir, `${fileName}.json`);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(appjsonDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Access denied' }));
          return true;
        }
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        invalidatePagesIndex();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Page created', file: `${fileName}.json` }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return true;
      }
    });
    return true;
  }

  // PUT /api/pages/:pageName - Update page config
  if (req.url.startsWith('/api/pages/') && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const pageName = req.url.split('/api/pages/')[1].split('?')[0];
        const filePath = path.join(appjsonDir, `${pageName}.json`);
        
        // Security: Prevent directory traversal
        if (!filePath.startsWith(appjsonDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Access denied' }));
          return true;
        }
        
        const data = JSON.parse(body);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        invalidatePagesIndex();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Page updated' }));
        return true;
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return true;
      }
    });
    return true;
  }

  // DELETE /api/pages/:pageName - Delete page config
  if (req.url.startsWith('/api/pages/') && req.method === 'DELETE') {
    try {
      const pageName = req.url.split('/api/pages/')[1].split('?')[0];
      const filePath = path.join(appjsonDir, `${pageName}.json`);
      
      // Security: Prevent directory traversal
      if (!filePath.startsWith(appjsonDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Page not found' }));
        return true;
      }
      
      fs.unlinkSync(filePath);
      invalidatePagesIndex();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Page deleted' }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  return false; // Not an API route
}

// ============================================
// Documentation API Routes
// GET    /api/docs              - List all docs
// GET    /api/docs/:slug        - Get single doc
// GET    /api/docs/:slug/html   - Get doc as rendered HTML
// POST   /api/docs              - Create doc (admin only)
// PUT    /api/docs/:slug        - Update doc (admin only)
// DELETE /api/docs/:slug        - Delete doc (admin only)
// ============================================
async function handleDocRoutes(req, res) {
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];

  const json = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // GET /api/docs - List all documentation
  if (pathname === '/api/docs' && req.method === 'GET') {
    try {
      const docs = await DocService.list();
      json(200, { success: true, data: docs });
      return true;
    } catch (error) {
      json(500, { success: false, error: error.message });
      return true;
    }
  }

  // GET /api/docs/:slug/html - Get doc as rendered HTML
  if (pathname.match(/^\/api\/docs\/[\w-]+\/html$/) && req.method === 'GET') {
    try {
      const slug = pathname.split('/')[3];
      const rendered = await DocService.getRenderedHtml(slug);
      
      if (!rendered) {
        json(404, { success: false, error: 'Documentation not found' });
        return true;
      }
      
      json(200, { success: true, data: rendered });
      return true;
    } catch (error) {
      json(500, { success: false, error: error.message });
      return true;
    }
  }

  // GET /api/docs/:slug - Get single documentation
  if (pathname.match(/^\/api\/docs\/[\w-]+$/) && req.method === 'GET') {
    try {
      const slug = pathname.split('/')[3];
      const doc = await DocService.getBySlug(slug);
      
      if (!doc) {
        json(404, { success: false, error: 'Documentation not found' });
        return true;
      }

      json(200, { success: true, data: doc });
      return true;
    } catch (error) {
      json(500, { success: false, error: error.message });
      return true;
    }
  }

  // POST /api/docs - Create new documentation (requires admin)
  if (pathname === '/api/docs' && req.method === 'POST') {
    try {
      const user = auth.getUserFromRequest(req);
      if (!user || user.role !== 'admin') {
        json(403, { success: false, error: 'Admin access required' });
        return true;
      }

      const body = await readJsonBody(req);
      const { slug, title, content, category, description } = body;

      const doc = await DocService.create(slug, title, content, {
        category,
        description
      });

      json(201, { success: true, data: doc });
      return true;
    } catch (error) {
      if (error.message.includes('already exists') || 
          error.message.includes('Invalid slug') ||
          error.message.includes('required')) {
        json(400, { success: false, error: error.message });
      } else {
        json(500, { success: false, error: error.message });
      }
      return true;
    }
  }

  // PUT /api/docs/:slug - Update documentation (requires admin)
  if (pathname.match(/^\/api\/docs\/[\w-]+$/) && req.method === 'PUT') {
    try {
      const user = auth.getUserFromRequest(req);
      if (!user || user.role !== 'admin') {
        json(403, { success: false, error: 'Admin access required' });
        return true;
      }

      const slug = pathname.split('/')[3];
      const body = await readJsonBody(req);
      const { title, content, category, description } = body;

      const doc = await DocService.update(slug, title, content, {
        category,
        description
      });

      json(200, { success: true, data: doc });
      return true;
    } catch (error) {
      if (error.message.includes('not found')) {
        json(404, { success: false, error: error.message });
      } else if (error.message.includes('required')) {
        json(400, { success: false, error: error.message });
      } else {
        json(500, { success: false, error: error.message });
      }
      return true;
    }
  }

  // DELETE /api/docs/:slug - Delete documentation (requires admin)
  if (pathname.match(/^\/api\/docs\/[\w-]+$/) && req.method === 'DELETE') {
    try {
      const user = auth.getUserFromRequest(req);
      if (!user || user.role !== 'admin') {
        json(403, { success: false, error: 'Admin access required' });
        return true;
      }

      const slug = pathname.split('/')[3];
      const result = await DocService.delete(slug);

      json(200, { success: true, message: result.message });
      return true;
    } catch (error) {
      if (error.message.includes('not found')) {
        json(404, { success: false, error: error.message });
      } else {
        json(500, { success: false, error: error.message });
      }
      return true;
    }
  }

  return false; // Not a doc route
}

// Konfigurasi Kanban per resource CRM
const KANBAN_RESOURCES = {
  deals: {
    groupField: 'stage',
    valueField: 'value',
    columns: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    patchPath: 'stage'
  },
  leads: {
    groupField: 'status',
    valueField: 'estimated_value',
    columns: ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'],
    patchPath: 'status'
  }
};

// ============================================
// Kanban API Routes
// GET  /api/:resource/kanban
// PATCH /api/:resource/:id/stage|status
// POST /api/:resource/reorder
// ============================================
async function handleKanbanRoutes(req, res) {
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];

  const json = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // GET /api/deals/kanban
  const kanbanListMatch = pathname.match(/^\/api\/(deals|leads)\/kanban$/);
  if (kanbanListMatch && req.method === 'GET') {
    const resource = kanbanListMatch[1];
    const cfg = KANBAN_RESOURCES[resource];
    if (!cfg || !database.getTableNames().includes(resource)) {
      json(404, { success: false, error: 'Kanban resource not found' });
      return true;
    }
    try {
      const result = await database.listKanban(resource, cfg.groupField, {
        valueField: cfg.valueField,
        columnKeys: cfg.columns
      });
      json(200, { success: true, data: result.data, totals: result.totals });
    } catch (error) {
      json(500, { success: false, error: error.message });
    }
    return true;
  }

  // POST /api/deals/reorder
  const reorderMatch = pathname.match(/^\/api\/(deals|leads)\/reorder$/);
  if (reorderMatch && req.method === 'POST') {
    const resource = reorderMatch[1];
    const cfg = KANBAN_RESOURCES[resource];
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const ids = payload.ids || [];
        const stage = payload.stage || payload.status || payload[cfg.groupField];
        const result = await database.reorderInStage(resource, ids, cfg.groupField, stage);
        json(200, result);
      } catch (error) {
        json(400, { success: false, error: error.message });
      }
    });
    return true;
  }

  // POST /api/leads/:id/convert — konversi lead ke customer (+ deal)
  const convertMatch = pathname.match(/^\/api\/leads\/([^/]+)\/convert$/);
  if (convertMatch && req.method === 'POST') {
    const leadId = convertMatch[1];
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = await database.convertLead(leadId, payload);
        if (!result) {
          json(404, { success: false, error: 'Lead not found' });
        } else {
          json(200, { success: true, data: result, message: 'Lead berhasil dikonversi' });
        }
      } catch (error) {
        json(400, { success: false, error: error.message });
      }
    });
    return true;
  }

  // PATCH /api/deals/:id/stage
  const stageMatch = pathname.match(/^\/api\/(deals|leads)\/([^/]+)\/(stage|status)$/);
  if (stageMatch && req.method === 'PATCH') {
    const resource = stageMatch[1];
    const id = stageMatch[2];
    const cfg = KANBAN_RESOURCES[resource];
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const value = payload[cfg.groupField] || payload.stage || payload.status;
        if (!value) {
          json(400, { success: false, error: 'Missing stage/status value' });
          return;
        }
        const updated = await database.updatePipelineField(resource, id, cfg.groupField, value);
        if (!updated) {
          json(404, { success: false, error: `${resource} not found` });
        } else {
          json(200, { success: true, data: updated });
        }
      } catch (error) {
        json(400, { success: false, error: error.message });
      }
    });
    return true;
  }

  return false;
}

// ============================================
// Dynamic CRUD API Routes (from database)
// /api/:resource - list, create
// /api/:resource/:id - get, update, delete
// ============================================
async function handleCrudRoutes(req, res) {
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];
  const queryString = urlParts[1] || '';

  // Parse query params
  const query = {};
  queryString.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });

  // Match /api/:resource or /api/:resource/:id
  const match = pathname.match(/^\/api\/([a-zA-Z_][a-zA-Z0-9_]*)(?:\/([^/]+))?$/);
  if (!match) return false;

  const resource = match[1];
  const id = match[2] || null;

  // Skip reserved API paths (schema, pages, auth, calendar, reports, export, timeline, dashboard, menu)
  // 'visa' tidak di-reserve — CRUD tabel visa; POST /api/visa/depart ditangani di handleApiRoutes lebih dulu
  const reserved = ['schema', 'pages', 'auth', 'calendar', 'timeline', 'dashboard', 'menu', 'reports', 'export', 'biodata', 'documents', 'letters'];
  if (reserved.includes(resource)) return false;

  if (resource === 'visa' && id === 'depart') return false;

  // Check if this resource has a schema/table
  const tableNames = database.getTableNames();
  if (!tableNames.includes(resource)) return false;

  // Set JSON header helper
  const json = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // GET /api/:resource - List with pagination & search
  if (!id && req.method === 'GET') {
    try {
      const schema = database.getSchema(resource);
      const searchFields = schema ? schema.fields
        .filter(f => ['text', 'email', 'textarea', 'url', 'enum', 'number'].includes(f.type))
        .map(f => f.name) : [];

      const filters = {};
      if (query.id_biodata || query.filter_id_biodata) {
        filters.id_biodata = query.id_biodata || query.filter_id_biodata;
      }
      if (query.sektor_prefix || query.id_biodata_prefix) {
        filters.id_biodata_prefix = query.sektor_prefix || query.id_biodata_prefix;
      }

      const result = await database.list(resource, {
        page: parseInt(query.page) || 1,
        perPage: parseInt(query.perPage) || parseInt(query.per_page) || 10,
        search: query.search || '',
        searchFields,
        sort: query.sort || '',
        order: query.order || 'asc',
        filters
      });

      json(200, { success: true, ...result });
    } catch (error) {
      json(500, { success: false, error: error.message });
    }
    return true;
  }

  // GET /api/:resource/:id - Get single record
  if (id && req.method === 'GET') {
    try {
      const row = await database.getById(resource, id);
      if (!row) {
        json(404, { success: false, error: `${resource} not found` });
      } else {
        json(200, { success: true, data: row });
      }
    } catch (error) {
      json(500, { success: false, error: error.message });
    }
    return true;
  }

  // POST /api/:resource - Create new record
  if (!id && req.method === 'POST') {
    readJsonBody(req, MAX_JSON_SIZE).then(async (data) => {
      try {
        // Bulk delete action
        if (data._action === 'bulkDelete' && Array.isArray(data.ids)) {
          const deleted = await database.bulkDelete(resource, data.ids);
          json(200, { success: true, deleted });
          return;
        }

        const created = await database.create(resource, data);
        json(201, { success: true, data: created });
      } catch (error) {
        json(400, { success: false, error: error.message });
      }
    }).catch((err) => {
      json(400, { success: false, error: err.message });
    });
    return true;
  }

  // PATCH /api/:resource/:id - Partial update
  if (id && req.method === 'PATCH') {
    readJsonBody(req, MAX_JSON_SIZE).then(async (data) => {
      try {
        const updated = await database.update(resource, id, data);
        if (!updated) {
          json(404, { success: false, error: `${resource} not found` });
        } else {
          json(200, { success: true, data: updated });
        }
      } catch (error) {
        json(400, { success: false, error: error.message });
      }
    }).catch((err) => {
      json(400, { success: false, error: err.message });
    });
    return true;
  }

  // PUT /api/:resource/:id - Update record
  if (id && req.method === 'PUT') {
    readJsonBody(req, MAX_JSON_SIZE).then(async (data) => {
      try {
        const updated = await database.update(resource, id, data);
        if (!updated) {
          json(404, { success: false, error: `${resource} not found` });
        } else {
          json(200, { success: true, data: updated });
        }
      } catch (error) {
        json(400, { success: false, error: error.message });
      }
    }).catch((err) => {
      json(400, { success: false, error: err.message });
    });
    return true;
  }

  // DELETE /api/:resource/:id - Delete record
  if (id && req.method === 'DELETE') {
    try {
      const deleted = await database.remove(resource, id);
      if (!deleted) {
        json(404, { success: false, error: `${resource} not found` });
      } else {
        json(200, { success: true, message: `${resource} deleted` });
      }
    } catch (error) {
      json(500, { success: false, error: error.message });
    }
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  (async () => {
    // Add security headers to ALL responses
    addSecurityHeaders(req, res);
    
    // Log request
    console.log(`${req.method} ${req.url}`);

    if (await handleAuthRoutes(req, res)) {
      return;
    }

    // Handle documentation routes BEFORE auth check (public access for GET)
    if (await handleDocRoutes(req, res)) {
      return;
    }

    // Skip API auth for /uploads/* - handled separately in serveUploadedFile
    if (!req.url.startsWith('/uploads/') && !requireApiAuth(req, res)) {
      return;
    }

    if (await handleApiRoutes(req, res)) {
      return;
    }

    if (await handleKanbanRoutes(req, res)) {
      return;
    }

    if (await handleCrudRoutes(req, res)) {
      return;
    }

    if (handleUnmatchedApi(req, res)) {
      return;
    }

    serveStaticOrSpa(req, res);
  })().catch((err) => {
    console.error('[Server]', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: sanitizeError(err) }));
    }
  });
});

const INDEX_HTML = path.join(__dirname, 'index.html');

function sendIndexHtml(res) {
  fs.readFile(INDEX_HTML, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>500 Server Error</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
  });
}

function serveUploadedFile(req, res, urlPath) {
  // SECURITY: Require authentication for ALL uploaded files
  const user = auth.getUserFromRequest(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Authentication required to access files' }));
    return true;
  }
  
  const rel = urlPath.replace(/^\/uploads\//, '');
  const abs = uploadService.resolveUploadAbsolute(`/uploads/${rel}`);
  
  if (!abs || !fs.existsSync(abs)) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 Not Found</h1>');
    return true;
  }
  
  // SECURITY: Extract id_biodata from path and check authorization
  const pathParts = rel.split('/');
  const fileIdBiodata = pathParts[0]; // First part is id_biodata
  
  // Admin can access all files
  if (user.role !== 'admin') {
    // Non-admin users: verify they have permission to access this biodata
    // Check if user has access to this specific biodata
    // For now, allow all authenticated users (can be enhanced with ownership check)
    // TODO: Add ownership verification based on your business logic
  }
  
  // Log file access
  console.log(`[FILE ACCESS] User: ${user.email}, File: ${urlPath}, IP: ${req.socket.remoteAddress}`);
  
  const ext = path.extname(abs).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  // Add security headers for file responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="file${ext}"`);
  
  fs.readFile(abs, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>500 Server Error</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    if (req.method === 'HEAD') res.end();
    else res.end(content);
  });
  return true;
}

/** Path API tanpa query; trailing slash dihapus agar route cocok */
function apiPathname(req) {
  const p = req.url.split('?')[0];
  if (p.length > 1 && p.endsWith('/')) return p.replace(/\/+$/, '');
  return p;
}

/** API tidak dikenali — jangan jatuh ke static (HTML 405) */
function handleUnmatchedApi(req, res) {
  const pathname = apiPathname(req);
  if (!pathname.startsWith('/api/')) return false;

  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '*';
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    error: `Endpoint API tidak ditemukan: ${req.method} ${pathname}. Pastikan server di-restart setelah update (npm start).`
  }));
  return true;
}

function serveStaticOrSpa(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/html' });
    res.end('<h1>405 Method Not Allowed</h1>');
    return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // SECURITY: Handle /uploads/* BEFORE public static files
  if (urlPath.startsWith('/uploads/')) {
    // Files are now served without requireApiAuth check
    // Authentication is handled inside serveUploadedFile
    serveUploadedFile(req, res, urlPath);
    return;
  }

  const resolved = path.resolve(path.join(__dirname, urlPath));
  const root = path.resolve(__dirname);
  if (!resolved.startsWith(root)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 Forbidden</h1>');
    return;
  }

  fs.stat(resolved, (statErr, stat) => {
    if (!statErr && stat.isDirectory()) {
      sendIndexHtml(res);
      return;
    }

    fs.readFile(resolved, (readErr, content) => {
      if (readErr) {
        if (readErr.code === 'ENOENT') {
          // Route client-side (#/login, /dashboard, dll.) → kembalikan shell SPA
          const ext = path.extname(urlPath);
          if (!ext || ext === '.html') {
            sendIndexHtml(res);
            return;
          }
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 Not Found</h1>');
          return;
        }
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 Server Error</h1>');
        return;
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(content);
      }
    });
  });
}

// Initialize database before starting server (sql.js — async)
(async () => {
  ensureProjectDataDirs();
  await database.init();
  uploadService.ensureUploadRoot();
  try {
    printSuratService.syncProductionTemplates();
    printSuratService.ensureRecordPrintTemplates();
  } catch (e) {
    console.warn('[print-surat] sync template:', e.message);
  }
  buildPagesIndex();
  
  // Seed initial admin account if enabled
  if (process.env.SEED_ADMIN !== 'false') {
    const bcrypt = require('bcryptjs');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'gugus$123$';
    const adminRole = process.env.ADMIN_ROLE || 'admin';
    
    try {
      // Check if admin exists
      const existingUsers = await database.list('users', { filters: { email: adminEmail }, limit: 1 });
      
      if (!existingUsers || existingUsers.length === 0) {
        // Create admin account
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await database.create('users', {
          name: 'Administrator',
          email: adminEmail,
          password: hashedPassword,
          role: adminRole,
          status: 'active',
          phone: ''
        });
        
        console.log('');
        console.log('╔════════════════════════════════════════╗');
        console.log('║   Admin Account Created               ║');
        console.log('╚════════════════════════════════════════╝');
        console.log(`   Email:    ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
        console.log(`   Role:     ${adminRole}`);
        console.log('');
        console.log('⚠️  IMPORTANT: Change password after first login!');
        console.log('');
      } else {
        console.log('✔ Admin account already exists');
      }
    } catch (err) {
      console.error('✖ Failed to seed admin account:', err.message);
    }
  }

  server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET    /api/schema         - List all schemas`);
  console.log(`  GET    /api/schema/:name   - Get schema config`);
  console.log(`  POST   /api/schema         - Create schema`);
  console.log(`  PUT    /api/schema/:name   - Update schema`);
  console.log(`  DELETE /api/schema/:name   - Delete schema`);
  console.log(`  GET    /api/pages          - List all pages`);
  console.log(`  GET    /api/pages/:name    - Get page config`);
  console.log(`  POST   /api/pages          - Create page`);
  console.log(`  PUT    /api/pages/:name    - Update page`);
  console.log(`  DELETE /api/pages/:name    - Delete page`);
  console.log(`  --- Auth (JWT cookie) ---`);
  console.log(`  POST   /api/auth/login     - Login`);
  console.log(`  POST   /api/auth/logout    - Logout`);
  console.log(`  GET    /api/auth/me        - Session saat ini`);
  console.log(`  --- Dynamic CRUD (from schema) ---`);
  const tables = database.getTableNames();
  tables.forEach(t => {
    console.log(`  CRUD   /api/${t}           - ${t} (list, create, get, update, delete)`);
  });
  console.log(`  --- OCR Gemini ---`);
  console.log(`  GET    /api/ocr/status       - Cek GOOGLE_API_KEY + model aktif`);
  console.log(`  GET    /api/ocr/models       - Daftar model Gemini (API key ini)`);
  console.log(`  POST   /api/ocr/ktp          - OCR e-KTP (multipart field: image)`);
  console.log(`  --- Dokumen & biodata ---`);
  console.log(`  POST   /api/documents/personal-foto      - Upload foto personal`);
  console.log(`  DELETE /api/documents/personal-foto      - Hapus foto personal`);
  console.log(`  POST   /api/documents/dokumen-identitas  - Upload dokumen identitas`);
  console.log(`  POST   /api/documents/upload             - Upload hub (42 jenis)`);
  console.log(`  GET    /api/biodata/:id_biodata          - Detail biodata TKI`);
  console.log(`  --- Kanban ---`);
  console.log(`  GET    /api/deals/kanban     - Deals pipeline`);
  console.log(`  PATCH  /api/deals/:id/stage  - Move deal stage`);
  console.log(`  GET    /api/leads/kanban     - Leads pipeline`);
  console.log(`  PATCH  /api/leads/:id/status - Move lead status`);
  console.log(`  --- Documentation ---`);
  console.log(`  GET    /api/docs             - List all docs`);
  console.log(`  GET    /api/docs/:slug       - Get single doc`);
  console.log(`  GET    /api/docs/:slug/html  - Get doc as HTML`);
  console.log(`  POST   /api/docs             - Create doc (admin)`);
  console.log(`  PUT    /api/docs/:slug       - Update doc (admin)`);
  console.log(`  DELETE /api/docs/:slug       - Delete doc (admin)`);
  });
})().catch((err) => {
  console.error('[DB] Failed to initialize:', err);
  process.exit(1);
});
