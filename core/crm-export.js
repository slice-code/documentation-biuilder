(function (global) {
  'use strict';

  const STAGE_LABELS = {
    prospecting: 'Prospecting',
    qualification: 'Qualification',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost'
  };

  const TABLE_TITLES = {
    customers: 'Pelanggan',
    leads: 'Leads',
    deals: 'Deals',
    companies: 'Perusahaan',
    activities: 'Aktivitas',
    contacts: 'Kontak',
    products: 'Produk',
    users: 'Pengguna',
    quotes: 'Penawaran',
    tags: 'Tag',
    entity_tags: 'Entity Tags',
    deal_products: 'Produk Deal',
    email_templates: 'Template Email',
    activity_logs: 'Log Aktivitas'
  };

  const HIDDEN_COLUMNS = new Set(['password']);

  const CURRENCY_KEYS = /^(value|price|total|revenue|amount|subtotal|tax|discount|unit_price|total_price|estimated_value|annual_revenue|pipelineValue|quotesValue|avgDealSize|weightedPipeline|revenueWon|revenueOpen|Nilai)$/i;
  const DATE_KEYS = /(_at|_date|due_date|close_date|converted_at|generatedAt|date$)/i;
  const CENTER_KEYS = /^(id|status|stage|priority|role|probability|count|quantity)$/i;

  const WRITE_OPTS = { bookType: 'xlsx', cellStyles: true };

  const BORDER_COLOR = 'CBD5E1';
  const HEADER_BG = '2563EB';
  const HEADER_FG = 'FFFFFF';
  const TITLE_COLOR = '0F172A';
  const SUBTITLE_COLOR = '64748B';
  const ZEBRA_ODD = 'F8FAFC';
  const ZEBRA_EVEN = 'FFFFFF';

  function toast(msg, type) {
    if (typeof layout !== 'undefined' && layout.toast) {
      layout.toast(msg, { type: type || 'info' });
    } else {
      alert(msg);
    }
  }

  function formatCurrency(n) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(n || 0);
  }

  function ensureXlsx() {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX library is not loaded. Ensure library/xlsx.js is included in index.html.');
    }
  }

  function ensurePdfMake() {
    if (typeof pdfMake === 'undefined') {
      throw new Error('Library pdfMake belum dimuat. Pastikan library/makepdf.js dan vfs_fonts.js dimuat.');
    }
    if (pdfMake.vfs && typeof pdfMake.addVirtualFileSystem === 'function' && !pdfMake._vfsReady) {
      try {
        pdfMake.addVirtualFileSystem(pdfMake.vfs);
        pdfMake._vfsReady = true;
      } catch {
        /* vfs sudah terpasang */
      }
    }
  }

  function apiBase() {
    return (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
  }

  function borderAll(style, color) {
    const side = { style: style || 'thin', color: { rgb: color || BORDER_COLOR } };
    return { top: side, bottom: side, left: side, right: side };
  }

  function mergeStyle(base, extra) {
    if (!extra) return base;
    return {
      font: { ...base.font, ...extra.font },
      fill: extra.fill || base.fill,
      alignment: { ...base.alignment, ...extra.alignment },
      border: extra.border || base.border,
      numFmt: extra.numFmt || base.numFmt
    };
  }

  const STYLES = {
    title: {
      font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: TITLE_COLOR } },
      alignment: { horizontal: 'left', vertical: 'center' }
    },
    subtitle: {
      font: { name: 'Calibri', sz: 10, color: { rgb: SUBTITLE_COLOR } },
      alignment: { horizontal: 'left', vertical: 'center' }
    },
    header: {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: HEADER_FG } },
      fill: { fgColor: { rgb: HEADER_BG }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: borderAll('thin', '1E40AF')
    },
    dataBase: (zebra) => ({
      font: { name: 'Calibri', sz: 10, color: { rgb: '334155' } },
      fill: { fgColor: { rgb: zebra ? ZEBRA_ODD : ZEBRA_EVEN }, patternType: 'solid' },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: borderAll('thin', BORDER_COLOR)
    }),
    currency: {
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0'
    },
    numberCenter: {
      alignment: { horizontal: 'center', vertical: 'center' }
    }
  };

  function humanizeHeader(key) {
    return String(key)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function isCurrencyKey(key) {
    return CURRENCY_KEYS.test(String(key));
  }

  function isDateKey(key) {
    return DATE_KEYS.test(String(key));
  }

  function formatCellValue(val, key) {
    if (val == null || val === '') return '';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if ((key === 'is_converted' || key === 'is_primary' || key === 'is_active') && (val === 0 || val === 1)) {
      return val ? 'Yes' : 'No';
    }
    if (isCurrencyKey(key) && !isNaN(Number(val))) return Number(val);
    return val;
  }

  function pickColumns(rows) {
    if (!rows?.length) return ['info'];
    return Object.keys(rows[0]).filter((k) => !HIDDEN_COLUMNS.has(k));
  }

  function estimateColWidth(key, rows, headerLabel) {
    let max = String(headerLabel || key).length;
    const sample = rows.slice(0, 50);
    sample.forEach((row) => {
      const s = formatCellValue(row[key], key);
      const len = String(s == null ? '' : s).length;
      if (len > max) max = len;
    });
    return Math.min(Math.max(max + 2, 10), 42);
  }

  function ref(c, r) {
    return XLSX.utils.encode_cell({ c, r });
  }

  function styleDataCell(ws, r, c, key, zebra) {
    const address = ref(c, r);
    const cell = ws[address];
    if (!cell) return;

    let style = STYLES.dataBase(zebra);
    if (isCurrencyKey(key)) {
      style = mergeStyle(style, STYLES.currency);
      if (typeof cell.v === 'string' && cell.v !== '' && !isNaN(Number(cell.v))) {
        cell.v = Number(cell.v);
        cell.t = 'n';
      }
    } else if (CENTER_KEYS.test(key)) {
      style = mergeStyle(style, STYLES.numberCenter);
    } else if (isDateKey(key)) {
      style = mergeStyle(style, { alignment: { horizontal: 'left', vertical: 'center' } });
    }

    cell.s = style;
  }

  /**
   * Bangun worksheet ber-styling: judul, header biru, zebra, border, lebar kolom
   */
  function buildStyledWorksheet(rows, options = {}) {
    const {
      title = 'Export Data',
      subtitle = '',
      sheetLabel = 'Data',
      columns = null
    } = options;

    const keys = columns || pickColumns(rows);
    const headers = keys.map((k) => humanizeHeader(k));
    const safeRows = rows?.length ? rows : [{ info: 'No data' }];
    const colCount = keys.length;

    const aoa = [];
    let headerRow = 0;

    if (title) {
      aoa.push([title]);
      if (subtitle) aoa.push([subtitle]);
      aoa.push([]);
      headerRow = aoa.length;
    }

    aoa.push(headers);
    safeRows.forEach((row) => {
      aoa.push(keys.map((k) => formatCellValue(row[k], k)));
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellStyles: true });

    if (title) {
      ws['!merges'] = ws['!merges'] || [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
      if (subtitle) {
        ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });
      }
      const titleCell = ws[ref(0, 0)];
      if (titleCell) titleCell.s = STYLES.title;
      if (subtitle) {
        const subCell = ws[ref(1, 0)];
        if (subCell) subCell.s = STYLES.subtitle;
      }
    }

    for (let c = 0; c < colCount; c++) {
      const address = ref(c, headerRow);
      if (ws[address]) ws[address].s = STYLES.header;
    }

    const dataStart = headerRow + 1;
    for (let r = 0; r < safeRows.length; r++) {
      const zebra = r % 2 === 1;
      for (let c = 0; c < colCount; c++) {
        styleDataCell(ws, dataStart + r, c, keys[c], zebra);
      }
    }

    ws['!cols'] = keys.map((k, i) => ({
      wch: estimateColWidth(k, safeRows, headers[i])
    }));

    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][headerRow] = { hpt: 22 };

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    if (title) ws['!rows'][0] = { hpt: 28 };

    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRow, c: 0 },
        e: { r: range.e.r, c: range.e.c }
      })
    };

    return { ws, sheetName: (sheetLabel || title || 'Data').slice(0, 31) };
  }

  function writeWorkbook(wb, fileName) {
    ensureXlsx();
    XLSX.writeFile(wb, fileName || 'export.xlsx', WRITE_OPTS);
  }

  function appendStyledSheet(wb, rows, options) {
    const { ws, sheetName } = buildStyledWorksheet(rows, options);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  /** Export array of objects ke file .xlsx dengan styling */
  function exportRowsXlsx(rows, sheetName, fileName, meta = {}) {
    ensureXlsx();
    const wb = XLSX.utils.book_new();
    appendStyledSheet(wb, rows, {
      title: meta.title || sheetName || 'Export',
      subtitle: meta.subtitle || `Diekspor: ${new Date().toLocaleString('id-ID')}`,
      sheetLabel: sheetName
    });
    writeWorkbook(wb, fileName || 'export.xlsx');
  }

  /** Ambil data CRUD dari API lalu export Excel ber-styling */
  async function exportTableXlsx(table) {
    const res = await fetch(`${apiBase()}/api/${table}?perPage=10000`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch data');

    const label = TABLE_TITLES[table] || humanizeHeader(table);
    const total = json.pagination?.total ?? (json.data || []).length;

    exportRowsXlsx(json.data || [], label, `${table}-export.xlsx`, {
      title: `CRM — ${label}`,
      subtitle: `Total ${total} rows · ${new Date().toLocaleString('en-US')}`
    });
  }

  /** Laporan penjualan multi-sheet Excel dengan styling */
  function exportSalesReportXlsx(report) {
    ensureXlsx();
    const wb = XLSX.utils.book_new();
    const ts = report.generatedAt
      ? new Date(report.generatedAt).toLocaleString('id-ID')
      : new Date().toLocaleString('id-ID');
    const stamp = new Date().toISOString().slice(0, 10);

    const kpiRows = [
      { Metrik: 'Diperbarui', Nilai: ts },
      { Metrik: 'Revenue Won', Nilai: report.revenueWon },
      { Metrik: 'Pipeline Terbuka', Nilai: report.revenueOpen },
      { Metrik: 'Weighted Pipeline', Nilai: report.weightedPipeline },
      { Metrik: 'Win Rate (%)', Nilai: report.winRate },
      { Metrik: 'Deals Won', Nilai: report.dealsWon },
      { Metrik: 'Deals Lost', Nilai: report.dealsLost },
      { Metrik: 'Deals Open', Nilai: report.dealsOpen },
      { Metrik: 'Avg Deal Size', Nilai: report.avgDealSize },
      { Metrik: 'Total Leads', Nilai: report.totalLeads },
      { Metrik: 'Leads Converted', Nilai: report.leadsConverted },
      { Metrik: 'Lead Conversion (%)', Nilai: report.leadConversionRate },
      { Metrik: 'Total Quotes', Nilai: report.totalQuotes },
      { Metrik: 'Quotes Value', Nilai: report.quotesValue }
    ];
    appendStyledSheet(wb, kpiRows, {
      title: 'Ringkasan KPI Penjualan',
      subtitle: ts,
      sheetLabel: 'Ringkasan',
      columns: ['Metrik', 'Nilai']
    });

    const pipeline = (report.pipelineByStage || []).map((r) => ({
      Tahap: STAGE_LABELS[r.stage] || r.stage,
      Jumlah: r.count,
      Nilai: r.total
    }));
    appendStyledSheet(wb, pipeline.length ? pipeline : [{ Tahap: '-', Jumlah: 0, Nilai: 0 }], {
      title: 'Pipeline per Tahap',
      subtitle: ts,
      sheetLabel: 'Pipeline',
      columns: ['Tahap', 'Jumlah', 'Nilai']
    });

    appendStyledSheet(wb, report.leadsBySource?.length ? report.leadsBySource.map((r) => ({
      Sumber: r.source,
      Jumlah: r.count
    })) : [{ Sumber: '-', Jumlah: 0 }], {
      title: 'Leads per Sumber',
      subtitle: ts,
      sheetLabel: 'Leads',
      columns: ['Sumber', 'Jumlah']
    });

    appendStyledSheet(wb, report.topDeals?.length ? report.topDeals.map((d) => ({
      Kode: d.deal_code,
      Judul: d.title,
      Pelanggan: d.customer_name,
      Nilai: d.value,
      Tahap: STAGE_LABELS[d.stage] || d.stage,
      Probabilitas: d.probability
    })) : [{ Judul: 'Tidak ada deal' }], {
      title: 'Top Deals',
      subtitle: ts,
      sheetLabel: 'Top Deals'
    });

    appendStyledSheet(wb, report.quotesByStatus?.length ? report.quotesByStatus.map((r) => ({
      Status: r.status,
      Jumlah: r.count,
      Total: r.total
    })) : [{ Status: '-', Jumlah: 0, Total: 0 }], {
      title: 'Penawaran per Status',
      subtitle: ts,
      sheetLabel: 'Quotes',
      columns: ['Status', 'Jumlah', 'Total']
    });

    writeWorkbook(wb, `laporan-penjualan-${stamp}.xlsx`);
  }

  /** Laporan penjualan PDF (pdfmake) */
  function exportSalesReportPdf(report) {
    ensurePdfMake();
    const ts = report.generatedAt
      ? new Date(report.generatedAt).toLocaleString('id-ID')
      : new Date().toLocaleString('id-ID');

    const kpiBody = [
      ['Revenue Won', formatCurrency(report.revenueWon)],
      ['Pipeline Terbuka', formatCurrency(report.revenueOpen)],
      ['Weighted Pipeline', formatCurrency(report.weightedPipeline)],
      ['Win Rate', `${report.winRate || 0}%`],
      ['Avg Deal Size', formatCurrency(report.avgDealSize)],
      ['Konversi Lead', `${report.leadConversionRate || 0}% (${report.leadsConverted || 0}/${report.totalLeads || 0})`]
    ];

    const pipelineRows = [['Stage', 'Jumlah', 'Nilai']];
    (report.pipelineByStage || []).forEach((r) => {
      pipelineRows.push([
        STAGE_LABELS[r.stage] || r.stage,
        String(r.count),
        formatCurrency(r.total)
      ]);
    });
    if (pipelineRows.length === 1) pipelineRows.push(['—', '0', '—']);

    const dealsRows = [['Kode', 'Judul', 'Customer', 'Nilai', 'Stage']];
    (report.topDeals || []).slice(0, 12).forEach((d) => {
      dealsRows.push([
        d.deal_code || '',
        d.title || '',
        d.customer_name || '—',
        formatCurrency(d.value),
        STAGE_LABELS[d.stage] || d.stage || ''
      ]);
    });
    if (dealsRows.length === 1) dealsRows.push(['—', '—', '—', '—', '—']);

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 48, 40, 48],
      defaultStyle: { fontSize: 10, color: '#334155' },
      styles: {
        title: { fontSize: 18, bold: true, color: '#0f172a', margin: [0, 0, 0, 8] },
        subtitle: { fontSize: 9, color: '#64748b', margin: [0, 0, 0, 16] },
        section: { fontSize: 12, bold: true, color: '#1e40af', margin: [0, 14, 0, 6] }
      },
      content: [
        { text: 'Laporan Penjualan CRM', style: 'title' },
        { text: `Diperbarui: ${ts}`, style: 'subtitle' },
        { text: 'Ringkasan KPI', style: 'section' },
        {
          layout: 'lightHorizontalLines',
          table: {
            widths: ['*', 'auto'],
            body: kpiBody
          }
        },
        { text: 'Pipeline per Tahap', style: 'section' },
        {
          layout: 'lightHorizontalLines',
          table: {
            widths: ['*', 50, 100],
            body: pipelineRows
          }
        },
        { text: 'Top Deals', style: 'section' },
        {
          layout: 'lightHorizontalLines',
          table: {
            widths: [55, '*', 80, 70, 70],
            body: dealsRows
          }
        }
      ],
      footer(currentPage, pageCount) {
        return {
          text: `CRM Report · halaman ${currentPage} / ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#94a3b8',
          margin: [0, 8, 0, 0]
        };
      }
    };

    const stamp = new Date().toISOString().slice(0, 10);
    pdfMake.createPdf(docDefinition).download(`laporan-penjualan-${stamp}.pdf`);
  }

  async function runExport(fn) {
    try {
      await fn();
      toast('Excel export successful', 'success');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Export failed', 'error');
    }
  }

  global.CrmExport = {
    exportRowsXlsx,
    exportTableXlsx,
    exportSalesReportXlsx,
    exportSalesReportPdf,
    buildStyledWorksheet,
    runExport
  };
})(typeof window !== 'undefined' ? window : global);
