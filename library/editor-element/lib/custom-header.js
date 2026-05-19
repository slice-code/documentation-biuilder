/**
 * Custom Header Tool for Editor.js
 * Supports H1-H6 with custom classes
 */
class CustomHeader {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Heading',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4V20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4V20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    };
  }

  static get conversionConfig() {
    return {
      export: 'text',
      import: 'text'
    };
  }

  static get sanitize() {
    return {
      level: {},
      text: {
        br: true
      }
    };
  }

  static get pasteConfig() {
    return {
      tags: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']
    };
  }

  static get levels() {
    return [
      { number: 1, tag: 'H1', class: 'heading-h1 text-4xl font-bold' },
      { number: 2, tag: 'H2', class: 'heading-h2 text-3xl font-semibold' },
      { number: 3, tag: 'H3', class: 'heading-h3 text-2xl font-medium' },
      { number: 4, tag: 'H4', class: 'heading-h4 text-xl font-medium' },
      { number: 5, tag: 'H5', class: 'heading-h5 text-lg font-normal' },
      { number: 6, tag: 'H6', class: 'heading-h6 text-base font-normal' }
    ];
  }

  constructor({ data, config, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    
    this._CSS = {
      block: this.api.styles.block,
      wrapper: 'ce-header'
    };

    this._settings = CustomHeader.levels;
    this._data = this.normalizeData(data);
    this._element = this.getTag();
  }

  normalizeData(data) {
    const defaultLevel = this._settings[1]; // Default to H2
    
    return {
      text: data.text || '',
      level: parseInt(data.level) || defaultLevel.number
    };
  }

  render() {
    return this._element;
  }

  renderSettings() {
    return this._settings.map(level => ({
      icon: `<span style="font-size: 14px; font-weight: bold;">H${level.number}</span>`,
      label: `Heading ${level.number}`,
      onActivate: () => this.setLevel(level.number),
      closeOnActivate: true,
      isActive: this._data.level === level.number
    }));
  }

  setLevel(level) {
    this._data.level = level;
    
    // Replace the element with new level
    const newElement = this.getTag();
    this._element.replaceWith(newElement);
    this._element = newElement;
    
    // Focus the new element
    this._element.focus();
  }

  getTag() {
    const level = this._settings.find(l => l.number === this._data.level) || this._settings[1];
    
    const tag = document.createElement(level.tag);
    tag.innerHTML = this._data.text;
    tag.classList.add(this._CSS.block, this._CSS.wrapper, ...level.class.split(' '));
    tag.contentEditable = !this.readOnly;
    
    // Remove focus outline
    tag.style.outline = 'none';
    
    // Add data attribute for styling
    tag.dataset.level = level.number;
    
    // Add placeholder
    if (!this.readOnly) {
      tag.dataset.placeholder = this.api.i18n.t('Heading') + ' ' + level.number;
    }

    return tag;
  }

  save(blockContent) {
    return {
      text: blockContent.innerHTML,
      level: this._data.level
    };
  }

  onPaste(event) {
    const content = event.detail.data;
    
    // Extract level from pasted tag
    let level = 2; // Default to H2
    if (content.tagName) {
      const match = content.tagName.match(/H(\d)/);
      if (match) {
        level = parseInt(match[1]);
      }
    }
    
    this._data = {
      text: content.innerHTML || content,
      level: Math.min(Math.max(level, 1), 6)
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
          level: 2
        };
      }
    };
  }
}

// Set on window for UMD-style access
window.CustomHeader = CustomHeader;

// Export for ES modules
export { CustomHeader };
