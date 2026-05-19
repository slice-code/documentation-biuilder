/**
 * Custom Divider Tool for Editor.js
 * Horizontal separator with multiple styles
 */
class Divider {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Divider',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="21" cy="12" r="1.5" fill="currentColor"/></svg>'
    };
  }

  static get sanitize() {
    return {
      style: {}
    };
  }

  constructor({ data, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      style: data.style || 'solid'
    };
    
    this._isDestroyed = false;
    
    // Available styles
    this.styles = [
      { name: 'solid', label: 'Solid' },
      { name: 'dashed', label: 'Dashed' },
      { name: 'dotted', label: 'Dotted' },
      { name: 'gradient', label: 'Gradient' },
      { name: 'dots', label: 'Dots' },
      { name: 'stars', label: 'Stars' }
    ];
  }

  render() {
    // Main wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('divider-wrapper');
    this.wrapper.style.margin = '24px 0';
    this.wrapper.style.display = 'flex';
    this.wrapper.style.alignItems = 'center';
    this.wrapper.style.justifyContent = 'center';
    
    // Render the divider based on style
    this._renderDivider(this.data.style);
    
    return this.wrapper;
  }

  /**
   * Render divider based on style
   */
  _renderDivider(styleName) {
    // Clear existing content
    this.wrapper.innerHTML = '';
    this.wrapper.style.height = 'auto';
    this.wrapper.style.overflow = 'hidden';
    
    switch (styleName) {
      case 'dashed':
        this._renderLine('dashed');
        break;
      case 'dotted':
        this._renderLine('dotted');
        break;
      case 'gradient':
        this._renderGradient();
        break;
      case 'dots':
        this._renderDots();
        break;
      case 'stars':
        this._renderStars();
        break;
      case 'solid':
      default:
        this._renderLine('solid');
        break;
    }
    
    this.data.style = styleName;
  }

  /**
   * Render simple line divider
   */
  _renderLine(borderStyle) {
    const line = document.createElement('hr');
    line.style.width = '100%';
    line.style.border = 'none';
    line.style.borderTop = `1px ${borderStyle} #e2e8f0`;
    line.style.margin = '0';
    this.wrapper.appendChild(line);
  }

  /**
   * Render gradient divider
   */
  _renderGradient() {
    const gradient = document.createElement('div');
    gradient.style.width = '100%';
    gradient.style.height = '1px';
    gradient.style.background = 'linear-gradient(90deg, transparent, #3b82f6, transparent)';
    this.wrapper.appendChild(gradient);
  }

  /**
   * Render dots divider
   */
  _renderDots() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.gap = '8px';
    container.style.width = '100%';
    
    // Create 3 dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.borderRadius = '50%';
      dot.style.background = '#94a3b8';
      container.appendChild(dot);
    }
    
    this.wrapper.appendChild(container);
  }

  /**
   * Render stars divider
   */
  _renderStars() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.gap = '16px';
    container.style.width = '100%';
    
    // Left line
    const leftLine = document.createElement('div');
    leftLine.style.flex = '1';
    leftLine.style.height = '1px';
    leftLine.style.background = '#e2e8f0';
    container.appendChild(leftLine);
    
    // Star icon
    const star = document.createElement('div');
    star.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#3b82f6"/></svg>';
    container.appendChild(star);
    
    // Right line
    const rightLine = document.createElement('div');
    rightLine.style.flex = '1';
    rightLine.style.height = '1px';
    rightLine.style.background = '#e2e8f0';
    container.appendChild(rightLine);
    
    this.wrapper.appendChild(container);
  }

  save() {
    return {
      style: this.data.style
    };
  }

  /**
   * Clean up when block is destroyed
   */
  destroy() {
    this._isDestroyed = true;
  }

  /**
   * Render settings for block tune menu
   */
  renderSettings() {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexWrap = 'wrap';
    wrapper.style.gap = '4px';
    wrapper.style.padding = '4px';
    wrapper.style.maxWidth = '200px';
    
    this.styles.forEach(style => {
      const button = document.createElement('div');
      button.style.width = '28px';
      button.style.height = '28px';
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.background = this.data.style === style.name ? '#3b82f6' : '#f3f4f6';
      button.style.color = this.data.style === style.name ? '#fff' : '#374151';
      button.style.transition = 'all 0.15s ease';
      button.style.fontSize = '12px';
      button.title = style.label;
      
      // Render mini preview
      button.innerHTML = this._getMiniPreview(style.name);
      
      button.addEventListener('click', () => {
        this._renderDivider(style.name);
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
   * Get mini preview icon for settings
   */
  _getMiniPreview(styleName) {
    switch (styleName) {
      case 'solid':
        return '<div style="width:16px;height:2px;background:currentColor;border-radius:1px;"></div>';
      case 'dashed':
        return '<div style="width:16px;height:0;border-top:2px dashed currentColor;"></div>';
      case 'dotted':
        return '<div style="width:16px;height:0;border-top:2px dotted currentColor;"></div>';
      case 'gradient':
        return '<div style="width:16px;height:2px;background:linear-gradient(90deg,transparent,currentColor,transparent);border-radius:1px;"></div>';
      case 'dots':
        return '<div style="display:flex;gap:2px;"><div style="width:3px;height:3px;background:currentColor;border-radius:50%;"></div><div style="width:3px;height:3px;background:currentColor;border-radius:50%;"></div><div style="width:3px;height:3px;background:currentColor;border-radius:50%;"></div></div>';
      case 'stars':
        return '<div style="font-size:10px;">★</div>';
      default:
        return '<div style="width:16px;height:2px;background:currentColor;border-radius:1px;"></div>';
    }
  }
}

// Expose to window for Editor.js
window.Divider = Divider;

// Export for ES modules
export { Divider };
