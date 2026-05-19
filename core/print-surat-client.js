/**
 * Client helper — unduh surat Word/Excel dari API letters
 */
(function (global) {
  'use strict';

  function apiBase() {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return '';
  }

  function toast(msg, type) {
    if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: type || 'info' });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function fetchBinary(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal unduh (${res.status})`);
    }
    const disp = res.headers.get('Content-Disposition') || '';
    const m = disp.match(/filename="?([^";]+)"?/i);
    const filename = m ? m[1] : 'surat.docx';
    const blob = await res.blob();
    return { blob, filename };
  }

  async function downloadBatchWord(batchKey, id, type) {
    const params = new URLSearchParams({ batchKey, id, type: type || 'default' });
    const { blob, filename } = await fetchBinary(`${apiBase()}/api/letters/generate-batch?${params}`);
    downloadBlob(blob, filename);
  }

  async function downloadRecordWord(resource, id) {
    const params = new URLSearchParams({ resource, id });
    const { blob, filename } = await fetchBinary(`${apiBase()}/api/letters/generate-record?${params}`);
    downloadBlob(blob, filename);
  }

  async function downloadIjinBatchWord(id) {
    const { blob, filename } = await fetchBinary(`${apiBase()}/api/letters/ijin-batch/${id}/print`);
    downloadBlob(blob, filename);
  }

  function buildRecordPdfDoc(payload) {
    const h = payload.header || {};
    const t = payload.tki || {};
  const lines = [
      { text: payload.title || 'Surat', style: 'h1' },
      { text: 'Data Surat', style: 'h2', margin: [0, 8, 0, 4] },
      {
        table: {
          widths: [100, '*'],
          body: [
            ['Nomor', h.nomor || '—'],
            ['Lampiran', h.lampiran || '—'],
            ['Perihal', h.perihal || '—'],
            ['Kepada', h.kepada || '—'],
            ['Imigrasi', h.imigrasi || '—'],
            ['Daerah', h.daerah || '—'],
            ['Tanggal', h.tanggal || '—']
          ].map(([k, v]) => [{ text: k, bold: true }, v])
        },
        layout: 'lightHorizontalLines'
      },
      { text: 'Data TKI', style: 'h2', margin: [0, 12, 0, 4] },
      {
        table: {
          widths: [100, '*'],
          body: [
            ['ID Biodata', t.id_biodata || '—'],
            ['Nama', t.nama || '—'],
            ['Tempat lahir', t.tempatlahir || '—'],
            ['Tgl lahir', t.tgllahir || '—'],
            ['Alamat', t.alamat || '—'],
            ['Jabatan', t.jabatan || '—']
          ].map(([k, v]) => [{ text: k, bold: true }, v])
        },
        layout: 'lightHorizontalLines'
      },
      { text: `Dicetak: ${new Date().toLocaleString('id-ID')}`, style: 'note', margin: [0, 12, 0, 0] }
    ];
    return {
      pageSize: 'A4',
      content: lines,
      styles: {
        h1: { fontSize: 14, bold: true },
        h2: { fontSize: 11, bold: true, color: '#1e40af' },
        note: { fontSize: 8, color: '#94a3b8', italics: true }
      },
      defaultStyle: { fontSize: 9 }
    };
  }

  async function downloadRecordPdf(resource, id) {
    const params = new URLSearchParams({ resource, id });
    const res = await fetch(`${apiBase()}/api/letters/record-pdf?${params}`, { credentials: 'include' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `Gagal PDF (${res.status})`);
    if (typeof pdfMake === 'undefined') throw new Error('pdfMake tidak tersedia');
    const doc = buildRecordPdfDoc(json.data);
    const fname = `${resource}_${id}.pdf`;
    pdfMake.createPdf(doc).download(fname);
  }

  async function downloadTemplate(templateKey) {
    const { blob, filename } = await fetchBinary(`${apiBase()}/api/letters/template/${encodeURIComponent(templateKey)}`);
    downloadBlob(blob, filename);
  }

  async function downloadSuratPengajuanExcel(id) {
    const { blob, filename } = await fetchBinary(`${apiBase()}/api/letters/surat-pengajuan/${encodeURIComponent(id)}/export-xlsx`);
    downloadBlob(blob, filename);
  }

  async function downloadWintrustTemplate() {
    return downloadTemplate('wintrust');
  }

  async function downloadPapWord(id, type) {
    if (type === 'ppad' || type === 'opp') {
      try {
        await downloadBatchWord('pembuatan_tabelpap', id, type === 'opp' ? 'opp' : 'ppad');
        return true;
      } catch {
        /* fallback API pap pdf path below */
      }
    }
    return downloadBatchWord('pembuatan_tabelpap', id, type || 'ppad');
  }

  const PrintSuratClient = {
    downloadBlob,
    downloadBatchWord,
    downloadRecordWord,
    downloadIjinBatchWord,
    downloadSuratPengajuanExcel,
    downloadWintrustTemplate,
    downloadTemplate,
    downloadRecordPdf,
    buildRecordPdfDoc,
    downloadPapWord
  };

  global.PrintSuratClient = PrintSuratClient;
})(typeof window !== 'undefined' ? window : global);
