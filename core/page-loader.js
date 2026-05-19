(function (global) {
  'use strict';

  const API_BASE = () => (typeof window !== 'undefined' ? window.location.origin : '');

  // Halaman inti — dimuat segera setelah login (1 request bulk)
  const EAGER_PATHS = [
    '/',
    '/personal',
    '/tambahbio',
    '/family',
    '/working',
    '/skillcondition',
    '/pengalaman',
    '/dokumen',
    '/disnaker',
    '/medical',
    '/paspor',
    '/majikan',
    '/visa',
    '/skck',
    '/printsurat',
    '/about'
  ];

  const PageLoader = {
    EAGER_PATHS,

    applyPageConfig(core, pageConfig) {
      if (!pageConfig?.path) return;
      if (pageConfig.type === 'crud') {
        core.addCrudPage(pageConfig.path, pageConfig.config, pageConfig.options || {});
      } else if (pageConfig.type === 'page') {
        core.addPage(pageConfig.path, pageConfig.config, pageConfig.options || {});
      }
    },

    async fetchPageByPath(path) {
      const res = await fetch(
        `${API_BASE()}/api/pages/by-path?path=${encodeURIComponent(path)}`,
        { credentials: 'include' }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || `Halaman ${path} tidak ditemukan`);
      return json.data;
    },

    async fetchBulk(paths) {
      if (!paths.length) return [];
      const res = await fetch(`${API_BASE()}/api/pages/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memuat halaman');
      return json.data || [];
    },

    async fetchManifest() {
      const res = await fetch(`${API_BASE()}/api/pages`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memuat daftar halaman');
      return json.data || [];
    },

    mountPageConfig(core, pageConfig) {
      if (pageConfig.type === 'crud') {
        const crud = CrudEngine.build(pageConfig.config, {
          apiClient: core.apiClient,
          permissions: pageConfig.options?.permissions || null
        });
        const resource = pageConfig.config?.resource;
        if (resource) {
          core.crudPages = core.crudPages || {};
          core.crudPages[resource] = {
            schema: pageConfig.config,
            apiClient: core.apiClient,
            instance: crud
          };
        }
        return crud.get();
      }

      const pageSchema = pageConfig.config?.type
        ? pageConfig.config
        : { type: 'page', ...pageConfig.config };
      return UiBuilder.build(pageSchema, {
        data: pageConfig.options?.data || {},
        actions: pageConfig.options?.actions || {},
        apiClient: core.apiClient
      }).get();
    },

    registerLazyRoute(core, path, pageName) {
      core._lazyRoutes = core._lazyRoutes || {};
      core._lazyRoutes[path] = pageName;
      core._pageConfigCache = core._pageConfigCache || {};

      layout.addPage({
        path,
        component: async () => {
          try {
            let pageConfig = core._pageConfigCache[path];
            if (!pageConfig) {
              if (pageName && core.apiClient) {
                const res = await core.apiClient.read(`pages/${pageName}`);
                pageConfig = res?.data || res;
              } else {
                pageConfig = await PageLoader.fetchPageByPath(path);
              }
              PageLoader.applyPageConfig(core, pageConfig);
              core._pageConfigCache[path] = pageConfig;
            }
            return PageLoader.mountPageConfig(core, pageConfig);
          } catch (err) {
            console.error('Lazy page load failed:', path, err);
            return el('div').css({ padding: '2rem', color: '#dc2626' })
              .text(err.message || 'Gagal memuat halaman.').get();
          }
        },
        pageContentPadding: '0'
      });
    },

    collectMenuPaths(menuItems, out) {
      if (!menuItems) return;
      menuItems.forEach((item) => {
        if (item.page) out.add(item.page);
        if (item.children) PageLoader.collectMenuPaths(item.children, out);
      });
    },

    async bootstrap(core) {
      const manifest = await PageLoader.fetchManifest();
      const menuPaths = new Set();
      PageLoader.collectMenuPaths(core.layoutConfig?.sideMenu, menuPaths);

      let bulkPages = [];
      try {
        bulkPages = await PageLoader.fetchBulk(EAGER_PATHS);
      } catch (err) {
        console.warn('[PageLoader] bulk gagal, muat per halaman:', err.message);
        bulkPages = await Promise.all(
          EAGER_PATHS.map((p) => PageLoader.fetchPageByPath(p).catch(() => null))
        );
        bulkPages = bulkPages.filter(Boolean);
      }
      bulkPages.forEach((cfg) => PageLoader.applyPageConfig(core, cfg));

      const loadedPaths = new Set(bulkPages.map((p) => p.path).filter(Boolean));
      EAGER_PATHS.forEach((p) => loadedPaths.add(p));

      const allPaths = new Set();
      manifest.forEach((m) => {
        if (m.path) allPaths.add(m.path);
      });
      menuPaths.forEach((p) => allPaths.add(p));

      let lazyCount = 0;
      allPaths.forEach((path) => {
        if (!path || path === '/login' || path.includes(':')) return;
        if (loadedPaths.has(path)) return;
        const entry = manifest.find((m) => m.path === path);
        PageLoader.registerLazyRoute(core, path, entry?.name || null);
        lazyCount += 1;
      });

      console.log(`[PageLoader] Dimuat awal: ${loadedPaths.size}, lazy (saat diklik): ${lazyCount}`);
    }
  };

  global.PageLoader = PageLoader;
})(typeof window !== 'undefined' ? window : global);
