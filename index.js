// ============================================
// Core App - JSON-Driven UI Framework
// ============================================
// Schema:  /schema folder  → database DDL (SchemaManager)
// AppJSON: /appjson folder → UI pages & CRUD configs
// ============================================

const API_BASE = window.location.origin;

// ============================================
// Load Menu from API
// ============================================
async function loadMenuConfig(core) {
  try {
    console.log('Loading menu configuration from /api/menu...');
    const response = await fetch(`${API_BASE}/api/menu`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load menu config');
    }
    
    const menuConfig = result.data;
    
    // Update core with menu configuration
    if (menuConfig.sideMenu) {
      core.layoutConfig.sideMenu = menuConfig.sideMenu;
    }
    if (menuConfig.navbar) {
      core.layoutConfig.navbar = menuConfig.navbar;
    }
    if (menuConfig.theme) {
      core.layoutConfig.theme = menuConfig.theme;
    }
    if (menuConfig.navbarTitle) {
      core.layoutConfig.navbarTitle = menuConfig.navbarTitle;
    }
    
    console.log('✓ Menu configuration loaded');
    return menuConfig;
  } catch (error) {
    console.warn('Failed to load menu config, using defaults:', error);
    return null;
  }
}

function getDocumentationSideMenu() {
  return [
    {
      name: 'Dokumentasi',
      icon: 'fas fa-book-open',
      page: '/'
    },
    {
      name: 'Admin Dokumentasi',
      icon: 'fas fa-folder-tree',
      roles: ['admin'],
      children: [
        { name: 'Daftar Dokumen', icon: 'fas fa-list', page: '/admin', roles: ['admin'] },
        { name: 'Buat Dokumen', icon: 'fas fa-plus', page: '/admin/create', roles: ['admin'] }
      ]
    }
  ];
}

// Muat menu, schema, halaman TKI setelah login (tanpa reload halaman)
async function bootstrapAuthenticatedApp(core, user) {
  if (core._authBootstrapped) {
    return;
  }

  await loadMenuConfig(core);

  if (core.layoutConfig.sideMenu?.length) {
    layout.addSideMenu(core.layoutConfig.sideMenu);
  }
  if (core.layoutConfig.navbar?.length) {
    layout.addNavbar(core.layoutConfig.navbar);
  }
  if (core.layoutConfig.theme) {
    layout.setTheme(core.layoutConfig.theme);
  }
  if (core.layoutConfig.navbarTitle) {
    layout.setNavbarTitle(core.layoutConfig.navbarTitle);
  }

  const role = user?.role || 'admin';
  if (typeof CrmRbac !== 'undefined') {
    CrmRbac.setRole(role);
  }
  if (typeof layout.setRole === 'function') {
    layout.setRole(role);
  }

  try {
    if (typeof PageLoader !== 'undefined') {
      await PageLoader.bootstrap(core);
    } else {
      console.warn('PageLoader tidak ditemukan — halaman appjson tidak dimuat.');
    }
  } catch (err) {
    console.error('Gagal memuat halaman app:', err);
  }

  if (typeof registerBiodataDetailPage === 'function') {
    registerBiodataDetailPage();
  }

  if (typeof PrintDataRegistry !== 'undefined' && PrintDataRegistry.registerPrintLegacyPages) {
    await PrintDataRegistry.registerPrintLegacyPages(core);
  }

  registerPrintSuratPage(core);

  if (typeof TestOcrKtpPage !== 'undefined' && TestOcrKtpPage.registerTestOcrKtpPage) {
    TestOcrKtpPage.registerTestOcrKtpPage();
  }

  loadHardcodedPages(core, user);
  core.layoutConfig.sideMenu = getDocumentationSideMenu();
  layout.addSideMenu(core.layoutConfig.sideMenu);
  if (typeof layout.setNavbarTitle === 'function') {
    layout.setNavbarTitle('Dokumentasi');
  }
  core._authBootstrapped = true;
}

// ============================================
// Main App Initialization
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
  
  console.log('Loading Core App...');

  const currentHash = () => {
    let h = window.location.hash.replace('#', '') || '/';
    if (!h.startsWith('/')) h = '/' + h;
    return h;
  };

  // Cek sesi dari cookie HttpOnly (GET /api/auth/me)
  let sessionUser = null;
  if (typeof CrmAuth !== 'undefined') {
    try {
      sessionUser = await CrmAuth.me();
    } catch {
      sessionUser = null;
    }
  }

  // Define public routes that don't require authentication
  const publicRoutes = ['/', '/login'];
  const isPublicRoute = publicRoutes.some(route => currentHash() === route || currentHash().startsWith('/doc/'));

  // Redirect to login only if not authenticated AND not on a public route
  if (!sessionUser && !isPublicRoute) {
    window.location.hash = '#/login';
  }

  const core = new CoreApp({
    api: {
      baseUrl: `${API_BASE}/api`,
      token: () => null
    },
    layout: {
      theme: 'blue',
      sideMenu: [],
      navbar: []
    }
  });

  window.flamboyanApp = { core, bootstrapAuthenticatedApp };

  // Register public documentation pages (always, regardless of auth status)
  registerDocHomePage(core);
  registerDocViewerPage(core);

  registerLoginPage(core);
  // Route admin selalu terdaftar agar hash #/admin memicu renderPage + RBAC (redirect ke /login jika belum login)
  registerDocAdminPage(core);
  registerDocEditorPage(core);

  if (sessionUser) {
    try {
      await bootstrapAuthenticatedApp(core, sessionUser);
    } catch (err) {
      console.error('Bootstrap sesi gagal:', err);
    }
    if (currentHash() === '/login') {
      window.location.hash = '#/';
    }
  }

  console.log('Starting Core App...');
  core.init();

  console.log('✅ Core App initialized successfully!');
});

