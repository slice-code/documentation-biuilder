(function (global) {
  'use strict';

  function isImageFile(file) {
    if (!file) return false;
    const mime = String(file.type || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp)$/i.test(String(file.name || ''));
  }

  function isImagePath(filePath) {
    return /\.(jpe?g|png|gif|webp)$/i.test(String(filePath || ''));
  }

  function fileNameFromPath(filePath) {
    if (!filePath) return '';
    return String(filePath).split('/').pop();
  }

  /** Area preview: file baru (object URL) atau path server */
  function createPreviewBox(opts) {
    const minHeight = opts?.minHeight || '180px';
    const wrap = el('div').css({
      minHeight,
      borderRadius: '0.65rem',
      border: '1px dashed #cbd5e1',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: '0.75rem'
    });

    let objectUrl = null;

    function revokeObjectUrl() {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    }

    function showPlaceholder(text) {
      revokeObjectUrl();
      wrap.empty();
      wrap.child(
        el('span').text(text || 'Pilih file untuk melihat pratinjau').css({
          fontSize: '0.8125rem',
          color: '#94a3b8',
          padding: '1rem',
          textAlign: 'center'
        })
      );
      wrap.get();
    }

    function showPdfLabel(name) {
      revokeObjectUrl();
      wrap.empty();
      wrap.child(
        el('div').css({ textAlign: 'center', padding: '1rem' }).child([
          el('i').class('fas fa-file-pdf').css({
            fontSize: '2.5rem',
            color: '#dc2626',
            display: 'block',
            marginBottom: '0.5rem'
          }),
          el('span').text(name || 'Dokumen PDF').css({
            fontSize: '0.8125rem',
            color: '#475569',
            wordBreak: 'break-all'
          })
        ])
      );
      wrap.get();
    }

    function showImageSrc(src, alt) {
      revokeObjectUrl();
      wrap.empty();
      wrap.child(
        el('img').attr('src', src).attr('alt', alt || 'Pratinjau').css({
          maxWidth: '100%',
          maxHeight: 'min(320px, 50vh)',
          objectFit: 'contain',
          display: 'block'
        })
      );
      wrap.get();
    }

    function showFile(file) {
      if (!file) {
        showPlaceholder();
        return;
      }
      if (isImageFile(file)) {
        revokeObjectUrl();
        objectUrl = URL.createObjectURL(file);
        showImageSrc(objectUrl, file.name);
        return;
      }
      showPdfLabel(file.name);
    }

    function showPath(path, label) {
      if (!path) {
        showPlaceholder();
        return;
      }
      if (isImagePath(path)) {
        showImageSrc(path, label);
        return;
      }
      showPdfLabel(fileNameFromPath(path));
    }

    function destroy() {
      revokeObjectUrl();
    }

    showPlaceholder();
    return { wrap, showFile, showPath, showPlaceholder, destroy };
  }

  function openModal(options) {
    if (typeof layout === 'undefined' || !layout.modal) {
      return false;
    }
    layout.modal({
      title: options.title || 'Upload dokumen',
      content: options.content,
      footer: options.footer,
      size: options.size || 'large',
      dismissible: options.dismissible !== false
    });
    return true;
  }

  function closeModal() {
    if (typeof layout !== 'undefined' && layout.closeModal) {
      layout.closeModal();
    }
  }

  function btnStyle(variant) {
    const base = {
      padding: '0.55rem 1rem',
      borderRadius: '0.5rem',
      fontWeight: '600',
      fontSize: '0.8125rem',
      cursor: 'pointer',
      border: 'none'
    };
    if (variant === 'outline') {
      return { ...base, background: '#fff', color: '#334155', border: '1px solid #cbd5e1' };
    }
    if (variant === 'danger') {
      return { ...base, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' };
    }
    return { ...base, background: '#2563eb', color: '#fff' };
  }

  function makeButton(label, variant, onClick) {
    const b = el('button').attr('type', 'button').text(label).css(btnStyle(variant));
    b.click(onClick);
    return b;
  }

  global.UploadModal = {
    isImageFile,
    isImagePath,
    fileNameFromPath,
    createPreviewBox,
    openModal,
    closeModal,
    makeButton,
    btnStyle
  };
})(typeof window !== 'undefined' ? window : global);
