# Layout.js Cheatsheet

## Quick Start

```html
<!-- Load dependencies -->
<script src="https://unpkg.com/@slice-code/el.js@1.0.6/el.js"></script>
<script src="layouting/layout.js"></script>

<!-- App container -->
<div id="app"></div>

<script>
  // Add pages
  layout.addPage({
    path: '/',
    component: () => el('div').text('Home Page')
  });

  // Add sidebar menu
  layout.addSideMenu([
    { name: 'Home', icon: 'fas fa-home', page: '/' }
  ]);

  // Render layout
  layout.render();
</script>
```

---

## Routing API

### Add Page
```javascript
layout.addPage({
  path: '/dashboard',           // Route path
  component: () => el('div'),   // Component function
  roles: ['admin', 'manager'],  // Optional: RBAC
  hideLayout: false,            // Optional: hide navbar/sidebar
  fullWidthDesktop: false,      // Optional: hide sidebar on desktop
  pageContentPadding: '10px'    // Optional: override padding
});
```

### Dynamic Routes
```javascript
layout.addPage({
  path: '/users/:id',
  component: () => {
    const hash = window.location.hash; // /users/123
    // Parse ID from hash
  }
});
```

### Navigation
```javascript
layout.navigate('/dashboard');     // Navigate to page
layout.navigate('/users/123');     // Navigate with params
```

### Hash Change Listener
```javascript
// Automatically handled
// Browser back/forward buttons work
// URL format: #/path
```

---

## Role-Based Access Control (RBAC)

### Set User Role
```javascript
layout.setRole('admin');    // Set current user role
layout.getRole();           // Get current role
layout.setRole(null);       // Clear role (logout)
```

### Page-Level RBAC
```javascript
layout.addPage({
  path: '/admin',
  component: () => el('div').text('Admin Panel'),
  roles: ['admin']          // Only admin can access
});
```

### Menu-Level RBAC
```javascript
layout.addSideMenu([
  {
    name: 'Admin Panel',
    icon: 'fas fa-shield-alt',
    page: '/admin',
    roles: ['admin']        // Only visible to admin
  },
  {
    name: 'Dashboard',
    icon: 'fas fa-chart-line',
    page: '/dashboard'      // No roles = visible to all
  }
]);
```

---

## Middleware

### Add Middleware
```javascript
layout.middleware((path, pageConfig) => {
  // Run before each page render
  // Return { allowed: false, redirect: '/login' } to block
  
  const isLoggedIn = checkAuth();
  if (!isLoggedIn && path !== '/login') {
    return { allowed: false, redirect: '/login' };
  }
  
  return { allowed: true };
});
```

### Async Middleware
```javascript
layout.middleware(async (path, pageConfig) => {
  const user = await fetch('/api/user');
  if (!user) {
    return { allowed: false, redirect: '/login' };
  }
  return { allowed: true };
});
```

### Multiple Middleware
```javascript
// Middleware dijalankan berurutan (sequentially)
// Jika satu middleware block, yang berikutnya tidak jalan

layout.middleware(async (path, pageConfig) => {
  // 1. Auth check
  const token = localStorage.getItem('token');
  if (!token) return { allowed: false, redirect: '/login' };
  return { allowed: true };
});

layout.middleware(async (path, pageConfig) => {
  // 2. Permission check
  const user = await fetch('/api/user');
  if (!user.permissions.includes(path)) {
    return { allowed: false, redirect: '/unauthorized' };
  }
  return { allowed: true };
});
```

### Middleware + Loader Flow

**Penting**: Loader muncul SEBELUM middleware dijalankan dan hilang SETELAH komponen selesai render.

```
User clicks link
    ↓
layout.navigate('/dashboard')
    ↓
showLoader()  ← Spinner muncul
    ↓
Run middleware 1 (async)
    ↓
Run middleware 2 (async)
    ↓
Check RBAC roles
    ↓
Load component()
    ↓
┌─ If Sync Component ──────────────┐
│ Render component                  │
│ hideLoader()  ← Spinner hilang   │
└───────────────────────────────────┘

┌─ If Async Component (Promise) ───┐
│ Wait for Promise resolve          │
│ Render component                  │
│ hideLoader()  ← Spinner hilang   │
└───────────────────────────────────┘

┌─ If Middleware Redirect ─────────┐
│ layout.navigate('/login')         │
│ Trigger renderPage baru           │
│ Loader otomatis handle            │
└───────────────────────────────────┘
```

