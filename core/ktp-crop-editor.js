/**
 * Crop gambar ke rasio e-KTP (85.6 × 53.98 mm, landscape).
 */
(function (global) {
  'use strict';

  const KTP_ASPECT = 85.6 / 53.98;
  /** Resolusi minimum sisi terpanjang hasil crop (untuk OCR) */
  const MIN_EXPORT_LONG_SIDE = 1280;

  function mount(host, file) {
    if (!host || !file) {
      throw new Error('Host dan file gambar wajib');
    }

    const state = {
      objectUrl: null,
      naturalW: 0,
      naturalH: 0,
      scale: 1,
      x: 0,
      y: 0,
      frame: { w: 0, h: 0, left: 0, top: 0 },
      dragging: false,
      pointerId: null,
      dragStart: null
    };

    host.innerHTML = '';
    Object.assign(host.style, {
      position: 'relative',
      overflow: 'hidden',
      background: '#0f172a',
      borderRadius: '0.5rem',
      touchAction: 'none',
      userSelect: 'none',
      minHeight: '480px',
      height: 'min(72vh, 560px)',
      width: '100%',
      cursor: 'grab'
    });

    const hint = document.createElement('p');
    hint.textContent = 'Geser · scroll untuk zoom in — pastikan seluruh KTP dalam bingkai biru';
    Object.assign(hint.style, {
      position: 'absolute',
      left: '0',
      right: '0',
      bottom: '8px',
      margin: '0',
      textAlign: 'center',
      fontSize: '0.72rem',
      color: '#cbd5e1',
      zIndex: '4',
      pointerEvents: 'none',
      padding: '0 8px'
    });

    const frameEl = document.createElement('div');
    Object.assign(frameEl.style, {
      position: 'absolute',
      border: '2px solid #60a5fa',
      borderRadius: '6px',
      boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.58)',
      pointerEvents: 'none',
      zIndex: '3',
      boxSizing: 'border-box'
    });

    const img = document.createElement('img');
    img.alt = 'Crop KTP';
    img.draggable = false;
    Object.assign(img.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      transformOrigin: '0 0',
      willChange: 'transform',
      pointerEvents: 'none'
    });

    host.appendChild(img);
    host.appendChild(frameEl);
    host.appendChild(hint);

    function layoutFrame() {
      const vw = host.clientWidth || 400;
      const vh = host.clientHeight || 480;
      let fw = vw * 0.98;
      let fh = fw / KTP_ASPECT;
      if (fh > vh * 0.9) {
        fh = vh * 0.9;
        fw = fh * KTP_ASPECT;
      }
      state.frame = {
        w: fw,
        h: fh,
        left: (vw - fw) / 2,
        top: Math.max(8, (vh - fh) / 2)
      };
      Object.assign(frameEl.style, {
        width: `${fw}px`,
        height: `${fh}px`,
        left: `${state.frame.left}px`,
        top: `${state.frame.top}px`
      });
    }

    function applyTransform() {
      img.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    }

    function clampPan() {
      const iw = state.naturalW * state.scale;
      const ih = state.naturalH * state.scale;
      const f = state.frame;
      if (iw <= f.w) {
        state.x = f.left + (f.w - iw) / 2;
      } else {
        const minX = f.left + f.w - iw;
        const maxX = f.left;
        state.x = Math.min(maxX, Math.max(minX, state.x));
      }
      if (ih <= f.h) {
        state.y = f.top + (f.h - ih) / 2;
      } else {
        const minY = f.top + f.h - ih;
        const maxY = f.top;
        state.y = Math.min(maxY, Math.max(minY, state.y));
      }
    }

    /** Tampilkan seluruh gambar dulu — user zoom in ke bingkai KTP */
    function fitContain() {
      if (!state.naturalW) return;
      const f = state.frame;
      const fitScale = Math.min(f.w / state.naturalW, f.h / state.naturalH);
      state.scale = fitScale;
      state.x = f.left + (f.w - state.naturalW * state.scale) / 2;
      state.y = f.top + (f.h - state.naturalH * state.scale) / 2;
      clampPan();
      applyTransform();
    }

    function zoomAt(factor, cx, cy) {
      const prev = state.scale;
      const next = Math.min(8, Math.max(0.08, prev * factor));
      if (next === prev) return;
      const ix = (cx - state.x) / prev;
      const iy = (cy - state.y) / prev;
      state.scale = next;
      state.x = cx - ix * next;
      state.y = cy - iy * next;
      clampPan();
      applyTransform();
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      state.dragging = true;
      state.pointerId = e.pointerId;
      state.dragStart = { x: e.clientX, y: e.clientY, px: state.x, py: state.y };
      host.style.cursor = 'grabbing';
      try { host.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!state.dragging || e.pointerId !== state.pointerId) return;
      state.x = state.dragStart.px + (e.clientX - state.dragStart.x);
      state.y = state.dragStart.py + (e.clientY - state.dragStart.y);
      clampPan();
      applyTransform();
    }

    function onPointerUp(e) {
      if (e.pointerId !== state.pointerId) return;
      state.dragging = false;
      state.pointerId = null;
      host.style.cursor = 'grab';
      try { host.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }

    function onWheel(e) {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(factor, cx, cy);
    }

    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointercancel', onPointerUp);
    host.addEventListener('wheel', onWheel, { passive: false });

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        layoutFrame();
        fitContain();
      })
      : null;
    if (ro) ro.observe(host);

    state.objectUrl = URL.createObjectURL(file);
    img.src = state.objectUrl;

    const ready = new Promise((resolve, reject) => {
      img.onload = () => {
        state.naturalW = img.naturalWidth;
        state.naturalH = img.naturalHeight;
        layoutFrame();
        fitContain();
        resolve();
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
    });

    async function getCroppedFile(filenameBase) {
      await ready;
      const f = state.frame;
      const sx = (f.left - state.x) / state.scale;
      const sy = (f.top - state.y) / state.scale;
      const sw = f.w / state.scale;
      const sh = f.h / state.scale;

      let outW = Math.max(1, Math.round(sw));
      let outH = Math.max(1, Math.round(sh));
      const longSide = Math.max(outW, outH);
      if (longSide < MIN_EXPORT_LONG_SIDE) {
        const up = MIN_EXPORT_LONG_SIDE / longSide;
        outW = Math.round(outW * up);
        outH = Math.round(outH * up);
      }

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Gagal crop gambar'))),
          'image/jpeg',
          0.95
        );
      });
      const base = (filenameBase || file.name || 'ktp').replace(/\.[^.]+$/i, '') || 'ktp';
      return new File([blob], `${base}-crop.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    }

    function resetView() {
      fitContain();
    }

    function destroy() {
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointercancel', onPointerUp);
      host.removeEventListener('wheel', onWheel);
      if (ro) ro.disconnect();
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      host.innerHTML = '';
    }

    return {
      ready,
      resetView,
      getCroppedFile,
      destroy,
      KTP_ASPECT,
      MIN_EXPORT_LONG_SIDE
    };
  }

  global.KtpCropEditor = { mount, KTP_ASPECT, MIN_EXPORT_LONG_SIDE };
})(typeof window !== 'undefined' ? window : global);
