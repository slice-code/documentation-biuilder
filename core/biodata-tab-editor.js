(function (global) {
  'use strict';

  const pageSchemaCache = Object.create(null);

  const SINGLETON_TABS = {
    personal: 'personal',
    family: 'family',
    dokumen: 'dokumen'
  };

  const LIST_TABS = {
    working: 'working',
    skillcondition: 'skillcondition',
    experience: 'experience',
    pengalaman: 'pengalaman',
    request: 'request',
    pptk: 'pptk',
    tugas: 'tugas',
    kettugas: 'kettugas',
    interview: 'interview',
    vaksin: 'vaksin'
  };

  /** Menu detail administrasi — plan §8A.6b (inti + modul yang sudah ada appjson) */
  const ADMIN_MENU_TABS = [
    { key: 'fiskal', label: 'FISKAL TKI', icon: 'fas fa-chart-pie', panel: 'fiskal' },
    { key: 'keadaan_tki', label: 'Keadaan TKI', icon: 'fas fa-user-injured', page: 'keadaantki', dataKey: 'keadaanTki', list: true },
    { key: 'disnaker', label: 'Disnaker', icon: 'fas fa-building', page: 'disnaker', dataKey: 'disnaker' },
    { key: 'medical', label: 'Medical 1', icon: 'fas fa-stethoscope', page: 'medical', dataKey: 'medical' },
    { key: 'medical2', label: 'Medical 2', icon: 'fas fa-stethoscope', page: 'medical', resource: 'medical2', dataKey: 'medical2' },
    { key: 'medical3', label: 'Medical 3', icon: 'fas fa-stethoscope', page: 'medical', resource: 'medical3', dataKey: 'medical3' },
    { key: 'paspor', label: 'Paspor', icon: 'fas fa-passport', page: 'paspor', dataKey: 'paspor' },
    { key: 'pasporlama', label: 'Paspor Lama', icon: 'fas fa-passport', page: 'paspor', resource: 'pasporlama', dataKey: 'pasporlama' },
    { key: 'skck', label: 'SKCK POLDA', icon: 'fas fa-shield-halved', page: 'skck', dataKey: 'skck' },
    { key: 'skckpolres', label: 'SKCK POLRES', icon: 'fas fa-shield', page: 'skckpolres', dataKey: 'skckPolres' },
    { key: 'legalitas', label: 'Legalitas', icon: 'fas fa-scale-balanced', page: 'legalitas', dataKey: 'legalitas' },
    { key: 'visa', label: 'Visa & Terbang', icon: 'fas fa-plane', page: 'visa', dataKey: 'visa', panel: 'visa' },
    { key: 'signingbank', label: 'Pengajuan Bank', icon: 'fas fa-building-columns', page: 'signingbank', dataKey: 'signingbank' },
    { key: 'bukarekening', label: 'Buka Rekening', icon: 'fas fa-piggy-bank', page: 'bukarekening', dataKey: 'bukaRekening' },
    { key: 'asuransihotel', label: 'Asuransi & Hotel', icon: 'fas fa-hotel', page: 'asuransihotel', dataKey: 'asuransiHotel' },
    { key: 'isichongyi', label: 'Chongyi', icon: 'fas fa-language', page: 'isichongyi', dataKey: 'isichongyi' },
    { key: 'majikan', label: 'Majikan', icon: 'fas fa-house-user', page: 'majikan', dataKey: 'majikan' },
    { key: 'markawal', label: 'Marketing Awal', icon: 'fas fa-bullhorn', panel: 'markawal' },
    { key: 'upload', label: 'Upload Dokumen', icon: 'fas fa-cloud-arrow-up', panel: 'upload' }
  ];

  function filterBiodataMenus(menuTabs) {
    return (menuTabs || [])
      .filter((m) => m.url_menu !== 'admin')
      .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
  }


  function getApiClient() {
    if (typeof window !== 'undefined' && window.flamboyanApp?.core?.apiClient) {
      return window.flamboyanApp.core.apiClient;
    }
    return new ApiClient({ baseUrl: '/api' });
  }

  async function loadCrudSchema(pageName, apiClient) {
    if (pageSchemaCache[pageName]) return pageSchemaCache[pageName];
    const res = await apiClient.read(`pages/${pageName}`);
    const cfg = res?.data?.config || res?.config;
    if (!cfg?.form) throw new Error(`Konfigurasi form "${pageName}" tidak ditemukan.`);
    pageSchemaCache[pageName] = cfg;
    return cfg;
  }

  let biodataDetailStylesInjected = false;

  function ensureBiodataDetailStyles() {
    if (biodataDetailStylesInjected || document.querySelector('style[data-biodata-detail-style]')) return;
    biodataDetailStylesInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-biodata-detail-style', 'true');
    style.textContent = `
      .biodata-detail-list-wrap .crud-dt-search { font-size: 0.875rem; }
      .biodata-detail-list-wrap > div { max-height: none !important; flex: none !important; }
      .biodata-detail-form-slot {
        position: relative;
        overflow: visible;
        margin-top: 1rem;
        padding: 1rem 1.1rem 0.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        background: #f8fafc;
        z-index: 0;
      }
      .biodata-detail-form-slot .biodata-detail-form-title {
        margin: 0 0 0.75rem;
        font-size: 0.9rem;
        font-weight: 700;
        color: #0f172a;
      }
      .biodata-detail-form-body {
        position: relative;
        z-index: 0;
        padding-bottom: 0.5rem;
      }
      .biodata-detail-form-body form {
        position: relative;
        z-index: 0;
      }
      .biodata-detail-form-actions {
        position: relative;
        z-index: 50;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 1rem;
        padding: 0.85rem 0 0.25rem;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
      }
    `;
    document.head.appendChild(style);
  }

  function scopedFormFields(fields) {
    return (fields || []).filter((f) => f.name !== 'id_biodata');
  }

  // Toolbar ringkas + layout aman di panel detail (hindari Quill menutupi tombol)
  function detailFormFields(fields) {
    const compactToolbar = [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'clean']
    ];
    return scopedFormFields(fields).map((f) => {
      if (f.type !== 'textarea') return f;
      return {
        ...f,
        editorToolbar: f.editorToolbar || compactToolbar,
        rows: f.rows || 4
      };
    });
  }

  function buildFormActions({ onSave, onCancel, saveLabel, showCancel = true }) {
    const actions = el('div').class('biodata-detail-form-actions');
    const saveBtn = el('button').attr('type', 'button').text(saveLabel || 'Simpan').css({
      padding: '0.55rem 1.1rem',
      borderRadius: '0.5rem',
      border: 'none',
      background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
      color: '#fff',
      fontWeight: '600',
      fontSize: '0.875rem',
      cursor: 'pointer'
    });
    saveBtn.click(onSave);
    if (showCancel && onCancel) {
      const cancelBtn = el('button').attr('type', 'button').text('Batal').css({
        padding: '0.55rem 1.1rem',
        borderRadius: '0.5rem',
        border: '1px solid #cbd5e1',
        background: '#fff',
        color: '#334155',
        fontWeight: '600',
        fontSize: '0.875rem',
        cursor: 'pointer'
      });
      cancelBtn.click(onCancel);
      actions.child([saveBtn, cancelBtn]);
    } else {
      actions.child(saveBtn);
    }
    return { actions, saveBtn };
  }

  function mountDetailFormPanel(formSlot, formApi, options) {
    const { title, onSave, onCancel, saveLabel, showCancel = true } = options;
    formSlot.empty();
    formSlot.el.classList.add('biodata-detail-form-slot');
    formSlot.css({ display: 'block' });

    if (title) {
      formSlot.child(el('h4').text(title).class('biodata-detail-form-title'));
    }

    const body = el('div').class('biodata-detail-form-body');
    body.child(formApi.el);
    formSlot.child(body);

    const { actions, saveBtn } = buildFormActions({ onSave, onCancel, saveLabel, showCancel });
    formSlot.child(actions);
    formSlot.get();

    return { saveBtn };
  }

  function contextBanner(idBiodata, subtitle) {
    return el('div').css({
      padding: '0.65rem 1rem',
      borderRadius: '0.5rem',
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      fontSize: '0.8125rem',
      color: '#1e40af'
    }).child([
      el('strong').text('Konteks TKI: '),
      el('span').text(idBiodata).css({ fontFamily: 'monospace', fontWeight: '600' }),
      subtitle ? el('span').text(' · ' + subtitle).css({ color: '#3b82f6', marginLeft: '0.25rem' }) : null
    ].filter(Boolean));
  }

  function sectionShell(title, icon) {
    const card = el('div').css({
      background: '#fff',
      borderRadius: '0.875rem',
      border: '1px solid #e2e8f0',
      padding: '1.25rem 1.35rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
    });
    const head = el('div').css({
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '1rem'
    });
    if (icon) head.child(el('i').class(icon).css({ color: '#2563eb' }));
    head.child(el('h3').text(title).css({ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }));
    card.child(head);
    return { card, body: card };
  }

  function toastOk(msg) {
    if (typeof layout !== 'undefined' && layout.toast) {
      layout.toast(msg, { type: 'success' });
    }
  }

  function toastErr(msg) {
    if (typeof layout !== 'undefined' && layout.toast) {
      layout.toast(msg, { type: 'error' });
    }
  }

  async function saveRecord(apiClient, resource, idBiodata, record, formData) {
    const payload = { ...formData, id_biodata: idBiodata };
    if (record && record.id != null) {
      return apiClient.update(`${resource}/${record.id}`, payload);
    }
    return apiClient.create(resource, payload);
  }

  function buildKelengkapanPanel(detail) {
    const checks = [
      { label: 'Keluarga', ok: Boolean(detail?.family) },
      { label: 'Dokumen', ok: Boolean(detail?.dokumen) },
      { label: 'Disnaker', ok: Boolean(detail?.disnaker) },
      { label: 'Medical', ok: Boolean(detail?.medical) },
      { label: 'Paspor', ok: Boolean(detail?.paspor) },
      { label: 'Majikan', ok: Boolean(detail?.majikan) },
      { label: 'Visa', ok: Boolean(detail?.visa) },
      { label: 'Marketing awal', ok: Boolean(detail?.marka) || (Array.isArray(detail?.markaBiotoagen) && detail.markaBiotoagen.length > 0) },
      { label: 'Working', ok: Array.isArray(detail?.working) && detail.working.length > 0 },
      { label: 'Skill', ok: Array.isArray(detail?.skillcondition) && detail.skillcondition.length > 0 }
    ];
    const shell = sectionShell('Kelengkapan data', 'fas fa-clipboard-check');
    const list = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.35rem' });
    checks.forEach((c) => {
      list.child(el('div').css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.8125rem',
        color: c.ok ? '#15803d' : '#94a3b8'
      }).child([
        el('i').class(c.ok ? 'fas fa-circle-check' : 'fas fa-circle'),
        el('span').text(c.label)
      ]));
    });
    shell.card.child(list);
    return shell.card;
  }

  function buildPersonalStatusBar(idBiodata, record, onSaved) {
    const statuses = ['PROSES', 'TERPILIH', 'PENDING', 'TERBANG'];
    const bar = el('div').css({
      padding: '0.75rem 1rem',
      borderRadius: '0.65rem',
      background: '#fffbeb',
      border: '1px solid #fde68a',
      marginBottom: '0.75rem'
    });
    bar.child(el('div').text('Ubah status TKI').css({
      fontSize: '0.75rem',
      fontWeight: '700',
      color: '#92400e',
      marginBottom: '0.5rem',
      textTransform: 'uppercase',
      letterSpacing: '0.04em'
    }));
    const row = el('div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' });
    const apiClient = getApiClient();
    const current = record?.statusaktif || 'PROSES';
    statuses.forEach((st) => {
      const btn = el('button').attr('type', 'button').text(st).css({
        padding: '0.35rem 0.65rem',
        borderRadius: '0.4rem',
        border: st === current ? '2px solid #d97706' : '1px solid #fcd34d',
        background: st === current ? '#fef3c7' : '#fff',
        color: '#92400e',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: st === current ? 'default' : 'pointer'
      });
      if (st !== current) {
        btn.click(async () => {
          if (!record?.id) return;
          if (!confirm(`Ubah status menjadi ${st}?`)) return;
          try {
            const res = await apiClient.update(`personal/${record.id}`, { statusaktif: st });
            if (!res.success) throw new Error(res.error || 'Gagal');
            toastOk('Status diperbarui.');
            if (onSaved) await onSaved();
          } catch (e) {
            toastErr(e.message || 'Gagal ubah status.');
          }
        });
      }
      row.child(btn);
    });
    bar.child(row);
    return bar;
  }

  function buildPersonalEditor(cfg, idBiodata, record, onSaved, detail) {
    const wrap = el('div');
    if (record) wrap.child(buildPersonalStatusBar(idBiodata, record, onSaved));
    if (typeof DocumentPrintPanel !== 'undefined' && DocumentPrintPanel.buildPersonalPrintPanel) {
      wrap.child(DocumentPrintPanel.buildPersonalPrintPanel({
        idBiodata,
        detail,
        onRefresh: onSaved
      }));
    }
    if (typeof PersonalFotoPanel !== 'undefined') {
      wrap.child(PersonalFotoPanel.buildPersonalFotoPanel({
        idBiodata,
        record,
        onRefresh: onSaved
      }));
    }
    const cfgNoFoto = {
      ...cfg,
      form: {
        ...cfg.form,
        fields: (cfg.form?.fields || []).filter((f) => f.name !== 'foto')
      }
    };
    wrap.child(buildSingletonEditor(cfgNoFoto, idBiodata, record, onSaved));
    if (detail) wrap.child(buildKelengkapanPanel(detail));
    return wrap;
  }

  function buildSingletonEditor(cfg, idBiodata, record, onSaved) {
    ensureBiodataDetailStyles();
    const apiClient = getApiClient();
    const { card } = sectionShell(cfg.title || cfg.resource, cfg.icon);
    const msgEl = el('p').css({ fontSize: '0.875rem', margin: '0 0 0.75rem', display: 'none' });
    card.child(msgEl);

    const formSchema = {
      columns: cfg.form.columns || 2,
      hideButtons: true,
      fields: detailFormFields(cfg.form.fields)
    };

    const initial = { ...(record || {}) };
    delete initial.id_biodata;

    const formApi = FormBuilder.build(formSchema, {
      apiClient,
      initialData: initial,
      onSubmit: () => {},
      onCancel: () => {}
    });

    const formSlot = el('div');
    card.child(formSlot);

    const { saveBtn } = mountDetailFormPanel(formSlot, formApi, {
      saveLabel: 'Simpan',
      showCancel: false,
      onSave: async () => {
        const errors = formApi.validate();
        if (Object.keys(errors).length > 0) {
          const first = Object.values(errors)[0][0];
          msgEl.text(first || 'Lengkapi data wajib.').css({ display: 'block', color: '#dc2626' });
          return;
        }
        saveBtn.disabled(true).css({ opacity: '0.7', cursor: 'wait' });
        msgEl.css({ display: 'none' });
        try {
          const res = await saveRecord(apiClient, cfg.resource || 'personal', idBiodata, record, formApi.getData());
          if (!res.success) {
            msgEl.text(res.error || 'Gagal menyimpan.').css({ display: 'block', color: '#dc2626' });
            return;
          }
          toastOk('Data tersimpan.');
          if (onSaved) await onSaved();
        } catch (e) {
          msgEl.text(e.message || 'Gagal menyimpan.').css({ display: 'block', color: '#dc2626' });
          toastErr('Gagal menyimpan data.');
        } finally {
          saveBtn.disabled(false).css({ opacity: '1', cursor: 'pointer' });
        }
      }
    });

    return card;
  }


  // Kolom tabel detail (dari appjson table, tanpa id_biodata & actions)
  function listColumns(cfg) {
    const fromTable = (cfg.table?.columns || []).filter(
      (c) => c.key && c.key !== 'id_biodata' && c.type !== 'actions'
    );
    if (fromTable.length) {
      return fromTable.map((c) => ({ key: c.key, label: c.label || c.key }));
    }
    return (cfg.form?.fields || [])
      .filter((f) => f.name && f.name !== 'id_biodata' && !['hidden', 'password'].includes(f.type))
      .map((f) => ({ key: f.name, label: f.label || f.name }));
  }

  function stripHtmlPreview(val, maxLen) {
    if (val == null || val === '') return '-';
    const tmp = document.createElement('div');
    tmp.innerHTML = String(val);
    let text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return '-';
    if (maxLen && text.length > maxLen) text = text.slice(0, maxLen - 1) + '…';
    return text;
  }

  function buildDetailTableSchema(cfg, handlers) {
    const richKeys = new Set(
      (cfg.form?.fields || []).filter((f) => f.type === 'textarea').map((f) => f.name)
    );
    const cols = listColumns(cfg).map((c) => {
      const col = {
        key: c.key,
        label: c.label,
        sortable: true,
        searchable: true
      };
      if (richKeys.has(c.key)) {
        col.render = (v) => stripHtmlPreview(v, 60);
      }
      return col;
    });
    return {
      columns: [
        ...cols,
        {
          key: 'actions',
          type: 'actions',
          label: 'Aksi',
          actions: [
            {
              icon: 'fas fa-edit',
              label: 'Edit',
              onClick: (row) => handlers.onEdit(row)
            },
            {
              icon: 'fas fa-trash',
              label: 'Hapus',
              variant: 'danger',
              confirm: true,
              onClick: (row) => handlers.onDelete(row)
            }
          ]
        }
      ],
      features: {
        search: true,
        pagination: true,
        perPage: 5,
        perPageOptions: [5, 10, 25, 50]
      },
      emptyText: 'Belum ada data. Klik + Tambah untuk menambah.'
    };
  }

  function buildListEditor(cfg, idBiodata, items, onSaved) {
    ensureBiodataDetailStyles();
    const apiClient = getApiClient();
    const { card } = sectionShell(cfg.title || cfg.resource, cfg.icon);

    const toolbar = el('div').css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '0.5rem',
      marginBottom: '0.75rem'
    });
    toolbar.child(el('span').text('Daftar data untuk TKI ini').css({ fontSize: '0.8125rem', color: '#64748b' }));
    const addBtn = el('button').attr('type', 'button').text('+ Tambah').css({
      padding: '0.45rem 0.9rem',
      borderRadius: '0.5rem',
      border: 'none',
      background: '#2563eb',
      color: '#fff',
      fontWeight: '600',
      fontSize: '0.8125rem',
      cursor: 'pointer'
    });
    toolbar.child(addBtn);
    card.child(toolbar);

    const listWrap = el('div').class('biodata-detail-list-wrap').css({ marginBottom: '0.5rem' });
    card.child(listWrap);

    const formSlot = el('div').css({ display: 'none' });
    card.child(formSlot);

    let editingRow = null;
    let formApi = null;
    let tableInstance = null;

    const refreshTableData = (rows) => {
      if (tableInstance) tableInstance.setData(rows || []);
    };

    const showListView = () => {
      toolbar.css({ display: 'flex' });
      listWrap.css({ display: 'block' });
      toolbar.get();
      listWrap.get();
    };

    const hideListView = () => {
      toolbar.css({ display: 'none' });
      listWrap.css({ display: 'none' });
      toolbar.get();
      listWrap.get();
    };

    const closeForm = () => {
      formSlot.empty();
      formSlot.el.classList.remove('biodata-detail-form-slot');
      formSlot.css({ display: 'none' });
      editingRow = null;
      formApi = null;
      formSlot.get();
      showListView();
    };

    const openForm = (row) => {
      hideListView();
      editingRow = row || null;
      const formSchema = {
        columns: cfg.form.columns || 2,
        hideButtons: true,
        fields: detailFormFields(cfg.form.fields)
      };
      const initial = { ...(row || {}) };
      delete initial.id_biodata;
      formApi = FormBuilder.build(formSchema, {
        apiClient,
        initialData: initial,
        onSubmit: () => {},
        onCancel: closeForm
      });

      mountDetailFormPanel(formSlot, formApi, {
        title: row ? 'Edit data' : 'Tambah data baru',
        saveLabel: 'Simpan',
        onCancel: closeForm,
        onSave: async () => {
          const errors = formApi.validate();
          if (Object.keys(errors).length > 0) return;
          try {
            const res = await saveRecord(apiClient, cfg.resource, idBiodata, editingRow, formApi.getData());
            if (res && res.success === false) {
              toastErr(res.error || 'Gagal menyimpan.');
              return;
            }
            toastOk('Data tersimpan.');
            closeForm();
            if (onSaved) await onSaved();
          } catch (e) {
            toastErr('Gagal menyimpan.');
          }
        }
      });
    };

    const deleteRow = async (row) => {
      if (!row?.id) return;
      try {
        await apiClient.delete(`${cfg.resource}/${row.id}`);
        toastOk('Data dihapus.');
        if (onSaved) await onSaved();
      } catch (e) {
        toastErr('Gagal menghapus.');
      }
    };

    if (typeof TableBuilder === 'undefined') {
      listWrap.child(el('p').text('TableBuilder tidak tersedia.').css({ color: '#dc2626' }));
    } else {
      const tableSchema = buildDetailTableSchema(cfg, { onEdit: openForm, onDelete: deleteRow });
      tableInstance = TableBuilder.build(tableSchema, { data: items || [] });
      listWrap.child(tableInstance.el);
      listWrap.get();
    }

    addBtn.click(() => openForm(null));

    return {
      card,
      setItems: (rows) => {
        items = rows;
        refreshTableData(rows);
      }
    };
  }

  async function buildAdminPanel(menuKey, ctx) {
    const { idBiodata, detail, onRefresh } = ctx;
    const item = ADMIN_MENU_TABS.find((m) => m.key === menuKey);
    const wrap = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1rem' });
    if (!item) {
      wrap.child(el('p').text('Menu administrasi tidak dikenali.').css({ color: '#64748b' }));
      return wrap;
    }
    const onSaved = async () => {
      if (typeof onRefresh === 'function') await onRefresh();
    };
    wrap.child(contextBanner(idBiodata, item.label));
    const panelOnly = item.panel && !item.page;
    if (!detail[item.dataKey || item.key] && item.page && !panelOnly) {
      wrap.child(el('p').text('Belum ada data — isi form lalu Simpan untuk menambah.').css({
        margin: 0,
        fontSize: '0.8125rem',
        color: '#64748b',
        fontStyle: 'italic'
      }));
    }
    if (item.panel === 'stub') {
      wrap.child(el('p').text(item.stubMsg || 'Modul dalam pengembangan.').css({
        margin: 0,
        fontSize: '0.875rem',
        color: '#64748b',
        lineHeight: 1.55
      }));
      return wrap;
    }
    if (item.panel === 'fiskal') {
      if (typeof BiodataFiskalPanel !== 'undefined') {
        const fiskalSlot = el('div');
        wrap.child(fiskalSlot);
        try {
          await BiodataFiskalPanel.loadAndRender(fiskalSlot, idBiodata);
        } catch (e) {
          fiskalSlot.child(el('p').text(e.message || 'Gagal memuat FISKAL.').css({ color: '#dc2626' }));
        }
      }
      return wrap;
    }
    if (item.panel === 'upload') {
      if (typeof DocumentUploadHub !== 'undefined') {
        wrap.child(DocumentUploadHub.buildUploadHub({ idBiodata, onRefresh: onSaved }));
      }
      return wrap;
    }
    if (item.panel === 'markawal') {
      if (typeof BiodataMarkawalPanel !== 'undefined') {
        try {
          const panel = await BiodataMarkawalPanel.buildMarkawalPanel({ idBiodata, detail, onRefresh: onSaved });
          wrap.child(panel);
        } catch (e) {
          wrap.child(el('p').text(e.message || 'Gagal memuat marketing awal.').css({ color: '#dc2626' }));
        }
      } else {
        wrap.child(el('p').text('Modul marketing awal belum dimuat.').css({ color: '#64748b' }));
      }
      return wrap;
    }
    if (item.page) {
      const apiClient = getApiClient();
      const cfg = await loadCrudSchema(item.page, apiClient);
      const resource = item.resource || cfg.resource;
      if (item.list) {
        const items = Array.isArray(detail[item.dataKey || item.key]) ? detail[item.dataKey || item.key] : [];
        const listUi = buildListEditor({ ...cfg, resource, title: item.label, icon: item.icon }, idBiodata, items, onSaved);
        wrap.child(listUi.card);
        return wrap;
      }
      const record = detail[item.dataKey || item.key] || null;
      if (item.panel === 'visa' && typeof VisaDepartPanel !== 'undefined') {
        wrap.child(VisaDepartPanel.buildVisaDepartPanel({ idBiodata, detail, onRefresh: onSaved }));
      }
      wrap.child(buildSingletonEditor(
        { ...cfg, resource, title: item.label, icon: item.icon },
        idBiodata,
        record,
        onSaved
      ));
      return wrap;
    }
    return wrap;
  }

  async function buildPanel(tabKey, ctx) {
    const { idBiodata, detail, onRefresh } = ctx;
    const apiClient = ctx.apiClient || getApiClient();
    const wrap = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1rem' });

    const onSaved = async () => {
      if (typeof onRefresh === 'function') await onRefresh();
    };

    if (tabKey === 'dokumen') {
      wrap.child(contextBanner(idBiodata, 'Dokumen identitas'));
      if (typeof DokumenIdentitasPanel !== 'undefined') {
        wrap.child(DokumenIdentitasPanel.buildDokumenIdentitasPanel({
          idBiodata,
          record: detail.dokumen || null,
          onRefresh: onSaved
        }));
      } else {
        wrap.child(el('p').text('Modul dokumen identitas belum dimuat.').css({ color: '#dc2626', fontSize: '0.875rem' }));
      }
      return wrap;
    }

    if (tabKey === 'upload') {
      wrap.child(contextBanner(idBiodata, 'Upload dokumen'));
      if (typeof DocumentUploadHub !== 'undefined') {
        wrap.child(DocumentUploadHub.buildUploadHub({ idBiodata, onRefresh: onSaved }));
      } else {
        wrap.child(el('p').text('Modul upload belum dimuat.').css({ color: '#dc2626', fontSize: '0.875rem' }));
      }
      return wrap;
    }

    if (tabKey === 'upload_arc' || tabKey === 'upload_keterangan') {
      const label = (typeof UploadTypes !== 'undefined' && UploadTypes.getLabel)
        ? UploadTypes.getLabel(tabKey)
        : tabKey;
      wrap.child(contextBanner(idBiodata, label));
      if (typeof DocumentUploadHub !== 'undefined') {
        wrap.child(DocumentUploadHub.buildUploadHub({
          idBiodata,
          onRefresh: onSaved,
          filterTypes: [tabKey]
        }));
      }
      return wrap;
    }

    const pageName = SINGLETON_TABS[tabKey] || LIST_TABS[tabKey];
    if (!pageName) {
      wrap.child(el('p').text('Tab tidak dikenali.').css({ color: '#64748b' }));
      return wrap;
    }

    const cfg = await loadCrudSchema(pageName, apiClient);
    wrap.child(contextBanner(idBiodata, cfg.title || pageName));

    if (SINGLETON_TABS[tabKey]) {
      let record = null;
      if (tabKey === 'personal') record = detail.personal;
      else record = detail[tabKey] || null;
      if (tabKey === 'personal') {
        wrap.child(buildPersonalEditor(cfg, idBiodata, record, onSaved, detail));
      } else {
        wrap.child(buildSingletonEditor(cfg, idBiodata, record, onSaved));
      }
      return wrap;
    }

    let items = Array.isArray(detail[tabKey]) ? detail[tabKey] : [];
    if (tabKey === 'experience') {
      items = Array.isArray(detail.skillcondition) ? detail.skillcondition : [];
    }
    const listUi = buildListEditor(cfg, idBiodata, items, onSaved);
    wrap.child(listUi.card);
    return wrap;
  }

  const BiodataTabEditorApi = {
    buildPanel: buildPanel,
    buildAdminPanel: buildAdminPanel,
    buildSingletonEditor: buildSingletonEditor,
    buildListEditor: buildListEditor,
    getApiClient: getApiClient,
    filterBiodataMenus: filterBiodataMenus,
    ADMIN_MENU_TABS: ADMIN_MENU_TABS,
    loadCrudSchema: loadCrudSchema,
    buildKelengkapanPanel: buildKelengkapanPanel
  };

  global.BiodataTabEditor = BiodataTabEditorApi;
})(typeof window !== 'undefined' ? window : global);
