(function (global) {
  'use strict';

  function normalizeDateKey(value) {
    if (!value) return '';
    const s = String(value).trim();
    if (s.length >= 10) return s.slice(0, 10);
    return s;
  }

  function registerCrmCalendar() {
    if (typeof UiBuilder === 'undefined') {
      setTimeout(registerCrmCalendar, 30);
      return;
    }

    UiBuilder.registerComponent('crm-calendar', () => {
      const root = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%'
      });

      const now = new Date();
      let year = now.getFullYear();
      let month = now.getMonth() + 1;

      const header = el('div').css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      });

      const title = el('h2').css({ margin: 0, fontSize: '1.35rem', fontWeight: '700', color: '#0f172a' });
      const nav = el('div').css({ display: 'flex', gap: '0.5rem' });

      const btnStyle = {
        padding: '0.45rem 0.85rem',
        borderRadius: '0.5rem',
        border: '1px solid #cbd5e1',
        background: '#fff',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '0.8rem'
      };

      const prevBtn = el('button').attr('type', 'button').text('‹ Prev').css(btnStyle);
      const nextBtn = el('button').attr('type', 'button').text('Next ›').css(btnStyle);
      const todayBtn = el('button').attr('type', 'button').text('Hari ini').css({
        ...btnStyle,
        background: '#2563eb',
        color: '#fff',
        border: 'none'
      });

      nav.child(prevBtn);
      nav.child(todayBtn);
      nav.child(nextBtn);
      header.child(title);
      header.child(nav);
      root.child(header);

      const statusEl = el('p').css({ margin: 0, fontSize: '0.8rem', color: '#64748b' });
      root.child(statusEl);

      const gridWrap = el('div').css({
        backgroundColor: '#fff',
        borderRadius: '0.875rem',
        border: '1px solid #e2e8f0',
        padding: '1rem',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)'
      });
      const gridSlot = el('div');
      gridWrap.child(gridSlot);
      root.child(gridWrap);

      const listWrap = el('div').css({
        backgroundColor: '#fff',
        borderRadius: '0.875rem',
        border: '1px solid #e2e8f0',
        padding: '1rem 1.25rem'
      });
      listWrap.child(el('h3').text('Agenda bulan ini').css({ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: '700' }));
      const listSlot = el('div');
      listWrap.child(listSlot);
      root.child(listWrap);

      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      const render = async () => {
        title.text(`${monthNames[month - 1]} ${year}`);
        statusEl.text('Memuat kalender...');
        gridSlot.empty();
        listSlot.empty();
        gridSlot.child(el('p').text('Memuat...').css({ color: '#64748b', fontSize: '0.875rem' }));
        gridSlot.get();

        const apiBase = window.location?.origin || '';
        try {
          const res = await fetch(`${apiBase}/api/calendar?year=${year}&month=${month}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!json.success) throw new Error(json.error || 'API error');

          const events = json.data || [];
          const byDay = {};
          events.forEach((ev) => {
            const d = normalizeDateKey(ev.due_date || ev.created_at);
            if (!d) return;
            if (!byDay[d]) byDay[d] = [];
            byDay[d].push(ev);
          });

          gridSlot.empty();
          const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
          const headRow = el('div').css({
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.35rem',
            marginBottom: '0.35rem'
          });
          weekdays.forEach((w) => {
            headRow.child(el('div').text(w).css({
              textAlign: 'center',
              fontSize: '0.7rem',
              fontWeight: '700',
              color: '#64748b',
              padding: '0.25rem'
            }));
          });
          gridSlot.child(headRow);

          const first = new Date(year, month - 1, 1);
          const startPad = first.getDay();
          const daysInMonth = new Date(year, month, 0).getDate();

          const calGrid = el('div').css({
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.35rem'
          });

          for (let i = 0; i < startPad; i++) {
            calGrid.child(el('div').css({ minHeight: '4.5rem' }));
          }

          const todayKey = normalizeDateKey(new Date().toISOString());

          for (let d = 1; d <= daysInMonth; d++) {
            const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEvents = byDay[iso] || [];
            const isToday = iso === todayKey;
            const cell = el('div').css({
              minHeight: '4.5rem',
              border: isToday ? '2px solid #2563eb' : '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              padding: '0.35rem',
              backgroundColor: dayEvents.length ? '#eff6ff' : '#fafafa'
            });
            cell.child(el('div').text(String(d)).css({
              fontSize: '0.75rem',
              fontWeight: '700',
              color: isToday ? '#1d4ed8' : '#334155'
            }));
            dayEvents.slice(0, 2).forEach((ev) => {
              cell.child(
                el('div').text(ev.title).css({
                  fontSize: '0.65rem',
                  color: '#1d4ed8',
                  marginTop: '0.2rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                })
              );
            });
            if (dayEvents.length > 2) {
              cell.child(el('div').text(`+${dayEvents.length - 2}`).css({ fontSize: '0.6rem', color: '#64748b' }));
            }
            calGrid.child(cell);
          }
          gridSlot.child(calGrid);
          gridSlot.get();

          listSlot.empty();
          statusEl.text(`${events.length} aktivitas di bulan ini`);
          if (!events.length) {
            listSlot.child(
              el('p').text('Tidak ada aktivitas di bulan ini. Tambahkan due date di modul Activities.').css({
                color: '#94a3b8',
                fontSize: '0.875rem'
              })
            );
          } else {
            events.forEach((ev) => {
              const row = el('div').css({
                padding: '0.6rem 0',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.5rem',
                cursor: 'pointer'
              });
              row.click(() => {
                if (typeof layout !== 'undefined') layout.navigate('/activities');
              });
              row.child(el('div').text(ev.title).css({ fontWeight: '600', fontSize: '0.875rem' }));
              row.child(
                el('div').text(normalizeDateKey(ev.due_date || ev.created_at)).css({
                  fontSize: '0.75rem',
                  color: '#64748b',
                  flexShrink: '0'
                })
              );
              listSlot.child(row);
            });
          }
          listSlot.get();
        } catch (e) {
          gridSlot.empty();
          gridSlot.child(
            el('p').text(`Gagal memuat kalender: ${e.message}`).css({ color: '#dc2626', fontSize: '0.875rem' })
          );
          gridSlot.get();
          statusEl.text('Error memuat data');
          listSlot.empty();
          listSlot.get();
        }
      };

      prevBtn.click(() => {
        month -= 1;
        if (month < 1) { month = 12; year -= 1; }
        render();
      });
      nextBtn.click(() => {
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        render();
      });
      todayBtn.click(() => {
        const t = new Date();
        year = t.getFullYear();
        month = t.getMonth() + 1;
        render();
      });

      render();
      return root;
    });
  }

  registerCrmCalendar();
})(typeof window !== 'undefined' ? window : global);
