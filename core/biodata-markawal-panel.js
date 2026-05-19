(function (global) {
  'use strict';

  const PROGRESS_STEPS = [
    { key: 'marka', label: 'A', title: 'Marketing awal', color: '#2563eb' },
    { key: 'markaBiotoagen', label: 'Agen', title: 'Bio ke agen', color: '#7c3aed', list: true },
    { key: 'markb', label: 'B', title: 'Progress B', color: '#0891b2' },
    { key: 'markc', label: 'C', title: 'Med / Legal', color: '#059669' },
    { key: 'marke', label: 'E', title: 'Visa (marketing)', color: '#ea580c' },
    { key: 'markf', label: 'F', title: 'Progress F', color: '#ca8a04' },
    { key: 'markg', label: 'G', title: 'Progress G', color: '#db2777' }
  ];

  function getApiClient() {
    if (typeof BiodataTabEditor !== 'undefined' && BiodataTabEditor.getApiClient) {
      return BiodataTabEditor.getApiClient();
    }
    return new ApiClient({ baseUrl: '/api' });
  }

  function toastOk(msg) {
    if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: 'success' });
  }

  function toastErr(msg) {
    if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: 'error' });
  }

  function schemaToFormCfg(schema, title, icon) {
    const skip = new Set(['id', 'id_biodata']);
    const typeMap = { textarea: 'textarea', date: 'date', number: 'number' };
    return {
      resource: schema.name,
      title: title || schema.label || schema.name,
      icon,
      form: {
        columns: 2,
        fields: (schema.fields || [])
          .filter((f) => f.name && !skip.has(f.name))
          .map((f) => ({
            name: f.name,
            label: f.label || f.name.replace(/_/g, ' '),
            type: typeMap[f.type] || 'text',
            required: Boolean(f.required)
          }))
      }
    };
  }

  async function loadTableSchema(tableName) {
    const api = getApiClient();
    const res = await api.read(`schema/${tableName}`);
    if (!res.success || !res.data) throw new Error(res.error || `Schema ${tableName} tidak ditemukan`);
    return res.data;
  }

  function hasValue(v) {
    return v != null && String(v).trim() !== '' && String(v) !== '0';
  }

  function stepFilled(step, detail) {
    if (step.list) {
      const rows = detail[step.key];
      return Array.isArray(rows) && rows.length > 0;
    }
    const rec = detail[step.key];
    if (!rec) return false;
    if (hasValue(rec.status)) return true;
    const dateKeys = Object.keys(rec).filter((k) => k.startsWith('tgl_') || k.endsWith('_perkiraan') || k === 'tanggal');
    return dateKeys.some((k) => hasValue(rec[k]));
  }

  function buildPipeline(detail) {
    const wrap = el('div').css({
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.875rem',
      padding: '1rem 1.15rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
    });
    wrap.child(el('h4').text('Pipeline marketing awal').css({
      margin: '0 0 0.85rem',
      fontSize: '0.9rem',
      fontWeight: '700',
      color: '#0f172a'
    }));

    const row = el('div').css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.5rem',
      alignItems: 'stretch'
    });

    PROGRESS_STEPS.forEach((step) => {
      const done = stepFilled(step, detail);
      const tile = el('div').css({
        flex: '1 1 88px',
        minWidth: '80px',
        padding: '0.55rem 0.5rem',
        borderRadius: '0.55rem',
        border: done ? `2px solid ${step.color}` : '1px solid #e2e8f0',
        background: done ? `${step.color}12` : '#f8fafc',
        textAlign: 'center'
      });
      tile.child(el('div').text(step.label).css({
        fontSize: '0.7rem',
        fontWeight: '800',
        color: done ? step.color : '#94a3b8',
        fontFamily: 'ui-monospace, monospace'
      }));
      tile.child(el('div').text(step.title).css({
        fontSize: '0.62rem',
        color: '#64748b',
        marginTop: '0.2rem',
        lineHeight: 1.2
      }));
      tile.child(el('i').class(done ? 'fas fa-check-circle' : 'fas fa-circle').css({
        marginTop: '0.35rem',
        fontSize: '0.75rem',
        color: done ? step.color : '#cbd5e1'
      }));
      row.child(tile);
    });

    wrap.child(row);
    return wrap;
  }

  async function mountSchemaSection(wrap, schemaName, title, icon, idBiodata, record, onSaved) {
    if (typeof BiodataTabEditor === 'undefined' || !BiodataTabEditor.buildSingletonEditor) {
      wrap.child(el('p').text('Editor form tidak tersedia.').css({ color: '#dc2626', fontSize: '0.875rem' }));
      return;
    }
    try {
      const schema = await loadTableSchema(schemaName);
      const cfg = schemaToFormCfg(schema, title, icon);
      wrap.child(BiodataTabEditor.buildSingletonEditor(cfg, idBiodata, record, onSaved));
    } catch (e) {
      wrap.child(el('p').text(e.message || 'Gagal memuat form.').css({ color: '#dc2626', fontSize: '0.875rem' }));
    }
  }

  async function mountBioAgenSection(wrap, idBiodata, items, onSaved) {
    if (typeof BiodataTabEditor === 'undefined' || !BiodataTabEditor.buildListEditor) {
      wrap.child(el('p').text('Editor daftar tidak tersedia.').css({ color: '#dc2626' }));
      return;
    }
    try {
      const schema = await loadTableSchema('marka_biotoagen');
      const cfg = schemaToFormCfg(schema, 'Penugasan ke agen', 'fas fa-handshake');
      cfg.table = {
        columns: [
          { key: 'kode_agen', label: 'Kode agen' },
          { key: 'tgl_kirim', label: 'Tgl kirim' },
          { key: 'status', label: 'Status' },
          { key: 'actions', type: 'actions' }
        ]
      };
      const listUi = BiodataTabEditor.buildListEditor(cfg, idBiodata, items || [], onSaved);
      wrap.child(listUi.card);
    } catch (e) {
      wrap.child(el('p').text(e.message || 'Gagal memuat bio agen.').css({ color: '#dc2626' }));
    }
  }

  async function buildMarkawalPanel(ctx) {
    const { idBiodata, detail, onRefresh } = ctx;
    const root = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1rem' });

    root.child(el('p').text(
      'Progress marketing awal (marka–markg): status pipeline, penugasan agen, dan timeline pra-keberangkatan. Sesuai modul legacy markawal.'
    ).css({ margin: 0, fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.55 }));

    root.child(buildPipeline(detail));

    const onSaved = async () => {
      toastOk('Data marketing tersimpan.');
      if (typeof onRefresh === 'function') await onRefresh();
    };

    await mountSchemaSection(
      root,
      'marka',
      'Marketing A — Awal',
      'fas fa-bullhorn',
      idBiodata,
      detail.marka || null,
      onSaved
    );

    await mountBioAgenSection(root, idBiodata, detail.markaBiotoagen, onSaved);

    const simpleGrid = el('div').css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '1rem'
    });
    root.child(simpleGrid);

    await mountSchemaSection(simpleGrid, 'markb', 'Marketing B', 'fas fa-circle', idBiodata, detail.markb, onSaved);
    await mountSchemaSection(simpleGrid, 'markf', 'Marketing F', 'fas fa-circle', idBiodata, detail.markf, onSaved);
    await mountSchemaSection(simpleGrid, 'markg', 'Marketing G', 'fas fa-circle', idBiodata, detail.markg, onSaved);

    await mountSchemaSection(root, 'markc', 'Marketing C — Med / Legal', 'fas fa-stethoscope', idBiodata, detail.markc, onSaved);
    await mountSchemaSection(root, 'marke', 'Marketing E — Visa', 'fas fa-plane', idBiodata, detail.marke, onSaved);

    return root;
  }

  global.BiodataMarkawalPanel = {
    buildMarkawalPanel,
    PROGRESS_STEPS
  };
})(typeof window !== 'undefined' ? window : global);