### Loader Behavior Details

**Kapan Loader Muncul:**
- ✅ Saat `renderPage()` dipanggil
- ✅ Saat `layout.navigate()` dengan hash change
- ✅ Sebelum middleware dijalankan
- ✅ Sebelum komponen load

**Kapan Loader Hilang:**
- ✅ Setelah sync component di-render
- ✅ Setelah async component (Promise) resolve
- ✅ Setelah error saat load async component
- ✅ Saat middleware redirect (trigger renderPage baru)

### Loader Implementation

```javascript
// Default loader: spinner biru 40px berputar
// Auto-centered di page content
// Minimal height: 200px

// Spinner style:
// - Border: 4px solid #f3f3f3 (abu-abu)
// - Top border: 4px solid #3498db (biru)
// - Animation: spin 1s linear infinite
// - Size: 40px x 40px
```

### Custom Loading with Middleware

```javascript
// Contoh: Tampilkan custom message saat loading
layout.middleware(async (path, pageConfig) => {
  // Loader sudah muncul otomatis
  
  // Bisa show toast notification
  layout.toast('Loading page...', { type: 'info', duration: 1000 });
  
  const token = localStorage.getItem('token');
  if (!token) {
    return { allowed: false, redirect: '/login' };
  }
  
  return { allowed: true };
});
```

### Async Component with Loader

```javascript
// Component yang return Promise akan membuat loader muncul lebih lama
layout.addPage({
  path: '/dashboard',
  component: async () => {
    // Loader masih berputar saat fetch ini jalan
    const data = await fetch('/api/dashboard').then(r => r.json());
    
    // Loader hilang setelah ini return
    return el('div').child([
      el('h1').text('Dashboard'),
      el('p').text(`Total users: ${data.totalUsers}`)
    ]);
  }
});

// Error handling - loader tetap hilang meski error
layout.addPage({
  path: '/reports',
  component: async () => {
    try {
      const data = await fetch('/api/reports');
      return el('div').text(JSON.stringify(data));
    } catch (error) {
      // Loader akan hilang, error message ditampilkan
      throw error; // atau return custom error component
    }
  }
});
```

### Manual Loader Control

```javascript
// Bisa juga kontrol loader manual di component
layout.addPage({
  path: '/custom-load',
  component: () => {
    const container = el('div');
    
    // Hide loader dulu
    layout.hideLoader();
    
    // Custom loading state
    container.child(el('p').text('Loading...'));
    
    // Fetch data
    fetch('/api/data').then(data => {
      container.empty().child(
        el('div').text(JSON.stringify(data))
      );
    });
    
    return container;
  }
});
```

---

## Menus

### Sidebar Menu
```javascript
layout.addSideMenu([
  // Simple item
  {
    name: 'Dashboard',
    icon: 'fas fa-home',
    page: '/dashboard'
  },
  
  // Dropdown with children
  {
    name: 'Users',
    icon: 'fas fa-users',
    children: [
      { name: 'All Users', icon: 'fas fa-list', page: '/users' },
      { name: 'Add User', icon: 'fas fa-plus', page: '/users/add' }
    ]
  },
  
  // With i18n
  {
    nameKey: 'sidebar.dashboard',  // Uses window.i18n.t()
    name: 'Dashboard',             // Fallback
    icon: 'fas fa-home',
    page: '/'
  }
]);
```

### Navbar Menu
```javascript
layout.addNavbar([
  { name: 'Dashboard', page: '/' },
  { name: 'Settings', page: '/settings' }
]);
```

---

## Themes

### Built-in Themes
```javascript
layout.setTheme('default');   // Dark slate
layout.setTheme('blue');      // Blue
layout.setTheme('dark');      // Black
layout.setTheme('light');     // White/light gray
layout.setTheme('purple');    // Purple
layout.setTheme('green');     // Green
layout.setTheme('red');       // Red
layout.setTheme('orange');    // Orange
layout.setTheme('teal');      // Teal
layout.setTheme('pink');      // Pink
layout.setTheme('gray');      // Gray
```

