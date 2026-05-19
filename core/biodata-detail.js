(function (global) {
  'use strict';

  function parseHashParts() {
    const raw = (window.location.hash || '#/').replace(/^#/, '');
    const path = raw.split('?')[0] || '/';
    const query = raw.includes('?') ? raw.split('?')[1] : '';
    return { path, query };
  }

  function parseRouteContext() {
    const { path } = parseHashParts();
    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'biodata' || !parts[1]) {
      return { idBiodata: '', mode: 'biodata' };
    }
    let mode = 'biodata';
    if (parts[2] === 'admin') mode = 'admin';
    else if (parts[2] === 'upload') mode = 'upload';
    return {
      idBiodata: decodeURIComponent(parts[1]),
      mode
    };
  }

  function parseIdBiodataFromHash() {
    return parseRouteContext().idBiodata;
  }

  function parseInitialTabFromHash(defaultTab) {
    const { query } = parseHashParts();
    if (!query) return defaultTab || '';
    return new URLSearchParams(query).get('tab') || defaultTab || '';
  }

  function detailHashPath(idBiodata, mode, tabKey, defaultTab) {
    let base = '/biodata/' + encodeURIComponent(idBiodata);
    if (mode === 'admin') base += '/admin';
    else if (mode === 'upload') base += '/upload';
    const def = defaultTab || (mode === 'admin' ? 'fiskal' : mode === 'upload' ? 'upload' : 'personal');
    if (tabKey && tabKey !== def) {
      return base + '?tab=' + encodeURIComponent(tabKey);
    }
    return base;
  }

  function syncTabInHash(idBiodata, mode, tabKey, defaultTab) {
    const next = detailHashPath(idBiodata, mode, tabKey, defaultTab);
    const current = (window.location.hash || '#/').replace(/^#/, '');
    if (current !== next) {
      window.history.replaceState(null, '', '#' + next);
    }
  }

  function mountChildren(wrapper, nodes) {
    wrapper.empty();
    const list = Array.isArray(nodes) ? nodes : [nodes];
    list.forEach((n) => {
      if (n != null) wrapper.child(n);
    });
    wrapper.get();
  }

  function loadBiodataTabPanel(tabKey, detail, idBiodata, onRefresh) {
    const slot = el('div').css({ minHeight: '120px' });
    slot.child(el('p').text('Memuat...').css({ color: '#64748b', fontSize: '0.875rem', padding: '1rem 0' }));
    if (typeof BiodataTabEditor === 'undefined') {
      mountChildren(slot, el('p').text('Modul editor belum dimuat.').css({ color: '#dc2626' }));
      return slot;
    }
    BiodataTabEditor.buildPanel(tabKey, { idBiodata, detail, onRefresh })
      .then((panel) => mountChildren(slot, panel))
      .catch((err) => {
        mountChildren(slot, el('p').text(err.message || 'Gagal memuat tab.').css({ color: '#dc2626' }));
      });
    return slot;
  }

  function loadAdminTabPanel(tabKey, detail, idBiodata, onRefresh) {
    const slot = el('div').css({ minHeight: '120px' });
    slot.child(el('p').text('Memuat...').css({ color: '#64748b', fontSize: '0.875rem', padding: '1rem 0' }));
    if (typeof BiodataTabEditor === 'undefined') {
      mountChildren(slot, el('p').text('Modul administrasi belum dimuat.').css({ color: '#dc2626' }));
      return slot;
    }
    BiodataTabEditor.buildAdminPanel(tabKey, { idBiodata, detail, onRefresh })
      .then((panel) => mountChildren(slot, panel))
      .catch((err) => {
        mountChildren(slot, el('p').text(err.message || 'Gagal memuat modul admin.').css({ color: '#dc2626' }));
      });
    return slot;
  }

  function statusBadge(status) {
    const colors = {
      PROSES: { bg: '#dbeafe', fg: '#1d4ed8' },
      TERPILIH: { bg: '#ede9fe', fg: '#6d28d9' },
      TERBANG: { bg: '#dcfce7', fg: '#15803d' },
      PENDING: { bg: '#fef3c7', fg: '#b45309' }
    };
    const c = colors[status] || { bg: '#f1f5f9', fg: '#475569' };
    return el('span').text(status || '-').css({
      display: 'inline-block',
      padding: '0.2rem 0.55rem',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: '600',
      backgroundColor: c.bg,
      color: c.fg
    });
  }

  function buildSidePanel(detail, idBiodata, mode) {
    const aside = el('aside').css({
      flex: '0 0 220px',
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    });
    if (typeof BiodataTabEditor !== 'undefined' && BiodataTabEditor.buildKelengkapanPanel && mode === 'biodata') {
      aside.child(BiodataTabEditor.buildKelengkapanPanel(detail));
    }
    if (typeof DocumentPrintPanel !== 'undefined' && idBiodata) {
      aside.child(DocumentPrintPanel.buildCompact({ idBiodata, detail }));
    }
    return aside;
  }

  function createDetailPage(mode) {
    const isAdmin = mode === 'admin';
    const isUpload = mode === 'upload';
    const defaultTab = isAdmin ? 'fiskal' : isUpload ? 'upload' : 'personal';

    return () => {
      const { idBiodata } = parseRouteContext();
      const root = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%'
      });

      const backBtn = el('button').attr('type', 'button').css({
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.45rem 0.85rem',
        borderRadius: '0.5rem',
        border: '1px solid #cbd5e1',
        background: '#fff',
        color: '#334155',
        fontSize: '0.8125rem',
        fontWeight: '600',
        cursor: 'pointer'
      });
      backBtn.child(el('i').class('fas fa-arrow-left'));
      const backLabel = isUpload ? 'Kembali ke Data Dokumen' : isAdmin ? 'Kembali ke Data Administrasi' : 'Kembali ke Data Personal';
      backBtn.child(el('span').text(backLabel));
      backBtn.click(() => {
        if (isUpload) layout.navigate('/personaldokumen');
        else if (isAdmin) layout.navigate('/personaladmin');
        else layout.navigate('/personal');
      });
      root.child(backBtn);

      const body = el('div').css({ display: 'flex', flexDirection: 'column', gap: '1rem' });
      body.child(el('div').text('Memuat...').css({ padding: '2rem', textAlign: 'center', color: '#64748b' }));
      root.child(body);

      if (!idBiodata) {
        mountChildren(body, el('div').text('ID biodata tidak valid.').css({ color: '#dc2626', padding: '1rem' }));
        return root.get();
      }

      const apiBase = window.location?.origin || '';
      fetch(`${apiBase}/api/biodata/${encodeURIComponent(idBiodata)}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((res) => {
          if (!res.success || !res.data?.personal) {
            mountChildren(body, el('div').text(res.error || 'Biodata tidak ditemukan.').css({ color: '#dc2626', padding: '1rem' }));
            return;
          }

          let d = res.data;
          let p = d.personal;

          const hero = el('div').css({
            borderRadius: '1rem',
            padding: '1.5rem 1.75rem',
            background: isAdmin
              ? 'linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #ea580c 100%)'
              : isUpload
                ? 'linear-gradient(135deg, #14532d 0%, #15803d 50%, #22c55e 100%)'
                : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
            color: '#fff',
            boxShadow: isAdmin
              ? '0 10px 32px rgba(234, 88, 12, 0.35)'
              : isUpload
                ? '0 10px 32px rgba(34, 197, 94, 0.35)'
                : '0 10px 32px rgba(37, 99, 235, 0.3)'
          });

          const heroTop = el('div').css({
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem'
          });

          let heroAvatarWrap = null;
          function syncHeroAvatar(fotoPath) {
            if (isAdmin || isUpload) return;
            const show = typeof PersonalFotoPanel !== 'undefined'
              && PersonalFotoPanel.isRealFoto(fotoPath)
              && /\.(jpe?g|png|gif|webp)$/i.test(String(fotoPath || ''));
            if (!show) {
              if (heroAvatarWrap) { heroAvatarWrap.remove(); heroAvatarWrap = null; }
              return;
            }
            if (!heroAvatarWrap) {
              heroAvatarWrap = el('div').css({
                width: '88px', height: '110px', flexShrink: '0',
                borderRadius: '0.65rem', overflow: 'hidden',
                border: '3px solid rgba(255,255,255,0.5)'
              });
              heroAvatarWrap.child(
                el('img').attr('src', fotoPath).attr('alt', p.nama || '').css({
                  width: '100%', height: '100%', objectFit: 'cover'
                })
              );
              heroTop.child(heroAvatarWrap);
              const host = heroTop.get();
              const node = heroAvatarWrap.get();
              if (host && node && host.firstChild !== node) {
                host.insertBefore(node, host.firstChild);
              }
            } else {
              const img = heroAvatarWrap.get()?.querySelector('img');
              if (img) img.src = fotoPath;
            }
          }
          if (!isAdmin && !isUpload) syncHeroAvatar(p.foto);

          const titleBlock = el('div');
          const modeTitle = isAdmin ? 'Administrasi TKI' : isUpload ? 'Upload Dokumen TKI' : 'Detail Biodata TKI';
          titleBlock.child(el('div').text(modeTitle).css({
            fontSize: '0.75rem', fontWeight: '600', opacity: '0.85',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem'
          }));
          const nameHeading = el('h1').text(p.nama || '-').css({
            margin: '0 0 0.35rem',
            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
            fontWeight: '800'
          });
          titleBlock.child(nameHeading);
          titleBlock.child(el('div').text(p.id_biodata || idBiodata).css({
            fontSize: '0.95rem', opacity: '0.9', fontFamily: 'monospace'
          }));

          const badges = el('div').css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' });
          badges.child(statusBadge(p.statusaktif));
          if (Number(p.statterbang) === 1) {
            badges.child(el('span').text('Sudah Terbang').css({
              display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: '999px',
              fontSize: '0.75rem', fontWeight: '600',
              backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff'
            }));
          }
          heroTop.child([titleBlock, badges]);
          hero.child(heroTop);

          const heroActions = el('div').css({
            marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem'
          });

          const linkBtnStyle = (active) => ({
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: active ? 'none' : '2px solid rgba(255,255,255,0.65)',
            background: active ? '#fff' : 'rgba(255,255,255,0.15)',
            color: active ? (isAdmin ? '#9a3412' : isUpload ? '#166534' : '#1e40af') : '#fff',
            fontWeight: '600',
            fontSize: '0.8125rem',
            cursor: 'pointer'
          });

          const biodataLinkBtn = el('button').attr('type', 'button').css(linkBtnStyle(!isAdmin && !isUpload));
          biodataLinkBtn.child(el('i').class('fas fa-user').css({ marginRight: '0.35rem' }));
          biodataLinkBtn.child(el('span').text('Biodata TKI'));
          biodataLinkBtn.click(() => layout.navigate(detailHashPath(idBiodata, 'biodata', 'personal', 'personal')));

          const adminLinkBtn = el('button').attr('type', 'button').css(linkBtnStyle(isAdmin));
          adminLinkBtn.child(el('i').class('fas fa-landmark').css({ marginRight: '0.35rem' }));
          adminLinkBtn.child(el('span').text('Administrasi TKI'));
          adminLinkBtn.click(() => layout.navigate(detailHashPath(idBiodata, 'admin', 'fiskal', 'fiskal')));

          const uploadLinkBtn = el('button').attr('type', 'button').css(linkBtnStyle(isUpload));
          uploadLinkBtn.child(el('i').class('fas fa-cloud-arrow-up').css({ marginRight: '0.35rem' }));
          uploadLinkBtn.child(el('span').text('Upload Dokumen'));
          uploadLinkBtn.click(() => layout.navigate(detailHashPath(idBiodata, 'upload', 'upload', 'upload')));

          heroActions.child([biodataLinkBtn, adminLinkBtn, uploadLinkBtn]);
          hero.child(heroActions);

          let menus;
          if (isUpload) {
            menus = [{ url_menu: 'upload', label_menu: 'Hub Upload (42 jenis)', icon_menu: 'fas fa-cloud-arrow-up' }];
          } else if (isAdmin) {
            menus = (typeof BiodataTabEditor !== 'undefined' && BiodataTabEditor.ADMIN_MENU_TABS)
              ? BiodataTabEditor.ADMIN_MENU_TABS.map((m) => ({
                url_menu: m.key,
                label_menu: m.label,
                icon_menu: m.icon
              }))
              : [{ url_menu: 'fiskal', label_menu: 'FISKAL', icon_menu: 'fas fa-chart-pie' }];
          } else {
            const raw = (d.menuTabs && d.menuTabs.length)
              ? d.menuTabs
              : [{ url_menu: 'personal', label_menu: 'Personal', icon_menu: 'fas fa-user' }];
            menus = typeof BiodataTabEditor !== 'undefined' && BiodataTabEditor.filterBiodataMenus
              ? BiodataTabEditor.filterBiodataMenus(raw)
              : raw.filter((m) => m.url_menu !== 'admin');
          }

          const tabFromUrl = parseInitialTabFromHash(defaultTab);
          let activeTab = menus[0]?.url_menu || defaultTab;
          if (tabFromUrl && menus.some((m) => m.url_menu === tabFromUrl)) {
            activeTab = tabFromUrl;
          }

          const tabBar = el('div').css({
            display: 'flex', flexWrap: 'wrap', gap: '0.35rem',
            padding: '0.35rem',
            background: isAdmin ? '#fff7ed' : isUpload ? '#ecfdf5' : '#f1f5f9',
            borderRadius: '0.75rem',
            border: `1px solid ${isAdmin ? '#fed7aa' : isUpload ? '#bbf7d0' : '#e2e8f0'}`
          });
          const tabPanelSlot = el('div').css({ flex: '1', minWidth: 0 });
          const mainRow = el('div').css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'flex-start'
          });

          const refreshDetail = async () => {
            try {
              const r = await fetch(`${apiBase}/api/biodata/${encodeURIComponent(idBiodata)}`, { credentials: 'include' });
              const fresh = await r.json();
              if (fresh.success && fresh.data) {
                d = fresh.data;
                p = d.personal;
                nameHeading.text(p.nama || '-');
                if (!isAdmin) syncHeroAvatar(p.foto);
                renderTabs();
              }
            } catch (e) {
              console.error('Gagal refresh:', e);
            }
          };

          const renderTabs = () => {
            tabBar.empty();
            const activeColor = isAdmin ? '#ea580c' : isUpload ? '#16a34a' : '#2563eb';
            menus.forEach((m) => {
              const key = m.url_menu;
              const isActive = key === activeTab;
              const btn = el('button').attr('type', 'button').css({
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.45rem 0.75rem', borderRadius: '0.5rem', border: 'none',
                background: isActive ? activeColor : 'transparent',
                color: isActive ? '#fff' : '#475569',
                fontSize: '0.8125rem', fontWeight: '600', cursor: 'pointer'
              });
              if (m.icon_menu) btn.child(el('i').class(m.icon_menu));
              btn.child(el('span').text(m.label_menu));
              btn.click(() => {
                activeTab = key;
                syncTabInHash(idBiodata, mode, activeTab, defaultTab);
                renderTabs();
              });
              tabBar.child(btn);
            });
            tabBar.get();
            let panel;
            if (isAdmin) panel = loadAdminTabPanel(activeTab, d, idBiodata, refreshDetail);
            else panel = loadBiodataTabPanel(activeTab, d, idBiodata, refreshDetail);
            mountChildren(tabPanelSlot, panel);
          };

          renderTabs();
          mainRow.child(tabPanelSlot);
          if (!isUpload) mainRow.child(buildSidePanel(d, idBiodata, mode));
          mountChildren(body, [hero, tabBar, mainRow]);
        })
        .catch(() => {
          mountChildren(body, el('div').text('Gagal memuat biodata.').css({ color: '#dc2626', padding: '1rem' }));
        });

      return root.get();
    };
  }

  function registerBiodataDetailPages() {
    if (typeof layout === 'undefined') return;

    layout.addPage({
      path: '/biodata/:id_biodata',
      pageContentPadding: '1rem',
      component: createDetailPage('biodata')
    });

    layout.addPage({
      path: '/biodata/:id_biodata/admin',
      pageContentPadding: '1rem',
      component: createDetailPage('admin')
    });

    layout.addPage({
      path: '/biodata/:id_biodata/upload',
      pageContentPadding: '1rem',
      component: createDetailPage('upload')
    });
  }

  registerBiodataDetailPages();

  if (typeof window !== 'undefined') {
    window.registerBiodataDetailPages = registerBiodataDetailPages;
  }
})(typeof window !== 'undefined' ? window : global);
