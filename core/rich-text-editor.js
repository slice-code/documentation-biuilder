(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.RichTextEditor = factory());
})(this, (function () {
  'use strict';

  let crudQuillStylesInjected = false;

  const DEFAULT_TOOLBAR = [
    ['bold', 'italic', 'underline', 'strike'],
    [{ header: [1, 2, 3, false] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    ['blockquote', 'code-block'],
    ['link'],
    [{ color: [] }, { background: [] }],
    ['clean']
  ];

  function ensureCrudQuillStyles() {
    if (crudQuillStylesInjected || document.querySelector('style[data-crud-quill-style]')) return;
    crudQuillStylesInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-crud-quill-style', 'true');
    style.textContent = `
      .crud-rich-editor {
        width: 100%;
        position: relative;
        z-index: 0;
        margin-bottom: 0.75rem;
        clear: both;
      }
      .crud-rich-editor .ql-toolbar.ql-snow {
        border: 1px solid #d1d5db;
        border-bottom: none;
        border-radius: 0.5rem 0.5rem 0 0;
        background: #f8fafc;
        font-family: inherit;
        position: relative;
        z-index: 1;
      }
      .crud-rich-editor .ql-container.ql-snow {
        border: 1px solid #d1d5db;
        border-radius: 0 0 0.5rem 0.5rem;
        font-size: 0.95rem;
        font-family: inherit;
        background: #fff;
        position: relative;
        z-index: 0;
      }
      .crud-rich-editor .ql-editor {
        min-height: 120px;
        max-height: 220px;
        overflow-y: auto;
        line-height: 1.55;
      }
      .crud-rich-editor .ql-picker-options {
        z-index: 30;
        max-height: 200px;
        overflow-y: auto;
      }
      .crud-rich-editor .ql-tooltip {
        z-index: 35;
        left: auto !important;
      }
      .crud-rich-editor.is-readonly .ql-toolbar { display: none; }
      .crud-rich-editor.is-readonly .ql-container {
        border-radius: 0.5rem;
        background: #f8fafc;
      }
      .crud-rich-editor .ql-editor.ql-blank::before {
        color: #94a3b8;
        font-style: normal;
      }
      .biodata-detail-form-slot .crud-rich-editor {
        margin-bottom: 0.5rem;
      }
      .biodata-detail-form-slot .crud-rich-editor .ql-editor {
        min-height: 100px;
        max-height: 180px;
      }
    `;
    document.head.appendChild(style);
  }

  function isHtmlEmpty(html) {
    if (html == null || html === '') return true;
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html);
    return (tmp.textContent || '').replace(/\u200B/g, '').trim() === '';
  }

  const RichTextEditor = {
    DEFAULT_TOOLBAR,

    isAvailable() {
      return typeof Quill !== 'undefined';
    },

    isHtmlEmpty,

    create(field, value, readOnly, formData) {
      if (!this.isAvailable() || field.richText === false) return null;

      ensureCrudQuillStyles();

      const uid = `crud-quill-${field.name}-${Math.random().toString(36).slice(2, 9)}`;
      const wrapper = el('div').class('crud-rich-editor').css({ width: '100%' });
      if (readOnly) wrapper.el.classList.add('is-readonly');

      const editorMount = el('div').attr('id', uid).css({ width: '100%' });
      const hidden = el('input').attr('type', 'hidden').attr('name', field.name);

      wrapper.child(editorMount);
      wrapper.child(hidden);

      let quill = null;
      let pendingValue = value != null ? String(value) : '';

      const syncToForm = () => {
        if (!quill) return;
        const html = quill.root.innerHTML;
        const empty = quill.getText().replace(/\u200B/g, '').trim() === '';
        const val = empty ? '' : html;
        formData[field.name] = val;
        hidden.el.value = val;
      };

      const applyValue = (html) => {
        if (!quill) {
          pendingValue = html || '';
          return;
        }
        if (!html || isHtmlEmpty(html)) {
          quill.setText('');
        } else {
          quill.clipboard.dangerouslyPasteHTML(String(html));
        }
        syncToForm();
      };

      const initQuill = () => {
        if (quill) return;
        const toolbar = field.editorToolbar || DEFAULT_TOOLBAR;
        quill = new Quill(editorMount.el, {
          theme: 'snow',
          readOnly: !!readOnly,
          placeholder: field.placeholder || 'Tulis di sini...',
          modules: { toolbar }
        });

        if (pendingValue) {
          applyValue(pendingValue);
        } else {
          syncToForm();
        }

        quill.on('text-change', syncToForm);
      };

      const isVisible = () => {
        if (!document.body.contains(editorMount.el)) return false;
        let node = editorMount.el;
        while (node && node !== document.body) {
          const st = getComputedStyle(node);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          node = node.parentElement;
        }
        return true;
      };

      const tryInit = (attempts = 0) => {
        if (quill) return;
        if (isVisible()) {
          initQuill();
          return;
        }
        if (attempts < 80) {
          setTimeout(() => tryInit(attempts + 1), 50);
        }
      };

      requestAnimationFrame(() => tryInit());

      wrapper._richEditorApi = {
        setValue(val) {
          applyValue(val || '');
        },
        getValue() {
          if (quill) return quill.root.innerHTML;
          return formData[field.name] || pendingValue || '';
        },
        getText() {
          if (quill) return quill.getText().replace(/\u200B/g, '').trim();
          if (pendingValue && !isHtmlEmpty(pendingValue)) {
            const tmp = document.createElement('div');
            tmp.innerHTML = pendingValue;
            return (tmp.textContent || '').trim();
          }
          return '';
        },
        isEmpty() {
          return !this.getText();
        }
      };

      return wrapper;
    }
  };

  return RichTextEditor;
}));