### Custom Theme
```javascript
layout.setCustomTheme({
  navbarBg: '#1a202c',
  navbarColor: '#fff',
  sidebarBg: '#2d3748',
  sidebarColor: '#fff'
});
```

---

## Desktop Hide Mode

### Toggle Sidebar Hide
- Switch in navbar (desktop only)
- Collapses sidebar to 4px strip
- Hover to expand as floating overlay
- State saved in localStorage

### Programmatic Control
```javascript
// Access via layout internals
// Note: desktopHideMode is internal state
```

---

## UI Components

### Toast Notifications
```javascript
// Simple toast
layout.toast('Operation successful');

// With options
layout.toast('Data saved', {
  type: 'success',          // success | error | warning | info
  title: 'Success',
  duration: 3000            // Auto-close in ms
});

// Toast types
layout.toast('Success message', { type: 'success' });
layout.toast('Error message', { type: 'error' });
layout.toast('Warning message', { type: 'warning' });
layout.toast('Info message', { type: 'info' });
```

### Notify (Alias)
```javascript
layout.notify('Simple notification');

layout.notify({
  message: 'Detailed notification',
  title: 'Title',
  type: 'info'
});
```

### Confirm Dialog
```javascript
layout.confirm({
  title: 'Delete Item',
  message: 'Are you sure you want to delete this item?',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  dismissible: true,        // Click outside to close
  onConfirm: () => {
    console.log('Confirmed');
  },
  onCancel: () => {
    console.log('Cancelled');
  }
});

// Close programmatically
layout.closeConfirm();
```

### Custom Modal
```javascript
layout.modal({
  title: 'Custom Modal',
  content: 'Modal content here',
  dismissible: true,
  buttons: [
    {
      text: 'Cancel',
      variant: 'outline',   // outline | secondary | primary
      onClick: () => console.log('Cancel clicked')
    },
    {
      text: 'Save',
      variant: 'primary',
      onClick: () => console.log('Save clicked'),
      closeOnClick: true    // Default: true
    }
  ]
});

// With el.js component as content
layout.modal({
  title: 'Form Modal',
  content: el('form').child([
    el('input').attr('type', 'text').placeholder('Enter name')
  ]),
  buttons: [
    { text: 'Submit', onClick: handleSubmit }
  ]
});

// Close programmatically
layout.closeModal();
```

### Page Loader

**Basic Usage:**
```javascript
layout.showLoader();   // Show spinner
layout.hideLoader();   // Hide spinner
```

**Loader Features:**
- 🔄 Auto-show saat navigasi page
- 🔄 Auto-hide setelah component render
- 🔄 Works dengan sync & async components
- 🔄 Handles error gracefully
- 🔄 Spinner animation (blue, 40px, centered)

**Manual Control (Rare Cases):**
```javascript
// Biasanya otomatis, tapi bisa manual
function customOperation() {
  layout.showLoader();
  
  doSomethingAsync().then(() => {
    layout.hideLoader();
  });
}
```

**Loader Timing:**
```
navigate('/page')
  → showLoader() (immediate)
  → run middleware
  → load component
  → render component
  → hideLoader() (auto)
```

---

## Page Configuration Options

```javascript
layout.addPage({
  path: '/example',
  component: () => el('div'),
  
  // RBAC
  roles: ['admin', 'manager'],
  
  // Layout visibility
  hideLayout: true,          // Hide navbar + sidebar (e.g., login page)
  fullWidthDesktop: true,    // Hide sidebar on desktop only
  
  // Custom padding
  pageContentPadding: '0',   // Override default 10px padding
});
```

---

## Initialize Layout

### Basic Setup
```javascript
// 1. Add pages
layout.addPage({ path: '/', component: () => el('div').text('Home') });

// 2. Add menus
layout.addSideMenu([
  { name: 'Home', icon: 'fas fa-home', page: '/' }
]);

layout.addNavbar([
  { name: 'Profile', page: '/profile' }
]);

// 3. Set theme (optional)
layout.setTheme('blue');

// 4. Set role (optional)
layout.setRole('admin');

// 5. Add middleware (optional)
layout.middleware(authMiddleware);

// 6. Render
layout.render();
```

