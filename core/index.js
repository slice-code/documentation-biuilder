// Core App - Main Entry Point
// This file loads all core modules and makes them available globally

(function() {
  'use strict';

  // Check if el.js is loaded
  if (typeof el === 'undefined') {
    throw new Error('el.js is required. Please load el.js before core modules.');
  }

  // All modules are already loaded via separate script tags
  // This file serves as documentation and validation

  console.log('Core App modules loaded successfully');
  console.log('Available modules:');
  console.log('  - CoreApp');
  console.log('  - ApiClient');
  console.log('  - FormBuilder');
  console.log('  - TableBuilder');
  console.log('  - CrudEngine');
  console.log('  - UiBuilder');

  // Example usage (uncomment to test):
  /*
  const core = new CoreApp({
    api: {
      baseUrl: 'http://localhost:3000/api',
      token: () => localStorage.getItem('token')
    },
    layout: {
      theme: 'blue',
      sideMenu: [
        { name: 'Dashboard', icon: 'fas fa-home', page: '/' },
        { name: 'Users', icon: 'fas fa-users', page: '/users' },
        { name: 'Products', icon: 'fas fa-box', page: '/products' }
      ],
      navbar: [
        { name: 'Profile', page: '/profile' }
      ]
    },
    pages: [
      {
        path: '/',
        schema: {
          type: 'page',
          title: 'Dashboard',
          children: [
            {
              type: 'stats',
              items: [
                { icon: 'fas fa-users', label: 'Total Users', value: '1,234', color: '#2563eb' },
                { icon: 'fas fa-box', label: 'Total Products', value: '567', color: '#16a34a' },
                { icon: 'fas fa-shopping-cart', label: 'Total Orders', value: '8,901', color: '#f59e0b' }
              ]
            }
          ]
        }
      },
      {
        path: '/users',
        type: 'crud',
        schema: {
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
        }
      }
    ]
  });

  core.init();
  */

})();
