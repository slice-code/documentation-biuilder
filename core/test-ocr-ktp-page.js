/**
 * Halaman uji OCR KTP — /#/test-ocr-ktp
 */
(function (global) {
  'use strict';

  const FIELD_LABELS = {
    nik: 'NIK',
    nama: 'Nama',
    tempat_lahir: 'Tempat lahir',
    tanggal_lahir: 'Tanggal lahir',
    jenis_kelamin: 'Jenis kelamin',
    alamat: 'Alamat',
    rt_rw: 'RT/RW',
    kelurahan: 'Kelurahan/Desa',
    kecamatan: 'Kecamatan',
    agama: 'Agama',
    status_perkawinan: 'Status perkawinan',
    pekerjaan: 'Pekerjaan',
    kewarganegaraan: 'Kewarganegaraan',
    berlaku_hingga: 'Berlaku hingga',
    raw_text: 'Teks mentah'
  };

  function toast(msg, type) {
    if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: type || 'info' });
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString('id-ID');
  }

  function formatUsageBlock(usage, label) {
    if (!usage || !usage.totalTokenCount) {
      return `${label}: data token tidak tersedia dari API.`;
    }
    const parts = [
      `prompt ${fmtNum(usage.promptTokenCount)}`,
      `output ${fmtNum(usage.candidatesTokenCount)}`,
      `total ${fmtNum(usage.totalTokenCount)}`
    ];
    if (usage.cachedContentTokenCount) {
      parts.push(`cache ${fmtNum(usage.cachedContentTokenCount)}`);
    }
    if (usage.requestCount > 1) {
      parts.push(`${usage.requestCount} request API`);
    }
    if (usage.scanCount) {
      parts.unshift(`${usage.scanCount} scan`);
    }
    return `${label}: ${parts.join(' · ')}`;
  }

  function formatBytes(n) {
    const b = Number(n) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  }

  /** WebP hanya saat scan (setelah crop) — sisi maks ~1280px */
  async function compressImageToWebp(file) {
    const maxSide = 1280;
    const quality = 0.88;
    const bitmap = await createImageBitmap(file);
    let w = bitmap.width;
    let h = bitmap.height;
    const scale = Math.min(1, maxSide / Math.max(w, h, 1));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (typeof bitmap.close === 'function') bitmap.close();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Gagal mengompres gambar'))),
        'image/webp',
        quality
      );
    });
    const base = (file.name || 'ktp').replace(/\.[^.]+$/i, '') || 'ktp';
    return new File([blob], `${base}.webp`, { type: 'image/webp', lastModified: Date.now() });
  }

  function mergeSessionUsage(prev, next) {
    if (!next) return prev;
    return {
      promptTokenCount: (prev?.promptTokenCount || 0) + (next.promptTokenCount || 0),
      candidatesTokenCount: (prev?.candidatesTokenCount || 0) + (next.candidatesTokenCount || 0),
      totalTokenCount: (prev?.totalTokenCount || 0) + (next.totalTokenCount || 0),
      scanCount: (prev?.scanCount || 0) + 1
    };
  }

  function registerTestOcrKtpPage() {
    if (typeof layout === 'undefined') return;
    layout.addPage({
      path: '/test-ocr-ktp',
      pageContentPadding: '1.25rem',
      component: () => buildPage()
    });
  }

  function buildPage() {
    const root = el('div').css({
      maxWidth: '960px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    const head = el('motion.div');
    head.child(el('motion.h1').text('Test OCR KTP').css({
      margin: '0 0 0.35rem', fontSize: '1.5rem', fontWeight: '800', color: '#0f172a'
    }));
    head.child(el('motion.p').text('Upload (format asli) → sesuaikan crop → Scan mengonversi ke WebP + OCR.').css({
      margin: 0, fontSize: '0.875rem', color: '#64748b'
    }));
    root.child(head);

    const statusEl = el('motion.div').css({
      padding: '0.65rem 0.9rem',
      borderRadius: '0.5rem',
      fontSize: '0.8rem',
      background: '#f1f5f9',
      color: '#475569'
    }).text('Memeriksa layanan OCR…');
    root.child(statusEl);

    const tokenEl = el('motion.div').css({
      padding: '0.65rem 0.9rem',
      borderRadius: '0.5rem',
      fontSize: '0.78rem',
      background: '#eff6ff',
      color: '#1e40af',
      lineHeight: '1.5',
      whiteSpace: 'pre-wrap',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    }).text('Pemakaian token: belum ada scan.');
    root.child(tokenEl);

    let sessionUsage = null;

    const card = el('motion.div').css({
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '0.75rem',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem'
    });

    const previewWrap = el('motion.div').css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' });
    const preview = el('motion.div').css({
      minHeight: '480px',
      width: '100%',
      border: '2px dashed #cbd5e1',
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      overflow: 'hidden'
    });
    preview.child(el('motion.span').text('Pratinjau gambar').css({ color: '#94a3b8', fontSize: '0.85rem' }));

    const fileInput = el('input').attr('type', 'file').attr('accept', 'image/jpeg,image/png,image/webp');
    fileInput.css({ fontSize: '0.8rem', width: '100%' });

    const sizeEl = el('motion.p').css({
      margin: 0,
      fontSize: '0.75rem',
      color: '#64748b',
      lineHeight: '1.4'
    }).text('Preview memakai file asli (JPEG/PNG). WebP hanya dibuat saat Scan, setelah crop.');

    const resetCropBtn = el('motion.button').attr('type', 'button').text('Reset posisi crop').css({
      padding: '0.45rem 0.75rem',
      borderRadius: '0.5rem',
      border: '1px solid #cbd5e1',
      background: '#fff',
      color: '#334155',
      fontSize: '0.8rem',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'none'
    });

    const scanBtn = el('motion.button').attr('type', 'button').text('Scan KTP').css({
      padding: '0.6rem 1rem',
      borderRadius: '0.5rem',
      border: 'none',
      background: '#2563eb',
      color: '#fff',
      fontWeight: '600',
      cursor: 'pointer',
      opacity: '0.6'
    });
    scanBtn.get().disabled = true;

    let selectedFile = null;
    let cropEditor = null;
    let sourceFileName = '';

    function destroyCropEditor() {
      if (cropEditor) {
        cropEditor.destroy();
        cropEditor = null;
      }
    }

    resetCropBtn.click(() => {
      if (cropEditor) cropEditor.resetView();
    });

    fileInput.get().addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      destroyCropEditor();
      selectedFile = null;
      sourceFileName = f?.name || '';
      preview.get().innerHTML = '';
      preview.css({ minHeight: '480px', padding: '0', display: 'block' });

      if (!f) {
        preview.css({ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' });
        preview.child(el('span').text('Pratinjau & crop KTP').css({ color: '#94a3b8', fontSize: '0.85rem' }));
        resetCropBtn.css({ display: 'none' });
        scanBtn.get().disabled = true;
        scanBtn.css({ opacity: '0.6', cursor: 'not-allowed' });
        sizeEl.text('Pilih foto KTP untuk menyesuaikan crop.');
        return;
      }

      if (typeof KtpCropEditor === 'undefined') {
        toast('Modul crop KTP tidak dimuat.', 'error');
        return;
      }

      try {
        cropEditor = KtpCropEditor.mount(preview.get(), f);
        resetCropBtn.css({ display: 'inline-block' });
        selectedFile = f;
        sizeEl.text(`File asli: ${formatBytes(f.size)} · zoom in hingga KTP memenuhi bingkai biru, lalu Scan`);
        scanBtn.get().disabled = false;
        scanBtn.css({ opacity: '1', cursor: 'pointer' });
      } catch (err) {
        toast(err.message || 'Gagal membuka crop', 'error');
      }
    });

    previewWrap.child([
      el('motion.label').text('Foto KTP — sesuaikan crop').css({ fontWeight: '600', fontSize: '0.8rem', color: '#334155' }),
      preview,
      fileInput,
      el('motion.div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }).child([resetCropBtn, scanBtn]),
      sizeEl
    ]);

    const resultWrap = el('motion.div').css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' });
    resultWrap.child(el('motion.label').text('Hasil OCR').css({ fontWeight: '600', fontSize: '0.8rem', color: '#334155' }));

    const resultBox = el('motion.pre').css({
      margin: 0,
      padding: '0.85rem',
      background: '#0f172a',
      color: '#e2e8f0',
      borderRadius: '0.5rem',
      fontSize: '0.75rem',
      lineHeight: '1.5',
      overflow: 'auto',
      maxHeight: '360px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }).text('Belum ada hasil. Pilih gambar lalu klik Scan KTP.');

    const fieldsGrid = el('motion.div').css({
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '0.5rem'
    });
    resultWrap.child([fieldsGrid, resultBox]);

    card.child([previewWrap, resultWrap]);
    root.child(card);

    function renderFields(data) {
      fieldsGrid.get().innerHTML = '';
      if (!data || data.parse_error) {
        fieldsGrid.child(el('motion.p').text('JSON terstruktur gagal di-parse — lihat teks mentah di bawah.').css({
          margin: 0, fontSize: '0.8rem', color: '#b45309'
        }));
        return;
      }
      Object.keys(FIELD_LABELS).forEach((key) => {
        if (key === 'raw_text') return;
        const val = data[key];
        if (val === undefined || val === '') return;
        const row = el('motion.div').css({
          display: 'grid',
          gridTemplateColumns: '140px 1fr',
          gap: '0.5rem',
          padding: '0.4rem 0',
          borderBottom: '1px solid #f1f5f9',
          fontSize: '0.85rem'
        });
        row.child([
          el('motion.span').text(FIELD_LABELS[key]).css({ color: '#64748b', fontWeight: '600' }),
          el('motion.span').text(String(val)).css({ color: '#0f172a' })
        ]);
        fieldsGrid.child(row);
      });
    }

    scanBtn.click(async () => {
      if (!selectedFile) {
        toast('Pilih file gambar KTP.', 'warning');
        return;
      }
      scanBtn.get().disabled = true;
      scanBtn.text('Memproses…');
      resultBox.text('Menunggu respons Gemini…');
      fieldsGrid.get().innerHTML = '';
      try {
        const originalBytes = selectedFile.size;
        let croppedFile = selectedFile;
        if (cropEditor) {
          try {
            croppedFile = await cropEditor.getCroppedFile(sourceFileName);
          } catch (cropErr) {
            throw new Error(cropErr.message || 'Gagal crop gambar KTP');
          }
        }

        let uploadFile = croppedFile;
        try {
          uploadFile = await compressImageToWebp(croppedFile);
          sizeEl.text(
            `Crop+kompres: ${formatBytes(originalBytes)} → ${formatBytes(uploadFile.size)} (WebP)`
          );
        } catch (compressErr) {
          uploadFile = croppedFile;
          sizeEl.text(`Kompres gagal, kirim hasil crop (${formatBytes(croppedFile.size)}).`);
        }

        const fd = new FormData();
        fd.append('image', uploadFile, uploadFile.name || 'ktp.webp');
        const res = await fetch('/api/ocr/ktp', {
          method: 'POST',
          body: fd,
          credentials: 'include'
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'OCR gagal');
        renderFields(json.data);
        resultBox.text(JSON.stringify(json.data, null, 2));

        const usage = json.meta?.usage;
        sessionUsage = mergeSessionUsage(sessionUsage, usage);
        const imgMeta = json.meta?.image;
        const lines = [
          formatUsageBlock(usage, 'Scan ini'),
          formatUsageBlock(sessionUsage, 'Total sesi'),
          json.meta?.model ? `Model: ${json.meta.model}` : '',
          imgMeta
            ? `Gambar API: ${imgMeta.original_label} → ${imgMeta.compressed_label} (${imgMeta.width}×${imgMeta.height} webp)`
            : ''
        ].filter(Boolean);
        tokenEl.text(lines.join('\n'));

        if (imgMeta) {
          sizeEl.text(
            `Klien: ${formatBytes(originalBytes)} → ${formatBytes(uploadFile.size)} · `
            + `Server: ${imgMeta.original_label} → ${imgMeta.compressed_label} (${imgMeta.width}×${imgMeta.height})`
          );
        }

        const tokenHint = usage?.totalTokenCount
          ? ` (${fmtNum(usage.totalTokenCount)} token)`
          : '';
        toast(`OCR selesai${tokenHint}.`, 'success');
      } catch (e) {
        resultBox.text(String(e.message || e));
        toast(e.message || 'Gagal OCR', 'error');
      } finally {
        scanBtn.get().disabled = !selectedFile;
        scanBtn.text('Scan KTP');
      }
    });

    Promise.all([
      fetch('/api/ocr/status', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/ocr/models', { credentials: 'include' }).then((r) => r.json()).catch(() => null)
    ])
      .then(([j, modelsRes]) => {
        if (!j.success) throw new Error(j.error);
        const ok = j.data?.configured;
        statusEl.css({
          background: ok ? '#ecfdf5' : '#fef2f2',
          color: ok ? '#047857' : '#b91c1c',
          lineHeight: '1.45'
        });
        let text = ok
          ? `OCR siap · model: ${j.data.model || 'gemini'}`
          : 'GOOGLE_API_KEY belum di-set — isi di .env.local lalu restart server.';
        if (ok && modelsRes?.success) {
          const rec = (modelsRes.data.recommended || []).join(', ');
          text += `\nDisarankan free tier: ${rec}`;
        }
        statusEl.get().style.whiteSpace = 'pre-wrap';
        statusEl.text(text);
      })
      .catch(() => {
        statusEl.css({ background: '#fef2f2', color: '#b91c1c' });
        statusEl.text('Tidak dapat memeriksa status OCR.');
      });

    return root.get();
  }

  global.TestOcrKtpPage = { registerTestOcrKtpPage };
})(typeof window !== 'undefined' ? window : global);
