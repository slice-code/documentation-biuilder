const fs = require('fs');
const path = require('path');
const DocRenderer = require('./doc-renderer');
const docImageService = require('./doc-image-service');

const DOCS_DIR = path.join(__dirname, '../docs');

/**
 * Konversi semua image block berisi data URI base64 menjadi file pada disk.
 * Memodifikasi `content.blocks` in-place dan mengembalikan jumlah konversi.
 */
function convertBase64ImagesToFiles(content) {
  if (!content || !Array.isArray(content.blocks)) return 0;
  let converted = 0;

  for (const block of content.blocks) {
    if (!block || block.type !== 'image' || !block.data) continue;

    const candidates = [
      ['url', block.data.url],
      ['file.url', block.data.file && block.data.file.url]
    ];

    for (const [field, value] of candidates) {
      if (!docImageService.isDataUri(value)) continue;
      try {
        const publicUrl = docImageService.saveBase64DataUri(value);
        if (field === 'url') {
          block.data.url = publicUrl;
        } else {
          block.data.file = { ...(block.data.file || {}), url: publicUrl };
        }
        if (!block.data.url && block.data.file && block.data.file.url) {
          block.data.url = block.data.file.url;
        }
        converted += 1;
      } catch (err) {
        console.warn('[doc-service] Gagal konversi base64 ke file:', err.message);
      }
    }
  }

  return converted;
}

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function mdPath(slug) {
  return path.join(DOCS_DIR, `${slug}.md`);
}

function parseMdFile(filePath, slugFromName) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { meta, body } = DocRenderer.parseFrontMatter(raw);
  const slug = meta.slug || slugFromName.replace(/\.md$/, '');
  const content = DocRenderer.markdownToBlocks(body);

  return {
    slug,
    title: meta.title || slug,
    category: meta.category || 'Guide',
    description: meta.description || '',
    createdAt: meta.createdAt || new Date().toISOString(),
    updatedAt: meta.updatedAt || meta.createdAt || new Date().toISOString(),
    markdown: body.trim(),
    content
  };
}

function writeMdFile(slug, title, contentBlocks, metadata = {}, existing = null) {
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt || now;
  const meta = {
    slug,
    title: title.trim(),
    category: metadata.category || existing?.category || 'Guide',
    description: metadata.description !== undefined ? metadata.description : (existing?.description || ''),
    createdAt,
    updatedAt: now
  };

  const markdownBody = DocRenderer.blocksToMarkdown(contentBlocks.blocks || contentBlocks);
  const fileContent = DocRenderer.buildFrontMatter(meta) + markdownBody;

  fs.writeFileSync(mdPath(slug), fileContent, 'utf-8');

  return {
    slug,
    title: meta.title,
    category: meta.category,
    description: meta.description,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    markdown: markdownBody,
    content: contentBlocks.blocks ? contentBlocks : { time: Date.now(), blocks: contentBlocks }
  };
}

class DocService {
  static async list() {
    try {
      const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'));
      const docs = files.map((file) => {
        const full = parseMdFile(path.join(DOCS_DIR, file), file);
        return {
          slug: full.slug,
          title: full.title,
          category: full.category || 'Uncategorized',
          description: full.description || '',
          createdAt: full.createdAt,
          updatedAt: full.updatedAt
        };
      });
      docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return docs;
    } catch (error) {
      throw new Error(`Failed to list documentation: ${error.message}`);
    }
  }

  static async getBySlug(slug) {
    try {
      if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Invalid slug format');
      }

      const filePath = mdPath(slug);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      return parseMdFile(filePath, `${slug}.md`);
    } catch (error) {
      if (error.message.includes('Invalid slug format')) {
        throw error;
      }
      throw new Error(`Failed to read documentation: ${error.message}`);
    }
  }

  static async create(slug, title, content, metadata = {}) {
    try {
      if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Invalid slug format. Use lowercase letters, numbers, and hyphens only.');
      }

      if (fs.existsSync(mdPath(slug))) {
        throw new Error(`Documentation with slug "${slug}" already exists`);
      }

      if (!title || !title.trim()) {
        throw new Error('Title is required');
      }

      if (!content || !content.blocks || !Array.isArray(content.blocks)) {
        throw new Error('Content with blocks is required');
      }

      const converted = convertBase64ImagesToFiles(content);
      if (converted > 0) {
        console.log(`[doc-service] create:${slug} → ${converted} base64 image dikonversi jadi file`);
      }

      return writeMdFile(slug, title, content, metadata, null);
    } catch (error) {
      if (
        error.message.includes('Invalid slug') ||
        error.message.includes('already exists') ||
        error.message.includes('required')
      ) {
        throw error;
      }
      throw new Error(`Failed to create documentation: ${error.message}`);
    }
  }

  static async update(slug, title, content, metadata = {}) {
    try {
      if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Invalid slug format');
      }

      const filePath = mdPath(slug);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Documentation with slug "${slug}" not found`);
      }

      const existing = parseMdFile(filePath, `${slug}.md`);

      if (!title || !title.trim()) {
        throw new Error('Title is required');
      }

      if (!content || !content.blocks || !Array.isArray(content.blocks)) {
        throw new Error('Content with blocks is required');
      }

      const converted = convertBase64ImagesToFiles(content);
      if (converted > 0) {
        console.log(`[doc-service] update:${slug} → ${converted} base64 image dikonversi jadi file`);
      }

      return writeMdFile(slug, title, content, metadata, existing);
    } catch (error) {
      if (
        error.message.includes('Invalid slug') ||
        error.message.includes('not found') ||
        error.message.includes('required')
      ) {
        throw error;
      }
      throw new Error(`Failed to update documentation: ${error.message}`);
    }
  }

  static async delete(slug) {
    try {
      if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Invalid slug format');
      }

      const filePath = mdPath(slug);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Documentation with slug "${slug}" not found`);
      }

      fs.unlinkSync(filePath);
      return { success: true, message: `Documentation "${slug}" deleted successfully` };
    } catch (error) {
      if (error.message.includes('Invalid slug') || error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to delete documentation: ${error.message}`);
    }
  }

  /** HTML + TOC untuk endpoint /api/docs/:slug/html */
  static async getRenderedHtml(slug) {
    const doc = await this.getBySlug(slug);
    if (!doc) return null;

    const html = DocRenderer.markdownToHtml(doc.markdown || '');
    const toc = DocRenderer.extractTOCFromMarkdown(doc.markdown || '');

    return {
      slug: doc.slug,
      title: doc.title,
      category: doc.category,
      description: doc.description,
      html,
      toc,
      updatedAt: doc.updatedAt
    };
  }
}

module.exports = DocService;
