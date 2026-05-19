(function (global) {
  'use strict';

  function api() {
    if (typeof window !== 'undefined' && window.flamboyanApp?.core?.apiClient) {
      return window.flamboyanApp.core.apiClient;
    }
    return new ApiClient({ baseUrl: '/api' });
  }

  function toast(msg, type) {
    if (typeof layout !== 'undefined' && layout.toast) {
      layout.toast(msg, { type: type || 'info' });
    }
  }

  function sektorFromId(idBiodata) {
    return String(idBiodata || '').toUpperCase().slice(0, 2);
  }

  function getPrintGroups() {
    if (typeof PrintDataRegistry !== 'undefined' && PrintDataRegistry.GROUPS?.length) {
      return PrintDataRegistry.GROUPS;
    }
    console.warn('[PrintSurat] PrintDataRegistry belum dimuat — muat print-data-registry.js sebelum document-print-panel.js');
    return [];
  }

  /** el.js: flush antrian .ch ke .el — wajib setelah .child() pada wrapper yang sudah pernah .get() */
  function flushEl(node) {
    if (node && typeof node.get === 'function' && node.ch && node.ch.length) {
      node.get();
    }
  }

  function findPrintDataMenu(menuId) {
    if (typeof PrintDataRegistry !== 'undefined' && PrintDataRegistry.findMenu) {
      return PrintDataRegistry.findMenu(menuId);
    }
    return null;
  }

  function matchMenuTemplates(templates, item) {
    if (!item || !templates?.length) return [];
    if (item.kategori) {
      return templates.filter((t) => (t.kategori || '') === item.kategori);
    }
    const legacy = [].concat(item.legacy || []);
    if (!legacy.length) return [];
    return templates.filter((t) => {
      const ml = String(t.modul_legacy || '').toLowerCase();
      return legacy.some((l) => {
        const x = String(l).toLowerCase();
        return ml === x || ml.includes(x) || x.includes(ml);
      });
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function fetchGenerateDocx(kode, idBiodata) {
    const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    const url = `${base}/api/letters/generate?kode=${encodeURIComponent(kode)}&id_biodata=${encodeURIComponent(idBiodata)}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal generate (${res.status})`);
    }
    return res.blob();
  }

  function buildPdfSummary(idBiodata, detail, fiskal) {
    if (typeof pdfMake === 'undefined') {
      throw new Error('Library PDF belum dimuat (makepdf.js).');
    }
    const p = detail?.personal || {};
    const rows = [
      ['ID Biodata', p.id_biodata || idBiodata],
      ['Nama', p.nama || '-'],
      ['Status', p.statusaktif || '-'],
      ['Negara', p.negara1 || '-'],
      ['Tanggal daftar', p.tanggaldaftar || '-']
    ];
    if (fiskal?.disnaker) rows.push(['Disnaker', fiskal.disnaker.nodisnaker || '-']);
    if (fiskal?.paspor?.aktif) rows.push(['Paspor', fiskal.paspor.aktif.nopaspor || '-']);
    if (fiskal?.visa) rows.push(['Visa', fiskal.visa.novisa || '-']);
    if (fiskal?.majikan) rows.push(['Majikan', fiskal.majikan.namamajikan || '-']);

    const body = [
      { text: 'Ringkasan Biodata TKI', style: 'header', margin: [0, 0, 0, 12] },
      { text: `Dicetak: ${new Date().toLocaleString('id-ID')}`, style: 'sub', margin: [0, 0, 0, 16] },
      {
        table: {
          widths: ['30%', '*'],
          body: rows.map(([a, b]) => [
            { text: a, bold: true, color: '#475569' },
            { text: String(b) }
          ])
        },
        layout: 'lightHorizontalLines'
      },
      { text: 'Dokumen resmi Word menggunakan template di folder files/ — pilih template lalu unduh .docx.', style: 'note', margin: [0, 16, 0, 0] }
    ];

    return {
      pageSize: 'A4',
      pageMargins: [40, 48, 40, 48],
      content: body,
      styles: {
        header: { fontSize: 16, bold: true },
        sub: { fontSize: 9, color: '#64748b' },
        note: { fontSize: 8, color: '#94a3b8', italics: true }
      },
      defaultStyle: { fontSize: 10 }
    };
  }

  function downloadPdfSummary(idBiodata, detail, fiskal) {
    const docDef = buildPdfSummary(idBiodata, detail, fiskal);
    pdfMake.createPdf(docDef).download(`ringkasan_${idBiodata.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  }

  function buildBiodataPdfDoc(idBiodata, detail, fiskal) {
    if (typeof pdfMake === 'undefined') throw new Error('Library PDF belum dimuat (makepdf.js).');
    const p = detail?.personal || {};
    const f = detail?.family || {};
    const body = [
      { text: 'Biodata TKI', style: 'header', margin: [0, 0, 0, 10] },
      { text: `ID: ${p.id_biodata || idBiodata}  ·  Dicetak: ${new Date().toLocaleString('id-ID')}`, style: 'sub', margin: [0, 0, 0, 14] }
    ];
    const section = (title, rows) => {
      if (!rows.length) return;
      body.push({ text: title, style: 'section', margin: [0, 8, 0, 6] });
      body.push({
        table: { widths: ['32%', '*'], body: rows.map(([a, b]) => [{ text: a, bold: true, color: '#475569' }, { text: String(b ?? '-') }]) },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 4]
      });
    };
    section('Data personal', [
      ['Nama', p.nama], ['Nama Mandarin', p.nama_mandarin], ['Jenis kelamin', p.jeniskelamin],
      ['Tgl lahir', p.tgllahir], ['Tempat lahir', p.tempatlahir], ['Agama', p.agama],
      ['Pendidikan', p.pendidikan], ['Alamat', p.alamat], ['HP', p.hp], ['Email', p.email],
      ['Negara', p.negara1], ['Status', p.statusaktif], ['Keterangan', p.keterangan]
    ]);
    section('Keluarga', [
      ['Ayah', f.namaayah || f.nama_bapak], ['Ibu', f.namaibu || f.nama_ibu],
      ['Suami', f.namasuami], ['Istri', f.namaistri]
    ]);
    if (fiskal?.disnaker) {
      section('Disnaker', [['No disnaker', fiskal.disnaker.nodisnaker], ['Tgl online', fiskal.disnaker.tglonline]]);
    }
    if (fiskal?.paspor?.aktif) {
      section('Paspor', [['No paspor', fiskal.paspor.aktif.nopaspor], ['Tgl terbit', fiskal.paspor.aktif.tglterbit]]);
    }
    if (fiskal?.visa) {
      section('Visa & terbang', [
        ['No visa', fiskal.visa.novisa], ['Tgl terbang', fiskal.visa.tanggalterbang], ['Status', fiskal.visa.statusterbang]
      ]);
    }
    if (fiskal?.majikan) {
      section('Majikan', [['Nama majikan', fiskal.majikan.namamajikan], ['Kode agen', fiskal.majikan.kode_agen]]);
    }
  if (Array.isArray(detail?.working) && detail.working.length) {
      const w = detail.working[0];
      section('Pengalaman kerja (utama)', [['Negara', w.negara], ['Jabatan', w.jabatan], ['Lama', w.lamakerja]]);
    }
    body.push({
      text: 'Untuk dokumen resmi lengkap (format Word legacy), gunakan tombol DOCX di atas.',
      style: 'note', margin: [0, 12, 0, 0]
    });
    return {
      pageSize: 'A4',
      pageMargins: [40, 48, 40, 48],
      content: body,
      styles: {
        header: { fontSize: 16, bold: true },
        sub: { fontSize: 9, color: '#64748b' },
        section: { fontSize: 11, bold: true, color: '#1e40af' },
        note: { fontSize: 8, color: '#94a3b8', italics: true }
      },
      defaultStyle: { fontSize: 9 }
    };
  }

  function downloadBiodataPdf(idBiodata, detail, fiskal) {
    pdfMake.createPdf(buildBiodataPdfDoc(idBiodata, detail, fiskal))
      .download(`biodata_${idBiodata.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  }

  function resolveBiodataDocKode(sektor) {
    if (typeof window !== 'undefined' && window.pickBiodataDocKode) {
      return window.pickBiodataDocKode(sektor);
    }
    const s = String(sektor || '').toUpperCase().slice(0, 2);
    if (s === 'JP') return 'biodata_jp';
    if (['FI', 'MI', 'IM'].includes(s)) return 'biodata_im';
    if (['MF', 'MH', 'MC'].includes(s)) return 'biodata_male';
    if (['HM', 'HF'].includes(s)) return 'biodata_hm';
    return 'biodata_word';
  }

  /**
   * Panel cetak di tab Personal — parity detailpersonal/views/detailpersonal.php (PRINT DOKUMEN)
   * Bukan bagian majikan; DOCX + PDF biodata.
   */
  function buildPersonalPrintPanel(ctx) {
    const { idBiodata, detail, onRefresh } = ctx;
    const sektor = sektorFromId(idBiodata);
    const card = el('div').css({
      background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
      border: '1px solid #e2e8f0',
      borderRadius: '0.75rem',
      padding: '1rem 1.1rem',
      marginBottom: '0.85rem'
    });
    card.child(el('div').css({ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }).child([
      el('i').class('fa-solid fa-print').css({ color: '#2563eb', fontSize: '1rem' }),
      el('h3').text('Print dokumen').css({ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' })
    ]));
    card.child(el('p').text('Cetak biodata per TKI (Word/PDF) seperti menu Personal di aplikasi lama — terpisah dari data majikan.').css({
      margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45
    }));

    const list = el('ul').css({ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' });

    function addDocBtn(label, kode, opts) {
      if (opts?.sektorOnly && !opts.sektorOnly.includes(sektor)) return;
      const li = el('li');
      const btn = el('button').attr('type', 'button').css({
        width: '100%',
        textAlign: 'left',
        padding: '0.55rem 0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid #bfdbfe',
        background: '#eff6ff',
        color: '#1e40af',
        fontWeight: '600',
        fontSize: '0.78rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem'
      });
      btn.child(el('i').class('fa-solid fa-file-word').css({ fontSize: '0.85rem', opacity: 0.9 }));
      btn.child(el('span').text(label));
      btn.click(async () => {
        const useKode = kode === '_auto' ? resolveBiodataDocKode(sektor) : kode;
        btn.disabled(true);
        try {
          const blob = await fetchGenerateDocx(useKode, idBiodata);
          downloadBlob(blob, `${useKode}_${idBiodata}.docx`);
          toast('Dokumen Word diunduh.', 'success');
        } catch (e) {
          toast(e.message || 'Gagal generate Word.', 'error');
        } finally {
          btn.disabled(false);
        }
      });
      li.child(btn);
      list.child(li);
    }

    function addPdfBtn(label, mode) {
      const li = el('li');
      const btn = el('button').attr('type', 'button').css({
        width: '100%',
        textAlign: 'left',
        padding: '0.55rem 0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid #fecaca',
        background: '#fef2f2',
        color: '#b91c1c',
        fontWeight: '600',
        fontSize: '0.78rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem'
      });
      btn.child(el('i').class('fa-solid fa-file-pdf').css({ fontSize: '0.85rem' }));
      btn.child(el('span').text(label));
      btn.click(async () => {
        btn.disabled(true);
        try {
          let fiskal = null;
          const fRes = await api().read(`biodata/${encodeURIComponent(idBiodata)}/fiskal`);
          if (fRes.success) fiskal = fRes.data;
          const d = detail || (await api().read(`biodata/${encodeURIComponent(idBiodata)}/detail`)).data;
          if (mode === 'biodata') downloadBiodataPdf(idBiodata, d, fiskal);
          else downloadPdfSummary(idBiodata, d, fiskal);
          toast('PDF diunduh.', 'success');
        } catch (e) {
          toast(e.message || 'Gagal PDF.', 'error');
        } finally {
          btn.disabled(false);
        }
      });
      li.child(btn);
      list.child(li);
    }

    if (sektor === 'HM' || sektor === 'HF') {
      addDocBtn(`BIODATA ${sektor} (DOCX)`, 'biodata_hm', { sektorOnly: ['HM', 'HF'] });
      addDocBtn('Letter of Statement (DOCX)', 'biodata_los', { sektorOnly: ['HM', 'HF'] });
      addDocBtn('Letter of Statement LPK (DOCX)', 'biodata_los_lpk', { sektorOnly: ['HM', 'HF'] });
    }
    addDocBtn('Biodata (DOCX)', '_auto');
    addDocBtn('Biodata Formal Chongyi (DOCX)', 'biodata_cong_yi');
    if (['FF', 'MF', 'FH'].includes(sektor)) {
      addDocBtn('Biodata Formal / Taiwan (DOCX)', 'kirim_biodata_tw');
    }
    addPdfBtn('Biodata (PDF)', 'biodata');
    addPdfBtn('Ringkasan singkat (PDF)', 'ringkasan');

    card.child(list);
    const hub = el('button').attr('type', 'button').text('Semua template cetak →').css({
      marginTop: '0.65rem',
      border: 'none',
      background: 'transparent',
      color: '#2563eb',
      fontSize: '0.72rem',
      fontWeight: '600',
      cursor: 'pointer',
      padding: 0,
      textAlign: 'left'
    });
    hub.click(() => { if (typeof layout !== 'undefined') layout.navigate('/printsurat'); });
    card.child(hub);

    return card;
  }

  /** Panel cetak di sidebar detail TKI */
  function buildCompact(ctx) {
    const { idBiodata, detail, onRefresh } = ctx;
    const card = el('div').css({
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.75rem',
      padding: '0.85rem 1rem',
      fontSize: '0.8125rem'
    });
    card.child(el('div').text('Cetak dokumen').css({
      fontWeight: '700',
      color: '#0f172a',
      marginBottom: '0.5rem',
      fontSize: '0.875rem'
    }));

    const select = el('select').css({
      width: '100%',
      padding: '0.45rem 0.5rem',
      borderRadius: '0.45rem',
      border: '1px solid #cbd5e1',
      fontSize: '0.8125rem',
      marginBottom: '0.5rem'
    });
    select.child(el('option').attr('value', '').text('Memuat template...'));
    card.child(select);

    const btnRow = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.35rem' });
    const wordBtn = el('button').attr('type', 'button').text('Unduh Word (.docx)').css({
      padding: '0.45rem 0.65rem',
      borderRadius: '0.45rem',
      border: 'none',
      background: '#2563eb',
      color: '#fff',
      fontWeight: '600',
      fontSize: '0.75rem',
      cursor: 'pointer'
    });
    const pdfBtn = el('button').attr('type', 'button').text('PDF ringkasan').css({
      padding: '0.45rem 0.65rem',
      borderRadius: '0.45rem',
      border: '1px solid #cbd5e1',
      background: '#fff',
      color: '#334155',
      fontWeight: '600',
      fontSize: '0.75rem',
      cursor: 'pointer'
    });
    const hubBtn = el('button').attr('type', 'button').text('Semua template cetak').css({
      padding: '0.4rem',
      border: 'none',
      background: 'transparent',
      color: '#2563eb',
      fontSize: '0.72rem',
      fontWeight: '600',
      cursor: 'pointer',
      textAlign: 'left'
    });
    btnRow.child([wordBtn, pdfBtn, hubBtn]);
    card.child(btnRow);

    let templates = [];
    let suggestedKode = '';

    async function loadTemplates() {
      const sektor = sektorFromId(idBiodata);
      const client = api();
      const [listRes, sugRes] = await Promise.all([
        client.read(`letters/templates?sektor=${encodeURIComponent(sektor)}`),
        client.read(`letters/suggest-biodata?id_biodata=${encodeURIComponent(idBiodata)}`)
      ]);
      templates = (listRes.success && listRes.data) ? listRes.data.filter((t) => t.file_ok !== false) : [];
      suggestedKode = sugRes.data?.kode || '';
      select.empty();
      if (!templates.length) {
        select.child(el('option').attr('value', '').text('Tidak ada template'));
        return;
      }
      templates.forEach((t) => {
        const opt = el('option').attr('value', t.kode).text(`${t.nama} (${t.kategori || '-'})`);
        if (t.kode === suggestedKode) opt.attr('selected', 'selected');
        select.child(opt);
      });
    }

    wordBtn.click(async () => {
      const kode = select.getVal() || suggestedKode;
      if (!kode) {
        toast('Pilih template terlebih dahulu.', 'warning');
        return;
      }
      wordBtn.disabled(true);
      try {
        const blob = await fetchGenerateDocx(kode, idBiodata);
        downloadBlob(blob, `${kode}_${idBiodata}.docx`);
        toast('Dokumen Word diunduh.', 'success');
      } catch (e) {
        toast(e.message || 'Gagal generate Word.', 'error');
      } finally {
        wordBtn.disabled(false);
      }
    });

    pdfBtn.click(async () => {
      pdfBtn.disabled(true);
      try {
        let fiskal = null;
        const fRes = await api().read(`biodata/${encodeURIComponent(idBiodata)}/fiskal`);
        if (fRes.success) fiskal = fRes.data;
        downloadPdfSummary(idBiodata, detail, fiskal);
        toast('PDF ringkasan diunduh.', 'success');
      } catch (e) {
        toast(e.message || 'Gagal PDF.', 'error');
      } finally {
        pdfBtn.disabled(false);
      }
    });

    hubBtn.click(() => {
      if (typeof layout !== 'undefined') layout.navigate('/printsurat');
    });

    loadTemplates().catch(() => {
      select.empty();
      select.child(el('option').attr('value', '').text('Gagal memuat template'));
    });

    return card;
  }

  const PRINT_HUB_UI = {
    groupMeta: {
      rekom: { icon: 'fa-file-shield', color: '#2563eb', light: '#eff6ff' },
      keuangan: { icon: 'fa-coins', color: '#059669', light: '#ecfdf5' },
      laporan: { icon: 'fa-chart-line', color: '#7c3aed', light: '#f5f3ff' },
      legal: { icon: 'fa-scale-balanced', color: '#b45309', light: '#fffbeb' },
      opp_ntb: { icon: 'fa-plane-departure', color: '#ea580c', light: '#fff7ed' },
      katalog: { icon: 'fa-folder-open', color: '#0891b2', light: '#ecfeff' }
    },
    itemIcons: {
      pap_ktkln: 'fa-passport', rekom_ijin: 'fa-file-signature', asuransi_pap: 'fa-shield-heart',
      pengajuan_bank: 'fa-building-columns', briefing: 'fa-chalkboard-user',
      kat_biodata: 'fa-id-card', kat_visa: 'fa-plane', kat_keuangan: 'fa-receipt'
    }
  };

  function printGroupMeta(groupId) {
    return PRINT_HUB_UI.groupMeta[groupId] || { icon: 'fa-print', color: '#475569', light: '#f8fafc' };
  }

  function printItemIcon(menuId) {
    return PRINT_HUB_UI.itemIcons[menuId] || 'fa-file-lines';
  }

  function setMenuCardActive(card, on) {
    if (!card || typeof card.css !== 'function') return;
    card.css({
      borderColor: on ? '#2563eb' : '#e2e8f0',
      background: on ? '#f8fafc' : '#fff',
      boxShadow: on
        ? '0 0 0 3px rgba(37,99,235,0.14), 0 8px 20px rgba(15,23,42,0.08)'
        : '0 1px 2px rgba(15,23,42,0.05)',
      transform: on ? 'translateY(-2px)' : 'none'
    });
  }

  function createWordTemplateTile(t, getIdBiodata) {
    const ok = !!t.file_ok;
    const tile = el('div').css({
      background: '#fff',
      border: `1px solid ${ok ? '#e2e8f0' : '#fecaca'}`,
      borderRadius: '0.875rem',
      padding: '1rem 1.05rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.65rem',
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
    });
    const head = el('div').css({ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' });
    head.child(el('div').css({
      width: '2.35rem', height: '2.35rem', borderRadius: '0.65rem',
      background: ok ? '#eff6ff' : '#fef2f2',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'
    }).child(el('i').class(ok ? 'fa-solid fa-file-word' : 'fa-solid fa-triangle-exclamation').css({
      color: ok ? '#2563eb' : '#dc2626', fontSize: '1rem'
    })));
    const meta = el('div').css({ flex: '1', minWidth: 0 });
    meta.child(el('div').text(t.nama).css({ fontWeight: '700', color: '#0f172a', fontSize: '0.875rem', lineHeight: 1.35 }));
    meta.child(el('div').text(`${t.kategori || '-'} · ${t.kode}`).css({
      fontSize: '0.72rem', color: '#64748b', fontFamily: 'ui-monospace, monospace', marginTop: '0.2rem'
    }));
    head.child(meta);
    tile.child(head);
    if (!ok) {
      tile.child(el('span').text('File template belum tersedia').css({
        fontSize: '0.7rem', color: '#dc2626', fontWeight: '600', padding: '0.2rem 0.45rem',
        background: '#fef2f2', borderRadius: '0.35rem', alignSelf: 'flex-start'
      }));
    }
    const dl = el('button').attr('type', 'button').text(ok ? 'Unduh Word' : 'Tidak tersedia').css({
      padding: '0.5rem 0.75rem',
      borderRadius: '0.5rem',
      border: 'none',
      background: ok ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#e2e8f0',
      color: ok ? '#fff' : '#94a3b8',
      fontWeight: '600',
      fontSize: '0.78rem',
      cursor: ok ? 'pointer' : 'not-allowed',
      width: '100%'
    });
    if (ok) {
      dl.click(async () => {
        const idB = getIdBiodata();
        if (!idB) {
          toast('Isi ID Biodata dulu.', 'warning');
          return;
        }
        dl.disabled(true);
        try {
          const blob = await fetchGenerateDocx(t.kode, idB);
          downloadBlob(blob, `${t.kode}_${idB}.docx`);
          toast('Diunduh.', 'success');
        } catch (e) {
          toast(e.message, 'error');
        } finally {
          dl.disabled(false);
        }
      });
    }
    tile.child(dl);
    return tile;
  }

  /** Halaman hub Print Surat (print_data — banyak sub-menu cetak) */
  function buildPrintHub() {
    const root = el('div').css({
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      maxWidth: '1280px',
      margin: '0 auto',
      width: '100%',
      paddingBottom: '1.5rem'
    });

    const hero = el('div').css({
      background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
      borderRadius: '1rem',
      padding: '1.35rem 1.5rem',
      color: '#fff',
      boxShadow: '0 10px 28px rgba(37,99,235,0.22)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '1rem',
      alignItems: 'flex-start',
      justifyContent: 'space-between'
    });
    const heroText = el('div').css({ flex: '1', minWidth: '220px' });
    heroText.child(el('div').css({ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }).child([
      el('div').css({
        width: '2.5rem', height: '2.5rem', borderRadius: '0.65rem',
        background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }).child(el('i').class('fa-solid fa-print').css({ fontSize: '1.15rem' })),
      el('h1').text('Print Surat').css({ margin: 0, fontSize: '1.65rem', fontWeight: '800', letterSpacing: '-0.02em' })
    ]));
    heroText.child(el('p').text('Pilih jenis surat, kelola data batch, lalu unduh template Word atau PDF per ID Biodata.').css({
      margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.88)', maxWidth: '36rem'
    }));
    const steps = el('div').css({
      display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.85rem'
    });
    ['1. Pilih menu', '2. Isi ID Biodata', '3. Unduh dokumen'].forEach((s) => {
      steps.child(el('span').text(s).css({
        fontSize: '0.72rem', fontWeight: '600', padding: '0.28rem 0.55rem',
        borderRadius: '999px', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)'
      }));
    });
    heroText.child(steps);
    hero.child(heroText);
    root.child(hero);

    const toolbar = el('div').css({
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.875rem',
      padding: '1rem 1.15rem',
      boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem'
    });
    const filterRow = el('div').css({
      display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end'
    });
    const idInput = el('input').attr('type', 'text').attr('placeholder', 'Contoh: FF-0001, MF-0123…').css({
      padding: '0.6rem 0.75rem 0.6rem 2.35rem',
      borderRadius: '0.55rem',
      border: '1px solid #cbd5e1',
      minWidth: 'min(100%, 280px)',
      flex: '1',
      fontSize: '0.9rem',
      background: '#f8fafc',
      outline: 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s'
    });
    const idFieldWrap = el('div').css({ flex: '1', minWidth: '200px', position: 'relative' });
    idFieldWrap.child(el('i').class('fa-solid fa-id-card').css({
      position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
      color: '#94a3b8', fontSize: '0.85rem', pointerEvents: 'none'
    }));
    idFieldWrap.child([
      el('label').text('ID Biodata TKI').css({ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem' }),
      idInput
    ]);
    const btnSemua = el('button').attr('type', 'button').text('Semua template').css({
      padding: '0.6rem 1rem',
      borderRadius: '0.55rem',
      border: '1px solid #cbd5e1',
      background: '#fff',
      fontSize: '0.8125rem',
      fontWeight: '600',
      cursor: 'pointer',
      color: '#334155',
      whiteSpace: 'nowrap'
    });
    const menuSearch = el('input').attr('type', 'search').attr('placeholder', 'Cari menu cetak…').css({
      padding: '0.55rem 0.7rem 0.55rem 2.1rem',
      borderRadius: '0.55rem',
      border: '1px solid #e2e8f0',
      fontSize: '0.8125rem',
      width: '100%',
      background: '#f8fafc'
    });
    const searchWrap = el('div').css({ position: 'relative', width: '100%' });
    searchWrap.child(el('i').class('fa-solid fa-magnifying-glass').css({
      position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)',
      color: '#94a3b8', fontSize: '0.8rem', pointerEvents: 'none'
    }));
    searchWrap.child(menuSearch);
    filterRow.child([idFieldWrap, el('div').css({ paddingBottom: '0.05rem' }).child(btnSemua)]);
    toolbar.child(filterRow);
    toolbar.child(searchWrap);
    root.child(toolbar);

    const menuWrap = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: '4rem' });

    const tplHeader = el('div');
    const tplHint = el('p').css({ margin: '0 0 0.85rem', color: '#64748b', fontSize: '0.8125rem', lineHeight: 1.5 });
    const grid = el('div').css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))',
      gap: '1rem'
    });
    const tplBlock = el('div').css({
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.875rem',
      padding: '1.15rem 1.25rem',
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
    }).child([tplHeader, tplHint, grid]);

    let activeMenuId = null;
    let allTemplates = [];
    let printStats = {};
    const menuCardEls = {};
    const menuCardFilterMeta = [];

    function getIdBiodata() {
      return idInput.getVal()?.trim() || '';
    }

    async function refreshTemplates() {
      const sektor = sektorFromId(getIdBiodata());
      let url = 'letters/templates?';
      if (sektor) url += `sektor=${encodeURIComponent(sektor)}`;
      const res = await api().read(url);
      allTemplates = (res.success && res.data) ? res.data : [];
    }

    function renderTemplateGrid() {
      grid.empty();
      const found = findPrintDataMenu(activeMenuId);
      const item = found?.item;

      if (activeMenuId && item) {
        tplHeader.empty();
        tplHeader.child(el('div').css({ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }).child([
          el('h2').text(item.label).css({ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }),
          el('span').text('Template Word').css({
            fontSize: '0.68rem', fontWeight: '700', padding: '0.2rem 0.45rem',
            borderRadius: '999px', background: '#eff6ff', color: '#1d4ed8'
          })
        ]));
        tplHint.text(item.batch
          ? 'Mode batch: kelola daftar TKI di menu terkait, lalu pilih template di bawah untuk cetak per ID.'
          : (item.desc || 'Pilih template lalu unduh dengan ID Biodata yang sudah diisi.'));
      } else {
        tplHeader.empty();
        tplHeader.child(el('h2').text('Katalog template Word').css({ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }));
        tplHint.text('Semua file .docx dari folder files/ — filter otomatis menyesuaikan sektor dari ID Biodata.');
      }

      let items = allTemplates;
      if (item) items = matchMenuTemplates(allTemplates, item);

      if (!items.length) {
        const legacyNote = item?.legacy ? ` Modul legacy: ${[].concat(item.legacy).join(', ')}.` : '';
        grid.child(el('div').css({
          gridColumn: '1 / -1',
          padding: '1rem',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '0.65rem',
          color: '#92400e',
          fontSize: '0.8125rem',
          lineHeight: 1.5
        }        ).text(
          item
            ? `Belum ada template Word yang ter-mapping untuk menu ini.${legacyNote}`
            : 'Tidak ada template. Pastikan seed letter_templates dan file .docx di files/.'
        ));
        flushEl(grid);
        return;
      }

      items.forEach((t) => grid.child(createWordTemplateTile(t, getIdBiodata)));
      flushEl(tplHeader);
      flushEl(grid);
    }

    function updateMenuBadges() {
      const groups = getPrintGroups();
      groups.forEach((group) => {
        group.items.forEach((menuItem) => {
          const card = menuCardEls[menuItem.id];
          if (!card?._badgeEl) return;
          const badge = card._badgeEl;
          const docCount = typeof PrintDataRegistry !== 'undefined'
            ? PrintDataRegistry.sumCounts(printStats, menuItem.countResources)
            : null;
          const pill = (text, bg, color) => badge.text(text).css({
            display: 'inline-block', fontSize: '0.68rem', fontWeight: '700',
            padding: '0.22rem 0.5rem', borderRadius: '999px', background: bg, color
          });
          if (docCount != null) {
            pill(`${docCount} dokumen`, docCount > 0 ? '#dbeafe' : '#f1f5f9', docCount > 0 ? '#1d4ed8' : '#64748b');
            return;
          }
          const matched = matchMenuTemplates(allTemplates, menuItem);
          const ready = matched.filter((t) => t.file_ok).length;
          if (!matched.length) {
            pill('Cetak / laporan', '#f1f5f9', '#64748b');
          } else if (ready > 0) {
            pill(`${ready} template siap`, '#dcfce7', '#166534');
          } else {
            pill(`${matched.length} template`, '#fef3c7', '#92400e');
          }
        });
      });
    }

    function setActiveMenu(menuId) {
      activeMenuId = menuId;
      Object.keys(menuCardEls).forEach((id) => {
        setMenuCardActive(menuCardEls[id], id === menuId);
      });
      renderTemplateGrid();
    }

    function filterMenuCards(query) {
      const q = String(query || '').trim().toLowerCase();
      menuCardFilterMeta.forEach((meta) => {
        const match = !q || meta.label.includes(q) || meta.groupTitle.includes(q);
        meta.card.el.style.display = match ? '' : 'none';
      });
      const sections = new Set(menuCardFilterMeta.map((m) => m.sectionEl));
      sections.forEach((sectionEl) => {
        if (!sectionEl) return;
        const cardsInSection = sectionEl.querySelectorAll('[data-print-menu-card]');
        let show = false;
        for (let i = 0; i < cardsInSection.length; i++) {
          if (cardsInSection[i].style.display !== 'none') { show = true; break; }
        }
        sectionEl.style.display = show ? '' : 'none';
      });
    }

    function renderMenuHub() {
      menuWrap.empty();
      menuCardFilterMeta.length = 0;
      Object.keys(menuCardEls).forEach((k) => { delete menuCardEls[k]; });
      getPrintGroups().forEach((group) => {
        const gm = printGroupMeta(group.id);
        const section = el('div').css({
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.875rem',
          padding: '1rem 1.1rem 1.1rem',
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
          marginBottom: '0.25rem'
        });
        const sectionHead = el('div').css({
          display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem'
        });
        sectionHead.child(el('div').css({
          width: '2.1rem', height: '2.1rem', borderRadius: '0.55rem',
          background: gm.light, color: gm.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'
        }).child(el('i').class(`fa-solid ${gm.icon}`).css({ fontSize: '0.95rem' })));
        sectionHead.child(el('h2').text(group.title).css({
          margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#0f172a'
        }));
        section.child(sectionHead);
        const cards = el('div').css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '0.65rem'
        });
        group.items.forEach((menuItem) => {
          const icon = printItemIcon(menuItem.id);
          const card = el('div').attr('role', 'button').attr('tabindex', '0')
            .attr('data-print-menu-card', '1').css({
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.65rem',
              padding: '0.75rem 0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.7rem',
              boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
              transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s'
            });
          card.child(el('div').css({
            width: '2.25rem', height: '2.25rem', borderRadius: '0.55rem',
            background: gm.light, color: gm.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0'
          }).child(el('i').class(`fa-solid ${icon}`).css({ fontSize: '0.9rem' })));
          const body = el('div').css({ flex: '1', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' });
          body.child(el('span').text(menuItem.label).css({
            fontWeight: '700', fontSize: '0.8125rem', color: '#0f172a', lineHeight: 1.35
          }));
          if (menuItem.desc) {
            body.child(el('span').text(menuItem.desc).css({
              fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }));
          }
          const badge = el('span').text('…').css({ alignSelf: 'flex-start' });
          card._badgeEl = badge;
          body.child(badge);
          const tags = el('div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.15rem' });
          if (menuItem.batch) {
            tags.child(el('span').text('Batch').css({
              fontSize: '0.62rem', fontWeight: '700', padding: '0.15rem 0.4rem',
              borderRadius: '0.3rem', background: '#f1f5f9', color: '#475569'
            }));
          }
          if (menuItem.crudResources?.length && typeof PrintDataRegistry !== 'undefined') {
            menuItem.crudResources.forEach((res) => {
              const lbl = PrintDataRegistry.RESOURCE_LABELS[res] || res;
              const link = el('button').attr('type', 'button').text(lbl).css({
                fontSize: '0.62rem', color: '#2563eb', fontWeight: '600', cursor: 'pointer',
                border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '0.3rem',
                padding: '0.12rem 0.35rem'
              });
              link.click((e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                if (typeof layout !== 'undefined') {
                  layout.navigate(PrintDataRegistry.crudPathForResource(res));
                }
              });
              tags.child(link);
            });
          }
          if (tags.ch?.length) body.child(tags);
          card.child(body);
          card.child(el('i').class('fa-solid fa-chevron-right').css({
            color: '#cbd5e1', fontSize: '0.75rem', marginTop: '0.35rem', flexShrink: '0'
          }));
          const openBtn = menuItem.page || (menuItem.crudResources?.length === 1 && !menuItem.kategori)
            ? el('button').attr('type', 'button').text('Buka modul').css({
              fontSize: '0.65rem', fontWeight: '700', color: '#fff', background: '#2563eb',
              border: 'none', borderRadius: '0.35rem', padding: '0.2rem 0.45rem', cursor: 'pointer',
              marginTop: '0.2rem', alignSelf: 'flex-start'
            })
            : null;
          if (openBtn) {
            openBtn.click((e) => {
              if (e?.stopPropagation) e.stopPropagation();
              if (typeof PrintDataRegistry !== 'undefined' && PrintDataRegistry.resolveMenuPage) {
                const p = PrintDataRegistry.resolveMenuPage(menuItem);
                if (p && typeof layout !== 'undefined') layout.navigate(p);
              }
            });
            body.child(openBtn);
          }
          card.click(() => {
            if (menuItem.kategori) {
              setActiveMenu(menuItem.id);
              return;
            }
            const page = typeof PrintDataRegistry !== 'undefined' && PrintDataRegistry.resolveMenuPage
              ? PrintDataRegistry.resolveMenuPage(menuItem) : null;
            if (page && typeof layout !== 'undefined') {
              layout.navigate(page);
              return;
            }
            setActiveMenu(menuItem.id);
          });
          card.hover(
            () => { if (menuItem.id !== activeMenuId) card.css({ borderColor: '#93c5fd', boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }); },
            () => { if (menuItem.id !== activeMenuId) setMenuCardActive(card, false); }
          );
          menuCardEls[menuItem.id] = card;
          menuCardFilterMeta.push({
            card,
            label: menuItem.label.toLowerCase(),
            groupTitle: group.title.toLowerCase(),
            sectionEl: section.el
          });
          cards.child(card);
        });
        section.child(cards);
        menuWrap.child(section);
      });
      updateMenuBadges();
      filterMenuCards(menuSearch.getVal?.() || '');
    }

    menuSearch.on('input', () => filterMenuCards(menuSearch.getVal()));

    const htmlSection = el('div').css({
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.875rem',
      padding: '1.15rem 1.25rem',
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
    });
    htmlSection.child(el('div').css({ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }).child([
      el('i').class('fa-solid fa-file-pdf').css({ color: '#dc2626', fontSize: '1.1rem' }),
      el('h3').text('Template HTML (PDF)').css({ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' })
    ]));
    const htmlList = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.5rem' });
    htmlSection.child(htmlList);

    async function renderHtmlTemplates() {
      htmlList.empty();
      const res = await api().read('letters/html-templates');
      const items = (res.success && res.data) ? res.data : [];
      if (!items.length) {
        htmlList.child(el('p').text('Belum ada template HTML di document_templates.').css({ margin: 0, color: '#94a3b8', fontSize: '0.8125rem' }));
        flushEl(htmlList);
        return;
      }
      items.forEach((t) => {
        const row = el('div').css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          padding: '0.65rem 0.85rem',
          background: '#f8fafc',
          borderRadius: '0.55rem',
          border: '1px solid #e2e8f0'
        });
        row.child(el('div').css({ display: 'flex', alignItems: 'center', gap: '0.5rem' }).child([
          el('i').class('fa-solid fa-file-code').css({ color: '#64748b', fontSize: '0.9rem' }),
          el('span').text(`${t.name} (${t.template_type || 'opp'})`).css({ fontWeight: '600', fontSize: '0.8125rem', color: '#0f172a' })
        ]));
        const actions = el('div').css({ display: 'flex', gap: '0.35rem' });
        const prev = el('button').attr('type', 'button').text('Preview').css(btnGhostStyle());
        const pdf = el('button').attr('type', 'button').text('PDF').css(btnGhostStyle());
        actions.child([prev, pdf]);
        row.child(actions);
        htmlList.child(row);

        prev.click(async () => {
          const idB = idInput.getVal()?.trim();
          if (!idB) { toast('Isi ID Biodata.', 'warning'); return; }
          try {
            const r = await api().read(`letters/html-render?id=${t.id}&id_biodata=${encodeURIComponent(idB)}`);
            if (!r.success) throw new Error(r.error);
            const w = window.open('', '_blank');
            if (w) {
              w.document.write(r.data.html);
              w.document.close();
            }
          } catch (e) {
            toast(e.message, 'error');
          }
        });

        pdf.click(async () => {
          const idB = idInput.getVal()?.trim();
          if (!idB) { toast('Isi ID Biodata.', 'warning'); return; }
          try {
            const r = await api().read(`letters/html-render?id=${t.id}&id_biodata=${encodeURIComponent(idB)}`);
            if (!r.success) throw new Error(r.error);
            const tmp = document.createElement('div');
            tmp.innerHTML = r.data.html;
            const text = tmp.textContent || '';
            const docDef = {
              content: [
                { text: t.name, style: 'h' },
                { text: text, margin: [0, 8, 0, 0] }
              ],
              styles: { h: { fontSize: 14, bold: true } },
              defaultStyle: { fontSize: 10 }
            };
            pdfMake.createPdf(docDef).download(`${t.name}_${idB}.pdf`);
          } catch (e) {
            toast(e.message, 'error');
          }
        });
      });
      flushEl(htmlList);
    }

    function btnGhostStyle() {
      return {
        padding: '0.4rem 0.65rem',
        borderRadius: '0.45rem',
        border: '1px solid #cbd5e1',
        background: '#fff',
        fontSize: '0.75rem',
        fontWeight: '600',
        cursor: 'pointer',
        color: '#334155'
      };
    }

    btnSemua.click(() => setActiveMenu(null));
    btnSemua.css({
      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
    });
    idInput.on('focus', () => idInput.css({ borderColor: '#2563eb', boxShadow: '0 0 0 3px rgba(37,99,235,0.12)' }));
    idInput.on('blur', () => idInput.css({ borderColor: '#cbd5e1', boxShadow: 'none' }));

    async function loadPrintStats() {
      try {
        const res = await api().read('letters/print-data-stats');
        printStats = (res.success && res.data) ? res.data : {};
      } catch {
        printStats = {};
      }
    }

    async function bootstrap() {
      const loading = el('p').text('Memuat template Word...').css({ color: '#64748b', fontSize: '0.8125rem' });
      grid.empty().child(loading);
      flushEl(grid);
      try {
        await Promise.all([refreshTemplates(), loadPrintStats()]);
        renderTemplateGrid();
        updateMenuBadges();
      } catch (e) {
        grid.empty().child(el('p').text(e.message || 'Gagal memuat template.').css({ color: '#dc2626', fontSize: '0.8125rem' }));
        flushEl(grid);
      }
    }

    idInput.on('input', () => {
      refreshTemplates()
        .then(() => { updateMenuBadges(); renderTemplateGrid(); })
        .catch((e) => toast(e.message, 'error'));
    });

    // Kartu menu — isi dulu, baru mount ke root (el.js: .child(wrapper) memanggil .get() segera)
    renderMenuHub();
    if (!getPrintGroups().length) {
      menuWrap.child(el('p').text('Menu cetak tidak dimuat. Pastikan print-data-registry.js ada di index.html.').css({
        color: '#dc2626', fontSize: '0.875rem', padding: '0.5rem 0'
      }));
    }
    root.child(menuWrap);
    root.child(tplBlock);
    root.child(htmlSection);

    bootstrap().catch((e) => toast(e.message, 'error'));
    renderHtmlTemplates().catch(() => {});

    return root;
  }

  function registerPrintHub() {
    if (typeof UiBuilder === 'undefined') return;
    UiBuilder.registerComponent('print-surat-hub', () => buildPrintHub().get());
  }

  registerPrintHub();

  global.DocumentPrintPanel = {
    buildCompact,
    buildPrintHub,
    buildPersonalPrintPanel
  };
})(typeof window !== 'undefined' ? window : global);
