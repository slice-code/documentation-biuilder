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

  function formatNumber(n) {
    return new Intl.NumberFormat('id-ID').format(n || 0);
  }

  function formatCurrency(n) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(n || 0);
  }

  const SEKTOR_COLORS = {
    FF: '#2563eb', MF: '#1d4ed8', FI: '#7c3aed', IM: '#6d28d9', JP: '#db2777',
    FH: '#059669', MI: '#0d9488', MC: '#ca8a04', MH: '#ea580c', HM: '#c2410c',
    HF: '#be185d', HK: '#0891b2'
  };

  function getSektorColor(code) {
    return SEKTOR_COLORS[String(code || '').toUpperCase()] || '#64748b';
  }

  function pctOf(part, total) {
    const t = Math.max(Number(total) || 0, 1);
    return Math.round((Number(part) || 0) / t * 100);
  }

  /** Panel grafik dengan judul */
  function buildChartCard(title, subtitle, contentEl) {
    const card = el('div').css({
      backgroundColor: '#fff',
      borderRadius: '1rem',
      border: '1px solid #e2e8f0',
      padding: '1.25rem 1.35rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '300px'
    });
    card.child(el('h3').text(title).css({ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }));
    if (subtitle) {
      card.child(el('p').text(subtitle).css({ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }));
    }
    const body = el('div').css({ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center' });
    body.child(contentEl);
    card.child(body);
    return card;
  }

  /** Grafik donat SVG — distribusi proporsional */
  function buildDonutChart(slices, centerLabel) {
    const size = 196;
    const cx = size / 2;
    const cy = size / 2;
    const r = 70;
    const stroke = 26;
    const circ = 2 * Math.PI * r;
    const total = slices.reduce((s, x) => s + (Number(x.value) || 0), 0) || 1;
    let rotation = -90;

    const wrap = el('div').css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '1.25rem',
      alignItems: 'center',
      justifyContent: 'center'
    });

    const svgBox = el('div').css({ position: 'relative', width: size + 'px', height: size + 'px', flexShrink: '0' });
    const svg = el('svg').attr('width', String(size)).attr('height', String(size)).attr('viewBox', `0 0 ${size} ${size}`);
    svg.child(el('circle').attr('cx', String(cx)).attr('cy', String(cy)).attr('r', String(r))
      .attr('fill', 'none').attr('stroke', '#f1f5f9').attr('stroke-width', String(stroke)));

    slices.forEach((slice) => {
      const val = Number(slice.value) || 0;
      if (val <= 0) return;
      const portion = val / total;
      const dash = portion * circ;
      svg.child(el('circle').attr('cx', String(cx)).attr('cy', String(cy)).attr('r', String(r))
        .attr('fill', 'none')
        .attr('stroke', slice.color || '#2563eb')
        .attr('stroke-width', String(stroke))
        .attr('stroke-linecap', 'butt')
        .attr('stroke-dasharray', `${dash} ${circ - dash}`)
        .attr('transform', `rotate(${rotation} ${cx} ${cy})`));
      rotation += portion * 360;
    });

    svgBox.child(svg);
    svgBox.child(el('div').css({
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none'
    }).child([
      el('div').text(formatNumber(total)).css({ fontSize: '1.45rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }),
      el('div').text(centerLabel || 'Total').css({ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' })
    ]));
    wrap.child(svgBox);

    const legend = el('div').css({ flex: '1', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '0.45rem' });
    slices.forEach((slice) => {
      const val = Number(slice.value) || 0;
      const row = el('div').css({ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' });
      row.child(el('span').css({ width: '10px', height: '10px', borderRadius: '50%', background: slice.color || '#2563eb', flexShrink: '0' }));
      row.child(el('span').text(slice.label).css({ flex: 1, color: '#334155', fontWeight: '600' }));
      row.child(el('span').text(formatNumber(val) + ' (' + pctOf(val, total) + '%)').css({ color: '#64748b', fontWeight: '600', fontSize: '0.75rem' }));
      legend.child(row);
    });
    wrap.child(legend);
    return wrap;
  }

  /** Grafik batang vertikal — perbandingan nilai */
  function buildVerticalBarChart(items, chartHeight) {
    const h = chartHeight || 150;
    const max = Math.max(...items.map((i) => Number(i.value) || 0), 1);
    const wrap = el('div').css({
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: '0.4rem',
      height: (h + 52) + 'px',
      paddingTop: '0.35rem'
    });
    items.forEach((item) => {
      const val = Number(item.value) || 0;
      const barH = Math.max(6, Math.round((val / max) * h));
      const col = el('div').css({
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.3rem',
        minWidth: '0'
      });
      col.child(el('span').text(formatNumber(val)).css({ fontSize: '0.68rem', fontWeight: '700', color: '#64748b' }));
      col.child(el('div').css({
        width: '100%',
        maxWidth: '44px',
        height: barH + 'px',
        background: item.color || '#2563eb',
        borderRadius: '0.45rem 0.45rem 0.12rem 0.12rem'
      }));
      col.child(el('span').text(item.label).css({
        fontSize: '0.65rem',
        fontWeight: '700',
        color: '#475569',
        textAlign: 'center',
        lineHeight: 1.2,
        wordBreak: 'break-word'
      }));
      wrap.child(col);
    });
    return wrap;
  }

  /** Strip ringkasan angka penting */
  function buildSummaryStrip(d) {
    const total = Math.max(Number(d.personal) || 0, 1);
    const topSektor = (d.bySektor && d.bySektor.length) ? d.bySektor[0] : null;
    const card = el('div').css({
      background: 'linear-gradient(90deg, #eff6ff 0%, #f8fafc 45%, #f0fdf4 100%)',
      border: '1px solid #dbeafe',
      borderRadius: '1rem',
      padding: '1.15rem 1.35rem'
    });
    card.child(el('h3').text('Ringkasan cepat').css({ margin: '0 0 0.85rem', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }));
    const grid = el('div').css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '0.75rem'
    });
    [
      { label: 'TKI terdaftar', value: formatNumber(d.personal), sub: 'Basis seluruh biodata' },
      { label: 'Dalam proses', value: formatNumber(d.proses), sub: pctOf(d.proses, total) + '% dari total' },
      { label: 'Sudah terbang', value: formatNumber(d.terbang), sub: pctOf(d.terbang, total) + '% keberangkatan' },
      {
        label: 'Sektor terbesar',
        value: topSektor ? String(topSektor.sektor || '').toUpperCase() : '-',
        sub: topSektor ? formatNumber(topSektor.count) + ' TKI' : 'Belum ada data'
      }
    ].forEach((item) => {
      const box = el('div').css({
        background: 'rgba(255,255,255,0.75)',
        borderRadius: '0.65rem',
        padding: '0.75rem 0.9rem',
        border: '1px solid rgba(255,255,255,0.9)'
      });
      box.child(el('div').text(item.label).css({ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }));
      box.child(el('div').text(item.value).css({ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }));
      box.child(el('div').text(item.sub).css({ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }));
      grid.child(box);
    });
    card.child(grid);
    return card;
  }

  function navButton(text, icon, path, variant, onDark) {
    const isPrimary = variant === 'primary';
    const btn = el('button')
      .attr('type', 'button')
      .css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1rem',
        borderRadius: '0.625rem',
        border: isPrimary
          ? 'none'
          : (onDark ? '1px solid rgba(255,255,255,0.45)' : '1px solid #cbd5e1'),
        background: isPrimary
          ? 'linear-gradient(180deg, #ffffff 0%, #e0e7ff 100%)'
          : (onDark ? 'rgba(255,255,255,0.12)' : '#fff'),
        color: isPrimary ? '#1e40af' : (onDark ? '#fff' : '#334155'),
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: isPrimary
          ? '0 4px 14px rgba(0,0,0,0.15)'
          : (onDark ? 'none' : '0 1px 2px rgba(15,23,42,0.05)')
      });

    if (icon) btn.child(el('i').class(icon));
    btn.child(el('span').text(text));
    btn.click(() => {
      if (typeof layout !== 'undefined') layout.navigate(path);
    });
    return btn;
  }

  function buildStatCard({ icon, label, value, subtext, color, path }) {
    const accent = color || '#2563eb';
    const card = el('div').css({
      backgroundColor: '#fff',
      borderRadius: '0.875rem',
      border: '1px solid #e2e8f0',
      padding: '1.25rem 1.35rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
      cursor: path ? 'pointer' : 'default',
      transition: 'box-shadow 0.2s, transform 0.2s'
    });

    const row = el('div').css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '0.75rem'
    });

    row.child(
      el('div').css({
        width: '2.75rem',
        height: '2.75rem',
        borderRadius: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${accent}18`,
        flexShrink: '0'
      }).child(el('i').class(icon).css({ fontSize: '1.15rem', color: accent }))
    );

    const col = el('div').css({ flex: '1', textAlign: 'right' });
    col.child(el('div').text(value).css({
      fontSize: '1.65rem',
      fontWeight: '800',
      color: '#0f172a',
      lineHeight: '1.1',
      letterSpacing: '-0.02em'
    }));
    col.child(el('div').text(label).css({
      fontSize: '0.8125rem',
      color: '#64748b',
      marginTop: '0.25rem',
      fontWeight: '500'
    }));
    if (subtext) {
      col.child(el('div').text(subtext).css({
        fontSize: '0.75rem',
        color: '#94a3b8',
        marginTop: '0.15rem'
      }));
    }

    row.child(col);
    card.child(row);

    if (path) {
      card.click(() => layout.navigate(path));
      card.on('mouseenter', function () {
        this.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.1)';
        this.style.transform = 'translateY(-2px)';
      });
      card.on('mouseleave', function () {
        this.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.06)';
        this.style.transform = 'translateY(0)';
      });
    }

    return card;
  }

  /** Kartu KPI utama — lebih menonjol di baris atas dashboard */
  function buildFeaturedKpi({ icon, label, value, hint, color, path }) {
    const accent = color || '#2563eb';
    const card = el('div').css({
      background: `linear-gradient(145deg, #fff 0%, ${accent}08 100%)`,
      borderRadius: '1rem',
      border: `1px solid ${accent}22`,
      padding: '1.35rem 1.4rem',
      boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
      cursor: path ? 'pointer' : 'default',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s'
    });
    card.child(el('div').css({
      position: 'absolute',
      right: '-1.25rem',
      top: '-1.25rem',
      width: '5.5rem',
      height: '5.5rem',
      borderRadius: '50%',
      background: `${accent}12`
    }));
    const top = el('div').css({ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' });
    top.child(el('div').css({
      width: '2.5rem',
      height: '2.5rem',
      borderRadius: '0.65rem',
      background: `${accent}18`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }).child(el('i').class(icon).css({ color: accent, fontSize: '1.05rem' })));
    top.child(el('span').text(label).css({ fontSize: '0.8125rem', fontWeight: '600', color: '#64748b' }));
    card.child(top);
    card.child(el('div').text(value).css({
      fontSize: '2rem',
      fontWeight: '800',
      color: '#0f172a',
      letterSpacing: '-0.03em',
      lineHeight: 1.1
    }));
    if (hint) {
      card.child(el('div').text(hint).css({ marginTop: '0.35rem', fontSize: '0.75rem', color: '#94a3b8' }));
    }
    if (path) {
      card.click(() => layout.navigate(path));
      card.on('mouseenter', function () {
        this.style.transform = 'translateY(-3px)';
        this.style.boxShadow = '0 12px 28px rgba(15, 23, 42, 0.12)';
      });
      card.on('mouseleave', function () {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 4px 20px rgba(15, 23, 42, 0.06)';
      });
    }
    return card;
  }

  /** Daftar modul administrasi dengan bar progres relatif terhadap total TKI */
  function buildProcessList(d) {
    const base = Math.max(Number(d.personal) || 0, 1);
    const card = el('div').css({
      backgroundColor: '#fff',
      borderRadius: '1rem',
      border: '1px solid #e2e8f0',
      padding: '1.25rem 1.35rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
    });
    card.child(el('h3').text('Kelengkapan modul').css({ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }));
    [
      ['Disnaker', d.disnaker, '/disnaker', '#0d9488'],
      ['Medical', d.medical, '/medical', '#059669'],
      ['Paspor', d.paspor, '/paspor', '#7c3aed'],
      ['Majikan', d.majikan, '/majikan', '#db2777'],
      ['Dokumen', d.dokumen, '/dokumen', '#64748b']
    ].forEach(([label, n, path, color]) => {
      const pct = Math.min(100, Math.round((Number(n) / base) * 100));
      const row = el('div').css({ marginBottom: '0.85rem', cursor: 'pointer' });
      row.click(() => layout.navigate(path));
      row.child(el('div').css({ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.8125rem' }).child([
        el('span').text(label).css({ fontWeight: '600', color: '#334155' }),
        el('span').text(formatNumber(n)).css({ color: '#64748b', fontWeight: '600' })
      ]));
      row.child(el('div').css({ height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }).child(
        el('div').css({ width: pct + '%', height: '100%', background: color, borderRadius: '999px' })
      ));
      card.child(row);
    });
    return card;
  }

  function registerCrmDashboard() {
    if (typeof UiBuilder === 'undefined') return;

    UiBuilder.registerComponent('crm-dashboard', () => {
      const root = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      });

      const hero = el('div').css({
        borderRadius: '1rem',
        padding: '1.75rem 2rem',
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 45%, #3b82f6 100%)',
        color: '#fff',
        boxShadow: '0 12px 40px rgba(37, 99, 235, 0.35)',
        position: 'relative',
        overflow: 'hidden'
      });

      hero.child(
        el('div').css({
          position: 'absolute',
          right: '-2rem',
          top: '-2rem',
          width: '12rem',
          height: '12rem',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)'
        })
      );

      const heroInner = el('div').css({ position: 'relative', zIndex: '1' });
      heroInner.child(
        el('div').text('CRM Dashboard').css({
          margin: '0 0 0.35rem',
          fontSize: '0.8rem',
          fontWeight: '600',
          opacity: '0.85',
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        })
      );
      heroInner.child(
        el('h1').text('Ringkasan penjualan & relasi pelanggan').css({
          margin: '0 0 0.5rem',
          fontSize: 'clamp(1.35rem, 3vw, 1.85rem)',
          fontWeight: '800',
          lineHeight: '1.2',
          letterSpacing: '-0.02em'
        })
      );
      heroInner.child(
        el('p').text('Pantau pipeline deal, leads baru, dan aktivitas tim dari satu tempat.').css({
          margin: '0 0 1.25rem',
          fontSize: '0.95rem',
          opacity: '0.92',
          maxWidth: '36rem',
          lineHeight: '1.55'
        })
      );

      const heroActions = el('div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' });
      heroActions.child(navButton('Buka Deals', 'fas fa-handshake', '/deals', 'primary', true));
      heroActions.child(navButton('Leads', 'fas fa-user-plus', '/leads', 'outline', true));
      heroActions.child(navButton('Customers', 'fas fa-user-tie', '/customers', 'outline', true));
      heroInner.child(heroActions);
      hero.child(heroInner);
      root.child(hero);

      const bodySlot = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1.25rem' });
      bodySlot.child(
        el('div').text('Memuat ringkasan...').css({
          padding: '2rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.9rem'
        })
      );
      root.child(bodySlot);

      const apiBase = typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';

      fetch(`${apiBase}/api/dashboard`, { credentials: 'include' })
        .then((r) => r.json())
        .then((res) => {
          bodySlot.empty();
          if (!res.success || !res.data) {
            bodySlot.child(
              el('div').text('Gagal memuat data dashboard.').css({ color: '#dc2626', padding: '1rem' })
            );
            bodySlot.get();
            return;
          }

          const d = res.data;

          const statsGrid = el('div').css({
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
          });

          statsGrid.child(buildStatCard({
            icon: 'fas fa-user-tie',
            label: 'Customers',
            value: formatNumber(d.customers),
            color: '#2563eb',
            path: '/customers'
          }));
          statsGrid.child(buildStatCard({
            icon: 'fas fa-building',
            label: 'Companies',
            value: formatNumber(d.companies),
            color: '#7c3aed',
            path: '/companies'
          }));
          statsGrid.child(buildStatCard({
            icon: 'fas fa-handshake',
            label: 'Open Deals',
            value: formatNumber(d.openDeals),
            subtext: `dari ${formatNumber(d.deals)} total`,
            color: '#0891b2',
            path: '/deals'
          }));
          statsGrid.child(buildStatCard({
            icon: 'fas fa-coins',
            label: 'Nilai Pipeline',
            value: formatCurrency(d.pipelineValue),
            subtext: 'deal aktif',
            color: '#16a34a',
            path: '/deals'
          }));
          statsGrid.child(buildStatCard({
            icon: 'fas fa-user-plus',
            label: 'Leads Baru',
            value: formatNumber(d.leadsNew),
            subtext: `dari ${formatNumber(d.leads)} leads`,
            color: '#ea580c',
            path: '/leads'
          }));
          statsGrid.child(buildStatCard({
            icon: 'fas fa-tasks',
            label: 'Activities',
            value: formatNumber(d.activities),
            subtext: d.activitiesOverdue > 0 ? `${d.activitiesOverdue} terlambat` : `${d.activitiesPending || 0} aktif`,
            color: '#db2777',
            path: '/activities'
          }));

          bodySlot.child(statsGrid);

          const kpiGrid = el('div').css({
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
          });
          kpiGrid.child(buildStatCard({
            icon: 'fas fa-percentage',
            label: 'Lead Conversion',
            value: `${d.conversionRate || 0}%`,
            subtext: `${formatNumber(d.leadsConverted || 0)} dari ${formatNumber(d.leads)} leads`,
            color: '#0d9488',
            path: '/leads'
          }));
          kpiGrid.child(buildStatCard({
            icon: 'fas fa-trophy',
            label: 'Win Rate',
            value: `${d.winRate || 0}%`,
            subtext: `${formatNumber(d.dealsWon || 0)} won / ${formatNumber((d.dealsWon || 0) + (d.dealsLost || 0))} closed`,
            color: '#ca8a04',
            path: '/deals'
          }));
          kpiGrid.child(buildStatCard({
            icon: 'fas fa-tags',
            label: 'Tags',
            value: formatNumber(d.tags),
            color: '#6366f1',
            path: '/tags'
          }));
          bodySlot.child(kpiGrid);

          if (d.dealsByStage && d.dealsByStage.length > 0) {
            const maxCount = Math.max(...d.dealsByStage.map((s) => s.count), 1);
            const pipelineCard = el('div').css({
              backgroundColor: '#fff',
              borderRadius: '0.875rem',
              border: '1px solid #e2e8f0',
              padding: '1.35rem 1.5rem',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
            });

            const pipelineHeader = el('div').css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            });
            pipelineHeader.child(
              el('h3').text('Pipeline Deals').css({ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' })
            );
            pipelineHeader.child(
              el('button').attr('type', 'button').text('Lihat Kanban').css({
                border: 'none',
                background: 'transparent',
                color: '#2563eb',
                fontWeight: '600',
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }).click(() => layout.navigate('/deals'))
            );
            pipelineCard.child(pipelineHeader);

            const bars = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.65rem' });
            d.dealsByStage.forEach((row) => {
              const pct = Math.round((row.count / maxCount) * 100);
              const label = STAGE_LABELS[row.stage] || row.stage;
              const barRow = el('div').css({ display: 'flex', alignItems: 'center', gap: '0.75rem' });
              barRow.child(
                el('div').text(label).css({
                  width: '7.5rem',
                  flexShrink: '0',
                  fontSize: '0.8rem',
                  color: '#475569',
                  fontWeight: '500'
                })
              );
              const track = el('div').css({
                flex: '1',
                height: '0.5rem',
                backgroundColor: '#f1f5f9',
                borderRadius: '999px',
                overflow: 'hidden'
              });
              track.child(
                el('div').css({
                  width: `${pct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                  borderRadius: '999px',
                  minWidth: row.count > 0 ? '4px' : '0'
                })
              );
              barRow.child(track);
              barRow.child(
                el('div').text(String(row.count)).css({
                  width: '1.5rem',
                  textAlign: 'right',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: '#0f172a'
                })
              );
              bars.child(barRow);
            });
            pipelineCard.child(bars);
            bodySlot.child(pipelineCard);
          }

          if (d.recentActivities && d.recentActivities.length > 0) {
            const actCard = el('div').css({
              backgroundColor: '#fff',
              borderRadius: '0.875rem',
              border: '1px solid #e2e8f0',
              padding: '1.35rem 1.5rem',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
            });
            const actHeader = el('div').css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            });
            actHeader.child(
              el('h3').text('Aktivitas Terbaru').css({ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' })
            );
            actHeader.child(
              el('button').attr('type', 'button').text('Semua').css({
                border: 'none',
                background: 'transparent',
                color: '#2563eb',
                fontWeight: '600',
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }).click(() => layout.navigate('/activities'))
            );
            actCard.child(actHeader);

            const typeIcons = {
              call: 'fas fa-phone',
              email: 'fas fa-envelope',
              meeting: 'fas fa-calendar',
              task: 'fas fa-check-square',
              note: 'fas fa-sticky-note'
            };

            const list = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.5rem' });
            d.recentActivities.forEach((act) => {
              const row = el('div').css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.75rem',
                borderRadius: '0.5rem',
                backgroundColor: '#f8fafc',
                cursor: 'pointer'
              });
              row.click(() => layout.navigate('/activities'));
              row.child(
                el('div').css({
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: '0'
                }).child(el('i').class(typeIcons[act.activity_type] || 'fas fa-tasks'))
              );
              const meta = el('div').css({ flex: '1', minWidth: 0 });
              meta.child(el('div').text(act.title).css({
                fontWeight: '600',
                fontSize: '0.875rem',
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }));
              meta.child(
                el('div').text(`${act.activity_type} · ${act.status}`).css({
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginTop: '0.15rem'
                })
              );
              row.child(meta);
              list.child(row);
            });
            actCard.child(list);
            bodySlot.child(actCard);
          }

          const quickCard = el('div').css({
            backgroundColor: '#fff',
            borderRadius: '0.875rem',
            border: '1px solid #e2e8f0',
            padding: '1.35rem 1.5rem',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
          });
          quickCard.child(
            el('h3').text('Akses cepat').css({
              margin: '0 0 1rem',
              fontSize: '1.05rem',
              fontWeight: '700',
              color: '#0f172a'
            })
          );
          const quickGrid = el('div').css({
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'
          });
          [
            { t: 'Leads', i: 'fas fa-user-plus', p: '/leads' },
            { t: 'Deals', i: 'fas fa-handshake', p: '/deals' },
            { t: 'Customers', i: 'fas fa-user-tie', p: '/customers' },
            { t: 'Companies', i: 'fas fa-building', p: '/companies' },
            { t: 'Activities', i: 'fas fa-calendar-check', p: '/activities' }
          ].forEach((item) => {
            quickGrid.child(navButton(item.t, item.i, item.p, 'outline', false));
          });
          quickCard.child(quickGrid);
          bodySlot.child(quickCard);

          bodySlot.get();
        })
        .catch(() => {
          bodySlot.empty();
          bodySlot.child(
            el('div').text('Tidak dapat terhubung ke server.').css({ color: '#dc2626', padding: '1rem' })
          );
          bodySlot.get();
        });

      return root;
    });
  }

  function registerTkiDashboard() {
    if (typeof UiBuilder === 'undefined') return;

    UiBuilder.registerComponent('tki-dashboard', () => {
      const root = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.35rem',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        paddingBottom: '1.5rem'
      });

      const hero = el('div').css({
        borderRadius: '1rem',
        padding: '1.75rem 2rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 35%, #2563eb 70%, #3b82f6 100%)',
        color: '#fff',
        boxShadow: '0 16px 48px rgba(30, 64, 175, 0.4)',
        position: 'relative',
        overflow: 'hidden'
      });

      hero.child([
        el('div').text(new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })).css({ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: '500', opacity: '0.88' }),
        el('h1').text('Dashboard TKI').css({ margin: '0 0 0.4rem', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: '800', letterSpacing: '-0.03em' }),
        el('p').text('Ringkasan angka, grafik status, sektor, dan modul administrasi dalam satu layar.').css({ margin: '0 0 1.25rem', fontSize: '0.95rem', opacity: '0.92', maxWidth: '32rem', lineHeight: 1.55 })
      ]);

      const heroActions = el('div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' });
      heroActions.child(navButton('Tambah Biodata', 'fas fa-user-plus', '/tambahbio', 'primary', true));
      heroActions.child(navButton('Data Personal', 'fas fa-id-card', '/personal', 'outline', true));
      heroActions.child(navButton('Administrasi', 'fas fa-landmark', '/personaladmin', 'outline', true));
      heroActions.child(navButton('Upload Dokumen', 'fas fa-cloud-arrow-up', '/personaldokumen', 'outline', true));
      hero.child(heroActions);
      root.child(hero);

      const bodySlot = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1.35rem' });
      bodySlot.child(el('div').css({ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }).child([
        el('i').class('fas fa-circle-notch fa-spin').css({ marginRight: '0.5rem', color: '#2563eb' }),
        el('span').text('Memuat ringkasan...')
      ]));
      root.child(bodySlot);

      const apiBase = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

      fetch(`${apiBase}/api/dashboard`, { credentials: 'include' })
        .then((r) => r.json())
        .then((res) => {
          bodySlot.empty();
          if (!res.success || !res.data) {
            bodySlot.child(el('div').text(res.error || 'Gagal memuat data dashboard.').css({ color: '#dc2626', padding: '1rem' }));
            bodySlot.get();
            return;
          }

          try {
          const d = res.data;
          const totalTki = Math.max(Number(d.personal) || 0, 1);

          const featuredGrid = el('div').css({
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))'
          });
          featuredGrid.child(buildFeaturedKpi({ icon: 'fas fa-users', label: 'Total TKI', value: formatNumber(d.personal), hint: 'seluruh biodata terdaftar', color: '#2563eb', path: '/personal' }));
          featuredGrid.child(buildFeaturedKpi({ icon: 'fas fa-spinner', label: 'Status Proses', value: formatNumber(d.proses), hint: 'sedang diproses', color: '#0891b2', path: '/personal' }));
          featuredGrid.child(buildFeaturedKpi({ icon: 'fas fa-check-circle', label: 'Terpilih', value: formatNumber(d.terpilih), hint: 'siap penempatan', color: '#7c3aed', path: '/majikan' }));
          featuredGrid.child(buildFeaturedKpi({ icon: 'fas fa-plane-departure', label: 'Sudah Terbang', value: formatNumber(d.terbang), hint: 'keberangkatan tercatat', color: '#16a34a', path: '/visa' }));
          bodySlot.child(featuredGrid);

          const secondaryGrid = el('div').css({
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
          });
          secondaryGrid.child(buildStatCard({ icon: 'fas fa-hourglass-half', label: 'Pending', value: formatNumber(d.pending), color: '#ca8a04', path: '/personal' }));
          secondaryGrid.child(buildStatCard({ icon: 'fas fa-passport', label: 'Data Visa', value: formatNumber(d.visa), color: '#ea580c', path: '/visa' }));
          secondaryGrid.child(buildStatCard({ icon: 'fas fa-folder-open', label: 'Dokumen', value: formatNumber(d.dokumen), color: '#64748b', path: '/dokumen' }));
          secondaryGrid.child(buildStatCard({ icon: 'fas fa-briefcase', label: 'Majikan', value: formatNumber(d.majikan), color: '#db2777', path: '/majikan' }));
          bodySlot.child(secondaryGrid);
          bodySlot.child(buildSummaryStrip(d));

          const pipelineCard = el('div').css({
            backgroundColor: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0',
            padding: '1.25rem 1.35rem', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
          });
          pipelineCard.child(el('h3').text('Alur status TKI').css({ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }));
          const pipeBar = el('div').css({ display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden', background: '#f1f5f9', marginBottom: '1rem' });
          [[d.proses, '#2563eb'], [d.terpilih, '#7c3aed'], [d.pending, '#ca8a04'], [d.terbang, '#16a34a']].forEach(([n, c]) => {
            const w = (Number(n) / totalTki) * 100;
            if (w >= 0.5) pipeBar.child(el('div').css({ width: w + '%', background: c, minWidth: '4px' }));
          });
          pipelineCard.child(pipeBar);
          const leg = el('div').css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' });
          [['Proses', d.proses], ['Terpilih', d.terpilih], ['Pending', d.pending], ['Terbang', d.terbang]].forEach(([lb, n]) => {
            const it = el('div').css({ padding: '0.5rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1px solid #f1f5f9' });
            it.child(el('div').text(lb + ': ' + formatNumber(n)).css({ fontSize: '0.8125rem', fontWeight: '600', color: '#334155' }));
            leg.child(it);
          });
          pipelineCard.child(leg);

          const insightRow = el('div').css({
            display: 'grid',
            gap: '1.25rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            alignItems: 'stretch'
          });
          insightRow.child(pipelineCard);
          insightRow.child(buildProcessList(d));
          bodySlot.child(insightRow);

          bodySlot.child(el('h3').text('Visualisasi & grafik').css({ margin: '0.25rem 0 0', fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }));
          const chartsGrid = el('div').css({
            display: 'grid',
            gap: '1.25rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
          });

          const statusSlices = [
            { label: 'Proses', value: d.proses, color: '#2563eb' },
            { label: 'Terpilih', value: d.terpilih, color: '#7c3aed' },
            { label: 'Pending', value: d.pending, color: '#ca8a04' },
            { label: 'Terbang', value: d.terbang, color: '#16a34a' }
          ].filter((s) => Number(s.value) > 0);
          if (statusSlices.length === 0) {
            statusSlices.push({ label: 'Belum ada', value: 1, color: '#cbd5e1' });
          }
          chartsGrid.child(buildChartCard(
            'Distribusi status TKI',
            'Proporsi berdasarkan status aktif & keberangkatan',
            buildDonutChart(statusSlices, 'TKI')
          ));

          chartsGrid.child(buildChartCard(
            'Grafik modul administrasi',
            'Jumlah record per tahap proses',
            buildVerticalBarChart([
              { label: 'Disnaker', value: d.disnaker, color: '#0d9488' },
              { label: 'Medical', value: d.medical, color: '#059669' },
              { label: 'Paspor', value: d.paspor, color: '#7c3aed' },
              { label: 'Majikan', value: d.majikan, color: '#db2777' },
              { label: 'Dokumen', value: d.dokumen, color: '#64748b' }
            ], 140)
          ));

          if (d.bySektor && d.bySektor.length > 0) {
            const topSektor = d.bySektor.slice(0, 8).map((row) => ({
              label: String(row.sektor || '-').toUpperCase(),
              value: row.count,
              color: getSektorColor(row.sektor)
            }));
            chartsGrid.child(buildChartCard(
              'TKI per sektor (top 8)',
              'Berdasarkan kode awal id biodata',
              buildVerticalBarChart(topSektor, 140)
            ));
          }

          bodySlot.child(chartsGrid);

          bodySlot.child(el('h3').text('Modul proses administrasi').css({ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }));
          const prosesGrid = el('div').css({
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'
          });
          prosesGrid.child(buildStatCard({ icon: 'fas fa-building', label: 'Disnaker', value: formatNumber(d.disnaker), color: '#0d9488', path: '/disnaker' }));
          prosesGrid.child(buildStatCard({ icon: 'fas fa-stethoscope', label: 'Medical', value: formatNumber(d.medical), color: '#059669', path: '/medical' }));
          prosesGrid.child(buildStatCard({ icon: 'fas fa-passport', label: 'Paspor', value: formatNumber(d.paspor), color: '#7c3aed', path: '/paspor' }));
          prosesGrid.child(buildStatCard({ icon: 'fas fa-briefcase', label: 'Majikan', value: formatNumber(d.majikan), color: '#db2777', path: '/majikan' }));
          prosesGrid.child(buildStatCard({ icon: 'fas fa-folder-open', label: 'Dokumen', value: formatNumber(d.dokumen), color: '#64748b', path: '/dokumen' }));
          bodySlot.child(prosesGrid);

          if (d.bySektor && d.bySektor.length > 0) {
            const maxCount = Math.max(...d.bySektor.map((s) => Number(s.count)), 1);
            const sektorCard = el('div').css({
              backgroundColor: '#fff',
              borderRadius: '0.875rem',
              border: '1px solid #e2e8f0',
              padding: '1.35rem 1.5rem',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
            });
            sektorCard.child(el('h3').text('Detail lengkap per sektor').css({ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }));

            d.bySektor.forEach((row) => {
              const pct = Math.round((Number(row.count) / maxCount) * 100);
              const code = String(row.sektor || '').toUpperCase();
              const accent = getSektorColor(code);
              const barRow = el('div').css({ marginBottom: '0.75rem' });
              barRow.child(el('div').css({ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.8125rem' }).child([
                el('span').text(code || '-').css({ fontWeight: '700', fontFamily: 'ui-monospace, monospace', color: accent, padding: '0.1rem 0.4rem', borderRadius: '0.35rem', background: accent + '18' }),
                el('span').text(formatNumber(row.count)).css({ color: '#64748b', fontWeight: '600' })
              ]));
              barRow.child(el('div').css({ height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }).child(
                el('div').css({ width: `${pct}%`, height: '100%', background: accent, borderRadius: '999px' })
              ));
              sektorCard.child(barRow);
            });
            bodySlot.child(sektorCard);
          }

          if (d.recentPersonal && d.recentPersonal.length > 0) {
            const recentCard = el('div').css({
              backgroundColor: '#fff',
              borderRadius: '0.875rem',
              border: '1px solid #e2e8f0',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
            });
            const recentHead = el('div').css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.85rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            });
            recentHead.child(el('h3').text('TKI Terbaru').css({ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }));
            recentHead.child(
              el('button').attr('type', 'button').text('Lihat semua').css({
                border: 'none',
                background: 'transparent',
                color: '#2563eb',
                fontWeight: '600',
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }).click(() => layout.navigate('/personal'))
            );
            recentCard.child(recentHead);

            const tableWrap = el('div').css({ overflowX: 'auto' });
            const table = el('table').css({ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' });
            table.child(
              el('thead').child(
                el('tr').css({ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }).child([
                  el('th').text('ID Biodata').css({ padding: '0.5rem 0.65rem', color: '#64748b', fontWeight: '600' }),
                  el('th').text('Nama').css({ padding: '0.5rem 0.65rem', color: '#64748b', fontWeight: '600' }),
                  el('th').text('Status').css({ padding: '0.5rem 0.65rem', color: '#64748b', fontWeight: '600' }),
                  el('th').text('Negara').css({ padding: '0.5rem 0.65rem', color: '#64748b', fontWeight: '600' })
                ])
              )
            );
            const tbody = el('tbody');
            d.recentPersonal.forEach((row) => {
              const tr = el('tr').css({ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' });
              tr.click(() => {
                if (row.id_biodata) layout.navigate('/biodata/' + encodeURIComponent(row.id_biodata));
              });
              tr.on('mouseenter', function () { this.style.backgroundColor = '#f8fafc'; });
              tr.on('mouseleave', function () { this.style.backgroundColor = ''; });
              const statusTd = el('td').css({ padding: '0.55rem 0.65rem' });
              let badge;
              if (Number(row.statterbang) === 1) {
                badge = el('span').text('Terbang').css({ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', backgroundColor: '#dcfce7', color: '#15803d' });
              } else {
                const sm = { PROSES: ['#dbeafe', '#1d4ed8'], TERPILIH: ['#ede9fe', '#6d28d9'], PENDING: ['#fef3c7', '#b45309'], TERBANG: ['#dcfce7', '#15803d'] };
                const pair = sm[row.statusaktif] || ['#f1f5f9', '#475569'];
                badge = el('span').text(row.statusaktif || '-').css({ display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600', backgroundColor: pair[0], color: pair[1] });
              }
              statusTd.child(badge);
              tr.child([
                el('td').text(row.id_biodata || '-').css({ padding: '0.55rem 0.65rem', fontFamily: 'ui-monospace, monospace', color: '#1e40af', fontWeight: '700', fontSize: '0.8rem' }),
                el('td').text(row.nama || '-').css({ padding: '0.55rem 0.65rem', color: '#0f172a', fontWeight: '600' }),
                statusTd,
                el('td').text(row.negara1 || '-').css({ padding: '0.55rem 0.65rem', color: '#64748b' })
              ]);
              tbody.child(tr);
            });
            table.child(tbody);
            tableWrap.child(table);
            recentCard.child(tableWrap);
            bodySlot.child(recentCard);
          }

          const quickCard = el('div').css({
            backgroundColor: '#fff',
            borderRadius: '0.875rem',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem'
          });
          quickCard.child(el('h3').text('Akses cepat').css({ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }));
          const quickGrid = el('div').css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.65rem' });
          [
            { t: 'Tambah Biodata', i: 'fas fa-user-plus', p: '/tambahbio', c: '#2563eb' },
            { t: 'Administrasi', i: 'fas fa-landmark', p: '/personaladmin', c: '#c2410c' },
            { t: 'Data Dokumen', i: 'fas fa-folder-open', p: '/personaldokumen', c: '#15803d' },
            { t: 'Disnaker', i: 'fas fa-building', p: '/disnaker', c: '#0d9488' },
            { t: 'Medical', i: 'fas fa-stethoscope', p: '/medical', c: '#059669' },
            { t: 'Paspor', i: 'fas fa-passport', p: '/paspor', c: '#7c3aed' },
            { t: 'Visa', i: 'fas fa-plane', p: '/visa', c: '#ea580c' },
            { t: 'Sektor', i: 'fas fa-layer-group', p: '/datasektor', c: '#64748b' }
          ].forEach((item) => {
            const tile = el('button').attr('type', 'button').css({
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.45rem',
              padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fff',
              cursor: 'pointer', textAlign: 'left'
            });
            tile.child(el('div').css({ width: '2.1rem', height: '2.1rem', borderRadius: '0.55rem', background: item.c + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }).child(el('i').class(item.i).css({ color: item.c })));
            tile.child(el('span').text(item.t).css({ fontSize: '0.8125rem', fontWeight: '600', color: '#334155' }));
            tile.click(() => layout.navigate(item.p));
            quickGrid.child(tile);
          });
          quickCard.child(quickGrid);
          bodySlot.child(quickCard);
          } catch (renderErr) {
            console.error('Dashboard render error:', renderErr);
            bodySlot.child(el('div').text('Gagal merender dashboard: ' + (renderErr.message || renderErr)).css({ color: '#dc2626', padding: '1rem' }));
          }
          bodySlot.get();
        })
        .catch((err) => {
          console.error('Dashboard fetch error:', err);
          bodySlot.empty();
          bodySlot.child(el('div').text('Tidak dapat terhubung ke server.').css({ color: '#dc2626', padding: '1rem' }));
          bodySlot.get();
        });

      return root;
    });
  }

  registerTkiDashboard();
})(typeof window !== 'undefined' ? window : global);