// Halaman Print Surat (legacy print_data) — registrasi eksplisit agar selalu tersedia
function registerPrintSuratPage(core) {
  if (core._printSuratRegistered) return;

  layout.addPage({
    path: '/printsurat',
    pageContentPadding: '1.25rem',
    component: () => {
      if (typeof DocumentPrintPanel === 'undefined' || !DocumentPrintPanel.buildPrintHub) {
        return el('div').css({ padding: '2rem', color: '#dc2626' })
          .text('Modul Print Surat belum dimuat. Periksa urutan script di index.html.').get();
      }
      return DocumentPrintPanel.buildPrintHub().get();
    }
  });

  core._printSuratRegistered = true;
}

// ============================================
// Hardcoded Pages (special pages)
// ============================================
function loadHardcodedPages(core, sessionUser) {
  if (sessionUser) {
    registerProfilePage(core);
  }

  registerLoginPage(core);
}

// Halaman profil user yang sedang login (dari /api/auth/me)
function registerProfilePage(core) {
  layout.addPage({
    path: '/profile',
    pageContentPadding: '1.5rem',
    component: async () => {
      let user = typeof CrmAuth !== 'undefined' ? CrmAuth.getUser() : null;
      if (!user && typeof CrmAuth !== 'undefined') {
        try {
          user = await CrmAuth.me();
        } catch {
          user = null;
        }
      }

      if (!user) {
        return el('div').css({ padding: '2rem', color: '#64748b' })
          .text('Sesi tidak valid. Silakan login kembali.').get();
      }

      const roleLabel = { admin: 'Administrator', staff: 'Staff Operasional', agen: 'Agen' }[user.role] || user.role;
      const statusLabel = user.status === 'active' ? 'Aktif' : (user.status || '-');

      const row = (label, value) => el('div').css({
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '0.65rem 0',
        borderBottom: '1px solid #f1f5f9'
      }).child([
        el('span').text(label).css({ color: '#64748b', fontSize: '0.875rem' }),
        el('span').text(String(value || '-')).css({ color: '#0f172a', fontWeight: '600', fontSize: '0.875rem', textAlign: 'right' })
      ]);

      const avatar = el('div').css({
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.75rem',
        fontWeight: '700',
        flexShrink: '0'
      }).text((user.name || user.email || '?').charAt(0).toUpperCase());

      const logoutBtn = el('button').attr('type', 'button').text('Keluar')
        .css({
          padding: '0.6rem 1.25rem',
          borderRadius: '0.5rem',
          border: '1px solid #fecaca',
          background: '#fff',
          color: '#dc2626',
          fontWeight: '600',
          cursor: 'pointer'
        })
        .click(async () => {
          if (typeof CrmAuth !== 'undefined') await CrmAuth.logout();
          if (typeof layout.setRole === 'function') layout.setRole(null);
          window.location.hash = '#/login';
        });

      const dashBtn = el('button').attr('type', 'button').text('Ke Dashboard')
        .css({
          padding: '0.6rem 1.25rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          fontWeight: '600',
          cursor: 'pointer'
        })
        .click(() => layout.navigate('/'));

      const card = el('div').css({

        maxWidth: '640px',
        margin: '0 auto',
        background: '#fff',
        borderRadius: '1rem',
        boxShadow: '0 4px 24px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden'
      }).child([
        el('div').css({
          padding: '1.75rem',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem'
        }).child([
          avatar,
          el('div').child([
            el('h1').text(user.name || 'User').css({ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }),
            el('p').text(user.email || '').css({ margin: 0, color: '#475569', fontSize: '0.9rem' })
          ])
        ]),
        el('div').css({ padding: '1.25rem 1.75rem' }).child([
        row('Role', roleLabel),
        row('Status', statusLabel),
        row('Telepon', user.phone || '-'),
        row('ID Pengguna', user.id)
      ]),

        el('div').css({
          padding: '1rem 1.75rem 1.5rem',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc'
        }).child([dashBtn, logoutBtn])
      ]);

      return el('div').css({ width: '100%' }).child([
        el('h2').text('Profil Saya').css({ margin: '0 0 1.25rem', fontSize: '1.35rem', fontWeight: '700', color: '#0f172a' }),
        card
      ]).get();
    }
  });
}

// ============================================
// Documentation Pages
// ============================================

