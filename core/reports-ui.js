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

  const STAGE_COLORS = {
    prospecting: '#6366f1',
    qualification: '#8b5cf6',
    proposal: '#3b82f6',
    negotiation: '#0ea5e9',
    closed_won: '#16a34a',
    closed_lost: '#dc2626'
  };

  const QUOTE_STATUS_COLORS = {
    draft: '#94a3b8',
    sent: '#2563eb',
    accepted: '#16a34a',
    rejected: '#dc2626'
  };

  function formatCurrency(n) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(n || 0);
  }

  function formatNumber(n) {
    return new Intl.NumberFormat('id-ID').format(n || 0);
  }

  function panelCard(title, subtitle) {
    const card = el('div').css({
      backgroundColor: '#fff',
      borderRadius: '0.875rem',
      border: '1px solid #e2e8f0',
      padding: '1.25rem 1.35rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
      height: '100%',
      boxSizing: 'border-box'
    });
    const head = el('div').css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1rem',
      gap: '0.5rem'
    });
    const titles = el('div');
    titles.child(el('h3').text(title).css({ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }));
    if (subtitle) {
      titles.child(el('p').text(subtitle).css({ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }));
    }
    head.child(titles);
    card.child(head);
    return { card, head };
  }

  function buildKpiCard({ icon, label, value, subtext, color }) {
    const accent = color || '#2563eb';
    const card = el('div').css({
      backgroundColor: '#fff',
      borderRadius: '0.875rem',
      border: '1px solid #e2e8f0',
      padding: '1.15rem 1.25rem',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
    });
    const top = el('div').css({ display: 'flex', alignItems: 'center', gap: '0.75rem' });
    top.child(
      el('div').css({
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: '0.65rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${accent}18`,
        flexShrink: '0'
      }).child(el('i').class(icon).css({ fontSize: '1rem', color: accent }))
    );
    const col = el('div').css({ flex: '1', minWidth: 0 });
    col.child(el('div').text(value).css({
      fontSize: '1.35rem',
      fontWeight: '800',
      color: '#0f172a',
      lineHeight: '1.15',
      letterSpacing: '-0.02em'
    }));
    col.child(el('div').text(label).css({ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem', fontWeight: '500' }));
    if (subtext) {
      col.child(el('div').text(subtext).css({ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.1rem' }));
    }
    top.child(col);
    card.child(top);
    return card;
  }

  function buildPipelineChart(stages) {
    const { card } = panelCard('Pipeline per tahap', 'Nilai deal aktif per stage');
    const body = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.65rem' });
    if (!stages.length) {
      body.child(el('p').text('Belum ada data deal.').css({ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }));
      card.child(body);
      return card;
    }
    const maxTotal = Math.max(...stages.map((s) => s.total), 1);
    stages.forEach((row) => {
      const label = STAGE_LABELS[row.stage] || row.stage;
      const color = STAGE_COLORS[row.stage] || '#2563eb';
      const pct = Math.round((row.total / maxTotal) * 100);
      const rowEl = el('div');
      const meta = el('div').css({
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        marginBottom: '0.25rem'
      });
      meta.child(el('span').text(label).css({ fontWeight: '600', color: '#334155' }));
      meta.child(
        el('span').text(`${formatCurrency(row.total)} · ${row.count} deal`).css({ color: '#64748b' })
      );
      rowEl.child(meta);
      const track = el('div').css({
        height: '0.55rem',
        backgroundColor: '#f1f5f9',
        borderRadius: '999px',
        overflow: 'hidden'
      });
      track.child(
        el('div').css({
          width: `${Math.max(pct, row.count > 0 ? 4 : 0)}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: '999px'
        })
      );
      rowEl.child(track);
      body.child(rowEl);
    });
    card.child(body);
    return card;
  }

  function buildWinLossChart(won, lost) {
    const { card } = panelCard('Win vs Loss', 'Deal yang sudah ditutup');
    const total = won + lost;
    const body = el('div');
    if (total === 0) {
      body.child(el('p').text('Belum ada deal closed.').css({ color: '#94a3b8', fontSize: '0.875rem' }));
      card.child(body);
      return card;
    }
    const wonPct = Math.round((won / total) * 100);
    const bar = el('div').css({
      display: 'flex',
      height: '2rem',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      marginBottom: '1rem'
    });
    bar.child(el('div').css({
      width: `${wonPct}%`,
      background: 'linear-gradient(90deg, #22c55e, #16a34a)',
      minWidth: won > 0 ? '8px' : '0'
    }));
    bar.child(el('div').css({
      flex: '1',
      background: 'linear-gradient(90deg, #f87171, #dc2626)',
      minWidth: lost > 0 ? '8px' : '0'
    }));
    body.child(bar);
    const legend = el('div').css({ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' });
    [
      { label: 'Won', count: won, color: '#16a34a' },
      { label: 'Lost', count: lost, color: '#dc2626' }
    ].forEach((item) => {
      const itemEl = el('div').css({ display: 'flex', alignItems: 'center', gap: '0.4rem' });
      itemEl.child(el('div').css({ width: '0.65rem', height: '0.65rem', borderRadius: '999px', backgroundColor: item.color }));
      itemEl.child(el('span').text(`${item.label}: ${item.count}`).css({ fontSize: '0.85rem', fontWeight: '600', color: '#334155' }));
      legend.child(itemEl);
    });
    body.child(legend);
    body.child(
      el('p').text(`Win rate: ${wonPct}%`).css({
        margin: '0.75rem 0 0',
        fontSize: '1.5rem',
        fontWeight: '800',
        color: '#0f172a'
      })
    );
    card.child(body);
    return card;
  }

  function buildSourceChart(sources) {
    const { card } = panelCard('Leads per sumber', 'Efektivitas akuisisi lead');
    const body = el('div').css({ display: 'flex', flexDirection: 'column', gap: '0.55rem' });
    if (!sources.length) {
      body.child(el('p').text('Belum ada data lead.').css({ color: '#94a3b8', fontSize: '0.875rem' }));
      card.child(body);
      return card;
    }
    const max = Math.max(...sources.map((s) => s.count), 1);
    sources.forEach((row, i) => {
      const colors = ['#2563eb', '#7c3aed', '#ea580c', '#0891b2', '#16a34a'];
      const color = colors[i % colors.length];
      const pct = Math.round((row.count / max) * 100);
      const rowEl = el('div');
      const metaRow = el('div').css({
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        marginBottom: '0.2rem'
      });
      metaRow.child(el('span').text(row.source).css({ fontWeight: '600', color: '#334155' }));
      metaRow.child(el('span').text(String(row.count)).css({ fontWeight: '700', color: '#0f172a' }));
      rowEl.child(metaRow);
      const track = el('div').css({ height: '0.45rem', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' });
      track.child(el('div').css({ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '999px' }));
      rowEl.child(track);
      body.child(rowEl);
    });
    card.child(body);
    return card;
  }

  function buildQuotesPanel(quotes) {
    const { card } = panelCard('Quotes', 'Status penawaran');
    const body = el('div').css({ display: 'grid', gap: '0.65rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' });
    if (!quotes.length) {
      body.child(el('p').text('Belum ada quote.').css({ color: '#94a3b8', fontSize: '0.875rem', gridColumn: '1 / -1' }));
      card.child(body);
      return card;
    }
    quotes.forEach((q) => {
      const color = QUOTE_STATUS_COLORS[q.status] || '#64748b';
      const box = el('div').css({
        padding: '0.75rem',
        borderRadius: '0.65rem',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc'
      });
      box.child(el('div').text((q.status || '—').toUpperCase()).css({
        fontSize: '0.65rem',
        fontWeight: '700',
        color,
        letterSpacing: '0.04em'
      }));
      box.child(el('div').text(formatCurrency(q.total)).css({
        fontSize: '1rem',
        fontWeight: '700',
        color: '#0f172a',
        marginTop: '0.35rem'
      }));
      box.child(el('div').text(`${q.count} penawaran`).css({ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }));
      body.child(box);
    });
    card.child(body);
    return card;
  }

  function buildTopDealsTable(deals) {
    const { card } = panelCard('Top deals', 'Deal dengan nilai tertinggi');
    if (!deals.length) {
      card.child(el('p').text('Belum ada deal.').css({ color: '#94a3b8', fontSize: '0.875rem' }));
      return card;
    }
    const wrap = el('div').css({ overflowX: 'auto' });
    const table = el('table').css({ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' });
    const thead = el('thead');
    const hr = el('tr').css({ backgroundColor: '#f8fafc' });
    ['Kode', 'Judul', 'Customer', 'Nilai', 'Stage', 'Prob.'].forEach((h) => {
      hr.child(el('th').text(h).css({
        textAlign: 'left',
        padding: '0.65rem 0.75rem',
        fontWeight: '600',
        color: '#475569',
        whiteSpace: 'nowrap'
      }));
    });
    thead.child(hr);
    table.child(thead);
    const tbody = el('tbody');
    deals.forEach((d) => {
      const tr = el('tr');
      const stageLabel = STAGE_LABELS[d.stage] || d.stage;
      const stageColor = STAGE_COLORS[d.stage] || '#64748b';
      const cells = [
        d.deal_code,
        d.title,
        d.customer_name || '—',
        formatCurrency(d.value),
        stageLabel,
        `${d.probability ?? 0}%`
      ];
      cells.forEach((text, idx) => {
        const td = el('td').css({ padding: '0.6rem 0.75rem', borderTop: '1px solid #f1f5f9', color: '#334155' });
        if (idx === 4) {
          td.child(
            el('span').text(text).css({
              display: 'inline-block',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: '600',
              backgroundColor: `${stageColor}18`,
              color: stageColor
            })
          );
        } else {
          td.text(text);
        }
        tr.child(td);
      });
      tbody.child(tr);
    });
    table.child(tbody);
    wrap.child(table);
    card.child(wrap);
    return card;
  }

  function registerCrmReports() {
    if (typeof UiBuilder === 'undefined') {
      setTimeout(registerCrmReports, 30);
      return;
    }

    UiBuilder.registerComponent('crm-reports', () => {
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
        padding: '1.5rem 1.75rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)',
        color: '#fff',
        boxShadow: '0 12px 40px rgba(30, 64, 175, 0.25)'
      });
      const heroRow = el('div').css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem'
      });
      const heroText = el('div');
      heroText.child(el('h2').text('Laporan Penjualan').css({ margin: 0, fontSize: '1.5rem', fontWeight: '800' }));
      heroText.child(
        el('p').text('Ringkasan pipeline, konversi lead, dan performa deal — standar CRM analytics.').css({
          margin: '0.4rem 0 0',
          fontSize: '0.9rem',
          opacity: '0.88',
          maxWidth: '32rem'
        })
      );
      let lastReport = null;

      function reportToast(msg, type) {
        if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: type || 'info' });
        else alert(msg);
      }

      const exportWrap = el('div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' });
      const exportBtnStyle = {
        padding: '0.4rem 0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'rgba(255,255,255,0.12)',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem'
      };

      const pdfBtn = el('button').attr('type', 'button').css({
        ...exportBtnStyle,
        background: 'rgba(255,255,255,0.95)',
        color: '#1e40af',
        border: 'none'
      });
      pdfBtn.child(el('i').class('fas fa-file-pdf'));
      pdfBtn.child(el('span').text('PDF Laporan'));
      pdfBtn.click(() => {
        if (!lastReport) return reportToast('Data laporan belum siap', 'warning');
        if (typeof CrmExport === 'undefined') return reportToast('Modul export belum dimuat', 'error');
        CrmExport.runExport(() => CrmExport.exportSalesReportPdf(lastReport));
      });
      exportWrap.child(pdfBtn);

      const xlsxReportBtn = el('button').attr('type', 'button').css(exportBtnStyle);
      xlsxReportBtn.child(el('i').class('fas fa-file-excel'));
      xlsxReportBtn.child(el('span').text('Excel Laporan'));
      xlsxReportBtn.click(() => {
        if (!lastReport) return reportToast('Data laporan belum siap', 'warning');
        if (typeof CrmExport === 'undefined') return reportToast('Modul export belum dimuat', 'error');
        CrmExport.runExport(() => CrmExport.exportSalesReportXlsx(lastReport));
      });
      exportWrap.child(xlsxReportBtn);

      exportWrap.child(el('span').text('|').css({ opacity: '0.4', fontSize: '0.75rem' }));

      ['customers', 'leads', 'deals', 'quotes'].forEach((t) => {
        const btn = el('button').attr('type', 'button').css(exportBtnStyle);
        btn.child(el('i').class('fas fa-table'));
        btn.child(el('span').text(t));
        btn.click(() => {
          if (typeof CrmExport === 'undefined') return reportToast('Modul export belum dimuat', 'error');
          CrmExport.runExport(() => CrmExport.exportTableXlsx(t));
        });
        exportWrap.child(btn);
      });
      heroRow.child(heroText);
      heroRow.child(exportWrap);
      hero.child(heroRow);
      const updatedAt = el('p').text('').css({ margin: '0.75rem 0 0', fontSize: '0.75rem', opacity: '0.7' });
      hero.child(updatedAt);
      root.child(hero);

      const body = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1.25rem' });
      body.child(el('p').text('Memuat laporan...').css({ color: '#64748b', textAlign: 'center', padding: '2rem' }));
      root.child(body);
      root.get();

      fetch(`${window.location.origin}/api/reports/sales`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((res) => {
          body.empty();
          if (!res.success || !res.data) {
            body.child(el('p').text(res.error || 'Gagal memuat laporan').css({ color: '#dc2626', padding: '1rem' }));
            body.get();
            return;
          }

          const d = res.data;
          lastReport = d;
          if (d.generatedAt) {
            const dt = new Date(d.generatedAt);
            updatedAt.text(`Diperbarui: ${dt.toLocaleString('id-ID')}`);
          }

          const kpiGrid = el('div').css({
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
          });
          kpiGrid.child(buildKpiCard({
            icon: 'fas fa-trophy',
            label: 'Revenue Won',
            value: formatCurrency(d.revenueWon),
            subtext: `${formatNumber(d.dealsWon)} deal menang`,
            color: '#16a34a'
          }));
          kpiGrid.child(buildKpiCard({
            icon: 'fas fa-chart-line',
            label: 'Pipeline Terbuka',
            value: formatCurrency(d.revenueOpen),
            subtext: `${formatNumber(d.dealsOpen)} deal aktif`,
            color: '#2563eb'
          }));
          kpiGrid.child(buildKpiCard({
            icon: 'fas fa-scale-balanced',
            label: 'Weighted Pipeline',
            value: formatCurrency(d.weightedPipeline),
            subtext: 'Nilai × probabilitas',
            color: '#0891b2'
          }));
          kpiGrid.child(buildKpiCard({
            icon: 'fas fa-percent',
            label: 'Win Rate',
            value: `${d.winRate || 0}%`,
            subtext: `${d.dealsWon}W / ${d.dealsLost}L`,
            color: '#ca8a04'
          }));
          kpiGrid.child(buildKpiCard({
            icon: 'fas fa-coins',
            label: 'Avg Deal Size',
            value: formatCurrency(d.avgDealSize),
            color: '#7c3aed'
          }));
          kpiGrid.child(buildKpiCard({
            icon: 'fas fa-user-plus',
            label: 'Konversi Lead',
            value: `${d.leadConversionRate || 0}%`,
            subtext: `${formatNumber(d.leadsConverted)} / ${formatNumber(d.totalLeads)}`,
            color: '#ea580c'
          }));
          body.child(kpiGrid);

          const chartsRow = el('div').css({
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
          });
          chartsRow.child(buildPipelineChart(d.pipelineByStage || []));
          chartsRow.child(buildWinLossChart(d.dealsWon || 0, d.dealsLost || 0));
          body.child(chartsRow);

          const midRow = el('div').css({
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
          });
          midRow.child(buildSourceChart(d.leadsBySource || []));
          midRow.child(buildQuotesPanel(d.quotesByStatus || []));
          body.child(midRow);

          body.child(buildTopDealsTable(d.topDeals || []));
          body.get();
        })
        .catch((err) => {
          body.empty();
          body.child(
            el('p').text(`Tidak dapat memuat laporan: ${err.message}`).css({
              color: '#dc2626',
              padding: '1.5rem',
              textAlign: 'center'
            })
          );
          body.get();
        });

      return root;
    });
  }

  registerCrmReports();
})(typeof window !== 'undefined' ? window : global);