### Complete Example
```javascript
// Authentication middleware
layout.middleware(async (path, pageConfig) => {
  const publicPages = ['/login', '/register'];
  if (publicPages.includes(path)) return { allowed: true };
  
  const token = localStorage.getItem('token');
  if (!token) {
    return { allowed: false, redirect: '/login' };
  }
  
  return { allowed: true };
});

// Pages
layout.addPage({
  path: '/login',
  hideLayout: true,
  component: () => el('div').text('Login Page')
});

layout.addPage({
  path: '/dashboard',
  roles: ['admin', 'user'],
  component: () => el('div').text('Dashboard')
});

layout.addPage({
  path: '/admin',
  roles: ['admin'],
  component: () => el('div').text('Admin Panel')
});

// Sidebar
layout.addSideMenu([
  {
    name: 'Dashboard',
    icon: 'fas fa-chart-line',
    page: '/dashboard'
  },
  {
    name: 'Admin',
    icon: 'fas fa-shield-alt',
    page: '/admin',
    roles: ['admin']
  }
]);

// Set role after login
layout.setRole('admin');

// Render
layout.render();
```

---

## Responsive Behavior

### Desktop (>768px)
- Sidebar: 250px width, always visible
- Content: flex row (sidebar + page)
- Hide mode: collapsible to 4px strip

### Mobile (≤768px)
- Sidebar: full-screen overlay
- Hamburger menu: toggles sidebar
- Content: flex column
- Hide mode switch: hidden

---

## Global Functions (Legacy)

```javascript
window.addNavbar(menus);          // Same as layout.addNavbar()
window.setLayoutTheme(themeName); // Same as layout.setTheme()
window.setCustomTheme(config);    // Same as layout.setCustomTheme()
```

---

## Tips & Best Practices

### 1. Page Components
```javascript
// Return el.js element
component: () => el('div').text('Page')

// Return Promise for async loading
component: () => import('./pages/Dashboard.js')

// Return complex component
component: () => {
  return el('div').child([
    el('h1').text('Dashboard'),
    el('p').text('Welcome!')
  ]);
}
```

### 2. i18n Integration
```javascript
// Requires window.i18n.t() function
layout.addSideMenu([
  {
    nameKey: 'menu.dashboard',
    name: 'Dashboard',  // Fallback if i18n not available
    icon: 'fas fa-home',
    page: '/'
  }
]);
```

### 3. Prevent Flash on Load
```css
/* Add to your CSS */
#layout-container {
  visibility: hidden;
}
```
Layout automatically sets `visibility: visible` after rendering.

### 4. Custom Logout
```javascript
// Default logout calls /api/auth/logout
// Override by not using the built-in logout
// Or intercept with middleware
```

### 5. Page Scroll Reset
- Page content automatically scrolls to top on navigation
- Both `scrollTop` and `scrollLeft` are reset

---

## Common Patterns

### Login Page (No Layout)
```javascript
layout.addPage({
  path: '/login',
  hideLayout: true,
  component: () => el('div').css({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh'
  }).child([
    el('form').child([
      el('input').attr('type', 'email').placeholder('Email'),
      el('input').attr('type', 'password').placeholder('Password'),
      el('button').text('Login').click(handleLogin)
    ])
  ])
});
```

### Full-Width Page (No Sidebar)
```javascript
layout.addPage({
  path: '/reports',
  fullWidthDesktop: true,
  component: () => el('div').text('Full-width report')
});
```

### Async Page Component
```javascript
layout.addPage({
  path: '/dashboard',
  component: async () => {
    const data = await fetch('/api/dashboard');
    return el('div').text(JSON.stringify(data));
  }
});
```

---

## Troubleshooting

### "App element not found"
- Ensure `<div id="app"></div>` exists before loading layout.js

### "el.js not load"
- Load el.js before layout.js
- Check network tab for failed requests

### Page not rendering
- Verify `layout.render()` is called
- Check page path matches navigation
- Check RBAC role restrictions

### Sidebar not showing
- Check `hideLayout` or `fullWidthDesktop` page config
- Verify `addSideMenu()` is called before `render()`

### Theme not applying
- Call `setTheme()` before `render()`
- Check theme name is valid

---

## Version

Built for el.js v1.0.6
Layout Engine v1.0
