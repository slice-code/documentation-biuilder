# Core App - JSON-Driven UI Framework

A powerful JSON-driven UI framework built on top of `el.js` and `layout.js` for building complete applications with minimal code.

## Overview

Core App allows you to build entire applications using only JSON configuration. Define forms, tables, CRUD operations, and complete UI layouts through simple JSON schemas.

## Features

- **JSON-Driven UI**: Define entire interfaces with JSON
- **Auto CRUD**: Generate complete CRUD systems from schema
- **REST API Integration**: Built-in API client with auto-CRUD mapping
- **Dynamic Forms**: Generate forms with validation from JSON
- **Dynamic Tables**: Feature-rich tables with search, sort, pagination
- **Component System**: Extensible component architecture
- **Layout Integration**: Seamless integration with layout.js
- **RBAC Support**: Role-based access control built-in

## Quick Start

### 1. Load Scripts

```html
<!-- Dependencies -->
<script src="el.js"></script>
<script src="layouting/layout.js"></script>

<!-- Core modules -->
<script src="core/api-client.js"></script>
<script src="core/form-builder.js"></script>
<script src="core/table-builder.js"></script>
<script src="core/crud-engine.js"></script>
<script src="core/ui-builder.js"></script>
<script src="core/core.js"></script>
<script src="core/index.js"></script>
```

### 2. Initialize App

```javascript
const core = new CoreApp({
  api: {
    baseUrl: 'http://localhost:3000/api',
    token: () => localStorage.getItem('token')
  },
  layout: {
    theme: 'blue',
    sideMenu: [
      { name: 'Dashboard', icon: 'fas fa-home', page: '/' },
      { name: 'Users', icon: 'fas fa-users', page: '/users' }
    ],
    navbar: [
      { name: 'Profile', page: '/profile' }
    ]
  }
});

// Add CRUD page
core.addCrudPage('/users', {
  resource: 'users',
  title: 'User Management',
  table: {
    columns: [
      { key: 'id', label: 'ID', sortable: true },
      { key: 'name', label: 'Name', sortable: true, searchable: true },
      { key: 'email', label: 'Email', sortable: true },
      { key: 'role', label: 'Role' },
      {
        key: 'actions',
        type: 'actions',
        actions: ['edit', 'delete']
      }
    ],
    features: {
      search: true,
      pagination: true,
      perPage: 10
    }
  },
  form: {
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'role', label: 'Role', type: 'select', options: [
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'User' }
      ]}
    ]
  }
});

// Initialize
core.init();
```

## Modules

### 1. ApiClient

REST API client with auto-CRUD mapping.

```javascript
const api = new ApiClient({
  baseUrl: '/api',
  token: () => localStorage.getItem('token')
});

// CRUD operations
api.create('users', { name: 'John' });     // POST /api/users
api.read('users');                          // GET /api/users
api.read('users/123');                      // GET /api/users/123
api.update('users/123', { name: 'Jane' }); // PUT /api/users/123
api.delete('users/123');                    // DELETE /api/users/123
```

### 2. FormBuilder

Generate forms from JSON schema.

```javascript
const form = FormBuilder.build({
  fields: [
    { name: 'username', label: 'Username', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'role', label: 'Role', type: 'select', options: [...] }
  ],
  layout: 'vertical'
}, {
  onSubmit: (data) => console.log(data),
  initialData: { username: 'john' }
});
```

### 3. TableBuilder

Generate tables from JSON schema.

```javascript
const table = TableBuilder.build({
  columns: [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true, searchable: true },
    { key: 'actions', type: 'actions', actions: ['edit', 'delete'] }
  ],
  features: {
    search: true,
    pagination: true,
    perPage: 10
  }
}, {
  data: [],
  onSearch: (query) => loadData(query),
  onSort: (column, dir) => loadData(null, column, dir)
});
```

### 4. CrudEngine

Complete CRUD system generator.

```javascript
const crud = CrudEngine.build({
  resource: 'users',
  title: 'User Management',
  table: { ... },  // Table schema
  form: { ... }    // Form schema
}, {
  apiClient: api
});
```

### 5. UiBuilder

Full UI component generator.

```javascript
const ui = UiBuilder.build({
  type: 'page',
  title: 'Dashboard',
  children: [
    { type: 'stats', items: [...] },
    { type: 'card', title: 'Recent Users', children: [...] }
  ]
}, {
  data: {},
  apiClient: api
});
```

### 6. CoreApp

Main application orchestrator.

```javascript
const core = new CoreApp({
  api: { ... },
  layout: { ... },
  pages: [...]
});

core.init();
```

## Component Types

UiBuilder supports these component types:

- `page` - Full page with title
- `card` - Card container
- `grid` - Grid layout
- `form` - Dynamic form
- `table` - Dynamic table
- `crud` - Complete CRUD system
- `button` - Button with action
- `text` - Text/paragraph
- `heading` - H1-H6
- `stats` - Statistics cards
- `divider` - Horizontal line
- `spacer` - Spacing element
- `custom` - Custom renderer

## API Reference

See individual module files for complete API documentation:

- [api-client.js](api-client.js) - REST API client
- [form-builder.js](form-builder.js) - Form generator
- [table-builder.js](table-builder.js) - Table generator
- [crud-engine.js](crud-engine.js) - CRUD engine
- [ui-builder.js](ui-builder.js) - UI builder
- [core.js](core.js) - Core application

## Examples

### Dashboard Page

```javascript
core.addPage('/', {
  type: 'page',
  title: 'Dashboard',
  children: [
    {
      type: 'stats',
      items: [
        { icon: 'fas fa-users', label: 'Users', value: '1,234' },
        { icon: 'fas fa-box', label: 'Products', value: '567' },
        { icon: 'fas fa-shopping-cart', label: 'Orders', value: '8,901' }
      ]
    },
    {
      type: 'card',
      title: 'Recent Activity',
      children: [
        { type: 'text', text: 'No recent activity' }
      ]
    }
  ]
});
```

### CRUD Page with Permissions

```javascript
core.addCrudPage('/products', {
  resource: 'products',
  title: 'Product Management',
  permissions: {
    create: ['admin'],
    read: ['admin', 'user'],
    update: ['admin'],
    delete: ['admin']
  },
  table: { ... },
  form: { ... }
}, {
  permissions: ['admin'] // Current user roles
});
```

## Integration

### With layout.js

Core App automatically integrates with layout.js:
- Pages registered via `addPage()` or `addCrudPage()`
- Theme management
- Side menu and navbar
- RBAC system
- Toast notifications
- Modal dialogs

### With el.js

All components return el.js elements:
- Chainable API
- Consistent styling
- Event handling
- DOM manipulation

## Best Practices

1. **Organize Schemas**: Keep JSON schemas in separate files
2. **Reuse Forms**: Share form schemas between create/edit
3. **Error Handling**: Use ApiClient error handlers
4. **Permissions**: Define permissions at page and field level
5. **Validation**: Always validate forms before submission

## License

MIT