// Home page - Documentation index
function registerDocHomePage(core) {
  layout.addPage({
    path: '/',
    hideLayout: true,  // Hide navbar & sidebar for clean documentation view
    pageContentPadding: '0',
    component: async () => {
      // Main container with GitBook-like layout
      const container = el('div').css({
        display: 'flex',
        minHeight: '100vh',
        background: '#fff'
      });

      // Left sidebar - Documentation navigation
      const sidebar = el('div').css({
        width: '280px',
        background: '#f6f8fa',
        borderRight: '1px solid #e1e4e8',
        padding: '2rem 0',
        position: 'fixed',
        left: '0',
        top: '0',
        bottom: '0',
        overflowY: 'auto'
      });

      // Logo/Title
      sidebar.child(
        el('div').css({
          padding: '0 1.5rem',
          marginBottom: '2rem'
        }).child([
          el('div').css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.5rem'
          }).child([
            el('i').class('fas fa-book').css({
              fontSize: '1.5rem',
              color: '#2563eb'
            }),
            el('h1').text('Documentation').css({
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#0f172a',
              margin: '0'
            })
          ]),
          el('p').text('System Guide & Reference').css({
            fontSize: '0.875rem',
            color: '#64748b',
            margin: '0'
          })
        ])
      );

      // Admin/Login button in sidebar
      sidebar.child(
        el('div').css({
          padding: '0 1.5rem',
          marginBottom: '1.5rem'
        }).child([
          el('a')
            .attr('href', '#/admin')
            .css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1rem',
              background: '#2563eb',
              color: '#fff',
              borderRadius: '0.375rem',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            })
            .hover(
              (e) => {
                e.currentTarget.style.background = '#1d4ed8';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(37, 99, 235, 0.3)';
              },
              (e) => {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            )
            .child([
              el('i').class('fas fa-lock'),
              el('span').text('Admin Panel')
            ])
        ])
      );

      // Search box
      sidebar.child(
        el('div').css({
          padding: '0 1.5rem',
          marginBottom: '1.5rem'
        }).child([
          el('input')
            .attr('type', 'text')
            .attr('placeholder', 'Search docs...')
            .attr('id', 'doc-search')
            .css({
              width: '100%',
              padding: '0.625rem 0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box'
            })
            .on('focus', (e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
            })
            .on('blur', (e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = 'none';
            })
            .on('input', (e) => {
              const query = e.target.value.toLowerCase();
              const cards = document.querySelectorAll('.doc-card');
              cards.forEach(card => {
                const title = card.querySelector('.doc-title')?.textContent.toLowerCase() || '';
                const desc = card.querySelector('.doc-desc')?.textContent.toLowerCase() || '';
                const match = title.includes(query) || desc.includes(query);
                card.style.display = match ? 'block' : 'none';
              });
            })
        ])
      );

      // Navigation sections (will be populated dynamically)
      const navContent = el('div').css({ padding: '0 1.5rem' });
      sidebar.child(navContent);

      // Main content area
      const mainContent = el('div').css({
        flex: '1',
        marginLeft: '280px',
        padding: '3rem 4rem',
        maxWidth: 'calc(100% - 280px)'
      });

      // Add hover styles for cards
      const hoverStyles = el('style').html(`
        a.doc-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
          border-color: #2563eb !important;
          transform: translateY(-2px) !important;
        }
      `);

      container.child(sidebar);
      container.child(hoverStyles);
      container.child(mainContent);

      // Loading state
      const loadingEl = el('div').css({
        textAlign: 'center',
        padding: '3rem',
        color: '#64748b'
      }).text('Loading documentation...');
      mainContent.child(loadingEl);

      // Fetch docs
      try {
        const response = await fetch('/api/docs');
        const result = await response.json();

        loadingEl.remove();
        mainContent.empty();

        if (!result.success || !result.data || result.data.length === 0) {
          mainContent.child(
            el('div').css({
              textAlign: 'center',
              padding: '4rem 2rem'
            }).child([
              el('i').class('fas fa-book-open').css({
                fontSize: '4rem',
                color: '#d1d5db',
                marginBottom: '1.5rem',
                display: 'block'
              }),
              el('h2').text('Welcome to Documentation').css({
                fontSize: '1.875rem',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '0.75rem'
              }),
              el('p').text('Documentation is being prepared. Check back soon!').css({
                color: '#64748b',
                fontSize: '1rem'
              })
            ])
          );
          mainContent.get();
          return container.get();
        }

        // Hero section
        const hero = el('div').css({
          marginBottom: '3rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #e1e4e8'
        }).child([
          el('h1').text('Documentation').css({
            fontSize: '2.25rem',
            fontWeight: '800',
            color: '#0f172a',
            marginBottom: '0.75rem'
          }),
          el('p').text('Learn how to use the system effectively with our comprehensive guides and references.').css({
            fontSize: '1.125rem',
            color: '#64748b',
            lineHeight: '1.6'
          })
        ]);
        mainContent.child(hero);

        // Group by category
        const grouped = {};
        result.data.forEach(doc => {
          const cat = doc.category || 'General';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(doc);
        });
        const homeDoc = result.data.find(doc => doc.slug === 'home');

        // Build sidebar navigation
        const navSections = el('div');
        Object.keys(grouped).forEach(category => {
          const section = el('div').css({ marginBottom: '1.5rem' });
          
          section.child(
            el('h3').text(category).css({
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem',
              paddingLeft: '0.5rem'
            })
          );

          const navList = el('div');
          grouped[category].forEach(doc => {
            navList.child(
              el('a')
                .attr('href', doc.slug === 'home' ? '#/' : `#/doc/${doc.slug}`)
                .text(doc.title)
                .css({
                  display: 'block',
                  padding: '0.5rem 0.75rem',
                  color: '#374151',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  borderRadius: '0.375rem',
                  marginBottom: '0.25rem',
                  borderLeft: '2px solid transparent'
                })
                .hover(
                  (e) => {
                    e.currentTarget.style.background = '#e5e7eb';
                    e.currentTarget.style.color = '#2563eb';
                    e.currentTarget.style.borderLeftColor = '#2563eb';
                  },
                  (e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.borderLeftColor = 'transparent';
                  }
                )
            );
          });

          section.child(navList);
          navSections.child(section);
        });
        navContent.child(navSections);
        navContent.get();

        if (homeDoc) {
          const homeResponse = await fetch('/api/docs/home/html');
          const homeResult = await homeResponse.json();
          if (homeResult.success) {
            mainContent.empty();
            const doc = homeResult.data;
            const article = el('article').class('doc-content').css({
              maxWidth: '900px',
              margin: '0 auto'
            });

            article.child([
              el('h1').text(doc.title).css({
                fontSize: '2.25rem',
                fontWeight: '800',
                marginBottom: '0.75rem',
                color: '#0f172a'
              }),
              el('div').css({
                display: 'flex',
                gap: '1.5rem',
                marginBottom: '2.5rem',
                paddingBottom: '1.5rem',
                borderBottom: '2px solid #e1e4e8',
                fontSize: '0.875rem',
                color: '#64748b'
              }).child([
                el('span').child([
                  el('i').class('fas fa-folder').css({ marginRight: '0.5rem' }),
                  el('span').text(doc.category || 'General')
                ]),
                el('span').child([
                  el('i').class('fas fa-clock').css({ marginRight: '0.5rem' }),
                  el('span').text(`Updated ${new Date(doc.updatedAt).toLocaleDateString()}`)
                ])
              ])
            ]);

            const articleNode = article.get();
            articleNode.insertAdjacentHTML('beforeend', doc.html || '');
            mainContent.child(el('style').html(`
              article.doc-content h2 { font-size: 1.875rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 1rem; color: #0f172a; padding-bottom: 0.5rem; border-bottom: 2px solid #e1e4e8; }
              article.doc-content h3 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; color: #0f172a; }
              article.doc-content p { font-size: 1rem; line-height: 1.75; color: #374151; margin-bottom: 1.25rem; }
              article.doc-content ul, article.doc-content ol { margin-bottom: 1.25rem; padding-left: 2rem; }
              article.doc-content ul { list-style-type: disc; }
              article.doc-content ol { list-style-type: decimal; }
              article.doc-content li { display: list-item; margin-bottom: 0.5rem; line-height: 1.75; color: #374151; }
              article.doc-content pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 0.5rem; padding: 1.25rem; overflow-x: auto; margin-bottom: 1.5rem; }
              article.doc-content code { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 0.375rem; padding: 0.2rem 0.4rem; font-size: 0.875rem; color: #24292e; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
              article.doc-content pre code { background: transparent; border: none; padding: 0; }
              article.doc-content blockquote { border-left: 4px solid #2563eb; padding: 1rem 1.5rem; margin: 1.5rem 0; background: #f0f9ff; border-radius: 0 0.5rem 0.5rem 0; }
              article.doc-content img { max-width: 100%; border-radius: 0.5rem; border: 1px solid #e1e4e8; margin: 1.5rem 0; }
              article.doc-content table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
              article.doc-content th, article.doc-content td { border: 1px solid #e1e4e8; padding: 0.75rem; text-align: left; }
              article.doc-content th { background: #f6f8fa; font-weight: 600; }
              article.doc-content a { color: #2563eb; text-decoration: none; }
              article.doc-content a:hover { text-decoration: underline; }
              article.doc-content hr { border: none; border-top: 2px solid #e1e4e8; margin: 2rem 0; }
            `));
            mainContent.child(articleNode);
            mainContent.get();
            setTimeout(() => {
              if (window.Prism) Prism.highlightAll();
            }, 100);
            return container.get();
          }
        }

        // Render categories in main content
        Object.keys(grouped).forEach(category => {
          const section = el('div').css({ marginBottom: '3rem' });

          section.child(
            el('h2').text(category).css({
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1.5rem',
              color: '#0f172a',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e1e4e8'
            })
          );

          const grid = el('div').css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem'
          });

          grouped[category].filter(doc => doc.slug !== 'home').forEach(doc => {
            const card = el('a')
              .attr('href', `#/doc/${doc.slug}`)
              .class('doc-card')
              .css({
                display: 'block',
                padding: '1.5rem',
                background: '#fff',
                borderRadius: '0.5rem',
                border: '1px solid #e1e4e8',
                textDecoration: 'none',
                transition: 'all 0.2s',
                cursor: 'pointer'
              })
              .child([
                el('h3').text(doc.title).class('doc-title').css({
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#0f172a'
                }),
                el('p').text(doc.description || 'No description available').class('doc-desc').css({
                  color: '#64748b',
                  fontSize: '0.875rem',
                  lineHeight: '1.6',
                  marginBottom: '1rem'
                }),
                el('div').css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#94a3b8'
                }).child([
                  el('i').class('fas fa-clock'),
                  el('span').text(`Updated ${new Date(doc.updatedAt).toLocaleDateString()}`)
                ])
              ]);

            grid.child(card);
          });

          section.child(grid);
          mainContent.child(section);
        });
        mainContent.get();
      } catch (error) {
        console.error('Failed to load documentation:', error);
        loadingEl.remove();
        mainContent.empty().child(
          el('div')
            .text('Failed to load documentation. Please try again later.')
            .css({ textAlign: 'center', padding: '3rem', color: '#dc2626' })
        );
        mainContent.get();
      }

      return container.get();
    }
  });
}

