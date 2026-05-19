(function (global) {
  'use strict';

  const PRIMARY_DOCS = [
    { key: 'ktp', label: 'KTP', icon: 'fas fa-id-card' },
    { key: 'kk', label: 'Kartu Keluarga', icon: 'fas fa-users' },
    { key: 'akte', label: 'Akte Kelahiran', icon: 'fas fa-file-certificate' },
    { key: 'ijazah', label: 'Ijazah', icon: 'fas fa-graduation-cap' },
    { key: 'paspor', label: 'Paspor', icon: 'fas fa-passport' },
    { key: 'arc', label: 'ARC', icon: 'fas fa-address-card' }
  ];

  const EXTRA_DOCS = [
    { key: 'si', label: 'Surat Izin (SI)' },
    { key: 'sn', label: 'Surat Nikah (SN)' },
    { key: 'asuransi', label: 'Asuransi' },
    { key: 'skck', label: 'SKCK' },
    { key: 'fingerprint', label: 'Fingerprint' },
    { key: 'visa', label: 'Visa (scan)' },
    { key: 'pap', label: 'PAP' },
    { key: 'medikal1', label: 'Medikal 1' },
    { key: 'medikal2', label: 'Medikal 2' },
    { key: 'medikal3', label: 'Medikal 3' }
  ];

  function isRealFile(filePath) {
    if (!filePath || String(filePath).trim() === '') return false;
    const base = String(filePath).split('/').pop().toLowerCase();
    if (base === 'profile.jpg' || base === 'profile.png') return false;
    return true;
  }

  function isImagePath(filePath) {
    if (typeof UploadModal !== 'undefined') return UploadModal.isImagePath(filePath);
    return /\.(jpe?g|png|gif|webp)$/i.test(String(filePath || ''));
  }

  function fileNameFromPath(filePath) {
    if (!filePath) return '';
    return String(filePath).split('/').pop();
  }

  function toast(msg, ok) {
    if (typeof layout !== 'undefined' && layout.toast) {
      layout.toast(msg, { type: ok ? 'success' : 'error' });
    }
  }

  function openUploadModal(spec, record, idBiodata, onRefresh) {
    const um = typeof UploadModal !== 'undefined' ? UploadModal : null;
    if (!um) {
      toast('Modul upload belum dimuat.', false);
      return;
    }

    const currentPath = record ? record[spec.key] : '';
    const hasFile = isRealFile(currentPath);

    const body = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' });

    if (hasFile) {
      body.child(el('p').text('File saat ini').css({
        margin: 0,
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#64748b'
      }));
    }

    const preview = um.createPreviewBox({ minHeight: '220px' });
    if (hasFile) {
      preview.showPath(currentPath, spec.label);
    } else {
      preview.showPlaceholder('Belum ada file — pilih file di bawah');
    }

    body.child(preview.wrap);

    const fileInput = el('input').attr('type', 'file').attr('accept', 'image/*,.pdf').css({
      width: '100%',
      fontSize: '0.8125rem'
    });
    fileInput.get().addEventListener('change', () => {
      const f = fileInput.get()?.files?.[0];
      if (f) preview.showFile(f);
      else if (hasFile) preview.showPath(currentPath, spec.label);
      else preview.showPlaceholder();
    });

    body.child(fileInput);

    if (hasFile) {
      body.child(
        el('a').attr('href', currentPath).attr('target', '_blank').text('Buka file di tab baru').css({
          fontSize: '0.8125rem',
          fontWeight: '600',
          color: '#2563eb'
        })
      );
    }

    const footer = el('div').css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.5rem',
      flexWrap: 'wrap'
    });

    if (hasFile) {
      footer.child(um.makeButton('Hapus file', 'danger', async () => {
        if (!confirm(`Hapus file ${spec.label}?`)) return;
        try {
          const res = await fetch('/api/documents/dokumen-identitas', {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_biodata: idBiodata, field: spec.key })
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || 'Gagal menghapus');
          toast('File dihapus.', true);
          preview.destroy();
          um.closeModal();
          if (onRefresh) await onRefresh();
        } catch (e) {
          toast(e.message || 'Gagal menghapus.', false);
        }
      }));
    }

    footer.child(um.makeButton('Batal', 'outline', () => {
      preview.destroy();
      um.closeModal();
    }));

    const uploadBtn = um.makeButton(hasFile ? 'Ganti file' : 'Unggah', 'primary', async () => {
      const input = fileInput.get();
      if (!input?.files?.length) {
        toast('Pilih file dulu.', false);
        return;
      }
      const fd = new FormData();
      fd.append('id_biodata', idBiodata);
      fd.append('field', spec.key);
      fd.append('file', input.files[0]);

      uploadBtn.disabled(true).css({ opacity: '0.7' });
      try {
        const res = await fetch('/api/documents/dokumen-identitas', {
          method: 'POST',
          credentials: 'include',
          body: fd
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Upload gagal');
        toast(`${spec.label} terunggah.`, true);
        preview.destroy();
        um.closeModal();
        if (onRefresh) await onRefresh();
      } catch (e) {
        toast(e.message || 'Upload gagal.', false);
      } finally {
        uploadBtn.disabled(false).css({ opacity: '1' });
      }
    });
    footer.child(uploadBtn);

    um.openModal({
      title: spec.label,
      content: body,
      footer,
      size: 'medium'
    });
  }

  function buildDocCard(spec, record, idBiodata, onRefresh) {
    const currentPath = record ? record[spec.key] : '';
    const hasFile = isRealFile(currentPath);

    const card = el('div').css({
      border: `1px solid ${hasFile ? '#86efac' : '#e2e8f0'}`,
      borderRadius: '0.75rem',
      background: hasFile ? '#f0fdf4' : '#fff',
      padding: '0.85rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.65rem',
      minHeight: '140px',
      cursor: 'pointer',
      transition: 'box-shadow 0.15s ease'
    });
    card.get().addEventListener('mouseenter', () => {
      card.css({ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' });
    });
    card.get().addEventListener('mouseleave', () => {
      card.css({ boxShadow: 'none' });
    });

    const head = el('div').css({ display: 'flex', alignItems: 'center', gap: '0.45rem' });
    if (spec.icon) head.child(el('i').class(spec.icon).css({ color: '#2563eb', fontSize: '0.9rem' }));
    head.child(el('span').text(spec.label).css({ fontWeight: '700', fontSize: '0.8125rem', color: '#0f172a' }));
    card.child(head);

    const preview = el('div').css({
      flex: '1',
      minHeight: '72px',
      borderRadius: '0.5rem',
      border: '1px dashed #cbd5e1',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative'
    });

    if (hasFile && isImagePath(currentPath)) {
      preview.child(
        el('img').attr('src', currentPath).attr('alt', spec.label).css({
          maxWidth: '100%',
          maxHeight: '100px',
          objectFit: 'contain'
        })
      );
    } else if (hasFile) {
      preview.child(
        el('div').css({ textAlign: 'center', padding: '0.5rem' }).child([
          el('i').class('fas fa-file-pdf').css({ fontSize: '1.75rem', color: '#dc2626', display: 'block', marginBottom: '0.35rem' }),
          el('span').text(fileNameFromPath(currentPath)).css({ fontSize: '0.7rem', color: '#475569', wordBreak: 'break-all' })
        ])
      );
    } else {
      preview.child(
        el('span').text('Belum ada file').css({ fontSize: '0.75rem', color: '#94a3b8' })
      );
    }
    card.child(preview);

    const actionHint = el('span').text(hasFile ? 'Klik untuk ganti file' : 'Klik untuk unggah').css({
      fontSize: '0.7rem',
      color: '#64748b',
      fontWeight: '500'
    });
    card.child(actionHint);

    card.click((e) => {
      e.stopPropagation();
      openUploadModal(spec, record, idBiodata, onRefresh);
    });

    return card;
  }

  function buildDokumenIdentitasPanel(ctx) {
    const { idBiodata, record, onRefresh } = ctx;
    const root = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1rem' });

    root.child(el('p').text('Klik kartu dokumen untuk membuka jendela unggah dengan pratinjau gambar.').css({
      margin: 0,
      fontSize: '0.8125rem',
      color: '#64748b',
      lineHeight: 1.5
    }));

    const primaryGrid = el('div').css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '0.75rem'
    });
    PRIMARY_DOCS.forEach((spec) => {
      primaryGrid.child(buildDocCard(spec, record, idBiodata, onRefresh));
    });
    root.child(primaryGrid);

    root.child(el('h4').text('Dokumen tambahan').css({
      margin: '0.25rem 0 0',
      fontSize: '0.875rem',
      fontWeight: '700',
      color: '#334155'
    }));

    const extraGrid = el('div').css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '0.75rem'
    });
    EXTRA_DOCS.forEach((spec) => {
      extraGrid.child(buildDocCard(spec, record, idBiodata, onRefresh));
    });
    root.child(extraGrid);

    if (!record?.id) {
      root.child(el('p').text('Baris dokumen akan dibuat otomatis saat file pertama diunggah.').css({
        margin: 0,
        fontSize: '0.75rem',
        color: '#94a3b8',
        fontStyle: 'italic'
      }));
    }

    return root;
  }

  global.DokumenIdentitasPanel = {
    buildDokumenIdentitasPanel,
    PRIMARY_DOCS,
    EXTRA_DOCS
  };
})(typeof window !== 'undefined' ? window : global);
