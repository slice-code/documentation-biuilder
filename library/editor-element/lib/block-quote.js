/**
 * Custom Block Quote Tool for Editor.js
 * Beautiful quote block with author attribution
 */
class BlockQuote {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Quote',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h6v6H4z" fill="currentColor"/><path d="M14 6h6v6h-6z" fill="currentColor"/><path d="M4 16h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    };
  }

  static get sanitize() {
    return {
      text: {
        br: true,
        b: true,
        i: true,
        a: { href: true }
      },
      author: {},
      source: {}
    };
  }

  static get conversionConfig() {
    return {
      export: (data) => {
        return data.text;
      },
      import: (text) => {
        return {
          text: text,
          author: '',
          source: ''
        };
      }
    };
  }

  constructor({ data, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      text: data.text || '',
      author: data.author || '',
      source: data.source || ''
    };
    
    this._isDestroyed = false;
  }

  render() {
    // Main wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('block-quote-wrapper');
    this.wrapper.style.margin = '16px 0';
    this.wrapper.style.padding = '20px 24px';
    this.wrapper.style.borderLeft = '4px solid #3b82f6';
    this.wrapper.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
    this.wrapper.style.borderRadius = '0 8px 8px 0';
    this.wrapper.style.position = 'relative';
    
    // Quote icon (decorative)
    const quoteIcon = document.createElement('div');
    quoteIcon.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" fill="#3b82f6" opacity="0.2"/></svg>';
    quoteIcon.style.position = 'absolute';
    quoteIcon.style.top = '12px';
    quoteIcon.style.right = '16px';
    this.wrapper.appendChild(quoteIcon);
    
    // Quote text
    this.quoteText = document.createElement('div');
    this.quoteText.contentEditable = !this.readOnly;
    this.quoteText.innerHTML = this.data.text;
    this.quoteText.style.fontSize = '18px';
    this.quoteText.style.lineHeight = '1.7';
    this.quoteText.style.color = '#1e293b';
    this.quoteText.style.fontStyle = 'italic';
    this.quoteText.style.outline = 'none';
    this.quoteText.style.marginBottom = '12px';
    this.quoteText.style.minHeight = '24px';
    this.quoteText.setAttribute('data-placeholder', 'Enter quote...');
    
    // Placeholder styles
    const placeholderStyle = document.createElement('style');
    placeholderStyle.textContent = `
      .block-quote-wrapper [contenteditable]:empty:before {
        content: attr(data-placeholder);
        color: #94a3b8;
        font-style: italic;
        pointer-events: none;
      }
    `;
    this.wrapper.appendChild(placeholderStyle);
    this.wrapper.appendChild(this.quoteText);
    
    // Author and source container
    const attributionContainer = document.createElement('div');
    attributionContainer.style.display = 'flex';
    attributionContainer.style.alignItems = 'center';
    attributionContainer.style.gap = '8px';
    attributionContainer.style.fontSize = '14px';
    attributionContainer.style.color = '#64748b';
    
    // Em dash separator
    const emDash = document.createElement('span');
    emDash.textContent = '—';
    emDash.style.color = '#3b82f6';
    attributionContainer.appendChild(emDash);
    
    // Author input
    this.authorInput = document.createElement('div');
    this.authorInput.contentEditable = !this.readOnly;
    this.authorInput.innerHTML = this.data.author;
    this.authorInput.style.outline = 'none';
    this.authorInput.style.minWidth = '50px';
    this.authorInput.style.fontWeight = '500';
    this.authorInput.setAttribute('data-placeholder', 'Author');
    attributionContainer.appendChild(this.authorInput);
    
    // Source separator (only show if both author and source exist)
    this.sourceSeparator = document.createElement('span');
    this.sourceSeparator.textContent = ',';
    this.sourceSeparator.style.display = this.data.author && this.data.source ? 'inline' : 'none';
    attributionContainer.appendChild(this.sourceSeparator);
    
    // Source input
    this.sourceInput = document.createElement('div');
    this.sourceInput.contentEditable = !this.readOnly;
    this.sourceInput.innerHTML = this.data.source;
    this.sourceInput.style.outline = 'none';
    this.sourceInput.style.minWidth = '50px';
    this.sourceInput.style.fontStyle = 'italic';
    this.sourceInput.setAttribute('data-placeholder', 'Source');
    attributionContainer.appendChild(this.sourceInput);
    
    this.wrapper.appendChild(attributionContainer);
    
    // Update separator visibility on input
    if (!this.readOnly) {
      this.authorInput.addEventListener('input', () => {
        this._updateSeparator();
      });
      this.sourceInput.addEventListener('input', () => {
        this._updateSeparator();
      });
    }
    
    return this.wrapper;
  }

  /**
   * Update source separator visibility
   */
  _updateSeparator() {
    const hasAuthor = this.authorInput.textContent.trim().length > 0;
    const hasSource = this.sourceInput.textContent.trim().length > 0;
    this.sourceSeparator.style.display = (hasAuthor && hasSource) ? 'inline' : 'none';
  }

  save() {
    return {
      text: this.quoteText.innerHTML,
      author: this.authorInput.textContent || '',
      source: this.sourceInput.textContent || ''
    };
  }

  /**
   * Clean up when block is destroyed
   */
  destroy() {
    this._isDestroyed = true;
  }

  static get pasteConfig() {
    return {
      tags: ['BLOCKQUOTE', 'Q']
    };
  }

  onPaste(event) {
    const content = event.detail.data;
    
    // Try to extract quote text
    let text = '';
    let author = '';
    let source = '';
    
    if (content.tagName === 'BLOCKQUOTE' || content.tagName === 'Q') {
      // Check for cite attribute
      if (content.hasAttribute('cite')) {
        source = content.getAttribute('cite');
      }
      
      // Get text content
      text = content.innerHTML;
      
      // Try to find citation or author
      const cite = content.querySelector('cite');
      if (cite) {
        author = cite.textContent;
        cite.remove();
        text = content.innerHTML;
      }
    }
    
    this.data = { text, author, source };
    
    if (this.quoteText) {
      this.quoteText.innerHTML = text;
    }
    if (this.authorInput) {
      this.authorInput.textContent = author;
    }
    if (this.sourceInput) {
      this.sourceInput.textContent = source;
    }
    this._updateSeparator();
  }

  /**
   * Render settings for block tune menu
   */
  renderSettings() {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '4px';
    wrapper.style.padding = '4px';
    
    // Style options
    const styles = [
      { name: 'default', icon: '≡', label: 'Default' },
      { name: 'highlight', icon: '★', label: 'Highlight' },
      { name: 'minimal', icon: '—', label: 'Minimal' }
    ];
    
    styles.forEach(style => {
      const button = document.createElement('div');
      button.textContent = style.icon;
      button.style.padding = '4px 8px';
      button.style.fontSize = '14px';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.background = '#f3f4f6';
      button.style.color = '#374151';
      button.style.transition = 'all 0.15s ease';
      button.title = style.label;
      
      button.addEventListener('click', () => {
        this._applyStyle(style.name);
        // Update button styles
        wrapper.querySelectorAll('div').forEach(btn => {
          btn.style.background = '#f3f4f6';
          btn.style.color = '#374151';
        });
        button.style.background = '#3b82f6';
        button.style.color = '#fff';
      });
      
      button.addEventListener('mouseenter', () => {
        if (button.style.background !== 'rgb(59, 130, 246)') {
          button.style.background = '#e5e7eb';
        }
      });
      
      button.addEventListener('mouseleave', () => {
        if (button.style.background !== 'rgb(59, 130, 246)') {
          button.style.background = '#f3f4f6';
        }
      });
      
      wrapper.appendChild(button);
    });
    
    return wrapper;
  }

  /**
   * Apply different quote styles
   */
  _applyStyle(styleName) {
    switch (styleName) {
      case 'highlight':
        this.wrapper.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
        this.wrapper.style.borderLeftColor = '#2563eb';
        break;
      case 'minimal':
        this.wrapper.style.background = 'transparent';
        this.wrapper.style.borderLeftColor = '#94a3b8';
        this.wrapper.style.padding = '12px 16px';
        break;
      default:
        this.wrapper.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
        this.wrapper.style.borderLeftColor = '#3b82f6';
        this.wrapper.style.padding = '20px 24px';
    }
  }
}

// Expose to window for Editor.js
window.BlockQuote = BlockQuote;

// Export for ES modules
export { BlockQuote };
