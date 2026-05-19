/**
 * Print Batch Engine — template batch print (PAP/KTKLN) parity surat_rekom_tabelpap
 * List server-side (TableBuilder + pagination API), form via preset (FormBuilder + layout.modal)
 */
(function (global) {
  'use strict';

  const TEMPLATES_URL = './appjson/print-batch-templates.json';
  let _config = null;
  let _loadPromise = null;
  const _hooks = {};

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
      padding: '0.4rem 0.65rem',
      borderRadius: '0.45rem',
      border: 'none',
      background: bg,
      color: color || '#fff',
      fontWeight: '600',
      fontSize: '0.75rem',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    };
  }

  async function ensureLoaded() {
    if (_config) return _config;
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch(TEMPLATES_URL, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        _config = data || { batches: {}, formTemplates: {} };
        return _config;
      })
      .catch((err) => {
        console.warn('[PrintBatchEngine] Gagal memuat template', err);
        _config = { batches: {}, formTemplates: {} };
        return _config;
      });
    return _loadPromise;
  }

  function getBatchConfig(batchId) {
    return _config?.batches?.[batchId] || null;
  }

  function papFieldWithPreset(field) {
    if (field.preset && typeof FormFieldPresets !== 'undefined' && FormFieldPresets.mergeFieldWithPreset) {
      return FormFieldPresets.mergeFieldWithPreset(field, field.preset);
    }
    return field;
  }

  async function resolveFormSchema(templateId) {
    await ensureLoaded();
    const tpl = _config.formTemplates?.[templateId];
    if (!tpl) return null;
    let form = {
      hideButtons: true,
      fields: (tpl.fields || []).map((f) => papFieldWithPreset({ ...f }))
    };
    if (typeof FormFieldPresets !== 'undefined' && FormFieldPresets.resolveFormSchema) {
      form = await FormFieldPresets.resolveFormSchema(form, {});
    }
    if (FormBuilder.prepareFormSchema) {
      form = await FormBuilder.prepareFormSchema(form, api(), {});
    }
    return form;
  }

  function formModalFooter() {
    const footer = el('div').css({
      display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
      paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '0.5rem'
    });
    footer.child(el('button').attr('type', 'button').text('Batal').css(btnStyle('#e2e8f0', '#334155')).click(() => {
      if (layout?.closeModal) layout.closeModal();
    }));
    footer.child(el('button').attr('type', 'button').text('Simpan').css(btnStyle('#2563eb')).click(() => {
      const formEl = document.getElementById('crud-form');
      if (formEl) formEl.requestSubmit();
    }));
    return footer;
  }

  /** Select TKI filter / detail — sama preset personal */
  function createBiodataSelect(opts = {}) {
    const {
      placeholder = '— Semua TKI —',
      emptyLabel = '— Semua TKI —',
      initialValue = '',
      allowEmpty = true
    } = opts;

    const optionsFrom = {
      resource: 'personal',
      value: 'id_biodata',
      label: ['id_biodata', 'nama'],
      labelFormat: '{{id_biodata}} {{nama}}',
      perPage: 10000,
      sort: 'id_biodata',
      order: 'asc'
    };

    let field = {
      name: 'id_biodata',
      type: 'select',
      placeholder,
      searchable: true,
      remoteSearch: false,
      searchPlaceholder: 'Ketik ID biodata atau nama TKI…',
      optionsFrom
    };
    if (allowEmpty) field.prependEmptyOption = { value: '', label: emptyLabel };
    if (FormFieldPresets?.mergeFieldWithPreset) {
      const merged = FormFieldPresets.mergeFieldWithPreset({ name: 'id_biodata', placeholder }, 'id_biodata');
      field = {
        ...merged,
        placeholder,
        searchable: true,
        remoteSearch: false,
        searchPlaceholder: field.searchPlaceholder,
        optionsFrom: { ...optionsFrom, ...(merged.optionsFrom || {}) }
      };
      if (allowEmpty) field.prependEmptyOption = { value: '', label: emptyLabel };
      else delete field.prependEmptyOption;
    }
    delete field.options;

    const formData = { id_biodata: initialValue || '' };
    const wrap = FormBuilder.createSelect(field, initialValue || '', false, formData, api());
    wrap.css({ minWidth: '260px', width: '100%', maxWidth: '360px' });
    return {
      el: wrap,
      getValue: () => String(formData.id_biodata || '').trim(),
      setValue: (v) => {
        const val = v == null ? '' : String(v);
        formData.id_biodata = val;
        if (wrap._crudSelectApi) wrap._crudSelectApi.setValue(val);
      }
    };
  }

  async function openBatchFormModal(batchCfg, opts) {
    const { title, initial, onSave } = opts;
    if (!layout?.modal || !FormBuilder) {
      toast('Modal form tidak tersedia.', 'error');
      return;
    }
    if (FormFieldPresets?.ensureLoaded) await FormFieldPresets.ensureLoaded();
    if (FormBuilder.closeAllSearchSelects) FormBuilder.closeAllSearchSelects();

    const formSchema = await resolveFormSchema(batchCfg.formTemplate);
    if (!formSchema) {
      toast('Template form tidak ditemukan.', 'error');
      return;
    }

    const form = FormBuilder.build(formSchema, {
      apiClient: api(),
      initialData: { ...(batchCfg.defaultFormValues || {}), ...(initial || {}) },
      onSubmit: async (formData) => {
        try {
          await onSave(formData);
          layout.closeModal();
        } catch (err) {
          toast(err.message || 'Gagal simpan', 'error');
        }
      }
    });

    layout.modal({
      title,
      content: form.el,
      footer: formModalFooter(),
      dismissible: true,
      size: 'medium'
    });
  }

  function formatCell(value, col) {
    if (value == null || value === '') return '—';
    if (col.format === 'stripBr') return String(value).replace(/<br\s*\/?>/gi, ' ').trim();
    return String(value);
  }

  function apiPathReplace(path, params) {
    let p = path;
    Object.keys(params).forEach((k) => {
      p = p.replace(`:${k}`, encodeURIComponent(params[k]));
    });
    return p;
  }

  function cellDisplay(val, col) {
    if (val == null || val === '') return '—';
    if (col?.format === 'stripBr') return String(val).replace(/<br\s*\/?>/gi, ' ').trim();
    return String(val);
  }

  function buildDefaultBatchPdfDoc(payload, batchCfg) {
    const h = payload.header || {};
    const rows = payload.details || [];
    const headerLines = (batchCfg.table?.columns || []).map((c) => ({
      text: `${c.label}: ${cellDisplay(h[c.key], c)}`,
      margin: [0, 0, 0, 2]
    }));
    return {
      content: [
        { text: batchCfg.title || batchCfg.resource || 'Print Surat', style: 'h1', margin: [0, 0, 0, 8] },
        ...headerLines,
        { text: 'Daftar CTKI', style: 'h2', margin: [0, 12, 0, 6] },
        {
          table: {
            widths: [28, 90, '*'],
            body: [
              [{ text: 'No', style: 'th' }, { text: 'ID Biodata', style: 'th' }, { text: 'Nama', style: 'th' }],
              ...(rows.length ? rows.map((r, i) => [String(i + 1), r.id_biodata || '—', r.nama || '—']) : [['—', '—', 'Belum ada CTKI']])
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: `Dicetak: ${new Date().toLocaleString('id-ID')}`, style: 'note', margin: [0, 12, 0, 0] }
      ],
      styles: {
        h1: { fontSize: 14, bold: true },
        h2: { fontSize: 11, bold: true, color: '#1e40af' },
        th: { bold: true, fillColor: '#f1f5f9' },
        note: { fontSize: 8, color: '#94a3b8', italics: true }
      },
      defaultStyle: { fontSize: 9 }
    };
  }

  async function defaultBatchPrint(row, type, batchCfg) {
    const idField = batchCfg.idField || 'id_pembuatan';
    const id = row[idField];
    if (!id) throw new Error('ID batch tidak valid');
    const batchKey = batchCfg.resource || batchCfg.batchKey;

    if (typeof PrintSuratClient !== 'undefined' && PrintSuratClient.downloadBatchWord && batchKey) {
      try {
        await PrintSuratClient.downloadBatchWord(batchKey, id, type || 'default');
        return;
      } catch (wordErr) {
        console.warn('[PrintBatch] Word gagal, fallback PDF:', wordErr.message);
      }
    }

    const apiBase = batchCfg.listApi || '';
    let pdfPath;
    if (apiBase.startsWith('print/batch/')) {
      const resource = batchKey || apiBase.replace(/^print\/batch\//, '').split('/')[0];
      pdfPath = `print/batch/${resource}/${id}/pdf?type=${encodeURIComponent(type || 'default')}`;
    } else if (apiBase === 'print/pap') {
      pdfPath = `print/pap/${id}/pdf?type=${encodeURIComponent(type || 'ppad')}`;
    } else {
      throw new Error('API cetak tidak dikonfigurasi');
    }
    const res = await api().read(pdfPath);
    if (!res.success || !res.data) throw new Error(res.error || 'Gagal memuat data cetak');
    if (typeof pdfMake === 'undefined') throw new Error('pdfMake tidak tersedia');
    const doc = buildDefaultBatchPdfDoc(res.data, batchCfg);
    const fname = `${(batchKey || 'batch').replace(/[^a-z0-9_]/gi, '_')}_${id}.pdf`;
    pdfMake.createPdf(doc).download(fname);
  }

  async function loadListData(batchCfg, state) {
    const params = new URLSearchParams();
    params.set('page', String(state.page || 1));
    params.set('perPage', String(state.perPage || batchCfg.table?.features?.perPage || 25));
    if (state.search) params.set('search', state.search);
    if (state.id_biodata) params.set('id_biodata', state.id_biodata);
    if (state.sort) params.set('sort', state.sort);
    if (state.order) params.set('order', state.order);

    const endpoint = `${batchCfg.listApi}?${params.toString()}`;
    const res = await api().read(endpoint);
    return {
      data: res.data || [],
      pagination: res.pagination || null
    };
  }

  function buildTableSchema(batchCfg, handlers) {
    const cols = [];

    cols.push({
      key: '_ops',
      label: 'Opsi',
      type: 'actions',
      actions: [
        {
          label: 'Edit',
          icon: 'fas fa-pen',
          onClick: (row) => handlers.onEdit(row)
        },
        {
          label: 'Hapus',
          icon: 'fas fa-trash',
          variant: 'danger',
          confirm: true,
          onClick: (row) => handlers.onDelete(row)
        }
      ]
    });

    (batchCfg.prints || []).forEach((pr) => {
      cols.push({
        key: `_print_${pr.type}`,
        label: pr.label || 'Print',
        type: 'actions',
        actions: [{
          label: pr.label,
          icon: 'fas fa-print',
          onClick: (row) => handlers.onPrint(row, pr.type)
        }]
      });
    });

    if (batchCfg.excelExport && typeof PrintSuratClient !== 'undefined' && PrintSuratClient.downloadSuratPengajuanExcel) {
      cols.push({
        key: '_excel',
        label: 'Excel',
        type: 'actions',
        actions: [{
          label: 'Export pinjaman',
          icon: 'fas fa-file-excel',
          onClick: async (row) => {
            const id = row[batchCfg.idField || 'id'];
            try {
              await PrintSuratClient.downloadSuratPengajuanExcel(id);
              toast('Excel diunduh.', 'success');
            } catch (e) { toast(e.message || 'Gagal export', 'error'); }
          }
        }]
      });
    }

    if (batchCfg.detail?.enabled !== false && batchCfg.detail?.path) {
      cols.push({
        key: '_detail',
        label: 'CTKI',
        type: 'actions',
        actions: [{
          label: 'Tampil CTKI',
          icon: 'fas fa-users',
          onClick: (row) => handlers.onDetail(row)
        }]
      });
    }

    (batchCfg.table?.columns || []).forEach((c) => {
      cols.push({
        key: c.key,
        label: c.label,
        sortable: Boolean(c.sortable),
        render: (val) => formatCell(val, c)
      });
    });

    return {
      columns: cols,
      features: {
        pagination: true,
        search: false,
        perPage: batchCfg.table?.features?.perPage || 25,
        perPageOptions: batchCfg.table?.features?.perPageOptions || [10, 25, 50, 100]
      },
      emptyText: batchCfg.emptyText || 'Belum ada data.'
    };
  }

  function buildListPage(batchId) {
    const batchCfg = getBatchConfig(batchId);
    if (!batchCfg) return el('div').text('Konfigurasi batch tidak ditemukan.').get();

    const hooks = _hooks[batchId] || {};
    const idField = batchCfg.idField || 'id';

    const fieldLabelStyle = {
      display: 'block',
      fontSize: '0.75rem',
      fontWeight: '600',
      color: '#475569',
      marginBottom: '0.4rem',
      letterSpacing: '0.01em'
    };

    const fieldInputStyle = {
      width: '100%',
      padding: '0.55rem 0.75rem',
      borderRadius: '0.5rem',
      border: '1px solid #cbd5e1',
      fontSize: '0.875rem',
      outline: 'none',
      backgroundColor: '#fff',
      color: '#0f172a',
      boxSizing: 'border-box',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
    };

    const root = el('div').css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1',
      minHeight: '0',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '1rem 1.25rem 1.25rem',
      gap: '1rem',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    const pageHeader = el('div').css({
      flexShrink: '0',
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      border: '1px solid #e2e8f0',
      borderRadius: '0.875rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
      overflow: 'hidden'
    });

    const titleBlock = el('div').css({
      padding: '1.25rem 1.35rem 1rem',
      borderBottom: '1px solid #e2e8f0'
    });
    titleBlock.child(el('h1').text(batchCfg.title || batchId).css({
      margin: '0 0 0.4rem',
      fontSize: '1.35rem',
      fontWeight: '800',
      color: '#0f172a',
      letterSpacing: '-0.02em',
      lineHeight: '1.3'
    }));
    if (batchCfg.subtitle) {
      titleBlock.child(el('p').text(batchCfg.subtitle).css({
        margin: 0,
        fontSize: '0.8125rem',
        color: '#64748b',
        lineHeight: '1.5',
        maxWidth: '52rem'
      }));
    }
    pageHeader.child(titleBlock);

    const filterState = { id_biodata: '', search: '' };
    let filterBar = null;
    let searchIn = null;

    if (batchCfg.filters?.idBiodata || batchCfg.filters?.search) {
      const filterSection = el('div').css({
        padding: '1rem 1.35rem 1.15rem',
        borderBottom: '1px solid #e2e8f0'
      });
      filterSection.child(el('div').text('Pencarian & filter').css({
        margin: '0 0 0.85rem',
        fontSize: '0.7rem',
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.06em'
      }));

      filterBar = el('div').css({
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem 1rem',
        alignItems: 'end'
      });

      if (batchCfg.filters.idBiodata) {
        const tkiField = el('div').css({ minWidth: '0' });
        tkiField.child(el('span').text('ID TKI').css(fieldLabelStyle));
        const tkiWrap = el('div').css({ width: '100%' });
        const tkiSelect = createBiodataSelect();
        tkiSelect.el.css({ maxWidth: 'none', minWidth: '0' });
        tkiWrap.child(tkiSelect.el);
        tkiField.child(tkiWrap);
        filterBar.child(tkiField);
        filterBar._tkiSelect = tkiSelect;
      }

      if (batchCfg.filters.search) {
        const searchField = el('div').css({ minWidth: '0' });
        searchField.child(el('span').text('Cari data').css(fieldLabelStyle));
        const searchWrap = el('div').css({ position: 'relative', width: '100%' });
        searchWrap.child(el('i').class('fas fa-search').css({
          position: 'absolute',
          left: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#94a3b8',
          fontSize: '0.8rem',
          pointerEvents: 'none'
        }));
        searchIn = el('input').attr('type', 'search')
          .attr('placeholder', batchCfg.filters.searchPlaceholder || 'Cari…')
          .css({ ...fieldInputStyle, paddingLeft: '2.15rem' });
        searchWrap.child(searchIn);
        searchField.child(searchWrap);
        filterBar.child(searchField);
      }

      const btnCol = el('div').css({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        alignItems: 'flex-end',
        paddingBottom: '0.1rem'
      });
      const btnTampil = el('button').attr('type', 'button').text('Tampilkan').css({
        ...btnStyle('#0ea5e9'),
        padding: '0.55rem 1rem'
      });
      const btnSemua = el('button').attr('type', 'button').text('Semua').css({
        ...btnStyle('#64748b'),
        padding: '0.55rem 1rem'
      });
      btnCol.child([btnTampil, btnSemua]);
      filterBar.child(btnCol);

      filterSection.child(filterBar);
      pageHeader.child(filterSection);

      const applyFilter = () => {
        if (filterBar._tkiSelect) filterState.id_biodata = filterBar._tkiSelect.getValue();
        if (searchIn) filterState.search = (searchIn.get().value || '').trim();
        listState.page = 1;
        refreshTable();
      };
      btnTampil.click(applyFilter);
      btnSemua.click(() => {
        if (filterBar._tkiSelect) filterBar._tkiSelect.setValue('');
        if (searchIn) searchIn.get().value = '';
        filterState.id_biodata = '';
        filterState.search = '';
        listState.page = 1;
        refreshTable();
      });
      if (searchIn) {
        searchIn.keydown((e) => { if (e.key === 'Enter') applyFilter(); });
      }
    }

    const toolbar = el('div').css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.65rem',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.9rem 1.35rem 1.1rem',
      background: '#fafbfc'
    });
    const back = el('button').attr('type', 'button').text('← Print Surat').css({
      ...btnStyle('#fff', '#334155'),
      border: '1px solid #cbd5e1',
      padding: '0.5rem 0.9rem'
    });
    back.click(() => layout.navigate('/printsurat'));
    const addBtn = el('button').attr('type', 'button').text('+ Tambah Data').css({
      ...btnStyle('#16a34a'),
      padding: '0.5rem 1rem'
    });
    toolbar.child([back, addBtn]);
    pageHeader.child(toolbar);
    root.child(pageHeader);

    const listState = {
      page: 1,
      perPage: batchCfg.table?.features?.perPage || 25,
      sort: null,
      order: 'asc',
      ...filterState
    };

    let tableInstance = null;
    let refreshTable = () => {};

    const handlers = {
      onEdit: (row) => {
        const id = row[idField];
        openBatchFormModal(batchCfg, {
          title: 'Ubah Data',
          initial: row,
          onSave: async (data) => {
            await api().update(`${batchCfg.listApi}/${id}`, data);
            toast('Data diperbarui.', 'success');
            refreshTable();
          }
        });
      },
      onDelete: async (row) => {
        const id = row[idField];
        if (!confirm(`Hapus data #${id}?`)) return;
        await api().delete(`${batchCfg.listApi}/${id}`);
        toast('Data dihapus.', 'success');
        refreshTable();
      },
      onPrint: async (row, type) => {
        if (hooks.onPrint) {
          await hooks.onPrint(row, type, batchCfg);
          return;
        }
        if (batchCfg.prints?.length) {
          try {
            await defaultBatchPrint(row, type, batchCfg);
            toast('PDF diunduh.', 'success');
          } catch (e) {
            toast(e.message || 'Gagal cetak', 'error');
          }
          return;
        }
        toast('Cetak belum dikonfigurasi untuk modul ini.', 'warning');
      },
      onDetail: (row) => {
        const id = row[idField];
        const path = apiPathReplace(batchCfg.detail.path, { id });
        layout.navigate(path);
      }
    };

    const tableSchema = buildTableSchema(batchCfg, handlers);
    tableInstance = TableBuilder.build(tableSchema, {
      data: [],
      onPageChange: (page) => {
        listState.page = page;
        refreshTable();
      },
      onPerPageChange: (perPage, page) => {
        listState.perPage = perPage;
        listState.page = page;
        refreshTable();
      },
      onSort: (col, dir) => {
        listState.sort = col;
        listState.order = dir;
        refreshTable();
      }
    });

    tableInstance.el.css({ flex: '1', minHeight: '0', border: '1px solid #e2e8f0', borderRadius: '0.75rem' });
    root.child(tableInstance.el);

    refreshTable = async () => {
      tableInstance.setLoading(true);
      try {
        listState.id_biodata = filterState.id_biodata;
        listState.search = filterState.search;
        const { data, pagination } = await loadListData(batchCfg, listState);
        tableInstance.setData(data, pagination);
      } catch (e) {
        toast(e.message || 'Gagal memuat data', 'error');
        tableInstance.setData([]);
      } finally {
        tableInstance.setLoading(false);
      }
    };

    addBtn.click(() => {
      openBatchFormModal(batchCfg, {
        title: 'Tambah Data',
        initial: {},
        onSave: async (data) => {
          await api().create(batchCfg.listApi, data);
          toast('Data ditambahkan.', 'success');
          refreshTable();
        }
      });
    });

    refreshTable();
    return root.get();
  }

  function buildDetailPage(batchId, batchRowId) {
    const batchCfg = getBatchConfig(batchId);
    const detail = batchCfg?.detail;
    if (!detail) return el('div').text('Detail tidak dikonfigurasi.').get();

    const root = el('div').css({
      maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem'
    });
    const title = (detail.title || 'Detail CTKI').replace('#{id}', batchRowId);
    root.child(el('h1').text(title).css({ margin: 0, fontSize: '1.25rem', fontWeight: '800' }));

    const toolbar = el('div').css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' });
    const back = el('button').attr('type', 'button').text('← Kembali').css(btnStyle('#64748b'));
    back.click(() => layout.navigate(batchCfg.listPath || `/print/${batchId}`));
    const addCtki = el('button').attr('type', 'button').text('+ Tambah CTKI').css(btnStyle('#16a34a'));
    toolbar.child([back, addCtki]);
    root.child(toolbar);

    const listApi = apiPathReplace(detail.listApi, { id: batchRowId });
    let refreshDetail = () => {};

    const detailHandlers = {
      onDelete: async (row) => {
        if (!confirm('Hapus CTKI dari batch ini?')) return;
        const delPath = apiPathReplace(detail.deleteApi, {
          id: batchRowId,
          detailId: row[detail.detailIdField || 'id_pembuatan']
        });
        await api().delete(delPath);
        toast('CTKI dihapus.', 'success');
        refreshDetail();
      }
    };

    const detailCols = (detail.columns && detail.columns.length)
      ? detail.columns
      : [
        { key: 'id_biodata', label: 'ID Biodata' },
        { key: 'nama', label: 'Nama' }
      ];
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
            onClick: (row) => detailHandlers.onDelete(row)
          }]
        },
        ...detailCols.map((c) => ({ key: c.key, label: c.label, sortable: false }))
      ],
      features: { pagination: false, search: false },
      emptyText: 'Belum ada CTKI.'
    };

    let tableInstance = TableBuilder.build(tableSchema, { data: [] });
    tableInstance.el.css({ border: '1px solid #e2e8f0', borderRadius: '0.75rem' });
    root.child(tableInstance.el);

    refreshDetail = async () => {
      tableInstance.setLoading(true);
      try {
        const res = await api().read(listApi);
        tableInstance.setData(res.data || []);
      } catch (e) {
        toast(e.message || 'Gagal memuat detail', 'error');
        tableInstance.setData([]);
      } finally {
        tableInstance.setLoading(false);
      }
    };

    addCtki.click(() => {
      if (FormBuilder.closeAllSearchSelects) FormBuilder.closeAllSearchSelects();
      const body = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' });
      const payload = {};
      let biodataPick = null;

      if (detail.addFormTemplate && _config.formTemplates?.[detail.addFormTemplate]) {
        const tpl = _config.formTemplates[detail.addFormTemplate];
        for (const f of tpl.fields || []) {
          if (f.preset === 'id_biodata') {
            biodataPick = createBiodataSelect({ placeholder: '— Pilih TKI —', allowEmpty: false });
            body.child(el('label').text(f.label || 'TKI').css({ fontWeight: '600', fontSize: '0.8rem' }));
            body.child(biodataPick.el);
            continue;
          }
          const name = f.name;
          if (!name) continue;
          const inp = el('input').attr('type', f.type === 'date' ? 'date' : 'text').css({
            width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem'
          });
          body.child(el('label').text(f.label || name).css({ fontWeight: '600', fontSize: '0.8rem' }));
          body.child(inp);
          inp.get().dataset.fieldName = name;
        }
      } else {
        biodataPick = createBiodataSelect({ placeholder: '— Pilih TKI —', allowEmpty: false });
        body.child(biodataPick.el);
      }

      const footer = el('div').css({ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' });
      footer.child(el('button').attr('type', 'button').text('Batal').css(btnStyle('#e2e8f0', '#334155')).click(() => layout.closeModal()));
      footer.child(el('button').attr('type', 'button').text('Simpan').css(btnStyle('#2563eb')).click(async () => {
        const idBio = biodataPick ? biodataPick.getValue() : '';
        if (!idBio) { toast('Pilih TKI.', 'warning'); return; }
        body.get().querySelectorAll('input[data-field-name]').forEach((inp) => {
          payload[inp.dataset.fieldName] = inp.value;
        });
        payload.id_biodata = idBio;
        try {
          const createPath = apiPathReplace(detail.createApi, { id: batchRowId });
          await api().create(createPath, payload);
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

  function parseDetailIdFromHash(batchId) {
    let h = (window.location.hash || '').replace(/^#/, '') || '/';
    if (!h.startsWith('/')) h = '/' + h;
    const parts = h.split('/').filter(Boolean);
    const idx = parts.indexOf(batchId);
    if (idx >= 0 && parts[idx + 1] && parts[idx + 1] !== 'create') {
      return decodeURIComponent(parts[idx + 1]);
    }
    return null;
  }

  function registerBatch(batchId, hooks = {}) {
    if (hooks && Object.keys(hooks).length) _hooks[batchId] = hooks;
    const batchCfg = getBatchConfig(batchId);
    if (!batchCfg || typeof layout === 'undefined') return;

    if (batchCfg.detail?.path) {
      const detailPath = batchCfg.detail.path.replace(':id', ':id');
      layout.addPage({
        path: detailPath,
        pageContentPadding: '0',
        component: () => buildDetailPage(batchId, parseDetailIdFromHash(batchId))
      });
    }

    layout.addPage({
      path: batchCfg.listPath || `/print/${batchId}`,
      pageContentPadding: '0',
      component: () => buildListPage(batchId)
    });
  }

  async function registerAll(hooksByBatch = {}) {
    await ensureLoaded();
    if (FormFieldPresets?.ensureLoaded) await FormFieldPresets.ensureLoaded();
    Object.keys(_config.batches || {}).forEach((batchId) => {
      registerBatch(batchId, hooksByBatch[batchId] || {});
    });
  }

  function getBatchIds() {
    const ids = Object.keys(_config?.batches || {});
    return ids.length ? ids : ['pembuatan_tabelpap'];
  }

  async function getPrintSuratCrudForm(isPembatalan) {
    await ensureLoaded();
    const key = isPembatalan ? 'printSuratPembatalanForm' : 'printSuratCrudForm';
    const tpl = _config[key];
    if (!tpl) return null;
    let form = {
      columns: 2,
      fields: (tpl.fields || []).map((f) => papFieldWithPreset({ ...f }))
    };
    if (FormFieldPresets?.resolveFormSchema) {
      form = await FormFieldPresets.resolveFormSchema(form, {});
    }
    return form;
  }

  const PrintBatchEngine = {
    ensureLoaded,
    getBatchConfig,
    getBatchIds,
    registerBatch,
    registerAll,
    registerHooks: (batchId, hooks) => { _hooks[batchId] = hooks; },
    buildListPage,
    buildDetailPage,
    openBatchFormModal,
    createBiodataSelect,
    getPrintSuratCrudForm,
    resolveFormSchema
  };

  global.PrintBatchEngine = PrintBatchEngine;
})(typeof window !== 'undefined' ? window : global);
