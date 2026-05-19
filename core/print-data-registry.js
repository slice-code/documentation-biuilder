(function (global) {
  'use strict';

  /**
   * Hub Print Surat — parity flamboyan-app/modules/print_data
   * Kartu menu + resource CRUD batch + mapping modul legacy CI.
   */
  const PRINT_DATA_GROUPS = [
    {
      id: 'rekom',
      title: 'Rekomendasi & Asuransi',
      items: [
        {
          id: 'pap_batch',
          label: 'Pengajuan PAP',
          desc: 'Batch PAP + daftar CTKI + cetak',
          legacy: ['surat_rekom_tabelpap'],
          batch: true,
          page: '/print/pembuatan_tabelpap',
          countResources: ['pembuatan_tabelpap']
        },
        {
          id: 'ktkln_batch',
          label: 'Pengajuan KTKLN',
          desc: 'Batch KTKLN + daftar CTKI',
          legacy: ['surat_rekom_tabelktkln'],
          batch: true,
          page: '/print/pembuatan_tabelktkln',
          countResources: ['pembuatan_tabelktkln']
        },
        {
          id: 'rekom_ijin',
          label: 'Surat rekom ijin',
          desc: 'Batch per tanggal + detail CTKI (pola PAP)',
          legacy: ['surat_rekom_ijin_batch', 'surat_rekom_ijin'],
          batch: true,
          page: '/print/surat_rekom_ijin_batch',
          countResources: ['surat_rekom_ijin_batch']
        },
        {
          id: 'rekom_tabungan',
          label: 'Rekom buka rekening tabungan',
          desc: 'Surat rekom tabungan per TKI',
          legacy: ['surat_rekom_tabungan'],
          countResources: ['pembuatan_tabungan'],
          crudResources: ['pembuatan_tabungan'],
          page: '/print/pembuatan_tabungan'
        },
        {
          id: 'asuransi_pra_awal',
          label: 'Asuransi pra-awal',
          desc: 'Batch DIS pra-awal',
          legacy: ['surat_rekom_tabeldis'],
          batch: true,
          page: '/print/pembuatan_tabeldis',
          countResources: ['pembuatan_tabeldis']
        },
        {
          id: 'asuransi_pra_pap',
          label: 'Asuransi pra-PAP',
          desc: 'Batch DIS pra-PAP',
          legacy: ['surat_rekom_tabeldis2'],
          batch: true,
          page: '/print/pembuatan_tabeldis2',
          countResources: ['pembuatan_tabeldis2']
        },
        {
          id: 'asuransi_masa_pap',
          label: 'Asuransi masa PAP',
          desc: 'Batch DIS masa PAP',
          legacy: ['surat_rekom_tabeldis3'],
          batch: true,
          page: '/print/pembuatan_tabeldis3',
          countResources: ['pembuatan_tabeldis3']
        },
        {
          id: 'laporan_an05',
          label: 'Laporan AN 05',
          desc: 'Batch laporan + CTKI',
          legacy: ['surat_rekom_laporan'],
          batch: true,
          page: '/print/pembuatan_laporan',
          countResources: ['pembuatan_laporan']
        }
      ]
    },
    {
      id: 'keuangan',
      title: 'Keuangan & Agen',
      items: [
        {
          id: 'pengajuan_bank',
          label: 'Surat pengajuan bank',
          desc: 'Header surat + detail CTKI & pinjaman (pola PAP)',
          legacy: ['surat_pengajuan_keuangan'],
          batch: true,
          page: '/print/surat_pengajuan',
          countResources: ['surat_pengajuan']
        },
        {
          id: 'biaya_agen',
          label: 'Laporan biaya agensi',
          desc: 'Promosi agen',
          legacy: ['new_agen_promosi'],
          page: '/print/laporan/biaya-agen'
        },
        {
          id: 'perincian_terbang',
          label: 'Perincian TKI terbang ke agen',
          desc: 'Keuangan PT',
          legacy: ['new_perincian_keuangan_pt'],
          page: '/print/laporan/perincian-terbang'
        },
        {
          id: 'cicilan_kabur',
          label: 'Cicilan TKI kabur ke agen',
          desc: 'Cicilan kabur',
          legacy: ['new_cicilan_tki_kabur_agen'],
          page: '/print/laporan/cicilan-kabur'
        },
        {
          id: 'wintrust',
          label: 'Formulir Wintrust',
          desc: 'Form cetak Wintrust',
          legacy: ['formulir_wintrust', 'admin_laporan'],
          page: '/print/laporan/wintrust'
        }
      ]
    },
    {
      id: 'laporan',
      title: 'Laporan & Medical',
      items: [
        {
          id: 'laporan_md',
          label: 'Laporan MD / kabur / pulang',
          desc: 'Laporan MD',
          legacy: ['new_laporan_md'],
          page: '/keadaantki'
        },
        {
          id: 'legalisasi_spl',
          label: 'Surat pengajuan legalisasi',
          desc: 'SPL cost',
          legacy: ['spl_cost'],
          page: '/print/laporan/legalisasi-spl'
        },
        {
          id: 'pplk',
          label: 'Formulir pinjaman lembaga keuangan',
          desc: 'PPLK (manual)',
          legacy: ['pplk'],
          countResources: ['pplk'],
          crudResources: ['pplk'],
          page: '/print/pplk'
        },
        {
          id: 'medical_blm',
          label: 'Medical belum terbang',
          desc: 'Laporan medical',
          legacy: ['print_medical_blm_terbang'],
          page: '/print/laporan/medical-belum-terbang'
        },
        {
          id: 'expire_online',
          label: 'Expired tanggal online',
          desc: 'Laporan expire',
          legacy: ['print_expire_tgl_online'],
          page: '/print/laporan/expire-tgl-online'
        }
      ]
    },
    {
      id: 'legal',
      title: 'Legal, Briefing & Rekap',
      items: [
        {
          id: 'briefing',
          label: 'Briefing TKI',
          desc: 'Template briefing + data terbang',
          legacy: ['amplop_terbang', 'brifing'],
          page: '/print/laporan/briefing-template'
        },
        {
          id: 'rekap_kabur',
          label: 'Rekap kabur / pulang / interminate',
          desc: 'Rekap dokumen',
          legacy: ['rekap_kabur_interminate_ambil_dok'],
          page: '/print/laporan/rekap-kabur'
        },
        {
          id: 'rekom_malang',
          label: 'Print rekom Malang',
          desc: 'Paspor Malang',
          legacy: ['new_rekom_malang', 'new_rekom_malang_baru', 'pembuatan_paspor'],
          countResources: ['pembuatan_paspor_malang_print', 'surat_pernyataan_malang', 'pembuatan_paspor'],
          crudResources: ['pembuatan_paspor_malang_print', 'surat_pernyataan_malang', 'pembuatan_paspor']
        },
        {
          id: 'leg_pk',
          label: 'Permohonan legalisasi PK',
          desc: 'Surat legal PK',
          legacy: ['leg_pk'],
          countResources: ['leg_pk'],
          crudResources: ['leg_pk']
        },
        {
          id: 'hapus_pp',
          label: 'Penghapusan PP agency',
          desc: 'Surat penghapusan PP',
          legacy: ['penghapusan_pp'],
          countResources: ['penghapusan_pp'],
          crudResources: ['penghapusan_pp']
        }
      ]
    },
    {
      id: 'opp_ntb',
      title: 'OPP, PP & NTB',
      items: [
        {
          id: 'pembatalan_pp',
          label: 'Pembatalan PP jabatan',
          desc: 'Permohonan pembatalan PP jabatan',
          legacy: ['pembatalan_pp'],
          countResources: ['pembatalan_pp'],
          crudResources: ['pembatalan_pp']
        },
        {
          id: 'pembatalan_gabungan',
          label: 'Pembatalan PP jabatan & agency',
          desc: 'Pembatalan gabungan',
          legacy: ['pembatalan_gabungan'],
          countResources: ['pembatalan_gabungan'],
          crudResources: ['pembatalan_gabungan']
        },
        {
          id: 'pembuatan_opp',
          label: 'Permohonan OPP',
          desc: 'Pembuatan perjanjian penempatan',
          legacy: ['pembuatan_opp'],
          countResources: ['pembuatan_opp'],
          crudResources: ['pembuatan_opp']
        },
        {
          id: 'pembatalan_opp',
          label: 'Pembatalan OPP Malang',
          desc: 'Pembatalan OPP',
          legacy: ['pembatalan_opp'],
          countResources: ['pembatalan_opp'],
          crudResources: ['pembatalan_opp']
        },
        {
          id: 'pembatalan_opp_sidoarjo',
          label: 'Pembatalan OPP Sidoarjo',
          desc: 'Pembatalan OPP Sidoarjo',
          legacy: ['pembatalan_opp_sidoarjo'],
          countResources: ['pembatalan_opp_sidoarjo'],
          crudResources: ['pembatalan_opp_sidoarjo']
        },
        {
          id: 'berita_acara_ntb',
          label: 'Berita acara NTB',
          desc: 'Berita acara',
          legacy: ['berita_acara_ntb'],
          countResources: ['berita_acara_ntb'],
          crudResources: ['berita_acara_ntb']
        },
        {
          id: 'srat_jalan_ntb',
          label: 'Surat jalan NTB',
          desc: 'Surat jalan',
          legacy: ['srat_jalan_ntb'],
          countResources: ['srat_jalan_ntb'],
          crudResources: ['srat_jalan_ntb']
        }
      ]
    },
    {
      id: 'katalog',
      title: 'Katalog template per TKI',
      items: [
        { id: 'kat_biodata', label: 'Biodata & format khusus', desc: 'Template biodata Word', kategori: 'biodata' },
        { id: 'kat_surat', label: 'Surat & perjanjian', desc: 'PK, kontrak, rekom', kategori: 'surat' },
        { id: 'kat_disnaker', label: 'Disnaker & dokumen formal', desc: 'DL004, dok formal/informal', kategori: 'disnaker' },
        { id: 'kat_visa', label: 'Visa & apendik', desc: 'Apendik, dokumen terbang', kategori: 'visa' },
        { id: 'kat_spbg', label: 'SPBG', desc: 'Surat penjamin', kategori: 'spbg' },
        { id: 'kat_opp', label: 'Perjanjian penempatan (PP)', desc: 'OPP formal/informal', kategori: 'opp' },
        { id: 'kat_blk', label: 'BLK & briefing', desc: 'Jadwal, sertifikat, UJK', kategori: 'blk' },
        { id: 'kat_keuangan', label: 'Kwitansi & invoice', desc: 'Keuangan per TKI', kategori: 'keuangan' },
        { id: 'kat_laporan', label: 'Laporan rekap', desc: 'Disnaker, registrasi, majikan', kategori: 'laporan' }
      ]
    }
  ];

  const RESOURCE_LABELS = {
    pembuatan_tabelpap: 'PAP',
    pembuatan_tabelktkln: 'KTKLN',
    pembuatan_tabeldis: 'Asuransi pra-awal',
    pembuatan_tabeldis2: 'Asuransi pra-PAP',
    pembuatan_tabeldis3: 'Asuransi masa PAP',
    pembuatan_laporan: 'Laporan AN 05',
    surat_pengajuan: 'Surat pengajuan bank',
    personal_fee_tki_terbang: 'Perincian TKI terbang',
    pembuatan_tabungan: 'Rekom tabungan',
    pembuatan_ijin: 'Rekom ijin',
    pembuatan_opp: 'OPP',
    pembatalan_opp: 'Pembatalan OPP',
    pembatalan_opp_sidoarjo: 'Pembatalan OPP Sidoarjo',
    pembatalan_pp: 'Pembatalan PP',
    pembatalan_gabungan: 'Pembatalan gabungan',
    berita_acara_ntb: 'Berita acara NTB',
    srat_jalan_ntb: 'Surat jalan NTB',
    leg_pk: 'Legalisasi PK',
    penghapusan_pp: 'Penghapusan PP',
    pplk: 'PPLK',
    pembuatan_paspor: 'Pembuatan paspor',
    pembuatan_paspor_malang_print: 'Rekom Malang',
    surat_pernyataan_malang: 'Rekom luar Malang'
  };

  function crudPathForResource(resource) {
    return `/print/${resource}`;
  }

  function buildDocCrudConfig(resource, title) {
    const isPembatalan = /^pembatalan_/.test(resource);
    const fields = isPembatalan
      ? [
          { name: 'id_biodata', preset: 'id_biodata', required: true },
          { name: 'nomor', label: 'Nomor', type: 'text' },
          { name: 'tanggal', label: 'Tanggal', type: 'date' },
          { name: 'peserta', label: 'Peserta', type: 'textarea', colspan: 2 },
          { name: 'alasan', label: 'Alasan', type: 'textarea', colspan: 2 },
          { name: 'file', label: 'File', type: 'text' }
        ]
      : [
          { name: 'id_biodata', preset: 'id_biodata', required: true },
          { name: 'nomor', label: 'Nomor', type: 'text' },
          { name: 'tanggal', label: 'Tanggal', type: 'date' },
          { preset: 'kepada_datanamapap', label: 'Kepada', required: false },
          { name: 'isi', label: 'Isi', type: 'textarea', colspan: 2 },
          { name: 'file', label: 'File', type: 'text' }
        ];

    const columns = [
      { key: 'id', label: 'ID', sortable: true },
      { key: 'id_biodata', label: 'ID Biodata', sortable: true, searchable: true },
      { key: 'nomor', label: 'Nomor', sortable: true, searchable: true },
      { key: 'tanggal', label: 'Tanggal', sortable: true },
      { key: 'actions', type: 'actions', actions: ['edit', 'delete'] }
    ];

    return {
      resource,
      title: title || RESOURCE_LABELS[resource] || resource,
      icon: 'fas fa-print',
      formDisplay: 'modal',
      modalSize: 'large',
      pageContentPadding: '0',
      table: {
        columns,
        features: {
          search: true,
          pagination: true,
          perPage: 25,
          perPageOptions: [10, 25, 50, 100]
        }
      },
      form: {
        columns: 2,
        fields
      }
    };
  }

  function findMenu(menuId) {
    if (!menuId) return null;
    for (const g of PRINT_DATA_GROUPS) {
      const item = g.items.find((i) => i.id === menuId);
      if (item) return { group: g, item };
    }
    return null;
  }

  function sumCounts(stats, resources) {
    if (!resources?.length || !stats) return null;
    let total = 0;
    let any = false;
    resources.forEach((r) => {
      if (stats[r] != null) {
        total += Number(stats[r]) || 0;
        any = true;
      }
    });
    return any ? total : null;
  }

  /** Resource CRUD tambahan (belum di menu batch) */
  const EXTRA_CRUD_RESOURCES = ['personal_fee_tki_terbang', 'pembuatan_ijin_desa'];

  const RECORD_PDF_RESOURCES = new Set(['pembuatan_ijin', 'pembuatan_tabungan']);

  /** Form + tabel Rekom Ijin per TKI (parity pembuatan_ijin legacy + kolom Print) */
  function buildRekomIjinCrudConfig() {
    return {
      resource: 'pembuatan_ijin',
      title: 'Rekom Ijin',
      icon: 'fas fa-print',
      formDisplay: 'modal',
      modalSize: 'large',
      pageContentPadding: '0',
      table: {
        columns: [
          { key: 'nomor', label: 'Nomor Surat', sortable: true, searchable: true },
          { key: 'lampiran', label: 'Lampiran', sortable: true },
          { key: 'perihal', label: 'Perihal', searchable: true },
          { key: 'id_tki', label: 'ID TKI', sortable: true, searchable: true },
          { key: 'tanggal', label: 'Tanggal', sortable: true },
          { key: '_ops', label: 'Opsi', type: 'actions', actions: ['edit', 'delete'] },
          { key: '_pdf', label: 'PDF', type: 'actions', actions: ['printPdf'] },
          { key: '_print', label: 'Print', type: 'actions', actions: ['print'] }
        ],
        features: {
          search: true,
          pagination: true,
          perPage: 25,
          perPageOptions: [10, 25, 50, 100]
        }
      },
      enableRecordPdf: true,
      form: {
        columns: 2,
        fields: [
          { preset: 'id_tki', required: true },
          { name: 'nomor', label: 'Nomor Surat', type: 'text', required: true },
          { name: 'lampiran', label: 'Lampiran', type: 'text' },
          { name: 'perihal', label: 'Perihal', type: 'text' },
          { name: 'kepada', label: 'Kepada', type: 'textarea', colspan: 2 },
          { name: 'imigrasi', label: 'Imigrasi', type: 'text' },
          { name: 'jabatan', label: 'Jabatan', type: 'text' },
          { name: 'daerah', label: 'Daerah', type: 'text' },
          { name: 'tampilkan', label: 'Tampilkan', type: 'text' },
          { name: 'tanggal', label: 'Tanggal', type: 'date' }
        ]
      }
    };
  }

  /** Surat pengajuan bank — Excel pinjaman (parity printxls_test) + Word opsional */
  function buildSuratPengajuanCrudConfig() {
    return {
      resource: 'surat_pengajuan',
      title: 'Surat pengajuan bank',
      icon: 'fas fa-print',
      formDisplay: 'modal',
      modalSize: 'large',
      pageContentPadding: '0',
      enableSuratPengajuanExcel: true,
      printPkField: 'id',
      table: {
        columns: [
          { key: 'nomor', label: 'Nomor', sortable: true, searchable: true },
          { key: 'id_biodata', label: 'ID TKI', sortable: true, searchable: true },
          { key: 'tanggal', label: 'Tanggal', sortable: true },
          { key: 'kepada', label: 'Lembaga / Kepada', searchable: true },
          { key: '_ops', label: 'Opsi', type: 'actions', actions: ['edit', 'delete'] },
          { key: '_export', label: 'Export', type: 'actions', actions: ['exportPinjaman'] },
          { key: '_print', label: 'Print', type: 'actions', actions: ['print'] }
        ],
        features: {
          search: true,
          pagination: true,
          perPage: 25,
          perPageOptions: [10, 25, 50, 100]
        }
      },
      form: {
        columns: 2,
        fields: [
          { preset: 'id_biodata', required: true },
          { name: 'nomor', label: 'Nomor surat', type: 'text' },
          { name: 'tanggal', label: 'Tanggal', type: 'date' },
          { name: 'kepada', label: 'Lembaga keuangan', type: 'text' },
          { name: 'isi', label: 'Keterangan', type: 'textarea', colspan: 2 }
        ]
      }
    };
  }

  function buildRekomTabunganCrudConfig() {
    return {
      resource: 'pembuatan_tabungan',
      title: 'Rekom tabungan',
      icon: 'fas fa-print',
      formDisplay: 'modal',
      modalSize: 'large',
      pageContentPadding: '0',
      table: {
        columns: [
          { key: 'nomor', label: 'Nomor', sortable: true, searchable: true },
          { key: 'id_tki', label: 'ID TKI', sortable: true, searchable: true },
          { key: 'kepada', label: 'Kepada', searchable: true },
          { key: '_ops', label: 'Opsi', type: 'actions', actions: ['edit', 'delete'] },
          { key: '_pdf', label: 'PDF', type: 'actions', actions: ['printPdf'] },
          { key: '_print', label: 'Print', type: 'actions', actions: ['print'] }
        ],
        features: {
          search: true,
          pagination: true,
          perPage: 25,
          perPageOptions: [10, 25, 50, 100]
        }
      },
      enableRecordPdf: true,
      form: {
        columns: 2,
        fields: [
          { preset: 'id_tki', required: true },
          { name: 'nomor', label: 'Nomor', type: 'text' },
          { name: 'lampiran', label: 'Lampiran', type: 'text' },
          { name: 'perihal', label: 'Perihal', type: 'text' },
          { name: 'jabatan', label: 'Jabatan', type: 'text' },
          { preset: 'kepada_datanamapap', label: 'Kepada', required: false }
        ]
      }
    };
  }

  /** CRUD dengan tombol Print Word (appjson/print-surat-templates.json recordMap) */
  const PRINT_RECORD_RESOURCES = {
    pembuatan_ijin: { pk: 'id_pembuatan' },
    pembuatan_tabungan: { pk: 'id_pembuatan' },
    surat_pengajuan: { pk: 'id' },
    pembatalan_pp: { pk: 'id' },
    pembatalan_gabungan: { pk: 'id' },
    pembatalan_opp: { pk: 'id' },
    pembatalan_opp_sidoarjo: { pk: 'id' },
    pembuatan_opp: { pk: 'id' },
    leg_pk: { pk: 'id' },
    penghapusan_pp: { pk: 'id' },
    pplk: { pk: 'id' },
    pembuatan_paspor: { pk: 'id' },
    pembuatan_paspor_malang_print: { pk: 'id' },
    surat_pernyataan_malang: { pk: 'id' },
    berita_acara_ntb: { pk: 'id' },
    srat_jalan_ntb: { pk: 'id' }
  };

  function applyPrintCrudOptions(resource, config) {
    const pr = PRINT_RECORD_RESOURCES[resource];
    if (!pr || !config?.table) return config;
    let columns = [...(config.table.columns || [])];

    // Pisahkan Print ke kolom sendiri (seperti PAP / legacy btn-warning)
    columns = columns.map((col) => {
      if (col.type !== 'actions' || col.key === '_print') return col;
      const acts = (col.actions || []).filter((a) => a !== 'print');
      return { ...col, actions: acts.length ? acts : ['edit', 'delete'] };
    });

    if (!columns.some((c) => c.key === '_print')) {
      columns.push({ key: '_print', label: 'Print', type: 'actions', actions: ['print'] });
    }
    if (RECORD_PDF_RESOURCES.has(resource) && !columns.some((c) => c.key === '_pdf')) {
      columns.splice(columns.length - 1, 0, {
        key: '_pdf', label: 'PDF', type: 'actions', actions: ['printPdf']
      });
    }

    return {
      ...config,
      enableRecordPrint: true,
      enableRecordPdf: RECORD_PDF_RESOURCES.has(resource),
      printPkField: pr.pk,
      table: { ...config.table, columns }
    };
  }

  const _registeredCrud = new Set();
  const _registeredPages = new Set();

  function schemaToCrudConfig(schema, title) {
    if (!schema?.name) return null;
    const skip = new Set(['id', 'id_pembuatan', 'id_pembuatanpap']);
    const typeMap = { textarea: 'textarea', date: 'date', number: 'number', email: 'email' };
    const fields = (schema.fields || [])
      .filter((f) => f.name && !skip.has(f.name))
      .map((f) => {
        if (f.name === 'id_biodata') {
          return { name: 'id_biodata', preset: 'id_biodata', required: Boolean(f.required) };
        }
        if (f.name === 'id_tki') {
          return { name: 'id_tki', preset: 'id_tki', required: Boolean(f.required) };
        }
        return {
          name: f.name,
          label: (f.label || f.name).replace(/_/g, ' '),
          type: typeMap[f.type] || 'text',
          required: Boolean(f.required),
          colspan: f.type === 'textarea' ? 2 : 1
        };
      });
    const columns = fields
      .filter((f) => !['isi', 'kepada', 'peserta', 'alasan', 'file', 'keterangan'].includes(f.name))
      .slice(0, 5)
      .map((f) => ({ key: f.name, label: f.label, sortable: true, searchable: f.name === 'id_biodata' }));
    columns.push({ key: 'actions', type: 'actions', actions: ['edit', 'delete'] });
    return {
      resource: schema.name,
      title: title || schema.label || schema.name,
      icon: 'fas fa-print',
      formDisplay: 'modal',
      modalSize: 'large',
      pageContentPadding: '0',
      table: {
        columns,
        features: {
          search: true,
          pagination: true,
          perPage: 25,
          perPageOptions: [10, 25, 50, 100]
        }
      },
      form: { columns: 2, fields }
    };
  }

  function resolveMenuPage(menuItem) {
    if (menuItem.page) return menuItem.page;
    if (menuItem.crudResources?.length === 1) return crudPathForResource(menuItem.crudResources[0]);
    return null;
  }

  /** Laporan print — TableBuilder + pagination server-side (jika API mengembalikan pagination) */
  function buildReportTablePage(cfg) {
    const root = el('div').css({
      display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '1100px', margin: '0 auto', width: '100%'
    });
    const head = el('div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center', justifyContent: 'space-between' });
    head.child(el('div').child([
      el('h1').text(cfg.title).css({ margin: '0 0 0.25rem', fontSize: '1.35rem', fontWeight: '800', color: '#0f172a' }),
      el('p').text(cfg.subtitle || '').css({ margin: 0, fontSize: '0.85rem', color: '#64748b' })
    ]));
    const back = el('button').attr('type', 'button').text('← Print Surat').css({
      padding: '0.45rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1',
      background: '#fff', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer'
    });
    back.click(() => { if (typeof layout !== 'undefined') layout.navigate('/printsurat'); });
    head.child(back);
    root.child(head);
    const tableWrap = el('div').css({
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.875rem',
      overflow: 'auto', boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
    });
    const table = el('table').css({ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' });
    const thead = el('thead');
    const hr = el('tr').css({ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' });
    cfg.columns.forEach((c) => {
      hr.child(el('th').text(c.label).css({
        padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap'
      }));
    });
    thead.child(hr);
    table.child(thead);
    const tbody = el('tbody');
    table.child(tbody);
    tableWrap.child(table);
    root.child(tableWrap);
    const status = el('p').text('Memuat data…').css({ margin: 0, color: '#64748b', fontSize: '0.8125rem' });
    root.child(status);

    const api = () => {
      if (typeof window !== 'undefined' && window.flamboyanApp?.core?.apiClient) {
        return window.flamboyanApp.core.apiClient;
      }
      return new ApiClient({ baseUrl: '/api' });
    };

    api().read(cfg.apiPath).then((res) => {
      tbody.empty();
      const rows = (res.success && res.data) ? res.data : [];
      status.text(`${rows.length} baris`);
      if (!rows.length) {
        const tr = el('tr');
        tr.child(el('td').attr('colspan', String(cfg.columns.length)).text(cfg.emptyText || 'Tidak ada data.')
          .css({ padding: '1.25rem', color: '#94a3b8', textAlign: 'center' }));
        tbody.child(tr);
        tbody.get();
        return;
      }
      rows.forEach((row) => {
        const tr = el('tr').css({ borderBottom: '1px solid #f1f5f9' });
        cfg.columns.forEach((c) => {
          const val = row[c.key] != null ? String(row[c.key]) : '—';
          tr.child(el('td').text(val).css({ padding: '0.55rem 0.75rem', color: '#334155' }));
        });
        tbody.child(tr);
      });
      tbody.get();
    }).catch((e) => {
      status.text(e.message || 'Gagal memuat laporan').css({ color: '#dc2626' });
    });

    return root.get();
  }

  /** Halaman unduh template Word/Excel (modul keuangan / laporan) */
  function buildTemplateDownloadPage(cfg) {
    const root = el('motion.div').css({
      maxWidth: '720px', margin: '0 auto', padding: '1.5rem',
      background: '#fff', borderRadius: '0.875rem', border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
    });
    root.child(el('h1').text(cfg.title).css({ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: '800' }));
    root.child(el('p').text(cfg.body || '').css({ margin: '0 0 1rem', color: '#64748b', lineHeight: 1.55, fontSize: '0.9rem' }));
    if (cfg.legacy?.length) {
      root.child(el('p').text(`Modul legacy: ${cfg.legacy.join(', ')}`).css({
        margin: '0 0 1rem', fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'ui-monospace, monospace'
      }));
    }
    const actions = el('motion.div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' });
    (cfg.downloads || []).forEach((d) => {
      const btn = el('button').attr('type', 'button').text(d.label).css({
        padding: '0.5rem 0.85rem', borderRadius: '0.5rem', border: 'none',
        background: d.variant === 'green' ? '#16a34a' : '#2563eb',
        color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem'
      });
      btn.click(async () => {
        if (typeof PrintSuratClient === 'undefined') return;
        try {
          await PrintSuratClient.downloadTemplate(d.key);
          if (typeof layout !== 'undefined') layout.toast('File diunduh.', { type: 'success' });
        } catch (e) {
          if (typeof layout !== 'undefined') layout.toast(e.message || 'Gagal unduh', { type: 'error' });
        }
      });
      actions.child(btn);
    });
    if (cfg.crudPath) {
      const crudBtn = el('button').attr('type', 'button').text(cfg.crudLabel || 'Kelola data').css({
        padding: '0.5rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1',
        background: '#fff', color: '#334155', fontWeight: '600', cursor: 'pointer'
      });
      crudBtn.click(() => { if (typeof layout !== 'undefined') layout.navigate(cfg.crudPath); });
      actions.child(crudBtn);
    }
    root.child(actions);
    const back = el('button').attr('type', 'button').text('Kembali ke Print Surat').css({
      padding: '0.5rem 0.85rem', borderRadius: '0.5rem', border: 'none',
      background: '#64748b', color: '#fff', fontWeight: '600', cursor: 'pointer'
    });
    back.click(() => { if (typeof layout !== 'undefined') layout.navigate('/printsurat'); });
    root.child(back);
    return root.get();
  }

  function buildInfoLegacyPage(cfg) {
    const root = el('div').css({
      maxWidth: '720px', margin: '0 auto', padding: '1.5rem',
      background: '#fff', borderRadius: '0.875rem', border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
    });
    root.child(el('h1').text(cfg.title).css({ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: '800' }));
    root.child(el('p').text(cfg.body).css({ margin: '0 0 1rem', color: '#64748b', lineHeight: 1.55, fontSize: '0.9rem' }));
    if (cfg.legacy?.length) {
      root.child(el('p').text(`Modul legacy CI: ${cfg.legacy.join(', ')}`).css({
        margin: '0 0 1rem', fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'ui-monospace, monospace'
      }));
    }
    const actions = el('motion.div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' });
    if (cfg.downloadWintrust && typeof PrintSuratClient !== 'undefined') {
      const dl = el('button').attr('type', 'button').text('Unduh formulir Wintrust (.xlsx)').css({
        padding: '0.5rem 0.85rem', borderRadius: '0.5rem', border: 'none',
        background: '#16a34a', color: '#fff', fontWeight: '600', cursor: 'pointer'
      });
      dl.click(async () => {
        try {
          await PrintSuratClient.downloadWintrustTemplate();
          if (typeof layout !== 'undefined') layout.toast('Template Wintrust diunduh.', { type: 'success' });
        } catch (e) {
          if (typeof layout !== 'undefined') layout.toast(e.message || 'Gagal unduh', { type: 'error' });
        }
      });
      actions.child(dl);
    }
    const back = el('button').attr('type', 'button').text('Kembali ke Print Surat').css({
      padding: '0.5rem 0.85rem', borderRadius: '0.5rem', border: 'none',
      background: '#2563eb', color: '#fff', fontWeight: '600', cursor: 'pointer'
    });
    back.click(() => { if (typeof layout !== 'undefined') layout.navigate('/printsurat'); });
    actions.child(back);
    root.child(actions);
    return root.get();
  }

  function registerPrintReportPages() {
    if (typeof layout === 'undefined') return;
    const reports = [
      {
        path: '/print/laporan/medical-belum-terbang',
        title: 'Medical belum terbang',
        subtitle: 'TKI sudah medical, belum status terbang',
        apiPath: 'letters/reports/medical-belum-terbang',
        columns: [
          { key: 'id_biodata', label: 'ID Biodata' },
          { key: 'nama', label: 'Nama' },
          { key: 'statusaktif', label: 'Status' },
          { key: 'negara1', label: 'Negara' },
          { key: 'tgl_medical', label: 'Tgl medical' }
        ]
      },
      {
        path: '/print/laporan/expire-tgl-online',
        title: 'Expired tanggal online',
        subtitle: 'Disnaker — tgl online ≤ 30 hari ke depan, belum terbang',
        apiPath: 'letters/reports/expire-tgl-online',
        columns: [
          { key: 'id_biodata', label: 'ID Biodata' },
          { key: 'nama', label: 'Nama' },
          { key: 'nodisnaker', label: 'No disnaker' },
          { key: 'tglonline', label: 'Tgl online' }
        ]
      }
    ];
    reports.forEach((r) => {
      if (_registeredPages.has(r.path)) return;
      layout.addPage({
        path: r.path,
        pageContentPadding: '1.25rem',
        component: () => buildReportTablePage(r)
      });
      _registeredPages.add(r.path);
    });

    const templatePages = [
      {
        path: '/print/laporan/biaya-agen',
        title: 'Laporan biaya agensi',
        body: 'Unduh template Word transfer biaya agensi. Kelola data promosi di Data Agen Promosi.',
        legacy: ['new_agen_promosi'],
        downloads: [{ key: 'transfer_biaya_agensi', label: 'Unduh transfer biaya agensi (.docx)', variant: 'green' }],
        crudPath: '/dataagen_promosi',
        crudLabel: 'Data agen promosi'
      },
      {
        path: '/print/laporan/perincian-terbang',
        title: 'Perincian TKI terbang ke agen',
        body: 'Template perincian pembayaran bank + data fee TKI terbang.',
        legacy: ['new_perincian_keuangan_pt'],
        downloads: [{ key: 'perincian_tki_terbang', label: 'Unduh template perincian (.docx)', variant: 'green' }],
        crudPath: '/print/personal_fee_tki_terbang',
        crudLabel: 'Data fee TKI terbang'
      },
      {
        path: '/print/laporan/cicilan-kabur',
        title: 'Cicilan TKI kabur ke agen',
        body: 'Template penagihan TKI kabur ke agen.',
        legacy: ['new_cicilan_tki_kabur_agen'],
        downloads: [{ key: 'penagihan_tki_kabur', label: 'Unduh template penagihan (.docx)', variant: 'green' }],
        crudPath: '/dataagen_promosi',
        crudLabel: 'Data agen (terkait)'
      },
      {
        path: '/print/laporan/wintrust',
        title: 'Formulir Wintrust',
        body: 'Unduh template Excel formulir Wintrust.',
        legacy: ['formulir_wintrust', 'admin_laporan'],
        downloads: [{ key: 'wintrust', label: 'Unduh formulir Wintrust (.xlsx)', variant: 'green' }]
      },
      {
        path: '/print/laporan/briefing-template',
        title: 'Briefing TKI',
        body: 'Template briefing. Jadwal terbang di menu Data Terbang.',
        legacy: ['amplop_terbang', 'brifing'],
        downloads: [{ key: 'brifing', label: 'Unduh template briefing (.docx)', variant: 'green' }],
        crudPath: '/dataterbang',
        crudLabel: 'Data terbang'
      }
    ];
    templatePages.forEach((s) => {
      if (_registeredPages.has(s.path)) return;
      layout.addPage({
        path: s.path,
        pageContentPadding: '1.25rem',
        component: () => buildTemplateDownloadPage(s)
      });
      _registeredPages.add(s.path);
    });

    const stubs = [
      {
        path: '/print/laporan/legalisasi-spl',
        title: 'Surat pengajuan legalisasi (SPL)',
        body: 'Modul spl_cost: gunakan katalog template per TKI atau modul legalitas.',
        legacy: ['spl_cost']
      },
      {
        path: '/print/laporan/rekap-kabur',
        title: 'Rekap kabur / pulang / interminate',
        body: 'Laporan rekap belum di-port penuh. Gunakan Keadaan TKI atau laporan medical/expire.',
        legacy: ['rekap_kabur_interminate_ambil_dok']
      }
    ];
    stubs.forEach((s) => {
      if (_registeredPages.has(s.path)) return;
      layout.addPage({
        path: s.path,
        pageContentPadding: '1.25rem',
        component: () => buildInfoLegacyPage(s)
      });
      _registeredPages.add(s.path);
    });
  }

  function getCustomBatchPageIds() {
    if (typeof PrintBatchEngine !== 'undefined' && PrintBatchEngine.getBatchIds) {
      return PrintBatchEngine.getBatchIds();
    }
    return ['pembuatan_tabelpap', 'surat_rekom_ijin_batch'];
  }

  async function registerPrintDataCrudPages(core) {
    if (!core || typeof core.addCrudPage !== 'function') return;
    if (typeof PrintBatchEngine !== 'undefined' && PrintBatchEngine.ensureLoaded) {
      await PrintBatchEngine.ensureLoaded();
    }
    const customBatches = new Set(getCustomBatchPageIds());
    const resources = new Set(EXTRA_CRUD_RESOURCES);
    PRINT_DATA_GROUPS.forEach((g) => {
      g.items.forEach((item) => {
        (item.crudResources || []).forEach((r) => resources.add(r));
      });
    });
    for (const resource of resources) {
      if (customBatches.has(resource)) continue;
      if (_registeredCrud.has(resource)) continue;
      const path = crudPathForResource(resource);
      const useDedicatedRecordForm = resource === 'pembuatan_tabungan';
      let config = useDedicatedRecordForm
        ? buildRekomTabunganCrudConfig()
        : buildDocCrudConfig(resource);
      if (!useDedicatedRecordForm && core.apiClient) {
        try {
          const res = await core.apiClient.read(`schema/${resource}`);
          if (res?.success && res.data) {
            const fromSchema = schemaToCrudConfig(res.data, RESOURCE_LABELS[resource]);
            if (fromSchema) {
              config = fromSchema;
              if (!/^pembatalan_/.test(resource) && config.form?.fields) {
                config.form.fields = config.form.fields.map((f) => {
                  if (f.name === 'kepada' && f.type === 'textarea') {
                    return { preset: 'kepada_datanamapap', label: f.label || 'Kepada', required: false };
                  }
                  return f;
                });
              }
            }
          }
        } catch {
          /* pakai default */
        }
      }
      if (typeof FormFieldPresets !== 'undefined' && config.form) {
        config = {
          ...config,
          form: await FormFieldPresets.resolveFormSchema(config.form, config)
        };
      }
      if (FormBuilder.prepareFormSchema && config.form) {
        config = {
          ...config,
          form: await FormBuilder.prepareFormSchema(config.form, core.apiClient, {})
        };
      }
      config = applyPrintCrudOptions(resource, config);
      core.addCrudPage(path, config, {
        permissions: ['admin', 'staff'],
        pageContentPadding: '0'
      });
      _registeredCrud.add(resource);
    }
  }

  async function registerPrintLegacyPages(core) {
    registerPrintReportPages();
    if (typeof PrintBatchEngine !== 'undefined' && PrintBatchEngine.registerAll) {
      await PrintBatchEngine.registerAll();
    }
    if (typeof PapBatchPage !== 'undefined' && PapBatchPage.registerPapBatchPages) {
      await PapBatchPage.registerPapBatchPages();
    }
    if (typeof IjinBatchPage !== 'undefined' && IjinBatchPage.registerIjinBatchPage) {
      IjinBatchPage.registerIjinBatchPage();
    }
    await registerPrintDataCrudPages(core);
  }

  global.PrintDataRegistry = {
    GROUPS: PRINT_DATA_GROUPS,
    RESOURCE_LABELS,
    crudPathForResource,
    buildDocCrudConfig,
    findMenu,
    sumCounts,
    resolveMenuPage,
    registerPrintDataCrudPages,
    registerPrintLegacyPages,
    getCustomBatchPageIds
  };
})(typeof window !== 'undefined' ? window : global);
