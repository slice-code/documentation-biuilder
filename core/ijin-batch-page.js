/**
 * Batch surat rekom ijin — pola PAP: header batch + halaman detail CTKI (bukan CRUD insert TKI manual)
 */
(function (global) {
  'use strict';

  const LIST_PATH = '/print/surat_rekom_ijin_batch';
  const DETAIL_PATH = '/print/surat_rekom_ijin_batch/:id';

  function api() {
    if (typeof window !== 'undefined' && window.flamboyanApp?.core?.apiClient) {
      return window.flamboyanApp.core.apiClient;
    }
    return new ApiClient({ baseUrl: '/api' });
  }

  function toast(msg, type) {
    if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: type || 'info' });
  }

  function btnStyle(bg, color) {
    return {
      padding: '0.45rem 0.75rem',
      borderRadius: '0.45rem',
      border: 'none',
      background: bg,
      color: color || '#fff',
      fontWeight: '600',
      fontSize: '0.75rem',
      cursor: 'pointer'
    };
  }

  function parseDetailIdFromHash() {
    let h = (window.location.hash || '').replace(/^#/, '') || '/';
    if (!h.startsWith('/')) h = '/' + h;
    const parts = h.split('/').filter(Boolean);
    const idx = parts.indexOf('surat_rekom_ijin_batch');
    if (idx >= 0 && parts[idx + 1] && parts[idx + 1] !== 'create') {
      return decodeURIComponent(parts[idx + 1]);
    }
    return null;
  }

  function createBiodataSelect(opts = {}) {
    if (typeof PrintBatchEngine !== 'undefined' && PrintBatchEngine.createBiodataSelect) {
      return PrintBatchEngine.createBiodataSelect(opts);
    }
    const wrap = el('div');
    const inp = el('input').attr('type', 'text').attr('placeholder', opts.placeholder || 'ID biodata');
    wrap.child(inp);
    return {
      el: wrap,
      getValue: () => inp.get().value.trim()
    };
  }

  function registerIjinBatchPage() {
    if (typeof layout === 'undefined') return;

    layout.addPage({
      path: LIST_PATH,
      pageContentPadding: '1.25rem',
      component: () => buildListPage()
    });

    layout.addPage({
      path: DETAIL_PATH,
      pageContentPadding: '1.25rem',
      component: () => buildDetailPage(parseDetailIdFromHash())
    });
  }

  function openHeaderForm(title, initial = {}, onSaved) {
    const tgl = el('input').attr('type', 'date').css({
      width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem'
    });
    if (initial.tgl) tgl.get().value = String(initial.tgl).slice(0, 10);
    const tipe = el('select').css({
      width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem'
    });
    ['PORTRAIT', 'LANDSCAPE'].forEach((v) => {
      const o = el('option').attr('value', v).text(v);
      if ((initial.tipe || 'PORTRAIT') === v) o.attr('selected', 'selected');
      tipe.child(o);
    });

    const body = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' });
    body.child(el('label').text('Tanggal surat').css({ fontWeight: '600', fontSize: '0.8rem' }));
    body.child(tgl);
    body.child(el('label').text('Orientasi cetak').css({ fontWeight: '600', fontSize: '0.8rem' }));
    body.child(tipe);
    body.child(el('p').text('Daftar CTKI ditambahkan di halaman detail (seperti PAP), bukan di form ini.').css({
      margin: 0, fontSize: '0.78rem', color: '#64748b'
    }));

    const footer = el('motion.div').css({
      display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e5e7eb'
    });
    footer.child(el('button').attr('type', 'button').text('Batal').css(btnStyle('#e2e8f0', '#334155')).click(() => layout.closeModal()));
    footer.child(el('button').attr('type', 'button').text('Simpan').css(btnStyle('#2563eb')).click(async () => {
      const payload = { tgl: tgl.get().value, tipe: tipe.get().value, tki: initial.tki || '' };
      try {
        if (initial.id) await api().update(`letters/ijin-batch/${initial.id}`, payload);
        else await api().create('letters/ijin-batch', payload);
        layout.closeModal();
        toast('Disimpan.', 'success');
        if (onSaved) onSaved();
      } catch (e) { toast(e.message, 'error'); }
    }));
    layout.modal({ title, content: body, footer, dismissible: true, size: 'medium' });
  }

  function buildListPage() {
    const root = el('div').css({
      maxWidth: '1100px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    });

    const head = el('motion.div').css({
      display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center'
    });
    head.child(el('motion.div').child([
      el('motion.h1').text('Surat Rekom Ijin').css({ margin: '0 0 0.25rem', fontSize: '1.35rem', fontWeight: '800' }),
      el('motion.p').text('Batch per tanggal — tambah CTKI di halaman detail (pola sama PAP).').css({
        margin: 0, fontSize: '0.85rem', color: '#64748b'
      })
    ]));
    const back = el('motion.button').attr('type', 'button').text('← Print Surat').css(btnStyle('#fff', '#334155')).css({ border: '1px solid #cbd5e1' });
    back.click(() => layout.navigate('/printsurat'));
    const addBtn = el('motion.button').attr('type', 'button').text('+ Tambah Batch').css(btnStyle('#16a34a'));
    head.child([back, addBtn]);
    root.child(head);

    let listState = { page: 1, perPage: 25 };
    let tableInstance = null;
    let refresh = () => {};

    const tableSchema = {
      columns: [
        {
          key: '_ops',
          label: 'Opsi',
          type: 'actions',
          actions: [
            {
              label: 'CTKI',
              icon: 'fas fa-users',
              onClick: (row) => layout.navigate(`${LIST_PATH}/${row.id}`)
            },
            {
              label: 'Print Word',
              icon: 'fas fa-file-word',
              onClick: async (row) => {
                try {
                  await PrintSuratClient.downloadIjinBatchWord(row.id);
                  toast('Word diunduh.', 'success');
                } catch (e) { toast(e.message, 'error'); }
              }
            },
            {
              label: 'Edit',
              icon: 'fas fa-pen',
              onClick: (row) => openHeaderForm('Ubah Batch', row, refresh)
            },
            {
              label: 'Hapus',
              icon: 'fas fa-trash',
              variant: 'danger',
              confirm: true,
              onClick: async (row) => {
                await api().delete(`letters/ijin-batch/${row.id}`);
                toast('Dihapus.', 'success');
                refresh();
              }
            }
          ]
        },
        { key: 'tgl', label: 'Tanggal', sortable: false },
        { key: 'tipe', label: 'Orientasi', sortable: false },
        { key: 'jumlah_ctki', label: 'Jumlah CTKI', sortable: false }
      ],
      features: { pagination: true, search: false, perPage: 25 },
      emptyText: 'Belum ada batch ijin.'
    };

    tableInstance = TableBuilder.build(tableSchema, {
      data: [],
      onPageChange: (p) => { listState.page = p; refresh(); },
      onPerPageChange: (pp, p) => { listState.perPage = pp; listState.page = p; refresh(); }
    });
    tableInstance.el.css({ border: '1px solid #e2e8f0', borderRadius: '0.75rem' });
    root.child(tableInstance.el);

    refresh = async () => {
      tableInstance.setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(listState.page),
          perPage: String(listState.perPage)
        });
        const res = await api().read(`letters/ijin-batch?${params}`);
        tableInstance.setData(res.data || [], res.pagination);
      } catch (e) {
        toast(e.message, 'error');
        tableInstance.setData([]);
      } finally {
        tableInstance.setLoading(false);
      }
    };

    addBtn.click(() => openHeaderForm('Tambah Batch Ijin', {}, refresh));
    refresh();
    return root.get();
  }

  function buildDetailPage(batchId) {
    if (!batchId) {
      return el('div').text('ID batch tidak valid.').get();
    }

    const root = el('motion.div').css({
      maxWidth: '900px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    });

    const titleEl = el('motion.h1').text(`Detail CTKI — Batch #${batchId}`).css({
      margin: 0, fontSize: '1.25rem', fontWeight: '800'
    });
    const metaEl = el('motion.p').text('Memuat…').css({ margin: 0, fontSize: '0.85rem', color: '#64748b' });
    root.child(titleEl);
    root.child(metaEl);

    const toolbar = el('motion.div').css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' });
    const back = el('motion.button').attr('type', 'button').text('← Kembali').css(btnStyle('#64748b'));
    back.click(() => layout.navigate(LIST_PATH));
    const addCtki = el('motion.button').attr('type', 'button').text('+ Tambah CTKI').css(btnStyle('#16a34a'));
    const printBtn = el('motion.button').attr('type', 'button').text('Print Word').css(btnStyle('#2563eb'));
    printBtn.click(async () => {
      try {
        await PrintSuratClient.downloadIjinBatchWord(batchId);
        toast('Word diunduh.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    toolbar.child([back, addCtki, printBtn]);
    root.child(toolbar);

    let refreshDetail = () => {};

    const tableSchema = {
      columns: [
        {
          key: '_del',
          label: 'Opsi',
          type: 'actions',
          actions: [{
            label: 'Hapus',
            icon: 'fas fa-trash',
            variant: 'danger',
            confirm: true,
            onClick: async (row) => {
              if (!confirm('Hapus CTKI dari batch ini?')) return;
              try {
                await api().delete(`letters/ijin-batch/${batchId}/details/${encodeURIComponent(row.id_biodata)}`);
                toast('CTKI dihapus.', 'success');
                refreshDetail();
              } catch (e) { toast(e.message, 'error'); }
            }
          }]
        },
        { key: 'no', label: 'No', sortable: false },
        { key: 'id_biodata', label: 'ID Biodata', sortable: false },
        { key: 'nama', label: 'Nama', sortable: false },
        { key: 'nodisnaker', label: 'No. Disnaker', sortable: false }
      ],
      features: { pagination: false, search: false },
      emptyText: 'Belum ada CTKI. Klik Tambah CTKI.'
    };

    const tableInstance = TableBuilder.build(tableSchema, { data: [] });
    tableInstance.el.css({ border: '1px solid #e2e8f0', borderRadius: '0.75rem' });
    root.child(tableInstance.el);

    refreshDetail = async () => {
      tableInstance.setLoading(true);
      try {
        const res = await api().read(`letters/ijin-batch/${batchId}/details`);
        const batch = res.batch || {};
        metaEl.get().textContent = `Tanggal: ${batch.tgl || '—'} · Orientasi: ${batch.tipe || 'PORTRAIT'} · ${(res.data || []).length} CTKI`;
        tableInstance.setData(res.data || []);
      } catch (e) {
        toast(e.message, 'error');
        tableInstance.setData([]);
      } finally {
        tableInstance.setLoading(false);
      }
    };

    addCtki.click(() => {
      if (FormBuilder.closeAllSearchSelects) FormBuilder.closeAllSearchSelects();
      const biodataPick = createBiodataSelect({ placeholder: '— Pilih TKI —', allowEmpty: false });
      const body = el('div').child(biodataPick.el);
      const footer = el('div').css({
        display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e5e7eb'
      });
      footer.child(el('button').attr('type', 'button').text('Batal').css(btnStyle('#e2e8f0', '#334155')).click(() => layout.closeModal()));
      footer.child(el('button').attr('type', 'button').text('Simpan').css(btnStyle('#2563eb')).click(async () => {
        const idBio = biodataPick.getValue();
        if (!idBio) { toast('Pilih TKI.', 'warning'); return; }
        try {
          await api().create(`letters/ijin-batch/${batchId}/details`, { id_biodata: idBio });
          layout.closeModal();
          toast('CTKI ditambahkan.', 'success');
          refreshDetail();
        } catch (e) { toast(e.message, 'error'); }
      }));
      layout.modal({ title: 'Tambah CTKI', content: body, footer, dismissible: true, size: 'small' });
    });

    refreshDetail();
    return root.get();
  }

  global.IjinBatchPage = { registerIjinBatchPage };
})(typeof window !== 'undefined' ? window : global);
