(function (global) {
  'use strict';

  function row(label, value) {
    const v = value != null && value !== '' ? String(value) : '—';
    return el('div').css({
      display: 'grid',
      gridTemplateColumns: 'minmax(120px, 38%) 1fr',
      gap: '0.35rem 0.75rem',
      fontSize: '0.8125rem',
      padding: '0.35rem 0',
      borderBottom: '1px solid #f1f5f9'
    }).child([
      el('span').text(label).css({ color: '#64748b', fontWeight: '500' }),
      el('span').text(v).css({ color: '#0f172a', wordBreak: 'break-word' })
    ]);
  }

  function section(title, icon, bodyRows) {
    const card = el('div').css({
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.75rem',
      padding: '0.85rem 1rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
    });
    const head = el('div').css({
      display: 'flex',
      alignItems: 'center',
      gap: '0.45rem',
      marginBottom: '0.65rem',
      fontWeight: '700',
      fontSize: '0.875rem',
      color: '#0f172a'
    });
    if (icon) head.child(el('i').class(icon).css({ color: '#2563eb' }));
    head.child(el('span').text(title));
    card.child(head);
    const body = el('div');
    if (!bodyRows || !bodyRows.length) {
      body.child(el('p').text('Belum ada data.').css({ margin: 0, fontSize: '0.8125rem', color: '#94a3b8' }));
    } else {
      bodyRows.forEach((r) => body.child(r));
    }
    card.child(body);
    return card;
  }

  function flattenObj(obj, prefix) {
    const rows = [];
    if (!obj) return rows;
    Object.keys(obj).forEach((k) => {
      const val = obj[k];
      if (val == null || val === '') return;
      rows.push(row(`${prefix}${k}`, val));
    });
    return rows;
  }

  function buildFiskalPanel(fiskal) {
    const root = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1rem' });

    root.child(el('p').text('Rekap administrasi (read-only) — untuk cetak/cek fiskal. Edit data lewat form modul di bawah.').css({
      margin: 0,
      fontSize: '0.8125rem',
      color: '#64748b',
      lineHeight: 1.5
    }));

    const grid = el('div').css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '0.85rem'
    });

    grid.child(section('Personal', 'fas fa-user', flattenObj(fiskal.personal, '')));
    grid.child(section('Keluarga', 'fas fa-people-roof', flattenObj(fiskal.family, '')));
    grid.child(section('Dokumen identitas', 'fas fa-folder', flattenObj(fiskal.dokumen, '')));
    grid.child(section('Disnaker', 'fas fa-building', flattenObj(fiskal.disnaker, '')));

    const medRows = [];
    if (fiskal.medical?.medical1) medRows.push(row('Medical 1', [fiskal.medical.medical1.jenismedical, fiskal.medical.medical1.tanggal].filter(Boolean).join(' · ')));
    if (fiskal.medical?.medical2) medRows.push(row('Medical 2', [fiskal.medical.medical2.jenismedical, fiskal.medical.medical2.tanggal].filter(Boolean).join(' · ')));
    if (fiskal.medical?.medical3) medRows.push(row('Medical 3', [fiskal.medical.medical3.jenismedical, fiskal.medical.medical3.tanggal].filter(Boolean).join(' · ')));
    grid.child(section('Medical', 'fas fa-stethoscope', medRows));

    const pasRows = [];
    if (fiskal.paspor?.aktif) pasRows.push(row('Paspor aktif', fiskal.paspor.aktif.nopaspor || '—'));
    if (fiskal.paspor?.lama) pasRows.push(row('Paspor lama', fiskal.paspor.lama.nopaspor || '—'));
    grid.child(section('Paspor', 'fas fa-passport', pasRows));

    grid.child(section('Majikan', 'fas fa-briefcase', flattenObj(fiskal.majikan, '')));
    grid.child(section('Visa & terbang', 'fas fa-plane', flattenObj(fiskal.visa, '')));
    if (fiskal.terbang) {
      grid.child(section('Data penerbangan', 'fas fa-plane-departure', flattenObj(fiskal.terbang, '')));
    }
    grid.child(section('SKCK', 'fas fa-shield-halved', flattenObj(fiskal.skck, '')));
    if (fiskal.skckPolres) {
      grid.child(section('SKCK POLRES', 'fas fa-shield', flattenObj(fiskal.skckPolres, '')));
    }
    if (fiskal.legalitas) {
      grid.child(section('Legalitas', 'fas fa-scale-balanced', flattenObj(fiskal.legalitas, '')));
    }
    if (fiskal.signingbank) {
      grid.child(section('Pengajuan bank', 'fas fa-building-columns', flattenObj(fiskal.signingbank, '')));
    }
    if (fiskal.bukaRekening) {
      grid.child(section('Buka rekening', 'fas fa-piggy-bank', flattenObj(fiskal.bukaRekening, '')));
    }
    if (fiskal.asuransiHotel) {
      grid.child(section('Asuransi & hotel', 'fas fa-hotel', flattenObj(fiskal.asuransiHotel, '')));
    }
    if (fiskal.isichongyi) {
      grid.child(section('Chongyi', 'fas fa-language', flattenObj(fiskal.isichongyi, '')));
    }

    const up = fiskal.upload || {};
    grid.child(section('Upload dokumen', 'fas fa-cloud-arrow-up', [
      row('Jenis terisi', `${up.jenisTerisi || 0} / ${up.jenisTotal || 0}`),
      row('Visa arrival', up.visaArrival?.hasFile ? 'Ada file' : (up.visaArrival?.count ? 'Ada data' : '—'))
    ]));

    root.child(grid);
    return root;
  }

  async function loadAndRender(slot, idBiodata) {
    const apiBase = window.location?.origin || '';
    const res = await fetch(`${apiBase}/api/biodata/${encodeURIComponent(idBiodata)}/fiskal`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Gagal memuat rekap FISKAL');
    slot.empty();
    slot.child(buildFiskalPanel(json.data));
    slot.get();
  }

  global.BiodataFiskalPanel = {
    buildFiskalPanel,
    loadAndRender
  };
})(typeof window !== 'undefined' ? window : global);
