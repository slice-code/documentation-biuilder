/**
 * Custom Code Block Tool for Editor.js
 * VS Code-like dark theme code editor with line numbers
 */
class CodeBlock {
  static get isReadOnlySupported() {
    return true;
  }

  // Important: Tell Editor.js that we handle Enter key ourselves
  static get enableLineBreaks() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Code',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 18L3 13L8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 8L21 13L16 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
  }

  static get sanitize() {
    return {
      code: true, // Allow all content without sanitization
      language: {}
    };
  }

  constructor({ data, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    
    // Decode HTML entities in code that were encoded by Editor.js sanitizer
    // This fixes issues like &gt; showing as literal text instead of >
    let decodedCode = data.code || '';
    if (decodedCode && typeof decodedCode === 'string') {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = decodedCode;
      decodedCode = textarea.value;
    }
    
    this.data = {
      code: decodedCode,
      language: data.language || 'javascript'
    };
    this.languages = [
      'javascript',
      'html',
      'css',
      'python',
      'java',
      'php',
      'sql',
      'bash',
      'json',
      'markdown'
    ];
    
    // Store event handlers for cleanup
    this._documentKeydownHandler = null;
    this._isDestroyed = false;
  }

  render() {
    // Main wrapper - dark theme like VS Code
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('code-block-wrapper');
    this.wrapper.style.background = '#1e1e1e';
    this.wrapper.style.borderRadius = '8px';
    this.wrapper.style.overflow = 'hidden';
    this.wrapper.style.margin = '8px 0';
    this.wrapper.style.fontFamily = "'Fira Code', 'Monaco', 'Consolas', monospace";

    // Window title bar with traffic lights
    const titleBar = document.createElement('div');
    titleBar.style.background = '#2d2d2d';
    titleBar.style.padding = '12px 16px';
    titleBar.style.display = 'flex';
    titleBar.style.alignItems = 'center';
    titleBar.style.gap = '8px';

    // Traffic lights (red, yellow, green)
    const colors = ['#ff5f56', '#ffbd2e', '#27c93f'];
    colors.forEach(color => {
      const dot = document.createElement('span');
      dot.style.width = '12px';
      dot.style.height = '12px';
      dot.style.borderRadius = '50%';
      dot.style.background = color;
      dot.style.display = 'inline-block';
      titleBar.appendChild(dot);
    });

    // Language selector or label
    const langContainer = document.createElement('div');
    langContainer.style.marginLeft = 'auto';
    
    if (!this.readOnly) {
      this.select = document.createElement('select');
      this.select.style.padding = '4px 12px';
      this.select.style.border = 'none';
      this.select.style.borderRadius = '4px';
      this.select.style.fontSize = '12px';
      this.select.style.background = '#3d3d3d';
      this.select.style.color = '#d4d4d4';
      this.select.style.cursor = 'pointer';
      this.select.style.outline = 'none';

      this.languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = lang;
        if (lang === this.data.language) {
          option.selected = true;
        }
        this.select.appendChild(option);
      });

      this.select.addEventListener('change', (e) => {
        this.data.language = e.target.value;
        this._scheduleHighlight();
      });

      langContainer.appendChild(this.select);
    } else {
      const langLabel = document.createElement('span');
      langLabel.textContent = this.data.language;
      langLabel.style.fontSize = '12px';
      langLabel.style.color = '#858585';
      langLabel.style.textTransform = 'lowercase';
      langContainer.appendChild(langLabel);
    }
    
    titleBar.appendChild(langContainer);
    this.wrapper.appendChild(titleBar);

    // Code editor area
    const codeArea = document.createElement('div');
    codeArea.style.display = 'flex';
    codeArea.style.background = '#1e1e1e';

    // Line numbers container (for scroll sync)
    const lineNumbersContainer = document.createElement('div');
    lineNumbersContainer.style.overflow = 'hidden';
    lineNumbersContainer.style.background = '#1e1e1e';
    lineNumbersContainer.style.borderRight = '1px solid #333';

    // Line numbers
    this.lineNumbers = document.createElement('div');
    this.lineNumbers.style.padding = '16px 12px 16px 16px';
    this.lineNumbers.style.background = '#1e1e1e';
    this.lineNumbers.style.color = '#858585';
    this.lineNumbers.style.fontSize = '14px';
    this.lineNumbers.style.lineHeight = '1.6';
    this.lineNumbers.style.textAlign = 'right';
    this.lineNumbers.style.userSelect = 'none';
    this.lineNumbers.style.minWidth = '30px';
    this.lineNumbers.style.whiteSpace = 'pre';
    this.lineNumbers.style.fontFamily = "'Fira Code', 'Monaco', 'Consolas', monospace";

    lineNumbersContainer.appendChild(this.lineNumbers);

    // Code content - use div with contenteditable
    // Each line is a separate div element
    this.codeContent = document.createElement('div');
    this.codeContent.classList.add('code-content');
    
    // Convert code to div lines
    if (this.data.code && this.data.code.length > 0) {
      const lines = this.data.code.split('\n');
      lines.forEach((line, index) => {
        const lineDiv = document.createElement('div');
        lineDiv.textContent = line;
        lineDiv.style.minHeight = '22.4px'; // lineHeight 1.6 * fontSize 14
        this.codeContent.appendChild(lineDiv);
      });
    } else {
      // Always have at least one empty div for editing
      const lineDiv = document.createElement('div');
      lineDiv.style.minHeight = '22.4px';
      this.codeContent.appendChild(lineDiv);
    }
    
    // Apply initial syntax highlighting
    this._scheduleHighlight();
    
    this.codeContent.style.display = 'block';
    this.codeContent.style.outline = 'none';
    this.codeContent.style.minHeight = '24px';
    this.codeContent.style.padding = '16px';
    this.codeContent.style.background = '#1e1e1e';
    this.codeContent.style.fontSize = '14px';
    this.codeContent.style.lineHeight = '1.6';
    this.codeContent.style.color = '#d4d4d4';
    this.codeContent.style.tabSize = '2';
    this.codeContent.style.fontFamily = "'Fira Code', 'Monaco', 'Consolas', monospace";
    this.codeContent.style.flex = '1';
    this.codeContent.style.overflow = 'auto';
    this.codeContent.style.whiteSpace = 'pre';

    if (!this.readOnly) {
      this.codeContent.contentEditable = 'true';
      
      // Add placeholder styles for dark theme
      const placeholderStyle = document.createElement('style');
      placeholderStyle.textContent = `
        .code-block-wrapper .code-content > div:only-child:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
        }
        .code-block-wrapper .code-content > div {
          min-height: 22.4px;
          white-space: pre;
        }
      `;
      this.wrapper.appendChild(placeholderStyle);
      
      // Ensure there's at least one div when focused
      this.codeContent.addEventListener('focus', () => {
        if (this.codeContent.children.length === 0) {
          const lineDiv = document.createElement('div');
          this.codeContent.appendChild(lineDiv);
          // Move cursor to the new div
          const range = document.createRange();
          range.setStart(lineDiv, 0);
          range.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          this.updatePlaceholder();
        }
      });
      
      // Update line numbers on input and schedule highlighting
      this.codeContent.addEventListener('input', (e) => {
        this.updateLineNumbers();
        this.updatePlaceholder();
        this._scheduleHighlight();
      });
      
      // Handle paste events - prevent Editor.js from intercepting
      this.codeContent.addEventListener('paste', (e) => {
        // Prevent Editor.js from handling this paste
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Get clipboard data
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text/plain');
        
        if (!pastedText) return;
        
        // Get current selection
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        // Delete any selected content
        if (!range.collapsed) {
          range.deleteContents();
        }
        
        // Split pasted text by newlines
        const lines = pastedText.split('\n');
        
        // Find current line div
        let currentLineDiv = range.startContainer;
        while (currentLineDiv && currentLineDiv.parentElement !== this.codeContent) {
          currentLineDiv = currentLineDiv.parentElement;
        }
        
        if (!currentLineDiv || currentLineDiv === this.codeContent) {
          // Fallback: just use normalize
          document.execCommand('insertText', false, pastedText);
          setTimeout(() => {
            this._normalizeLines();
            this.updateLineNumbers();
            this.updatePlaceholder();
            this._scheduleHighlight();
          }, 0);
          return;
        }
        
        // Get cursor position in current line
        const cursorPos = range.startOffset;
        const currentLineText = currentLineDiv.textContent || '';
        const textBefore = currentLineText.substring(0, cursorPos);
        const textAfter = currentLineText.substring(cursorPos);
        
        // Single line paste - just insert text
        if (lines.length === 1) {
          currentLineDiv.textContent = textBefore + lines[0] + textAfter;
          // Move cursor after pasted text
          this._setCursorInLine(currentLineDiv, textBefore.length + lines[0].length);
        } else {
          // Multi-line paste
          // First line: combine with text before cursor
          currentLineDiv.textContent = textBefore + lines[0];
          
          // Middle lines: create new divs
          let prevDiv = currentLineDiv;
          for (let i = 1; i < lines.length - 1; i++) {
            const newDiv = document.createElement('div');
            newDiv.textContent = lines[i];
            newDiv.style.minHeight = '22.4px';
            if (prevDiv.nextSibling) {
              this.codeContent.insertBefore(newDiv, prevDiv.nextSibling);
            } else {
              this.codeContent.appendChild(newDiv);
            }
            prevDiv = newDiv;
          }
          
          // Last line: combine with text after cursor
          const lastDiv = document.createElement('div');
          lastDiv.textContent = lines[lines.length - 1] + textAfter;
          lastDiv.style.minHeight = '22.4px';
          if (prevDiv.nextSibling) {
            this.codeContent.insertBefore(lastDiv, prevDiv.nextSibling);
          } else {
            this.codeContent.appendChild(lastDiv);
          }
          
          // Move cursor to end of last pasted line (before textAfter)
          this._setCursorInLine(lastDiv, lines[lines.length - 1].length);
        }
        
        // Update line numbers and placeholder
        this.updateLineNumbers();
        this.updatePlaceholder();
        this._scheduleHighlight();
      });
      
      // Initialize line numbers after codeContent is created
      this.updateLineNumbers();
      this.updatePlaceholder();
      
      // Handle keyboard events - use capture phase to intercept before Editor.js
      this.codeContent.addEventListener('keydown', (e) => {
        // Tab key: insert 2 spaces with undo support
        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          // Use execCommand for undo support
          document.execCommand('insertText', false, '  ');
          return;
        }
        
        // Backspace: handle empty lines and navigation
        if (e.key === 'Backspace') {
          const selection = window.getSelection();
          if (selection.rangeCount === 0) return;
          
          const range = selection.getRangeAt(0);
          if (!range.collapsed) return; // Only handle when there's no selection
          
          // Find which line div the cursor is in
          let currentLineDiv = range.startContainer;
          while (currentLineDiv && currentLineDiv.parentElement !== this.codeContent) {
            currentLineDiv = currentLineDiv.parentElement;
          }
          
          if (!currentLineDiv) return;
          
          // Get all line divs
          const lineDivs = Array.from(this.codeContent.querySelectorAll(':scope > div'));
          const currentLineIndex = lineDivs.indexOf(currentLineDiv);
          const lineText = currentLineDiv.textContent || '';
          const cursorPosInLine = range.startOffset;
          
          // If at start of line
          if (cursorPosInLine === 0) {
            // If current line is empty and not the first line, delete it
            if (lineText.length === 0 && currentLineIndex > 0) {
              e.preventDefault();
              e.stopPropagation();
              
              // Remove current empty line
              currentLineDiv.remove();
              
              // Move cursor to end of previous line
              const prevLineDiv = lineDivs[currentLineIndex - 1];
              const prevLineText = prevLineDiv.textContent || '';
              
              const newRange = document.createRange();
              const newSelection = window.getSelection();
              
              // Set cursor to end of previous line
              if (prevLineDiv.firstChild) {
                newRange.setStart(prevLineDiv.firstChild, prevLineText.length);
                newRange.setEnd(prevLineDiv.firstChild, prevLineText.length);
              } else {
                // Empty previous line
                newRange.setStart(prevLineDiv, 0);
                newRange.setEnd(prevLineDiv, 0);
              }
              
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
              
              // Update line numbers and placeholder
              this.updateLineNumbers();
              this.updatePlaceholder();
              return;
            }
            
            // If at start of first line, move to previous block
            if (currentLineIndex === 0) {
              e.preventDefault();
              e.stopPropagation();
              const currentIndex = this.api.blocks.getCurrentBlockIndex();
              if (currentIndex > 0) {
                this.api.caret.setToBlock(currentIndex - 1, 'end');
              }
              return;
            }
            
            // If at start of non-empty line, merge with previous line
            if (lineText.length > 0 && currentLineIndex > 0) {
              e.preventDefault();
              e.stopPropagation();
              
              const prevLineDiv = lineDivs[currentLineIndex - 1];
              const prevLineText = prevLineDiv.textContent || '';
              
              // Append current line text to previous line
              prevLineDiv.textContent = prevLineText + lineText;
              
              // Remove current line
              currentLineDiv.remove();
              
              // Move cursor to the merge point (end of old prev line text)
              const newRange = document.createRange();
              const newSelection = window.getSelection();
              
              if (prevLineDiv.firstChild) {
                newRange.setStart(prevLineDiv.firstChild, prevLineText.length);
                newRange.setEnd(prevLineDiv.firstChild, prevLineText.length);
              } else {
                newRange.setStart(prevLineDiv, 0);
                newRange.setEnd(prevLineDiv, 0);
              }
              
              newSelection.removeAllRanges();
              newSelection.addRange(newRange);
              
              // Update line numbers and placeholder
              this.updateLineNumbers();
              this.updatePlaceholder();
              return;
            }
          }
        }
        
        // Delete at end: move to next block
        if (e.key === 'Delete') {
          const selection = window.getSelection();
          if (selection.rangeCount === 0) return;
          
          const range = selection.getRangeAt(0);
          
          // Check if cursor is at end and there's no selection
          if (range.collapsed) {
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(this.codeContent);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            const caretOffset = preCaretRange.toString().length;
            const textContent = this.codeContent.textContent;
            
            // If at very end, move to next block
            if (caretOffset >= textContent.length) {
              e.preventDefault();
              e.stopPropagation();
              const currentIndex = this.api.blocks.getCurrentBlockIndex();
              const nextBlock = this.api.blocks.getBlockByIndex(currentIndex + 1);
              if (nextBlock) {
                this.api.caret.setToBlock(currentIndex + 1, 'start');
              }
              return;
            }
          }
        }
        
        // Arrow Down: move to next line or next block
        if (e.key === 'ArrowDown') {
          const selection = window.getSelection();
          if (selection.rangeCount === 0) return;
          
          const range = selection.getRangeAt(0);
          
          // Find which line div the cursor is in
          let currentLineDiv = range.startContainer;
          while (currentLineDiv && currentLineDiv.parentElement !== this.codeContent) {
            currentLineDiv = currentLineDiv.parentElement;
          }
          
          // Get all line divs
          const lineDivs = Array.from(this.codeContent.querySelectorAll(':scope > div'));
          const currentLineIndex = lineDivs.indexOf(currentLineDiv);
          
          // Check if cursor is at end of current line
          const lineText = currentLineDiv ? currentLineDiv.textContent : '';
          const cursorPosInLine = range.startOffset;
          const isAtEndOfLine = cursorPosInLine >= lineText.length;
          
          // If on last line and at end, move to next block
          if (currentLineIndex === lineDivs.length - 1 && isAtEndOfLine) {
            e.preventDefault();
            e.stopPropagation();
            const currentIndex = this.api.blocks.getCurrentBlockIndex();
            const nextBlock = this.api.blocks.getBlockByIndex(currentIndex + 1);
            if (nextBlock) {
              this.api.caret.setToBlock(currentIndex + 1, 'start');
            } else {
              this.api.blocks.insert('paragraph');
              this.api.caret.setToBlock(currentIndex + 1, 'start');
            }
          }
          // Otherwise let browser handle it (move to next line)
        }
        
        // Arrow Up: move to previous line or previous block
        if (e.key === 'ArrowUp') {
          const selection = window.getSelection();
          if (selection.rangeCount === 0) return;
          
          const range = selection.getRangeAt(0);
          
          // Find which line div the cursor is in
          let currentLineDiv = range.startContainer;
          while (currentLineDiv && currentLineDiv.parentElement !== this.codeContent) {
            currentLineDiv = currentLineDiv.parentElement;
          }
          
          // Get all line divs
          const lineDivs = Array.from(this.codeContent.querySelectorAll(':scope > div'));
          const currentLineIndex = lineDivs.indexOf(currentLineDiv);
          
          // Check if cursor is at start of current line
          const cursorPosInLine = range.startOffset;
          const isAtStartOfLine = cursorPosInLine === 0;
          
          // If on first line and at start, move to previous block
          if (currentLineIndex === 0 && isAtStartOfLine) {
            e.preventDefault();
            e.stopPropagation();
            const currentIndex = this.api.blocks.getCurrentBlockIndex();
            if (currentIndex > 0) {
              this.api.caret.setToBlock(currentIndex - 1, 'end');
            }
          }
          // Otherwise let browser handle it (move to previous line)
        }
      }, true); // Use capture phase to intercept events before Editor.js
      
      // Intercept at document level to ensure we catch Enter before Editor.js
      // We need to check if the event target is inside our code block
      this._documentKeydownHandler = (e) => {
        if (this._isDestroyed || !this.codeContent.contains(e.target)) return;
        
        // Enter without Shift: let browser handle it (creates new div), but prevent Editor.js
        if (e.key === 'Enter' && !e.shiftKey) {
          e.stopPropagation();
          e.stopImmediatePropagation();
          // Don't prevent default - let browser create new div line
          // Update line numbers and placeholder after a small delay
          setTimeout(() => {
            if (this._isDestroyed) return;
            this.updateLineNumbers();
            this.updatePlaceholder();
            this._scheduleHighlight();
          }, 0);
        }
        
        // Shift+Enter: create new paragraph below
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.api.blocks.insert('paragraph');
          this.api.caret.setToBlock(this.api.blocks.getCurrentBlockIndex() + 1);
        }
      };
      document.addEventListener('keydown', this._documentKeydownHandler, true); // Capture phase
    }

    codeArea.appendChild(lineNumbersContainer);
    codeArea.appendChild(this.codeContent);
    this.wrapper.appendChild(codeArea);

    // Sync scroll between code content and line numbers
    this.codeContent.addEventListener('scroll', () => {
      this.lineNumbers.style.transform = `translateY(-${this.codeContent.scrollTop}px)`;
    });

    return this.wrapper;
  }

  updateLineNumbers() {
    if (!this.codeContent) return;
    
    // Count lines by counting direct div children
    // Each line is a separate div element
    const lineDivs = this.codeContent.querySelectorAll(':scope > div');
    let lineCount = lineDivs.length;
    
    // If no div children, count as 1 line (empty or single line)
    if (lineCount === 0) {
      lineCount = 1;
    }
    
    let numbers = '';
    for (let i = 1; i <= lineCount; i++) {
      numbers += i + '\n';
    }
    if (this.lineNumbers) {
      this.lineNumbers.textContent = numbers;
    }
  }

  updatePlaceholder() {
    if (!this.codeContent) return;
    
    const allDivs = this.codeContent.querySelectorAll(':scope > div');
    
    // Only show placeholder when there's exactly one empty div
    if (allDivs.length === 1) {
      allDivs[0].dataset.placeholder = 'Enter your code here...';
    } else {
      // Remove placeholder from all divs when there are multiple lines
      allDivs.forEach(div => {
        delete div.dataset.placeholder;
      });
    }
  }

  /**
   * Set cursor position within a line div
   * @param {HTMLElement} lineDiv - The line div element
   * @param {number} offset - Character offset within the line
   */
  _setCursorInLine(lineDiv, offset) {
    const selection = window.getSelection();
    const range = document.createRange();
    
    // Ensure offset is within bounds
    const text = lineDiv.textContent || '';
    const safeOffset = Math.min(Math.max(0, offset), text.length);
    
    if (lineDiv.firstChild) {
      range.setStart(lineDiv.firstChild, safeOffset);
      range.collapse(true);
    } else {
      range.setStart(lineDiv, 0);
      range.collapse(true);
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Normalize content to ensure proper div-per-line structure
   * Called after browser operations (paste, etc.) that may create <br> or <div> inside text
   */
  _normalizeLines() {
    if (!this.codeContent) return;
    
    // Get all text content
    const text = this.codeContent.textContent || '';
    
    // If empty, ensure at least one empty div
    if (!text) {
      this.codeContent.innerHTML = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.style.minHeight = '22.4px';
      this.codeContent.appendChild(emptyDiv);
      return;
    }
    
    // Split by newlines and create divs
    const lines = text.split('\n');
    
    // Save cursor position before normalizing
    const selection = window.getSelection();
    let cursorOffset = null;
    
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (this.codeContent.contains(range.startContainer)) {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(this.codeContent);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        cursorOffset = preCaretRange.toString().length;
      }
    }
    
    // Rebuild content with proper div structure
    this.codeContent.innerHTML = '';
    lines.forEach((line) => {
      const lineDiv = document.createElement('div');
      lineDiv.textContent = line;
      lineDiv.style.minHeight = '22.4px';
      this.codeContent.appendChild(lineDiv);
    });
    
    // Restore cursor position
    if (cursorOffset !== null) {
      try {
        const newRange = document.createRange();
        let currentOffset = 0;
        let found = false;
        
        const walker = document.createTreeWalker(
          this.codeContent,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const nodeLength = node.textContent.length;
          
          if (currentOffset + nodeLength >= cursorOffset) {
            newRange.setStart(node, Math.min(cursorOffset - currentOffset, nodeLength));
            newRange.collapse(true);
            found = true;
            break;
          }
          currentOffset += nodeLength;
        }
        
        if (found) {
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } catch (e) {
        // Cursor restoration failed
      }
    }
  }

  /**
   * Schedule syntax highlighting (disabled for now)
   */
  _scheduleHighlight() {
    // Syntax highlighting disabled - no-op
  }

  /**
   * Apply syntax highlighting (disabled for now)
   */
  _applyHighlight() {
    // Syntax highlighting disabled - no-op
  }

  /**
   * Clean up event listeners and resources when block is destroyed
   */
  destroy() {
    this._isDestroyed = true;
    
    // Remove document-level event listener
    if (this._documentKeydownHandler) {
      document.removeEventListener('keydown', this._documentKeydownHandler, true);
      this._documentKeydownHandler = null;
    }
  }

  save() {
    // Get all line divs and join their content with \n
    const lineDivs = this.codeContent.querySelectorAll(':scope > div');
    let code = '';
    
    if (lineDivs.length > 0) {
      const lines = Array.from(lineDivs).map(div => div.textContent);
      code = lines.join('\n');
    } else {
      // Fallback: use textContent directly
      code = this.codeContent.textContent || '';
    }
    
    return {
      code: code,
      language: this.data.language
    };
  }

  renderSettings() {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexWrap = 'wrap';
    wrapper.style.gap = '4px';
    wrapper.style.padding = '4px';
    
    this.languages.forEach(lang => {
      const button = document.createElement('div');
      button.textContent = lang;
      button.style.padding = '4px 8px';
      button.style.fontSize = '12px';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.background = this.data.language === lang ? '#3b82f6' : '#f3f4f6';
      button.style.color = this.data.language === lang ? '#fff' : '#374151';
      button.style.transition = 'all 0.15s ease';
      
      button.addEventListener('click', () => {
        this.setLanguage(lang);
        // Update button styles
        wrapper.querySelectorAll('div').forEach(btn => {
          btn.style.background = '#f3f4f6';
          btn.style.color = '#374151';
        });
        button.style.background = '#3b82f6';
        button.style.color = '#fff';
      });
      
      button.addEventListener('mouseenter', () => {
        if (this.data.language !== lang) {
          button.style.background = '#e5e7eb';
        }
      });
      
      button.addEventListener('mouseleave', () => {
        if (this.data.language !== lang) {
          button.style.background = '#f3f4f6';
        }
      });
      
      wrapper.appendChild(button);
    });
    
    return wrapper;
  }

  setLanguage(language) {
    this.data.language = language;
    if (this.select) {
      this.select.value = language;
    }
    // Re-apply highlighting with new language
    this._scheduleHighlight();
  }

  static get pasteConfig() {
    return {
      tags: ['PRE', 'CODE']
    };
  }

  onPaste(event) {
    const content = event.detail.data;
    if (content.tagName === 'PRE' || content.tagName === 'CODE') {
      this.data.code = content.textContent;
      if (this.codeContent) {
        // Clear existing content
        this.codeContent.innerHTML = '';
        
        // Convert code to div lines
        if (this.data.code && this.data.code.length > 0) {
          const lines = this.data.code.split('\n');
          lines.forEach((line) => {
            const lineDiv = document.createElement('div');
            lineDiv.textContent = line;
            lineDiv.style.minHeight = '22.4px';
            this.codeContent.appendChild(lineDiv);
          });
        } else {
          // Empty paste - add empty div
          const lineDiv = document.createElement('div');
          lineDiv.style.minHeight = '22.4px';
          this.codeContent.appendChild(lineDiv);
        }
        
        this.updateLineNumbers();
        this.updatePlaceholder();
        this._scheduleHighlight();
      }
    }
  }
}

// Expose to window for Editor.js
window.CodeBlock = CodeBlock;

// Export for ES modules
export { CodeBlock };
