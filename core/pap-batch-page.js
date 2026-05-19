/**
 * PAP — hook cetak PDF; list/detail via PrintBatchEngine + print-batch-templates.json
 */
(function (global) {
  'use strict';

  function api() {
    if (typeof window !== 'undefined' && window.flamboyanApp?.core?.apiClient) {
      return window.flamboyanApp.core.apiClient;
    }
    return new ApiClient({ baseUrl: '/api' });
  }

  function toast(msg, type) {
    if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: type || 'info' });
  }

  function buildPapPdfDoc(payload, type) {
    const h = payload.header || {};
    const rows = payload.details || [];
    const title = type === 'opp' ? 'SURAT OPP (PAP)' : 'PENGAJUAN PAP / DAFTAR DATA';
    const body = [
      { text: title, style: 'h1', margin: [0, 0, 0, 8] },
      { text: `Nomor PAP: ${h.nomor || '—'}`, margin: [0, 0, 0, 2] },
      { text: `Nomor KTKLN: ${h.nomorktkln || '—'}`, margin: [0, 0, 0, 2] },
      { text: `Kepada (Lembaga): ${(h.kepada || '—').replace(/<br\s*\/?>/gi, ' ')}`, margin: [0, 0, 0, 2] },
      { text: `Daerah: ${h.daerah || '—'}  ·  Tgl dokumen: ${h.tanggal || '—'}  ·  Tgl PAP: ${h.tanggalpap || '—'}`, margin: [0, 0, 0, 12] },
      { text: 'Daftar CTKI', style: 'h2', margin: [0, 0, 0, 6] },
      {
        table: {
          widths: [28, 90, '*'],
          body: [
            [{ text: 'No', style: 'th' }, { text: 'ID Biodata', style: 'th' }, { text: 'Nama', style: 'th' }],
            ...rows.map((r, i) => [
              String(i + 1),
              r.id_biodata || '—',
              r.nama || '—'
            ])
          ]
        },
        layout: 'lightHorizontalLines'
      },
      { text: `Dicetak: ${new Date().toLocaleString('id-ID')}`, style: 'note', margin: [0, 12, 0, 0] }
    ];
    return {
      content: body,
      styles: {
        h1: { fontSize: 14, bold: true },
        h2: { fontSize: 11, bold: true, color: '#1e40af' },
        th: { bold: true, fillColor: '#f1f5f9' },
        note: { fontSize: 8, color: '#94a3b8', italics: true }
      },
      defaultStyle: { fontSize: 9 }
    };
  }

  async function downloadPapPdf(id, type) {
    if (typeof PrintSuratClient !== 'undefined' && PrintSuratClient.downloadBatchWord) {
      try {
        await PrintSuratClient.downloadBatchWord('pembuatan_tabelpap', id, type === 'opp' ? 'opp' : 'ppad');
        return;
      } catch (wordErr) {
        console.warn('[PAP] Word template:', wordErr.message, '— fallback PDF ringkas');
      }
    }
    const res = await api().read(`print/pap/${id}/pdf?type=${encodeURIComponent(type)}`);
    if (!res.success || !res.data) throw new Error(res.error || 'Gagal memuat data cetak');
    const doc = buildPapPdfDoc(res.data, type);
    const name = type === 'opp' ? `pap_opp_${id}` : `pap_${id}`;
    pdfMake.createPdf(doc).download(`${name}.pdf`);
  }

  async function registerPapBatchPages() {
    if (typeof PrintBatchEngine === 'undefined') {
      console.warn('[PAP] PrintBatchEngine tidak dimuat');
      return;
    }
    await PrintBatchEngine.ensureLoaded();
    PrintBatchEngine.registerBatch('pembuatan_tabelpap', {
      onPrint: async (row, type) => {
        const id = row.id_pembuatanpap;
        try {
          await downloadPapPdf(id, type);
          toast('PDF diunduh.', 'success');
        } catch (e) {
          toast(e.message, 'error');
        }
      }
    });
  }

  global.PapBatchPage = {
    registerPapBatchPages,
    downloadPapPdf,
    buildPapPdfDoc
  };
})(typeof window !== 'undefined' ? window : global);
