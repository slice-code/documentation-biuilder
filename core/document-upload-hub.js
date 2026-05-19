(function (global) {
  'use strict';

  const UM = () => (typeof UploadModal !== 'undefined' ? UploadModal : null);

  function getApiClient() {
    if (typeof window !== 'undefined' && window.flamboyanApp?.core?.apiClient) {
      return window.flamboyanApp.core.apiClient;
    }
    return new ApiClient({ baseUrl: '/api' });
  }

  function toast(msg, ok) {
    if (typeof layout !== 'undefined' && layout.toast) {
      layout.toast(msg, { type: ok ? 'success' : 'error' });
    }
  }

  function isImagePath(path) {
    const um = UM();
    return um ? um.isImagePath(path) : /\.(jpe?g|png|gif|webp)$/i.test(String(path || ''));
  }

  function buildUploadHub(ctx) {
    const { idBiodata, onRefresh, filterTypes } = ctx;
    const apiClient = getApiClient();
    const root = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1rem' });

    root.child(el('p').text('Klik jenis dokumen untuk membuka jendela unggah (dengan pratinjau gambar).').css({
      margin: 0,
      fontSize: '0.8125rem',
      color: '#64748b',
      lineHeight: 1.5
    }));

    const grid = el('div').css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '0.5rem'
    });
    root.child(grid);

    let summary = [];

    const renderGrid = () => {
      grid.empty();
      let types = (typeof UploadTypes !== 'undefined' && UploadTypes.ALL_TYPES) ? UploadTypes.ALL_TYPES : [];
      if (filterTypes && filterTypes.length) {
        types = types.filter((t) => filterTypes.includes(t.type));
      } else if (UploadTypes && UploadTypes.HUB_TYPES) {
        types = UploadTypes.HUB_TYPES;
      }
      const list = summary.length
        ? summary.filter((item) => !filterTypes?.length || filterTypes.includes(item.type))
        : types.map((t) => ({ type: t.type, label: t.label, count: 0, hasFile: false }));

      list.forEach((item) => {
        const tile = el('button').attr('type', 'button').css({
          textAlign: 'left',
          padding: '0.65rem 0.75rem',
          borderRadius: '0.65rem',
          border: `1px solid ${item.hasFile ? '#86efac' : '#e2e8f0'}`,
          background: item.hasFile ? '#f0fdf4' : '#fff',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: '#0f172a',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)'
        });
        tile.child(el('div').text(item.label).css({ marginBottom: '0.25rem', lineHeight: 1.3 }));
        tile.child(el('div').text(`${item.count} dok.`).css({ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }));
        tile.click(() => openTypeModal(item));
        grid.child(tile);
      });
      grid.get();
    };

    const openTypeModal = async (item) => {
      const um = UM();
      if (!um) {
        toast('Modul upload modal belum dimuat.', false);
        return;
      }

      let rows = [];
      try {
        const res = await apiClient.read(`${item.type}?id_biodata=${encodeURIComponent(idBiodata)}&perPage=100`);
        rows = res.data || [];
      } catch (e) {
        rows = [];
      }

      const body = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1rem' });

      const listSection = el('div');
      listSection.child(el('p').text('Dokumen tersimpan').css({
        margin: '0 0 0.5rem',
        fontWeight: '600',
        fontSize: '0.8125rem',
        color: '#334155'
      }));

      if (!rows.length) {
        listSection.child(el('p').text('Belum ada dokumen untuk jenis ini.').css({
          margin: 0,
          fontSize: '0.8125rem',
          color: '#94a3b8'
        }));
      } else {
        const listEl = el('div').css({ maxHeight: '200px', overflowY: 'auto' });
        rows.forEach((r) => {
          const line = el('div').css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.5rem 0',
            borderBottom: '1px solid #e2e8f0',
            fontSize: '0.8125rem'
          });

          if (r.file && isImagePath(r.file)) {
            const thumb = el('img').attr('src', r.file).attr('alt', '').css({
              width: '48px',
              height: '48px',
              objectFit: 'cover',
              borderRadius: '0.35rem',
              border: '1px solid #e2e8f0',
              flexShrink: 0
            });
            line.child(thumb);
          }

          line.child(el('span').text(r.namadok || r.file || `#${r.id}`).css({ flex: '1', minWidth: '120px' }));
          if (r.file) {
            line.child(
              el('a').attr('href', r.file).attr('target', '_blank').text('Lihat').css({
                color: '#2563eb',
                fontWeight: '600',
                fontSize: '0.75rem'
              })
            );
          }
          if (r.id) {
            const del = el('button').attr('type', 'button').text('Hapus').css({
              border: 'none',
              background: 'transparent',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '600'
            });
            del.click(async () => {
              if (!confirm('Hapus dokumen ini?')) return;
              try {
                await apiClient.delete(`${item.type}/${r.id}`);
                toast('Dokumen dihapus.', true);
                um.closeModal();
                await reloadSummary();
                await openTypeModal(item);
                if (onRefresh) onRefresh();
              } catch (e) {
                toast('Gagal menghapus.', false);
              }
            });
            line.child(del);
          }
          listEl.child(line);
        });
        listSection.child(listEl);
      }
      body.child(listSection);

      body.child(el('hr').css({ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }));

      const uploadSection = el('div');
      uploadSection.child(el('p').text('Unggah dokumen baru').css({
        margin: '0 0 0.5rem',
        fontWeight: '600',
        fontSize: '0.8125rem',
        color: '#334155'
      }));

      const preview = um.createPreviewBox({ minHeight: '200px' });
      uploadSection.child(preview.wrap);

      const fileInput = el('input').attr('type', 'file').attr('accept', 'image/*,.pdf').css({
        width: '100%',
        fontSize: '0.8125rem',
        marginBottom: '0.5rem'
      });
      fileInput.get().addEventListener('change', () => {
        const f = fileInput.get()?.files?.[0];
        if (f) preview.showFile(f);
        else preview.showPlaceholder();
      });

      const nameInput = el('input').attr('type', 'text').attr('placeholder', 'Nama dokumen (opsional)').css({
        width: '100%',
        padding: '0.5rem',
        borderRadius: '0.4rem',
        border: '1px solid #d1d5db',
        marginBottom: '0.5rem',
        fontSize: '0.8125rem',
        boxSizing: 'border-box'
      });
      const ketInput = el('input').attr('type', 'text').attr('placeholder', 'Keterangan').css({
        width: '100%',
        padding: '0.5rem',
        borderRadius: '0.4rem',
        border: '1px solid #d1d5db',
        marginBottom: '0.5rem',
        fontSize: '0.8125rem',
        boxSizing: 'border-box'
      });

      uploadSection.child([fileInput, nameInput, ketInput]);
      body.child(uploadSection);

      const footer = el('div').css({
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        flexWrap: 'wrap',
        marginTop: '0.25rem'
      });

      const cancelBtn = um.makeButton('Batal', 'outline', () => {
        preview.destroy();
        um.closeModal();
      });

      const uploadBtn = um.makeButton('Unggah', 'primary', async () => {
        const fileEl = fileInput.get();
        if (!fileEl?.files?.length) {
          toast('Pilih file terlebih dahulu.', false);
          return;
        }
        const fd = new FormData();
        fd.append('id_biodata', idBiodata);
        fd.append('doc_type', item.type);
        fd.append('file', fileEl.files[0]);
        if (nameInput.get().value) fd.append('namadok', nameInput.get().value);
        if (ketInput.get().value) fd.append('keterangan', ketInput.get().value);

        uploadBtn.disabled(true).css({ opacity: '0.7' });
        try {
          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            credentials: 'include',
            body: fd
          });
          let json;
          try {
            json = await res.json();
          } catch (e) {
            throw new Error(`Upload gagal (HTTP ${res.status})`);
          }
          if (!json.success) throw new Error(json.error || 'Upload gagal');
          toast('Dokumen terunggah.', true);
          preview.destroy();
          um.closeModal();
          await reloadSummary();
          if (onRefresh) onRefresh();
        } catch (e) {
          toast(e.message || 'Upload gagal.', false);
        } finally {
          uploadBtn.disabled(false).css({ opacity: '1' });
        }
      });

      footer.child([cancelBtn, uploadBtn]);

      um.openModal({
        title: item.label,
        content: body,
        footer,
        size: 'large'
      });
    };

    async function reloadSummary() {
      try {
        const res = await apiClient.read(`documents/summary?id_biodata=${encodeURIComponent(idBiodata)}`);
        summary = res.data || [];
      } catch (e) {
        summary = [];
      }
      renderGrid();
    }

    reloadSummary();
    return root;
  }

  global.DocumentUploadHub = { buildUploadHub };
})(typeof window !== 'undefined' ? window : global);
