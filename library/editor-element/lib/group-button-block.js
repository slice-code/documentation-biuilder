/**
 * Group Button Block for Editor.js
 * Multiple buttons in a row/group with icons and grid layout support
 */

class GroupButtonBlock {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Group Button',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7" width="8" height="10" rx="2" stroke="currentColor" stroke-width="2"/><rect x="14" y="7" width="8" height="10" rx="2" stroke="currentColor" stroke-width="2"/></svg>'
    };
  }

  static get sanitize() {
    return {
      buttons: {
        text: {},
        url: {},
        style: {},
        icon: {},
        iconPosition: {}
      },
      alignment: {},
      gap: {},
      layout: {}
    };
  }

  // Available icons (Font Awesome)
  static get availableIcons() {
    return [
      { value: '', label: 'No Icon' },
      { value: 'fas fa-arrow-right', label: 'Arrow Right' },
      { value: 'fas fa-arrow-left', label: 'Arrow Left' },
      { value: 'fas fa-download', label: 'Download' },
      { value: 'fas fa-upload', label: 'Upload' },
      { value: 'fas fa-shopping-cart', label: 'Cart' },
      { value: 'fas fa-heart', label: 'Heart' },
      { value: 'fas fa-star', label: 'Star' },
      { value: 'fas fa-play', label: 'Play' },
      { value: 'fas fa-pause', label: 'Pause' },
      { value: 'fas fa-envelope', label: 'Email' },
      { value: 'fas fa-phone', label: 'Phone' },
      { value: 'fas fa-external-link-alt', label: 'External Link' },
      { value: 'fas fa-check', label: 'Check' },
      { value: 'fas fa-times', label: 'Close' },
      { value: 'fas fa-plus', label: 'Plus' },
      { value: 'fas fa-minus', label: 'Minus' },
      { value: 'fas fa-share', label: 'Share' },
      { value: 'fas fa-bookmark', label: 'Bookmark' },
      { value: 'fas fa-bell', label: 'Bell' },
      { value: 'fas fa-calendar', label: 'Calendar' },
      { value: 'fas fa-user', label: 'User' },
      { value: 'fas fa-home', label: 'Home' },
      { value: 'fas fa-search', label: 'Search' },
      { value: 'fas fa-cog', label: 'Settings' },
      { value: 'fas fa-globe', label: 'Globe' },
      { value: 'fab fa-github', label: 'GitHub' },
      { value: 'fab fa-twitter', label: 'Twitter' },
      { value: 'fab fa-facebook', label: 'Facebook' },
      { value: 'fab fa-instagram', label: 'Instagram' },
      { value: 'fab fa-linkedin', label: 'LinkedIn' },
      { value: 'fab fa-youtube', label: 'YouTube' }
    ];
  }

  constructor({ data, config, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      buttons: data.buttons || [
        { text: 'Button 1', url: '#', style: 'primary', icon: '', iconPosition: 'left', size: 'medium' },
        { text: 'Button 2', url: '#', style: 'secondary', icon: '', iconPosition: 'left', size: 'medium' }
      ],
      alignment: data.alignment || 'center',
      gap: data.gap || '12px',
      layout: data.layout || 'row'
    };

    this.wrapper = null;
    this.buttonElements = [];
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('cdx-group-button-block');
    
    // Apply layout styles
    if (this.data.layout === 'grid') {
      this.wrapper.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: ${this.data.gap};
        padding: 16px 0;
        margin: 16px 0;
      `;
    } else {
      this.wrapper.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: ${this.data.gap};
        justify-content: ${this.getJustifyContent(this.data.alignment)};
        align-items: center;
        padding: 16px 0;
        margin: 16px 0;
      `;
    }

    // Render buttons
    this.data.buttons.forEach((btn, index) => {
      const buttonEl = this.createButtonElement(btn, index);
      this.wrapper.appendChild(buttonEl);
      this.buttonElements.push(buttonEl);
    });

    // Add "Add Button" button if not readonly
    if (!this.readOnly) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'cdx-group-button-add';
      addBtn.innerHTML = '+ Add Button';
      addBtn.style.cssText = `
        padding: 10px 16px;
        background: #f3f4f6;
        border: 2px dashed #d1d5db;
        border-radius: 6px;
        color: #6b7280;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        ${this.data.layout === 'grid' ? 'grid-column: span 2;' : ''}
      `;
      addBtn.addEventListener('click', () => this.addButton());
      addBtn.addEventListener('mouseenter', () => {
        addBtn.style.borderColor = '#9ca3af';
        addBtn.style.color = '#374151';
      });
      addBtn.addEventListener('mouseleave', () => {
        addBtn.style.borderColor = '#d1d5db';
        addBtn.style.color = '#6b7280';
      });
      this.wrapper.appendChild(addBtn);
      this.addBtnElement = addBtn;
    }

    return this.wrapper;
  }

  createButtonElement(btnData, index) {
    const btn = document.createElement('a');
    btn.href = btnData.url || '#';
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.className = 'cdx-group-button-item';
    btn.dataset.index = index;
    
    // Apply button style and size
    const styles = this.getButtonStyles(btnData.style || 'primary');
    const sizeStyles = this.getButtonSizeStyles(btnData.size || 'medium');
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 6px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
      ${sizeStyles}
      ${this.data.layout === 'grid' ? 'width: 100%; text-align: center;' : ''}
      ${styles}
    `;

    // Build button content with icon
    let content = '';
    const icon = btnData.icon || '';
    const iconPosition = btnData.iconPosition || 'left';
    const text = btnData.text || 'Button';
    
    if (icon) {
      if (iconPosition === 'right') {
        content = `${text} <i class="${icon}"></i>`;
      } else {
        content = `<i class="${icon}"></i> ${text}`;
      }
    } else {
      content = text;
    }
    
    btn.innerHTML = content;

    // Click handler - open edit modal
    btn.addEventListener('click', (e) => {
      if (!this.readOnly) {
        e.preventDefault();
        this.openEditModal(index);
      }
    });

    return btn;
  }

  getButtonStyles(style) {
    const stylePresets = {
      primary: `
        background: #3b82f6;
        color: #ffffff;
        border: 2px solid #3b82f6;
      `,
      secondary: `
        background: transparent;
        color: #3b82f6;
        border: 2px solid #3b82f6;
      `,
      success: `
        background: #10b981;
        color: #ffffff;
        border: 2px solid #10b981;
      `,
      danger: `
        background: #ef4444;
        color: #ffffff;
        border: 2px solid #ef4444;
      `,
      warning: `
        background: #f59e0b;
        color: #ffffff;
        border: 2px solid #f59e0b;
      `,
      dark: `
        background: #1f2937;
        color: #ffffff;
        border: 2px solid #1f2937;
      `,
      outline: `
        background: transparent;
        color: #1f2937;
        border: 2px solid #1f2937;
      `
    };

    return stylePresets[style] || stylePresets.primary;
  }

  getButtonSizeStyles(size) {
    const sizePresets = {
      small: `
        padding: 8px 16px;
        font-size: 13px;
      `,
      medium: `
        padding: 12px 24px;
        font-size: 15px;
      `,
      large: `
        padding: 16px 32px;
        font-size: 17px;
      `
    };
    return sizePresets[size] || sizePresets.medium;
  }

  getJustifyContent(alignment) {
    const alignments = {
      left: 'flex-start',
      center: 'center',
      right: 'flex-end'
    };
    return alignments[alignment] || 'center';
  }

  addButton() {
    const newButton = { text: 'New Button', url: '#', style: 'primary', icon: '', iconPosition: 'left', size: 'medium' };
    this.data.buttons.push(newButton);
    this.renderButtons();

    // Open edit modal for the new button
    this.openEditModal(this.data.buttons.length - 1);
  }



  removeButton(index) {
    if (this.data.buttons.length <= 1) {
      alert('Must have at least one button');
      return;
    }

    this.data.buttons.splice(index, 1);
    this.renderButtons();
  }

  renderButtons() {
    // Clear existing buttons
    this.wrapper.innerHTML = '';
    this.buttonElements = [];

    // Re-render all buttons
    this.data.buttons.forEach((btn, index) => {
      const buttonEl = this.createButtonElement(btn, index);
      this.wrapper.appendChild(buttonEl);
      this.buttonElements.push(buttonEl);
    });

    // Re-add the add button
    if (!this.readOnly) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'cdx-group-button-add';
      addBtn.innerHTML = '+ Add Button';
      addBtn.style.cssText = `
        padding: 10px 16px;
        background: #f3f4f6;
        border: 2px dashed #d1d5db;
        border-radius: 6px;
        color: #6b7280;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        ${this.data.layout === 'grid' ? 'grid-column: span 2;' : ''}
      `;
      addBtn.addEventListener('click', () => this.addButton());
      addBtn.addEventListener('mouseenter', () => {
        addBtn.style.borderColor = '#9ca3af';
        addBtn.style.color = '#374151';
      });
      addBtn.addEventListener('mouseleave', () => {
        addBtn.style.borderColor = '#d1d5db';
        addBtn.style.color = '#6b7280';
      });
      this.wrapper.appendChild(addBtn);
      this.addBtnElement = addBtn;
    }
  }

  save(blockContent) {
    return {
      buttons: this.data.buttons,
      alignment: this.data.alignment,
      gap: this.data.gap,
      layout: this.data.layout
    };
  }

  renderSettings() {
    const alignmentOptions = [
      { name: 'left', icon: '⬅' },
      { name: 'center', icon: '⬌' },
      { name: 'right', icon: '➡' }
    ];

    const gapOptions = [
      { name: 'S', value: '8px', title: 'Small' },
      { name: 'M', value: '12px', title: 'Medium' },
      { name: 'L', value: '20px', title: 'Large' }
    ];

    const layoutOptions = [
      { name: 'row', icon: '↔', title: 'Row Layout' },
      { name: 'grid', icon: '⊞', title: 'Grid Layout' }
    ];

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding: 8px;';

    // Layout section
    const layoutSection = document.createElement('div');
    layoutSection.style.marginBottom = '12px';
    
    const layoutLabel = document.createElement('div');
    layoutLabel.style.cssText = 'font-size: 10px; color: #6b7280; margin-bottom: 6px; font-weight: 500;';
    layoutLabel.textContent = 'LAYOUT';
    layoutSection.appendChild(layoutLabel);
    
    const layoutGrid = document.createElement('div');
    layoutGrid.style.cssText = 'display: flex; gap: 4px;';
    
    layoutOptions.forEach(layout => {
      const btn = document.createElement('div');
      const isActive = this.data.layout === layout.name;
      btn.style.cssText = `
        flex: 1;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isActive ? '#3b82f6' : '#f3f4f6'};
        color: ${isActive ? '#fff' : '#374151'};
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.15s;
      `;
      btn.title = layout.title;
      btn.innerHTML = layout.icon;
      btn.addEventListener('click', () => {
        this.setLayout(layout.name);
        layoutGrid.querySelectorAll('div').forEach(el => {
          el.style.background = '#f3f4f6';
          el.style.color = '#374151';
        });
        btn.style.background = '#3b82f6';
        btn.style.color = '#fff';
      });
      layoutGrid.appendChild(btn);
    });
    
    layoutSection.appendChild(layoutGrid);
    wrapper.appendChild(layoutSection);

    // Alignment section
    const alignSection = document.createElement('div');
    alignSection.style.marginBottom = '12px';
    
    const alignLabel = document.createElement('div');
    alignLabel.style.cssText = 'font-size: 10px; color: #6b7280; margin-bottom: 6px; font-weight: 500;';
    alignLabel.textContent = 'ALIGNMENT';
    alignSection.appendChild(alignLabel);
    
    const alignGrid = document.createElement('div');
    alignGrid.style.cssText = 'display: flex; gap: 4px;';
    
    alignmentOptions.forEach(align => {
      const btn = document.createElement('div');
      const isActive = this.data.alignment === align.name;
      btn.style.cssText = `
        flex: 1;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isActive ? '#3b82f6' : '#f3f4f6'};
        color: ${isActive ? '#fff' : '#374151'};
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.15s;
      `;
      btn.title = align.name;
      btn.innerHTML = align.icon;
      btn.addEventListener('click', () => {
        this.setAlignment(align.name);
        alignGrid.querySelectorAll('div').forEach(el => {
          el.style.background = '#f3f4f6';
          el.style.color = '#374151';
        });
        btn.style.background = '#3b82f6';
        btn.style.color = '#fff';
      });
      alignGrid.appendChild(btn);
    });
    
    alignSection.appendChild(alignGrid);
    wrapper.appendChild(alignSection);

    // Gap section
    const gapSection = document.createElement('div');
    
    const gapLabel = document.createElement('div');
    gapLabel.style.cssText = 'font-size: 10px; color: #6b7280; margin-bottom: 6px; font-weight: 500;';
    gapLabel.textContent = 'BUTTON GAP';
    gapSection.appendChild(gapLabel);
    
    const gapGrid = document.createElement('div');
    gapGrid.style.cssText = 'display: flex; gap: 4px;';
    
    gapOptions.forEach(gap => {
      const btn = document.createElement('div');
      const isActive = this.data.gap === gap.value;
      btn.style.cssText = `
        flex: 1;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isActive ? '#3b82f6' : '#f3f4f6'};
        color: ${isActive ? '#fff' : '#374151'};
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.15s;
      `;
      btn.title = gap.title;
      btn.innerHTML = gap.name;
      btn.addEventListener('click', () => {
        this.setGap(gap.value);
        gapGrid.querySelectorAll('div').forEach(el => {
          el.style.background = '#f3f4f6';
          el.style.color = '#374151';
        });
        btn.style.background = '#3b82f6';
        btn.style.color = '#fff';
      });
      gapGrid.appendChild(btn);
    });
    
    gapSection.appendChild(gapGrid);
    wrapper.appendChild(gapSection);

    return wrapper;
  }

  setLayout(layout) {
    this.data.layout = layout;
    
    // Update wrapper styles without replacing
    if (this.data.layout === 'grid') {
      this.wrapper.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: ${this.data.gap};
        padding: 16px 0;
        margin: 16px 0;
      `;
    } else {
      this.wrapper.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: ${this.data.gap};
        justify-content: ${this.getJustifyContent(this.data.alignment)};
        align-items: center;
        padding: 16px 0;
        margin: 16px 0;
      `;
    }
    
    // Re-render buttons to apply layout changes
    this.renderButtons();
  }

  setAlignment(alignment) {
    this.data.alignment = alignment;
    if (this.data.layout === 'row') {
      this.wrapper.style.justifyContent = this.getJustifyContent(alignment);
    }
  }

  setGap(gap) {
    this.data.gap = gap;
    this.wrapper.style.gap = gap;
  }

  // ============================================
  // BUTTON EDIT MODAL
  // ============================================
  openEditModal(index) {
    const btnData = this.data.buttons[index];
    const icons = GroupButtonBlock.availableIcons;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'cdx-group-button-modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
      background: rgba(0, 0, 0, 0.5);
    `;
    
    modal.innerHTML = `
      <div class="cdx-group-button-modal" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 400px; overflow: hidden; margin: 16px;">
        <div style="padding: 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 18px; font-weight: 600; margin: 0;">Edit Button</h2>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; color: #9ca3af; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
        </div>
        
        <div style="padding: 16px;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Button Text</label>
            <input type="text" id="btn-text" value="${btnData.text || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; box-sizing: border-box;" placeholder="Button Text" />
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Button URL</label>
            <input type="url" id="btn-url" value="${btnData.url || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; box-sizing: border-box;" placeholder="https://example.com" />
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Button Style</label>
            <select id="btn-style" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; background: white; box-sizing: border-box;">
              <option value="primary" ${btnData.style === 'primary' ? 'selected' : ''}>Primary (Blue)</option>
              <option value="secondary" ${btnData.style === 'secondary' ? 'selected' : ''}>Secondary (Outline Blue)</option>
              <option value="success" ${btnData.style === 'success' ? 'selected' : ''}>Success (Green)</option>
              <option value="danger" ${btnData.style === 'danger' ? 'selected' : ''}>Danger (Red)</option>
              <option value="warning" ${btnData.style === 'warning' ? 'selected' : ''}>Warning (Orange)</option>
              <option value="dark" ${btnData.style === 'dark' ? 'selected' : ''}>Dark (Black)</option>
              <option value="outline" ${btnData.style === 'outline' ? 'selected' : ''}>Outline (Black)</option>
            </select>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Button Size</label>
            <select id="btn-size" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; background: white; box-sizing: border-box;">
              <option value="small" ${btnData.size === 'small' ? 'selected' : ''}>Small</option>
              <option value="medium" ${btnData.size === 'medium' || !btnData.size ? 'selected' : ''}>Medium</option>
              <option value="large" ${btnData.size === 'large' ? 'selected' : ''}>Large</option>
            </select>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Icon</label>
            <select id="btn-icon" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; background: white; box-sizing: border-box;">
              ${icons.map(icon => `<option value="${icon.value}" ${btnData.icon === icon.value ? 'selected' : ''}>${icon.label}</option>`).join('')}
            </select>
          </div>
          
          <div style="margin-bottom: 0;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Icon Position</label>
            <select id="btn-icon-position" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; background: white; box-sizing: border-box;">
              <option value="left" ${btnData.iconPosition === 'left' ? 'selected' : ''}>Left (Icon before text)</option>
              <option value="right" ${btnData.iconPosition === 'right' ? 'selected' : ''}>Right (Icon after text)</option>
            </select>
          </div>
        </div>
        
        <div style="padding: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
          <button class="modal-delete" style="padding: 8px 16px; background: #fef2f2; color: #dc2626; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Delete Button</button>
          <div style="display: flex; gap: 8px;">
            <button class="modal-close" style="padding: 8px 16px; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Cancel</button>
            <button class="modal-save" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Save</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on first input
    setTimeout(() => {
      const textInput = modal.querySelector('#btn-text');
      if (textInput) textInput.focus();
    }, 0);
    
    // Close modal function
    const closeModal = () => {
      if (modal.parentElement) {
        modal.remove();
      }
    };
    
    // Event listeners
    modal.addEventListener('click', (e) => {
      const target = e.target;
      
      // Close modal
      if (target.classList.contains('modal-close')) {
        closeModal();
        return;
      }
      
      // Click on overlay (not modal content)
      if (target === modal) {
        closeModal();
        return;
      }
      
      // Save
      if (target.classList.contains('modal-save')) {
        const newText = modal.querySelector('#btn-text').value.trim();
        const newUrl = modal.querySelector('#btn-url').value.trim();
        const newStyle = modal.querySelector('#btn-style').value;
        const newSize = modal.querySelector('#btn-size').value;
        const newIcon = modal.querySelector('#btn-icon').value;
        const newIconPosition = modal.querySelector('#btn-icon-position').value;
        
        if (newText) {
          this.data.buttons[index].text = newText;
          this.data.buttons[index].url = newUrl || '#';
          this.data.buttons[index].style = newStyle;
          this.data.buttons[index].size = newSize;
          this.data.buttons[index].icon = newIcon;
          this.data.buttons[index].iconPosition = newIconPosition;
          this.renderButtons();
        } else {
          alert('Button text is required');
          return;
        }
        
        closeModal();
      }
      
      // Delete button
      if (target.classList.contains('modal-delete')) {
        this.removeButton(index);
        closeModal();
      }
    });
    
    // Close on Enter key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const saveBtn = modal.querySelector('.modal-save');
        if (saveBtn) saveBtn.click();
      }
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }
}

// Expose to window for Editor.js
window.GroupButtonBlock = GroupButtonBlock;

// Export for ES modules
export { GroupButtonBlock };
