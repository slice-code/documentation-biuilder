/**
 * Call-to-Action (CTA) Block for Editor.js
 * Customizable CTA block with title, text, and button
 */

class CTABlock {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'CTA',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" stroke-width="2"/><path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 9l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
  }

  static get sanitize() {
    return {
      title: { br: true, b: true, i: true },
      text: { br: true, b: true, i: true, a: { href: true } },
      buttonText: {},
      buttonUrl: {},
      backgroundColor: {},
      textColor: {},
      alignment: {}
    };
  }

  constructor({ data, config, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      title: data.title || '',
      text: data.text || '',
      buttonText: data.buttonText || 'Click Here',
      buttonUrl: data.buttonUrl || '#',
      backgroundColor: data.backgroundColor || '#3b82f6',
      textColor: data.textColor || '#ffffff',
      alignment: data.alignment || 'center'
    };

    this.wrapper = null;
    this.titleElement = null;
    this.textElement = null;
    this.buttonElement = null;
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('cdx-cta-block');
    this.wrapper.style.cssText = `
      background: ${this.data.backgroundColor};
      color: ${this.data.textColor};
      padding: 24px;
      border-radius: 8px;
      text-align: ${this.data.alignment};
      margin: 16px 0;
    `;

    // Title
    this.titleElement = document.createElement('h3');
    this.titleElement.innerHTML = this.data.title || 'Special Offer!';
    this.titleElement.contentEditable = !this.readOnly;
    this.titleElement.style.cssText = `
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 12px;
      outline: none;
      color: inherit;
    `;
    this.titleElement.dataset.placeholder = 'Enter title...';

    // Body text
    this.textElement = document.createElement('p');
    this.textElement.innerHTML = this.data.text || 'Limited time deal. Don\'t miss out!';
    this.textElement.contentEditable = !this.readOnly;
    this.textElement.style.cssText = `
      font-size: 16px;
      margin-bottom: 16px;
      outline: none;
      color: inherit;
      line-height: 1.5;
    `;
    this.textElement.dataset.placeholder = 'Enter description...';

    // Button
    this.buttonElement = document.createElement('a');
    this.buttonElement.href = this.data.buttonUrl;
    this.buttonElement.target = '_blank';
    this.buttonElement.rel = 'noopener noreferrer';
    this.buttonElement.style.cssText = `
      display: inline-block;
      padding: 12px 28px;
      background: ${this.data.textColor};
      color: ${this.data.backgroundColor};
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
    this.buttonElement.innerHTML = this.data.buttonText;

    // Button click - open edit modal
    this.buttonElement.addEventListener('click', (e) => {
      if (!this.readOnly) {
        e.preventDefault();
        this.openButtonEditModal();
      }
    });

    this.wrapper.appendChild(this.titleElement);
    this.wrapper.appendChild(this.textElement);
    this.wrapper.appendChild(this.buttonElement);

    return this.wrapper;
  }

  save(blockContent) {
    return {
      title: this.titleElement.innerHTML,
      text: this.textElement.innerHTML,
      buttonText: this.data.buttonText,
      buttonUrl: this.data.buttonUrl,
      backgroundColor: this.data.backgroundColor,
      textColor: this.data.textColor,
      alignment: this.data.alignment
    };
  }

  renderSettings() {
    const colors = [
      { name: 'Blue', bg: '#3b82f6', text: '#ffffff' },
      { name: 'Green', bg: '#10b981', text: '#ffffff' },
      { name: 'Red', bg: '#ef4444', text: '#ffffff' },
      { name: 'Purple', bg: '#8b5cf6', text: '#ffffff' },
      { name: 'Orange', bg: '#f97316', text: '#ffffff' },
      { name: 'Dark', bg: '#1f2937', text: '#ffffff' }
    ];

    const alignmentOptions = [
      { name: 'left', icon: '⬅' },
      { name: 'center', icon: '⬌' },
      { name: 'right', icon: '➡' }
    ];

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding: 8px;';

    // Color section
    const colorSection = document.createElement('div');
    colorSection.innerHTML = '<div style="font-size: 12px; color: #999; margin-bottom: 8px;">Background Color</div>';
    
    const colorGrid = document.createElement('div');
    colorGrid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;';
    
    colors.forEach(color => {
      const btn = document.createElement('div');
      btn.style.cssText = `
        width: 30px;
        height: 30px;
        background: ${color.bg};
        border-radius: 4px;
        cursor: pointer;
        border: 2px solid ${this.data.backgroundColor === color.bg ? '#000' : 'transparent'};
      `;
      btn.title = color.name;
      btn.addEventListener('click', () => {
        this.setBackgroundColor(color.bg, color.text);
        // Update all borders
        colorGrid.querySelectorAll('div').forEach(el => el.style.border = '2px solid transparent');
        btn.style.border = '2px solid #000';
      });
      colorGrid.appendChild(btn);
    });
    
    colorSection.appendChild(colorGrid);
    wrapper.appendChild(colorSection);

    // Alignment section
    const alignSection = document.createElement('div');
    alignSection.style.marginTop = '12px';
    alignSection.innerHTML = '<div style="font-size: 12px; color: #999; margin-bottom: 8px;">Alignment</div>';
    
    const alignGrid = document.createElement('div');
    alignGrid.style.cssText = 'display: flex; gap: 8px;';
    
    alignmentOptions.forEach(align => {
      const btn = document.createElement('div');
      btn.style.cssText = `
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${this.data.alignment === align.name ? '#e0e0e0' : '#f5f5f5'};
        border-radius: 4px;
        cursor: pointer;
        font-size: 18px;
      `;
      btn.title = align.name;
      btn.innerHTML = align.icon;
      btn.addEventListener('click', () => {
        this.setAlignment(align.name);
        alignGrid.querySelectorAll('div').forEach(el => el.style.background = '#f5f5f5');
        btn.style.background = '#e0e0e0';
      });
      alignGrid.appendChild(btn);
    });
    
    alignSection.appendChild(alignGrid);
    wrapper.appendChild(alignSection);

    // Button Settings section
    const buttonSection = document.createElement('div');
    buttonSection.style.marginTop = '12px';
    buttonSection.innerHTML = '<div style="font-size: 12px; color: #999; margin-bottom: 8px;">Button Settings</div>';
    
    const editLinkBtn = document.createElement('button');
    editLinkBtn.type = 'button';
    editLinkBtn.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    editLinkBtn.innerHTML = `
      <span style="font-size: 16px;">🔗</span>
      <span>Edit Link & Text</span>
    `;
    editLinkBtn.addEventListener('click', () => {
      this.openButtonEditModal();
    });
    
    buttonSection.appendChild(editLinkBtn);
    wrapper.appendChild(buttonSection);

    return wrapper;
  }

  setBackgroundColor(bgColor, textColor) {
    this.data.backgroundColor = bgColor;
    this.data.textColor = textColor;
    
    this.wrapper.style.background = bgColor;
    this.wrapper.style.color = textColor;
    this.buttonElement.style.background = textColor;
    this.buttonElement.style.color = bgColor;
  }

  setAlignment(alignment) {
    this.data.alignment = alignment;
    this.wrapper.style.textAlign = alignment;
  }

  // ============================================
  // BUTTON EDIT MODAL
  // ============================================
  openButtonEditModal() {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 flex items-center justify-center z-50';
    modal.style.cssText = 'font-family: system-ui, -apple-system, sans-serif; background: rgba(0, 0, 0, 0.2);';
    
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center">
          <h2 class="text-lg font-semibold">Edit Button</h2>
          <button class="text-gray-500 hover:text-gray-700 text-2xl modal-close">&times;</button>
        </div>
        
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
            <input type="text" id="cta-button-text" value="${this.data.buttonText}" class="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Click Here" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Button URL</label>
            <input type="url" id="cta-button-url" value="${this.data.buttonUrl}" class="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://example.com" />
          </div>
        </div>
        
        <div class="p-4 border-t flex justify-end gap-2">
          <button class="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 modal-close">Cancel</button>
          <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 modal-save">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on first input
    modal.querySelector('#cta-button-text').focus();
    
    // Event listeners
    modal.addEventListener('click', (e) => {
      const target = e.target;
      
      // Close modal
      if (target.classList.contains('modal-close') || target === modal) {
        modal.remove();
        return;
      }
      
      // Save
      if (target.classList.contains('modal-save')) {
        const newText = modal.querySelector('#cta-button-text').value.trim();
        const newUrl = modal.querySelector('#cta-button-url').value.trim();
        
        if (newText) {
          this.data.buttonText = newText;
          this.buttonElement.innerHTML = newText;
        }
        
        if (newUrl) {
          this.data.buttonUrl = newUrl;
          this.buttonElement.href = newUrl;
        }
        
        modal.remove();
      }
    });
    
    // Close on Enter key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        modal.querySelector('.modal-save').click();
      }
      if (e.key === 'Escape') {
        modal.remove();
      }
    });
  }
}

// Expose to window for Editor.js
window.CTABlock = CTABlock;

// Export for ES modules
export { CTABlock };