// Documentation viewer page
function registerDocViewerPage(core) {
  layout.addPage({
    path: '/doc/:slug',
    hideLayout: true,  // Hide navbar & sidebar for clean reading experience
    pageContentPadding: '0',
    component: async () => {
      // Parse slug from URL
      const hash = window.location.hash.replace('#', '');
      const parts = hash.split('/');
      const slug = parts[2];

      // Main container with GitBook-style layout
      const container = el('div').css({
        display: 'flex',
        minHeight: '100vh',
        background: '#fff'
      });

      // Left sidebar - Table of Contents
      const sidebar = el('div').css({
        width: '280px',
        background: '#f6f8fa',
        borderRight: '1px solid #e1e4e8',
        padding: '1.5rem 0',
        position: 'fixed',
        left: '0',
        top: '0',
        bottom: '0',
        overflowY: 'auto'
      });

      // Back button
      sidebar.child(
        el('div').css({
          padding: '0 1.5rem',
          marginBottom: '1.5rem'
        }).child([
          el('a')
            .attr('href', '#/')
            .css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#64748b',
              fontSize: '0.875rem',
              textDecoration: 'none',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db'
            })
            .hover(
              (e) => {
                e.currentTarget.style.background = '#e5e7eb';
                e.currentTarget.style.color = '#2563eb';
              },
              (e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }
            )
            .child([
              el('i').class('fas fa-arrow-left'),
              el('span').text('Back to Docs')
            ])
        ])
      );

      // TOC header
      sidebar.child(
        el('div').css({
          padding: '0 1.5rem',
          marginBottom: '1rem'
        }).child([
          el('h3').text('Table of Contents').css({
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '0'
          })
        ])
      );

      // TOC content (will be populated dynamically)
      const tocContent = el('div').css({ padding: '0 1.5rem' });
      sidebar.child(tocContent);

      // Main content area
      const mainContent = el('div').css({
        flex: '1',
        marginLeft: '280px',
        padding: '3rem 4rem 4rem 4rem',
        maxWidth: 'calc(100% - 280px)'
      });

      container.child(sidebar);
      container.child(mainContent);

      // Loading state
      const loadingEl = el('div').css({
        textAlign: 'center',
        padding: '3rem',
        color: '#64748b'
      }).text('Loading documentation...');
      mainContent.child(loadingEl);

      try {
        // Fetch doc HTML
        const response = await fetch(`/api/docs/${slug}/html`);
        const result = await response.json();

        loadingEl.remove();
        mainContent.empty();

        if (!result.success) {
          mainContent.child(
            el('div').css({
              textAlign: 'center',
              padding: '4rem 2rem'
            }).child([
              el('i').class('fas fa-exclamation-circle').css({
                fontSize: '3rem',
                color: '#d1d5db',
                marginBottom: '1rem',
                display: 'block'
              }),
              el('h2').text('Page Not Found').css({
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#0f172a',
                marginBottom: '0.5rem'
              }),
              el('p').text('This documentation page does not exist.').css({
                color: '#64748b',
                marginBottom: '1.5rem'
              }),
              el('a')
                .attr('href', '#/')
                .css({
                  display: 'inline-block',
                  padding: '0.625rem 1.25rem',
                  background: '#2563eb',
                  color: '#fff',
                  borderRadius: '0.375rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                })
                .text('← Back to Documentation')
            ])
          );
          mainContent.get();
          return container.get();
        }

        const doc = result.data;

        // Build TOC in sidebar
        if (doc.toc && doc.toc.length > 0) {
          const tocList = el('div');
          doc.toc.forEach((item, index) => {
            const indent = item.level === 1 ? '0' : '1rem';
            tocList.child(
              el('a')
                .attr('href', `#${item.id}`)
                .text(item.text)
                .css({
                  display: 'block',
                  padding: '0.4rem 0.75rem',
                  paddingLeft: indent,
                  color: '#374151',
                  fontSize: item.level === 1 ? '0.875rem' : '0.8125rem',
                  textDecoration: 'none',
                  borderRadius: '0.375rem',
                  marginBottom: '0.25rem',
                  borderLeft: '2px solid transparent',
                  fontWeight: item.level === 1 ? '500' : 'normal'
                })
                .hover(
                  (e) => {
                    e.currentTarget.style.background = '#e5e7eb';
                    e.currentTarget.style.color = '#2563eb';
                    e.currentTarget.style.borderLeftColor = '#2563eb';
                  },
                  (e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.borderLeftColor = 'transparent';
                  }
                )
                .click((e) => {
                  e.preventDefault();
                  const target = document.getElementById(item.id);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                })
            );
          });
          tocContent.child(tocList);
          tocContent.get();
        } else {
          tocContent.child(
            el('p').text('No sections available').css({
              fontSize: '0.875rem',
              color: '#94a3b8',
              padding: '0 0.75rem'
            })
          );
          tocContent.get();
        }

        // Article container
        const article = el('article').css({
          maxWidth: '900px',
          margin: '0 auto'
        });

        // Add title and metadata
        article.child([
          el('h1').text(doc.title).css({
            fontSize: '2.25rem',
            fontWeight: '800',
            marginBottom: '0.75rem',
            color: '#0f172a'
          }),
          el('div').css({
            display: 'flex',
            gap: '1.5rem',
            marginBottom: '2.5rem',
            paddingBottom: '1.5rem',
            borderBottom: '2px solid #e1e4e8',
            fontSize: '0.875rem',
            color: '#64748b'
          }).child([
            el('span').child([
              el('i').class('fas fa-folder').css({ marginRight: '0.5rem' }),
              el('span').text(doc.category || 'General')
            ]),
            el('span').child([
              el('i').class('fas fa-clock').css({ marginRight: '0.5rem' }),
              el('span').text(`Updated ${new Date(doc.updatedAt).toLocaleDateString()}`)
            ])
          ])
        ]);

        // Render HTML content setelah metadata queued dipasang ke article.
        article.class('doc-content');
        const articleNode = article.get();
        articleNode.insertAdjacentHTML('beforeend', doc.html || '');

        // Apply GitBook-like styling to content
        const contentStyles = el('style').html(`
          article.doc-content h2 { font-size: 1.875rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 1rem; color: #0f172a; padding-bottom: 0.5rem; border-bottom: 2px solid #e1e4e8; }
          article.doc-content h3 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; color: #0f172a; }
          article.doc-content p { font-size: 1rem; line-height: 1.75; color: #374151; margin-bottom: 1.25rem; }
          article.doc-content ul, article.doc-content ol { margin-bottom: 1.25rem; padding-left: 2rem; }
          article.doc-content ul { list-style-type: disc; }
          article.doc-content ol { list-style-type: decimal; }
          article.doc-content li { display: list-item; margin-bottom: 0.5rem; line-height: 1.75; color: #374151; }
          article.doc-content pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 0.5rem; padding: 1.25rem; overflow-x: auto; margin-bottom: 1.5rem; }
          article.doc-content code { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 0.375rem; padding: 0.2rem 0.4rem; font-size: 0.875rem; color: #24292e; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
          article.doc-content pre code { background: transparent; border: none; padding: 0; }
          article.doc-content blockquote { border-left: 4px solid #2563eb; padding: 1rem 1.5rem; margin: 1.5rem 0; background: #f0f9ff; border-radius: 0 0.5rem 0.5rem 0; }
          article.doc-content blockquote p { margin: 0; color: #1e40af; }
          article.doc-content img { max-width: 100%; border-radius: 0.5rem; border: 1px solid #e1e4e8; margin: 1.5rem 0; }
          article.doc-content table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
          article.doc-content th, article.doc-content td { border: 1px solid #e1e4e8; padding: 0.75rem; text-align: left; }
          article.doc-content th { background: #f6f8fa; font-weight: 600; }
          article.doc-content a { color: #2563eb; text-decoration: none; }
          article.doc-content a:hover { text-decoration: underline; }
          article.doc-content .cta-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 1.5rem; border-radius: 0.5rem; margin: 1.5rem 0; }
          article.doc-content hr { border: none; border-top: 2px solid #e1e4e8; margin: 2rem 0; }
        `);

        mainContent.child(contentStyles);
        mainContent.child(articleNode);
        mainContent.get();

        // Apply Prism highlighting after render
        setTimeout(() => {
          if (window.Prism) {
            Prism.highlightAll();
          }
        }, 100);

      } catch (error) {
        console.error('Failed to load documentation:', error);
        loadingEl.remove();
        mainContent.empty().child(
          el('div')
            .text('Failed to load documentation.')
            .css({ textAlign: 'center', padding: '3rem', color: '#dc2626' })
        );
        mainContent.get();
      }

      return container.get();
    }
  });
}

