(function (global) {
  'use strict';

  function getApiClient() {
    if (typeof window !== 'undefined' && window.flamboyanApp?.core?.apiClient) {
      return window.flamboyanApp.core.apiClient;
    }
    return new ApiClient({ baseUrl: '/api' });
  }

  function buildVisaDepartPanel(ctx) {
    const { idBiodata, detail, onRefresh } = ctx;
    const apiClient = getApiClient();
    const visa = detail?.visa || {};
    const personal = detail?.personal || {};

    const card = el('div').css({
      padding: '1rem',
      border: '1px solid #dbeafe',
      borderRadius: '0.75rem',
      background: 'linear-gradient(180deg, #eff6ff 0%, #fff 100%)',
      marginBottom: '1rem'
    });

    card.child(el('h4').text('Catat keberangkatan (visa terbang)').css({
      margin: '0 0 0.35rem',
      fontSize: '0.95rem',
      fontWeight: '700',
      color: '#1e40af'
    }));
    card.child(el('p').text('Memperbarui visa.tanggalterbang dan menandai personal sebagai sudah terbang.').css({
      margin: '0 0 0.85rem',
      fontSize: '0.8125rem',
      color: '#64748b'
    }));

    const tgl = el('input').attr('type', 'date').css({
      width: '100%',
      maxWidth: '220px',
      padding: '0.5rem',
      borderRadius: '0.4rem',
      border: '1px solid #cbd5e1',
      marginBottom: '0.5rem'
    });
    tgl.get().value = visa.tanggalterbang || new Date().toISOString().slice(0, 10);

    const airport = el('input').attr('type', 'text').attr('placeholder', 'Bandara keberangkatan').css({
      width: '100%',
      padding: '0.5rem',
      borderRadius: '0.4rem',
      border: '1px solid #cbd5e1',
      marginBottom: '0.5rem',
      fontSize: '0.8125rem'
    });
    if (visa.airport) airport.get().value = visa.airport;

    const tiket = el('input').attr('type', 'text').attr('placeholder', 'No. tiket (opsional)').css({
      width: '100%',
      padding: '0.5rem',
      borderRadius: '0.4rem',
      border: '1px solid #cbd5e1',
      marginBottom: '0.65rem',
      fontSize: '0.8125rem'
    });
    if (visa.tiket) tiket.get().value = visa.tiket;

    const statusEl = el('p').css({ margin: '0 0 0.65rem', fontSize: '0.8125rem', color: '#475569' });
    const st = Number(personal.statterbang) === 1 ? 'Sudah terbang' : 'Belum terbang';
    statusEl.text(`Status saat ini: ${st}`);

    const btn = el('button').attr('type', 'button').text('Simpan keberangkatan').css({
      padding: '0.55rem 1.1rem',
      borderRadius: '0.5rem',
      border: 'none',
      background: '#2563eb',
      color: '#fff',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '0.8125rem'
    });

    const msg = el('p').css({ display: 'none', marginTop: '0.5rem', fontSize: '0.8125rem' });

    btn.click(async () => {
      msg.css({ display: 'none' });
      btn.disabled(true).css({ opacity: '0.7' });
      try {
        const res = await apiClient.post('visa/depart', {
          id_biodata: idBiodata,
          tanggalterbang: tgl.get().value,
          airport: airport.get().value,
          tiket: tiket.get().value,
          statusterbang: 'Sudah terbang'
        });
        if (!res.success) throw new Error(res.error || 'Gagal menyimpan');
        msg.text('Keberangkatan tercatat.').css({ display: 'block', color: '#15803d' });
        if (typeof layout !== 'undefined' && layout.toast) {
          layout.toast('TKI ditandai sudah terbang.', { type: 'success' });
        }
        if (onRefresh) await onRefresh();
      } catch (e) {
        msg.text(e.message || 'Gagal menyimpan.').css({ display: 'block', color: '#dc2626' });
      } finally {
        btn.disabled(false).css({ opacity: '1' });
      }
    });

    card.child([statusEl, el('label').text('Tanggal terbang').css({ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }), tgl, airport, tiket, btn, msg]);
    return card;
  }

  global.VisaDepartPanel = { buildVisaDepartPanel };
})(typeof window !== 'undefined' ? window : global);
