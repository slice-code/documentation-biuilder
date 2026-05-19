/**
 * DocRenderer - Editor.js blocks <-> Markdown <-> HTML
 */

class DocRenderer {
  static generateId(text) {
    return String(text || '')
      .replace(/<[^>]+>/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  static escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text || '').replace(/[&<>"']/g, (m) => map[m]);
  }

  static stripHtml(text) {
    return String(text || '').replace(/<[^>]+>/g, '');
  }

  // --- Editor.js blocks -> Markdown ---

  static blocksToMarkdown(blocks) {
    if (!blocks || !Array.isArray(blocks)) return '';
    return blocks.map((block) => this.blockToMarkdown(block)).filter(Boolean).join('\n\n');
  }

  static blockToMarkdown(block) {
    if (!block || !block.type) return '';
    const data = block.data || {};

    switch (block.type) {
      case 'header': {
        const level = Math.min(Math.max(data.level || 1, 1), 6);
        const text = this.stripHtml(data.text || '');
        return `${'#'.repeat(level)} ${text}`;
      }
      case 'paragraph':
        return this.stripHtml(data.text || '');
      case 'code': {
        const lang = data.language || '';
        return '```' + lang + '\n' + (data.code || '') + '\n```';
      }
      case 'list': {
        const items = data.items || [];
        const ordered = data.style === 'ordered';
        return items
          .map((item, i) => {
            const t = this.stripHtml(typeof item === 'string' ? item : item.content || item);
            return ordered ? `${i + 1}. ${t}` : `- ${t}`;
          })
          .join('\n');
      }
      case 'quote': {
        const lines = (this.stripHtml(data.text || '') || '').split('\n');
        const quoted = lines.map((l) => `> ${l}`).join('\n');
        if (data.caption) return `${quoted}\n>\n> — ${this.stripHtml(data.caption)}`;
        return quoted;
      }
      case 'image': {
        const url = data.file?.url || data.url || '';
        const alt = data.alt || data.caption || '';
        const cap = data.caption ? `\n\n*${this.stripHtml(data.caption)}*` : '';
        return url ? `![${alt}](${url})${cap}` : '';
      }
      case 'table': {
        const rows = data.content || [];
        if (!rows.length) return '';
        const lines = rows.map((row, ri) => {
          const cells = row.map((c) => String(c || '').replace(/\|/g, '\\|'));
          const line = `| ${cells.join(' | ')} |`;
          if (ri === 0) {
            return line + '\n| ' + cells.map(() => '---').join(' | ') + ' |';
          }
          return line;
        });
        return lines.join('\n');
      }
      case 'divider':
        return '---';
      case 'embed':
        return data.embed ? `\n<!-- embed -->\n${data.embed}\n` : '';
      case 'cta': {
        const text = data.text || 'Click here';
        const url = data.url || '#';
        return `[${text}](${url})`;
      }
      case 'raw':
        return data.html || '';
      default:
        return '';
    }
  }

  // --- Markdown -> Editor.js blocks ---

  static markdownToBlocks(markdown) {
    const lines = String(markdown || '').split(/\r?\n/);
    const blocks = [];
    let i = 0;

    const pushParagraph = (text) => {
      const t = text.trim();
      if (t) blocks.push({ type: 'paragraph', data: { text: t } });
    };

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim() === '') {
        i += 1;
        continue;
      }

      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        blocks.push({
          type: 'header',
          data: { level: headerMatch[1].length, text: headerMatch[2].trim() }
        });
        i += 1;
        continue;
      }

      if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
        blocks.push({ type: 'divider', data: {} });
        i += 1;
        continue;
      }

      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim();
        i += 1;
        const codeLines = [];
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) i += 1;
        blocks.push({ type: 'code', data: { code: codeLines.join('\n'), language: lang } });
        continue;
      }

      if (line.trim().startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i += 1;
        }
        blocks.push({ type: 'quote', data: { text: quoteLines.join('\n'), caption: '' } });
        continue;
      }

      if (/^\|.+\|$/.test(line.trim())) {
        const tableRows = [];
        while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
          const row = lines[i]
            .trim()
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          const isSeparator = row.every((c) => /^:?-+:?$/.test(c));
          if (!isSeparator) tableRows.push(row);
          i += 1;
        }
        if (tableRows.length) {
          blocks.push({ type: 'table', data: { content: tableRows } });
        }
        continue;
      }

      const ulMatch = line.match(/^[-*+]\s+(.+)$/);
      if (ulMatch) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^[-*+]\s+(.+)$/);
          if (!m) break;
          items.push(m[1].trim());
          i += 1;
        }
        blocks.push({ type: 'list', data: { style: 'unordered', items } });
        continue;
      }

      const olMatch = line.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^\d+\.\s+(.+)$/);
          if (!m) break;
          items.push(m[1].trim());
          i += 1;
        }
        blocks.push({ type: 'list', data: { style: 'ordered', items } });
        continue;
      }

      const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        blocks.push({
          type: 'image',
          data: { url: imgMatch[2], alt: imgMatch[1], caption: '' }
        });
        i += 1;
        continue;
      }

      const paraLines = [line];
      i += 1;
      while (i < lines.length && lines[i].trim() !== '' && !this._isBlockStart(lines[i])) {
        paraLines.push(lines[i]);
        i += 1;
      }
      pushParagraph(paraLines.join('\n'));
    }

    if (!blocks.length) {
      blocks.push({ type: 'paragraph', data: { text: '' } });
    }

    return { time: Date.now(), blocks };
  }

  static _isBlockStart(line) {
    const t = line.trim();
    return (
      /^#{1,6}\s/.test(t) ||
      t.startsWith('```') ||
      t.startsWith('>') ||
      /^[-*+]\s/.test(t) ||
      /^\d+\.\s/.test(t) ||
      /^---+$/.test(t) ||
      /^\|.+\|$/.test(t) ||
      /^!\[/.test(t)
    );
  }

  // --- Markdown -> HTML (public viewer) ---

  static markdownToHtml(markdown) {
    const blocks = this.markdownToBlocks(markdown).blocks;
    return this.renderBlocks(blocks);
  }

  static renderBlocks(blocks) {
    if (!blocks || !Array.isArray(blocks)) return '';
    return blocks.map((block) => this.renderBlock(block)).join('\n');
  }

  static renderBlock(block) {
    if (!block || !block.type) return '';
    const data = block.data || {};

    switch (block.type) {
      case 'header':
        return this.renderHeader(data);
      case 'paragraph':
        return this.renderParagraph(data);
      case 'code':
        return this.renderCode(data);
      case 'list':
        return this.renderList(data);
      case 'quote':
        return this.renderQuote(data);
      case 'image':
        return this.renderImage(data);
      case 'table':
        return this.renderTable(data);
      case 'divider':
        return '<hr>';
      case 'embed':
        return this.renderEmbed(data);
      case 'cta': {
        const text = this.escapeHtml(data.text || 'Click here');
        const url = this.escapeHtml(data.url || '#');
        return `<p><a href="${url}" class="cta-button">${text}</a></p>`;
      }
      case 'raw':
        return data.html || '';
      default:
        return '';
    }
  }

  static renderHeader(data) {
    const level = Math.min(Math.max(data.level || 1, 1), 6);
    const text = this.escapeHtml(this.stripHtml(data.text || ''));
    const id = this.generateId(text);
    return `<h${level} id="${id}">${text}</h${level}>`;
  }

  static renderParagraph(data) {
    const text = String(data.text || '');
    return `<p>${text}</p>`;
  }

  static renderCode(data) {
    const language = data.language || 'plaintext';
    const code = this.escapeHtml(data.code || '');
    return `<pre><code class="language-${language}">${code}</code></pre>`;
  }

  static renderList(data) {
    const items = data.items || [];
    const tag = data.style === 'ordered' ? 'ol' : 'ul';
    const renderItem = (item) => {
      if (typeof item === 'string') return `<li>${item}</li>`;
      const content = item?.content || item?.text || '';
      const children = Array.isArray(item?.items) && item.items.length
        ? `<${tag}>${item.items.map(renderItem).join('')}</${tag}>`
        : '';
      return `<li>${content}${children}</li>`;
    };
    const itemsHtml = items.map(renderItem).join('');
    return `<${tag} class="doc-list doc-list-${data.style === 'ordered' ? 'ordered' : 'unordered'}">${itemsHtml}</${tag}>`;
  }

  static renderQuote(data) {
    let html = '<blockquote>';
    html += `<p>${data.text || ''}</p>`;
    if (data.caption) html += `<footer>${data.caption}</footer>`;
    html += '</blockquote>';
    return html;
  }

  static renderImage(data) {
    const url = data.file?.url || data.url || '';
    if (!url) return '';
    const alt = this.escapeHtml(data.alt || '');
    let html = '<figure>';
    html += `<img src="${url}" alt="${alt}" style="max-width: 100%; height: auto;">`;
    if (data.caption) html += `<figcaption>${data.caption}</figcaption>`;
    html += '</figure>';
    return html;
  }

  static renderTable(data) {
    const content = data.content || [];
    if (!content.length) return '';
    let html = '<table><thead><tr>';
    content[0].forEach((cell) => {
      html += `<th>${cell || ''}</th>`;
    });
    html += '</tr></thead>';
    if (content.length > 1) {
      html += '<tbody>';
      for (let i = 1; i < content.length; i++) {
        html += '<tr>';
        content[i].forEach((cell) => {
          html += `<td>${cell || ''}</td>`;
        });
        html += '</tr>';
      }
      html += '</tbody>';
    }
    html += '</table>';
    return html;
  }

  static renderEmbed(data) {
    const embed = data.embed || '';
    return embed ? `<div class="embed-container">${embed}</div>` : '';
  }

  static extractTOC(blocks) {
    if (!blocks || !Array.isArray(blocks)) return [];
    return blocks
      .filter((b) => b.type === 'header')
      .map((b) => ({
        id: this.generateId(this.stripHtml(b.data.text || '')),
        text: this.stripHtml(b.data.text || ''),
        level: b.data.level || 1
      }));
  }

  static extractTOCFromMarkdown(markdown) {
    return this.extractTOC(this.markdownToBlocks(markdown).blocks);
  }

  // --- Front matter ---

  static parseFrontMatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return { meta: {}, body: raw };
    }
    const meta = {};
    match[1].split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    });
    return { meta, body: match[2] };
  }

  static buildFrontMatter(meta) {
    const lines = ['---'];
    Object.entries(meta).forEach(([k, v]) => {
      const s = String(v == null ? '' : v);
      const needsQuote = /[:#\n"]/.test(s);
      lines.push(`${k}: ${needsQuote ? JSON.stringify(s) : s}`);
    });
    lines.push('---', '');
    return lines.join('\n');
  }
}

module.exports = DocRenderer;
