/**
 * Table Block for Editor.js
 * Dynamic table with rows/columns management
 */

class TableBlock {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Table',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 9h18" stroke="currentColor" stroke-width="2"/><path d="M3 15h18" stroke="currentColor" stroke-width="2"/><path d="M9 3v18" stroke="currentColor" stroke-width="2"/><path d="M15 3v18" stroke="currentColor" stroke-width="2"/></svg>'
    };
  }

  static get sanitize() {
    return {
      withHeader: {},
      content: {}
    };
  }

  constructor({ data, config, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = {
      withHeader: data.withHeader !== undefined ? data.withHeader : true,
      content: data.content || [
        ['Header 1', 'Header 2', 'Header 3'],
        ['Cell 1', 'Cell 2', 'Cell 3'],
        ['Cell 4', 'Cell 5', 'Cell 6']
      ]
    };

    this.table = null;
    this.wrapper = null;
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('cdx-table');

    // Create table
    this.table = document.createElement('table');
    this.table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      border: 1px solid #e5e7eb;
    `;

    // Render table content
    this.renderTable();

    this.wrapper.appendChild(this.table);

    // Add controls if not read-only
    if (!this.readOnly) {
      const controls = this.createControls();
      this.wrapper.appendChild(controls);
    }

    return this.wrapper;
  }

  renderTable() {
    this.table.innerHTML = '';

    this.data.content.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');

      row.forEach((cell, cellIndex) => {
        const isHeader = this.data.withHeader && rowIndex === 0;
        const td = document.createElement(isHeader ? 'th' : 'td');

        td.contentEditable = !this.readOnly;
        td.innerHTML = cell;
        td.style.cssText = `
          border: 1px solid #e5e7eb;
          padding: 10px;
          text-align: left;
          outline: none;
          ${isHeader ? 'background: #f9fafb; font-weight: 600;' : ''}
        `;

        td.dataset.rowIndex = rowIndex;
        td.dataset.cellIndex = cellIndex;

        // Add event listener for content changes
        td.addEventListener('input', (e) => {
          this.data.content[rowIndex][cellIndex] = e.target.innerHTML;
        });

        tr.appendChild(td);
      });

      this.table.appendChild(tr);
    });
  }

  createControls() {
    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    `;

    // Add Row button
    const addRowBtn = document.createElement('button');
    addRowBtn.type = 'button';
    addRowBtn.innerHTML = '<i class="fas fa-plus"></i> Add Row';
    addRowBtn.style.cssText = `
      padding: 6px 12px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    addRowBtn.addEventListener('click', () => this.addRow());

    // Remove Row button
    const removeRowBtn = document.createElement('button');
    removeRowBtn.type = 'button';
    removeRowBtn.innerHTML = '<i class="fas fa-minus"></i> Remove Row';
    removeRowBtn.style.cssText = `
      padding: 6px 12px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    removeRowBtn.addEventListener('click', () => this.removeRow());

    // Add Column button
    const addColBtn = document.createElement('button');
    addColBtn.type = 'button';
    addColBtn.innerHTML = '<i class="fas fa-plus"></i> Add Column';
    addColBtn.style.cssText = `
      padding: 6px 12px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    addColBtn.addEventListener('click', () => this.addColumn());

    // Remove Column button
    const removeColBtn = document.createElement('button');
    removeColBtn.type = 'button';
    removeColBtn.innerHTML = '<i class="fas fa-minus"></i> Remove Column';
    removeColBtn.style.cssText = `
      padding: 6px 12px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    removeColBtn.addEventListener('click', () => this.removeColumn());

    // Toggle Header button
    const toggleHeaderBtn = document.createElement('button');
    toggleHeaderBtn.type = 'button';
    toggleHeaderBtn.innerHTML = this.data.withHeader ? '✓ Header Row' : 'Header Row';
    toggleHeaderBtn.style.cssText = `
      padding: 6px 12px;
      background: ${this.data.withHeader ? '#dbeafe' : '#f3f4f6'};
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    toggleHeaderBtn.addEventListener('click', () => {
      this.data.withHeader = !this.data.withHeader;
      this.renderTable();
      toggleHeaderBtn.innerHTML = this.data.withHeader ? '✓ Header Row' : 'Header Row';
      toggleHeaderBtn.style.background = this.data.withHeader ? '#dbeafe' : '#f3f4f6';
    });

    controls.appendChild(addRowBtn);
    controls.appendChild(removeRowBtn);
    controls.appendChild(addColBtn);
    controls.appendChild(removeColBtn);
    controls.appendChild(toggleHeaderBtn);

    return controls;
  }

  addRow() {
    const columnCount = this.data.content[0].length;
    const newRow = Array(columnCount).fill('');
    this.data.content.push(newRow);
    this.renderTable();
  }

  removeRow() {
    if (this.data.content.length > 1) {
      this.data.content.pop();
      this.renderTable();
    }
  }

  addColumn() {
    this.data.content.forEach(row => {
      row.push('');
    });
    this.renderTable();
  }

  removeColumn() {
    if (this.data.content[0].length > 1) {
      this.data.content.forEach(row => {
        row.pop();
      });
      this.renderTable();
    }
  }

  save(blockContent) {
    return {
      withHeader: this.data.withHeader,
      content: this.data.content
    };
  }
}

// Expose to window for Editor.js
window.TableBlock = TableBlock;

// Export for ES modules
export { TableBlock };