// ============================================
// Admin Pages for Documentation
// ============================================

// Admin dashboard - List all docs
function registerDocAdminPage(core) {
  layout.addPage({
    path: '/admin',
    roles: ['admin'],
    component: async () => {
      const container = el('div').css({ maxWidth: '1200px', margin: '0 auto', padding: '2rem' });

      // Header
      const header = el('div').css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }).child([
        el('h1').text('Documentation Admin').css({
          fontSize: '2rem',
          fontWeight: '800',
          color: '#0f172a'
        }),
        el('button')
          .attr('type', 'button')
          .text('Create New Doc')
          .css({
            padding: '0.75rem 1.5rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: '600',
            cursor: 'pointer'
          })
          .click(() => {
            layout.navigate('/admin/create');
          })
      ]);

      container.child(header);

      // Wrapper khusus untuk konten dinamis. Dengan begini, kita bisa `empty()`
      // body tanpa menghapus header dan tanpa meninggalkan sisa loader di
      // antrian child el.js (`ch`) yang otherwise akan muncul lagi saat
      // `container.get()` dipanggil.
      const body = el('div');
      container.child(body);

      // Loading state
      const loadingEl = el('div').css({
        textAlign: 'center',
        padding: '3rem',
        color: '#64748b'
      }).text('Loading...');
      body.child(loadingEl);
      body.get(); // flush agar loader langsung tampil

      try {
        const response = await fetch('/api/docs');
        const result = await response.json();

        body.empty();

        if (!result.success || !result.data || result.data.length === 0) {
          body.child(
            el('div').css({
              textAlign: 'center',
              padding: '3rem',
              color: '#64748b'
            }).child([
              el('i').class('fas fa-folder-open').css({ fontSize: '3rem', marginBottom: '1rem', display: 'block' }),
              el('h3').text('Belum Ada Dokumentasi').css({ marginBottom: '0.5rem', color: '#0f172a' }),
              el('p').text('Buat dokumentasi pertama untuk ditampilkan di halaman utama.').css({ marginBottom: '1.25rem' }),
              el('button')
                .attr('type', 'button')
                .text('Buat Dokumentasi')
                .css({
                  padding: '0.75rem 1.5rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                })
                .click(() => layout.navigate('/admin/create'))
            ])
          );
          body.get();
          return container.get();
        }

        // Table
        const table = el('table').css({
          width: '100%',
          borderCollapse: 'collapse',
          background: '#fff',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        });

        // Table header
        table.child(
          el('thead').css({ background: '#f8fafc' }).child(
            el('tr').child([
              el('th').text('Title').css({ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e2e8f0' }),
              el('th').text('Slug').css({ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e2e8f0' }),
              el('th').text('Category').css({ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e2e8f0' }),
              el('th').text('Updated').css({ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e2e8f0' }),
              el('th').text('Actions').css({ padding: '1rem', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e2e8f0' })
            ])
          )
        );

        // Table body
        const tbody = el('tbody');
        result.data.forEach(doc => {
          tbody.child(
            el('tr').css({ borderBottom: '1px solid #e2e8f0' }).child([
              el('td').text(doc.title).css({ padding: '1rem' }),
              el('td').text(doc.slug).css({ padding: '1rem', fontFamily: 'monospace', fontSize: '0.875rem', color: '#64748b' }),
              el('td').text(doc.category).css({ padding: '1rem' }),
              el('td').text(new Date(doc.updatedAt).toLocaleDateString()).css({ padding: '1rem', fontSize: '0.875rem', color: '#64748b' }),
              el('td').child([
                el('button')
                  .attr('type', 'button')
                  .text('Edit')
                  .css({
                    padding: '0.5rem 1rem',
                    marginRight: '0.5rem',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  })
                  .click(() => {
                    layout.navigate(`/admin/edit/${doc.slug}`);
                  }),
                el('button')
                  .attr('type', 'button')
                  .text('Delete')
                  .css({
                    padding: '0.5rem 1rem',
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  })
                  .click(async () => {
                    layout.confirm({
                      title: 'Delete Documentation',
                      message: `Are you sure you want to delete "${doc.title}"? This cannot be undone.`,
                      confirmText: 'Delete',
                      cancelText: 'Cancel',
                      onConfirm: async () => {
                        try {
                          const res = await fetch(`/api/docs/${doc.slug}`, { method: 'DELETE' });
                          const result = await res.json();
                          if (result.success) {
                            layout.toast('Documentation deleted', { type: 'success' });
                            layout.navigate('/admin', true); // Force reload
                          } else {
                            layout.toast(result.error || 'Failed to delete', { type: 'error' });
                          }
                        } catch (error) {
                          layout.toast('Failed to delete documentation', { type: 'error' });
                        }
                      }
                    });
                  })
              ])
            ])
          );
        });

        table.child(tbody);
        body.child(table);
        body.get();

      } catch (error) {
        console.error('Failed to load documentation:', error);
        body.empty();
        body.child(
          el('div')
            .text('Failed to load documentation.')
            .css({ textAlign: 'center', padding: '3rem', color: '#dc2626' })
        );
        body.get();
      }

      return container.get();
    }
  });
}

// Halaman editor dokumentasi (create / edit)
function buildDocEditorComponent(isNew, editSlug) {
  return async () => {
      const slug = isNew ? null : editSlug;

      let existingData = null;
      if (!isNew && slug) {
        try {
          const response = await fetch(`/api/docs/${slug}`);
          const result = await response.json();
          if (result.success) {
            existingData = result.data;
          } else {
            return el('div').css({ padding: '2rem', color: '#dc2626' })
              .text(result.error || 'Dokumentasi tidak ditemukan.').get();
          }
        } catch (error) {
          console.error('Failed to load doc:', error);
          return el('div').css({ padding: '2rem', color: '#dc2626' })
            .text('Gagal memuat dokumentasi.').get();
        }
      }

      const { editor } = await import('./library/editor-element/editor.js?v=20260519b');
      const initialTitle = existingData?.title || '';
      const initialSlug = existingData?.slug || '';
      const initialCategory = existingData?.category || 'Guide';
      const initialDescription = existingData?.description || '';

      const editorInstance = await editor({
        el,
        type: 'documentation',
        editorTitle: isNew ? 'Buat Dokumentasi' : 'Edit Dokumentasi',
        enableDraft: true,
        storage: { type: 'indexedDB' },
        categories: ['Guide', 'API', 'Tutorial', 'Reference'],
        initialData: existingData ? {
          title: initialTitle,
          slug: initialSlug,
          category: initialCategory,
          description: initialDescription,
          content: existingData.content
        } : {
          category: 'Guide',
          content: { time: Date.now(), blocks: [] }
        },
        onSave: async (data) => {
          try {
            const title = (data.title || '').trim();
            const docSlug = (isNew ? data.slug : slug || data.slug || '').trim();
            const category = data.category || 'Guide';
            const description = data.metaDescription || data.description || '';

            if (!title || !docSlug) {
              layout.toast('Judul dan slug wajib diisi', { type: 'warning' });
              return;
            }

            const url = isNew ? '/api/docs' : `/api/docs/${docSlug}`;
            const method = isNew ? 'POST' : 'PUT';
            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                slug: docSlug,
                title,
                category,
                description,
                content: data.content
              })
            });
            const result = await res.json();
            if (result.success) {
              layout.toast('Dokumentasi tersimpan', { type: 'success' });
              layout.navigate('/admin', true);
            } else {
              layout.toast(result.error || 'Gagal menyimpan', { type: 'error' });
            }
          } catch (error) {
            console.error('Save error:', error);
            layout.toast('Gagal menyimpan dokumentasi', { type: 'error' });
          }
        },
        onClose: () => layout.navigate('/admin')
      });

      return typeof editorInstance?.get === 'function'
        ? editorInstance.get()
        : editorInstance;

      const container = el('div').css({ maxWidth: '1200px', margin: '0 auto', padding: '2rem' });

      // Header
      const header = el('div').css({
        marginBottom: '2rem'
      }).child([
        el('a')
          .attr('href', '#/admin')
          .text('← Back to Admin')
          .css({ display: 'block', marginBottom: '1rem', color: '#2563eb', textDecoration: 'none' }),
        el('h1').text(isNew ? 'Create Documentation' : 'Edit Documentation').css({
          fontSize: '2rem',
          fontWeight: '800',
          color: '#0f172a'
        })
      ]);

      container.child(header);

      // Metadata form
      const metaForm = el('div').css({
        background: '#fff',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        border: '1px solid #e2e8f0',
        marginBottom: '2rem'
      });

      const refs = {};

      // Title field
      const titleField = el('div').css({ marginBottom: '1rem' }).child([
        el('label').text('Title').css({ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }),
        el('input')
          .attr('type', 'text')
          .attr('placeholder', 'Documentation title')
          .link(refs, 'title')
          .css({
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem'
          })
          .on('input', (e) => {
            // Auto-generate slug from title
            if (isNew) {
              const autoSlug = e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
              el(refs.slug).attr('value', autoSlug);
            }
          })
      ]);

      // Slug field
      const slugField = el('div').css({ marginBottom: '1rem' }).child([
        el('label').text('Slug').css({ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }),
        el('input')
          .attr('type', 'text')
          .attr('placeholder', 'url-friendly-name')
          .link(refs, 'slug')
          .css({
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontFamily: 'monospace'
          })
      ]);

      // Category field
      const categoryField = el('div').css({ marginBottom: '1rem' }).child([
        el('label').text('Category').css({ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }),
        el('select')
          .link(refs, 'category')
          .css({
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem'
          })
          .child([
            el('option').attr('value', 'Guide').text('Guide'),
            el('option').attr('value', 'API').text('API'),
            el('option').attr('value', 'Tutorial').text('Tutorial'),
            el('option').attr('value', 'Reference').text('Reference')
          ])
      ]);

      // Description field
      const descField = el('div').css({ marginBottom: '1rem' }).child([
        el('label').text('Description').css({ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151' }),
        el('textarea')
          .attr('placeholder', 'Brief description of this documentation')
          .link(refs, 'description')
          .css({
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            minHeight: '80px',
            resize: 'vertical'
          })
      ]);

      metaForm.child([titleField, slugField, categoryField, descField]);
      container.child(metaForm);

      // Open editor button
      const openEditorBtn = el('button')
        .attr('type', 'button')
        .text(isNew ? 'Open Editor' : 'Open Editor')
        .css({
          padding: '0.75rem 2rem',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '0.5rem',
          fontWeight: '600',
          cursor: 'pointer',
          fontSize: '1rem'
        });

      container.child(openEditorBtn);

      // Load existing data if editing
      let legacyExistingData = null;
      if (!isNew && slug) {
        el(refs.slug).attr('readonly', 'readonly').css({ background: '#f1f5f9' });
        openEditorBtn.disabled(true).text('Loading...');
        try {
          const response = await fetch(`/api/docs/${slug}`);
          const result = await response.json();

          if (result.success) {
            existingData = result.data;
            el(refs.title).attr('value', existingData.title);
            el(refs.slug).attr('value', existingData.slug);
            el(refs.category).attr('value', existingData.category || 'Guide');
            el(refs.description).attr('value', existingData.description || '');
          } else {
            layout.toast(result.error || 'Dokumentasi tidak ditemukan', { type: 'error' });
          }
        } catch (error) {
          console.error('Failed to load doc:', error);
          layout.toast('Gagal memuat dokumentasi', { type: 'error' });
        }
        openEditorBtn.disabled(false).text('Buka Editor');
      }

      // Open UI Maker Editor on click
      openEditorBtn.click(async () => {
        const title = el(refs.title).getValue();
        const docSlug = el(refs.slug).getValue();
        const category = el(refs.category).getValue();
        const description = el(refs.description).getValue();

        if (!title || !docSlug) {
          layout.toast('Please fill in title and slug', { type: 'warning' });
          return;
        }

        try {
          // Import editor
          const { editor } = await import('./library/editor-element/editor.js?v=20260519b');

          // Open editor modal
          const editorInstance = await editor({
            el: el,
            type: 'documentation',
            enableDraft: true,
            storage: { type: 'indexedDB' },
            categories: ['Guide', 'API', 'Tutorial', 'Reference'],
            initialData: existingData ? {
              title: existingData.title,
              category: existingData.category,
              content: existingData.content
            } : null,
            onSave: async (data) => {
              try {
                const saveSlug = isNew ? docSlug : slug;
                const url = isNew ? '/api/docs' : `/api/docs/${saveSlug}`;
                const method = isNew ? 'POST' : 'PUT';
                const payloadContent = data.content && data.content.blocks
                  ? data.content
                  : { time: Date.now(), blocks: data.content?.blocks || [] };

                const res = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    slug: saveSlug,
                    title: data.title || title,
                    category: data.category || category,
                    description,
                    content: payloadContent
                  })
                });

                const result = await res.json();

                if (result.success) {
                  layout.toast('Dokumentasi tersimpan', { type: 'success' });
                  layout.navigate('/admin', true);
                } else {
                  layout.toast(result.error || 'Gagal menyimpan', { type: 'error' });
                }
              } catch (error) {
                console.error('Save error:', error);
                layout.toast('Gagal menyimpan dokumentasi', { type: 'error' });
              }
            },
            onClose: () => {}
          });
          const editorNode = typeof editorInstance?.get === 'function'
            ? editorInstance.get()
            : editorInstance;
          if (editorNode && !editorNode.isConnected) {
            document.body.appendChild(editorNode);
          }
        } catch (error) {
          console.error('Failed to load editor:', error);
          layout.toast('Gagal memuat editor', { type: 'error' });
        }
      });

      return container.get();
  };
}

function registerDocEditorPage(core) {
  layout.addPage({
    path: '/admin/create',
    roles: ['admin'],
    hideLayout: true,
    pageContentPadding: '0',
    component: buildDocEditorComponent(true, null)
  });

  layout.addPage({
    path: '/admin/edit/:slug',
    roles: ['admin'],
    hideLayout: true,
    pageContentPadding: '0',
    component: async () => {
      const hash = window.location.hash.replace('#', '');
      const parts = hash.split('/');
      const routeSlug = parts[3];
      return buildDocEditorComponent(false, routeSlug)();
    }
  });
}


// Login — layout-cheatsheet + el.js: form, .submit(), .link(), .child([...]), return wrapper
function registerLoginPage(core) {
  layout.addPage({
    path: '/login',
    hideLayout: true,
    pageContentPadding: '0',
    component: () => {
      const refs = {};

      const inputStyle = {
        width: '100%',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        border: '1px solid #cbd5e1',
        boxSizing: 'border-box',
        fontSize: '1rem'
      };

      const labelStyle = { fontSize: '0.875rem', fontWeight: '600', color: '#334155' };
      const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' };

      const errEl = el('p')
        .css({ margin: 0, color: '#dc2626', fontSize: '0.875rem', display: 'none' })
        .link(refs, 'error');

      const emailInput = el('input')
        .attr('type', 'email')
        .attr('name', 'email')
        .attr('placeholder', 'admin@gmail.com')
        .attr('autocomplete', 'email')
        .attr('required', 'required')
        .css(inputStyle);

      const passInput = el('input')
        .attr('type', 'password')
        .attr('name', 'password')
        .attr('placeholder', 'Password')
        .attr('autocomplete', 'current-password')
        .attr('required', 'required')
        .css(inputStyle);

      const submitBtn = el('button')
        .attr('type', 'submit')
        .text('Masuk')
        .link(refs, 'submitBtn')
        .css({
          width: '100%',
          padding: '0.75rem 1rem',
          borderRadius: '0.75rem',
          border: 'none',
          backgroundColor: '#2563eb',
          color: '#fff',
          fontWeight: '700',
          fontSize: '1rem',
          cursor: 'pointer'
        });

      const handleLogin = async (data) => {
        const email = (data.email || '').trim();
        const password = data.password || '';
        if (!email || !password) {
          el(refs.error).text('Email dan password wajib diisi').css({ display: 'block' });
          return;
        }
        el(refs.submitBtn).disabled(true).text('Memproses...');
        el(refs.error).css({ display: 'none' });

        try {
          await CrmAuth.login(email, password, async (user) => {
            await bootstrapAuthenticatedApp(core, user);
            core.toast('Login berhasil', { type: 'success', title: 'Login' });
            layout.navigate('/', true);
          });
        } catch (e) {
          el(refs.error).text(e.message || 'Login gagal').css({ display: 'block' });
          el(refs.submitBtn).disabled(false).text('Masuk');
        }
      };

      const loginForm = el('form')
        .attr('method', 'post')
        .attr('action', '#')
        .css({ display: 'grid', gap: '1rem', width: '100%' })
        .submit(handleLogin);

      loginForm.child([
        el('label').css(fieldStyle).child([
          el('span').text('Email').css(labelStyle),
          emailInput
        ]),
        el('label').css(fieldStyle).child([
          el('span').text('Password').css(labelStyle),
          passInput
        ]),
        errEl,
        submitBtn
      ]);



      const card = el('div').css({
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        borderRadius: '1rem',
        boxShadow: '0 24px 80px rgba(15, 23, 42, 0.12)',
        backgroundColor: '#ffffff'
      }).child([
        el('div').css({ marginBottom: '1.5rem' }).child([
          el('h2').text('Selamat Datang').css({ margin: '0 0 0.5rem', fontSize: '1.85rem', fontWeight: '800', color: '#0f172a' }),
          el('p').text('Masuk ke sistem manajemen TKI PJTKI.').css({ margin: 0, lineHeight: '1.75', color: '#475569' })
        ]),
        loginForm,
        el('div').css({ marginTop: '1.5rem', textAlign: 'center' }).child([
          el('a')
            .attr('href', '#/')
            .css({
              color: '#2563eb',
              fontSize: '0.875rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            })
            .hover(
              (e) => {
                e.currentTarget.style.textDecoration = 'underline';
              },
              (e) => {
                e.currentTarget.style.textDecoration = 'none';
              }
            )
            .child([
              el('i').class('fas fa-arrow-left'),
              el('span').text('Back to Documentation')
            ])
        ])
      ]);

      return el('div').css({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #eef2ff 100%)',
        boxSizing: 'border-box'
      }).child(card).get();
    }
  });
}

