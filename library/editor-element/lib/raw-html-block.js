/**
 * Raw HTML Block for Editor.js
 * Allows users to input and embed raw HTML code
 */

class RawHtmlBlock {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'HTML',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4V4z" stroke="currentColor" stroke-width="2"/><path d="M8 8l-2 2 2 2M16 8l2 2-2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 6l-4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    };
  }

  static get sanitize() {
    return {
      html: true, // Allow raw HTML
      caption: {
        br: true
      }
    };
  }

  constructor({ data, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      html: data.html || '',
      caption: data.caption || ''
    };

    this.wrapper = null;
    this.textarea = null;
    this.previewContainer = null;
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('raw-html-block');

    if (!this.readOnly) {
      // Input section
      const inputSection = document.createElement('div');
      inputSection.style.cssText = `
        margin-bottom: 12px;
      `;

      // Label
      const label = document.createElement('div');
      label.style.cssText = `
        font-size: 12px;
        color: #9ca3af;
        margin-bottom: 8px;
        font-weight: 500;
      `;
      label.textContent = 'Paste HTML embed code (iframe, script, etc.):';
      inputSection.appendChild(label);

      // Textarea for HTML input
      this.textarea = document.createElement('textarea');
      this.textarea.value = this.data.html;
      this.textarea.placeholder = '<iframe src="..." ...></iframe>\n<script>...</script>';
      this.textarea.style.cssText = `
        width: 100%;
        min-height: 120px;
        padding: 12px;
        border: 1px solid #374151;
        border-radius: 6px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 13px;
        background: #1e1e1e;
        color: #d4d4d4;
        resize: vertical;
        outline: none;
        line-height: 1.5;
      `;
      this.textarea.spellcheck = false;

      // Preview button
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        margin-top: 8px;
      `;

      const previewBtn = document.createElement('button');
      previewBtn.textContent = 'Preview';
      previewBtn.style.cssText = `
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        background: #3b82f6;
        color: white;
        cursor: pointer;
        font-weight: 500;
      `;

      const clearBtn = document.createElement('button');
      clearBtn.textContent = 'Clear';
      clearBtn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #374151;
        border-radius: 4px;
        font-size: 14px;
        background: transparent;
        color: #9ca3af;
        cursor: pointer;
      `;

      previewBtn.addEventListener('click', () => {
        this.data.html = this.textarea.value.trim();
        this._showPreview();
      });

      clearBtn.addEventListener('click', () => {
        this.textarea.value = '';
        this.data.html = '';
        if (this.previewContainer) {
          this.previewContainer.innerHTML = '';
          this.previewContainer.style.display = 'none';
        }
      });

      buttonContainer.appendChild(previewBtn);
      buttonContainer.appendChild(clearBtn);

      inputSection.appendChild(this.textarea);
      inputSection.appendChild(buttonContainer);
      this.wrapper.appendChild(inputSection);
    }

    // Preview container
    this.previewContainer = document.createElement('div');
    this.previewContainer.classList.add('raw-html-preview');
    this.previewContainer.style.cssText = `
      margin-top: 12px;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f5f5;
    `;
    this.wrapper.appendChild(this.previewContainer);

    // Caption input
    if (!this.readOnly) {
      const captionLabel = document.createElement('div');
      captionLabel.style.cssText = `
        font-size: 12px;
        color: #9ca3af;
        margin: 12px 0 4px 0;
      `;
      captionLabel.textContent = 'Caption (optional):';
      this.wrapper.appendChild(captionLabel);

      const captionInput = document.createElement('input');
      captionInput.type = 'text';
      captionInput.value = this.data.caption;
      captionInput.placeholder = 'Add caption...';
      captionInput.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #374151;
        border-radius: 4px;
        font-size: 14px;
        background: #1e1e1e;
        color: #d4d4d4;
        outline: none;
      `;
      captionInput.addEventListener('input', (e) => {
        this.data.caption = e.target.value;
      });
      this.wrapper.appendChild(captionInput);
    }

    // Show preview if HTML exists
    if (this.data.html) {
      this._showPreview();
    }

    return this.wrapper;
  }

  _showPreview() {
    if (!this.data.html) {
      this.previewContainer.style.display = 'none';
      return;
    }

    this.previewContainer.style.display = 'block';
    this.previewContainer.innerHTML = this.data.html;

    // Re-execute scripts in the preview
    const scripts = this.previewContainer.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  save() {
    return {
      html: this.data.html,
      caption: this.data.caption
    };
  }

  static get pasteConfig() {
    return {
      tags: ['iframe', 'script', 'div', 'blockquote', 'pre'],
    };
  }

  onPaste(event) {
    if (event.type === 'tag') {
      const element = event.detail.data;
      this.data.html = element.outerHTML;
      if (this.textarea) {
        this.textarea.value = this.data.html;
      }
      this._showPreview();
    }
  }
}

// Expose to window for Editor.js
window.RawHtmlBlock = RawHtmlBlock;

// Export for ES modules
export { RawHtmlBlock };
