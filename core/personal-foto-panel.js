(function (global) {
  'use strict';

  function isRealFoto(filePath) {
    if (!filePath || String(filePath).trim() === '') return false;
    const s = String(filePath);
    if (s.startsWith('/uploads/')) return true;
    const base = s.split('/').pop().toLowerCase();
    return base !== 'profile.jpg' && base !== 'profile.png';
  }

  function isImagePath(filePath) {
    return /\.(jpe?g|png|gif|webp)$/i.test(String(filePath || ''));
  }

  function toast(msg, ok) {
    if (typeof layout !== 'undefined' && layout.toast) {
      layout.toast(msg, { type: ok ? 'success' : 'error' });
    }
  }

  function buildPersonalFotoPanel(ctx) {
    const { idBiodata, record, onRefresh } = ctx;
    const fotoPath = record?.foto || '';
    const hasFoto = isRealFoto(fotoPath);

    const card = el('div').css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '1.25rem',
      alignItems: 'flex-start',
      padding: '1rem 1.1rem',
      marginBottom: '1rem',
      border: '1px solid #e2e8f0',
      borderRadius: '0.75rem',
      background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)'
    });

    const previewWrap = el('div').css({
      width: '140px',
      height: '175px',
      flexShrink: '0',
      borderRadius: '0.65rem',
      border: `2px solid ${hasFoto ? '#93c5fd' : '#e2e8f0'}`,
      background: '#f1f5f9',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)'
    });

    if (hasFoto && isImagePath(fotoPath)) {
      previewWrap.child(
        el('img').attr('src', fotoPath).attr('alt', 'Foto TKI').css({
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        })
      );
    } else {
      previewWrap.child(
        el('div').css({ textAlign: 'center', color: '#94a3b8', padding: '0.5rem' }).child([
          el('i').class('fas fa-user').css({ fontSize: '2.5rem', display: 'block', marginBottom: '0.35rem' }),
          el('span').text('Belum ada foto').css({ fontSize: '0.7rem' })
        ])
      );
    }

    const side = el('div').css({ flex: '1', minWidth: '200px' });
    side.child(el('h4').text('Foto TKI').css({
      margin: '0 0 0.35rem',
      fontSize: '0.95rem',
      fontWeight: '700',
      color: '#0f172a'
    }));
    side.child(el('p').text('Unggah foto resmi calon TKI (JPG/PNG/WebP). Tampil di header biodata dan cetakan.').css({
      margin: '0 0 0.75rem',
      fontSize: '0.8125rem',
      color: '#64748b',
      lineHeight: 1.45
    }));

    if (hasFoto) {
      const links = el('div').css({ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.65rem' });
      links.child(
        el('a').attr('href', fotoPath).attr('target', '_blank').text('Buka foto ukuran penuh').css({
          fontSize: '0.8125rem',
          fontWeight: '600',
          color: '#2563eb'
        })
      );
      const clearBtn = el('button').attr('type', 'button').text('Hapus foto').css({
        border: 'none',
        background: 'transparent',
        color: '#dc2626',
        fontSize: '0.8125rem',
        fontWeight: '600',
        cursor: 'pointer',
        padding: 0
      });
      clearBtn.click(async () => {
        if (!confirm('Hapus foto TKI ini?')) return;
        try {
          const res = await fetch('/api/documents/personal-foto', {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_biodata: idBiodata })
          });
          let json;
          try {
            json = await res.json();
          } catch (e) {
            throw new Error(res.status === 405
              ? 'Server belum mendukung hapus foto. Restart: npm start.'
              : `Gagal menghapus (HTTP ${res.status})`);
          }
          if (!json.success) throw new Error(json.error || 'Gagal menghapus');
          toast('Foto dihapus.', true);
          if (onRefresh) await onRefresh();
        } catch (e) {
          toast(e.message || 'Gagal menghapus.', false);
        }
      });
      links.child(clearBtn);
      side.child(links);
    }

    const fileInput = el('input').attr('type', 'file').attr('accept', 'image/jpeg,image/png,image/webp,image/gif').css({
      width: '100%',
      maxWidth: '320px',
      fontSize: '0.8125rem',
      marginBottom: '0.5rem'
    });

    const uploadBtn = el('button').attr('type', 'button').text(hasFoto ? 'Ganti foto' : 'Unggah foto').css({
      padding: '0.5rem 1rem',
      borderRadius: '0.5rem',
      border: 'none',
      background: '#2563eb',
      color: '#fff',
      fontWeight: '600',
      fontSize: '0.8125rem',
      cursor: 'pointer'
    });

    const statusEl = el('span').css({ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' });

    uploadBtn.click(async () => {
      const input = fileInput.get();
      if (!input?.files?.length) {
        toast('Pilih file foto dulu.', false);
        return;
      }
      const fd = new FormData();
      fd.append('id_biodata', idBiodata);
      fd.append('file', input.files[0]);

      uploadBtn.disabled(true).css({ opacity: '0.7' });
      statusEl.text('Mengunggah...');
      try {
        const res = await fetch('/api/documents/personal-foto', {
          method: 'POST',
          credentials: 'include',
          body: fd
        });
        let json;
        try {
          json = await res.json();
        } catch (e) {
          throw new Error(res.status === 405
            ? 'Server belum mendukung upload foto. Restart: npm start di folder project.'
            : `Upload gagal (HTTP ${res.status})`);
        }
        if (!json.success) throw new Error(json.error || 'Upload gagal');
        statusEl.text('Foto berhasil diunggah.').css({ color: '#15803d' });
        toast('Foto TKI tersimpan.', true);
        input.value = '';
        if (onRefresh) await onRefresh();
      } catch (e) {
        statusEl.text('Gagal mengunggah.').css({ color: '#dc2626' });
        toast(e.message || 'Upload gagal.', false);
      } finally {
        uploadBtn.disabled(false).css({ opacity: '1' });
      }
    });

    side.child([fileInput, uploadBtn, statusEl]);
    card.child([previewWrap, side]);
    return card;
  }

  global.PersonalFotoPanel = {
    buildPersonalFotoPanel,
    isRealFoto
  };
})(typeof window !== 'undefined' ? window : global);
