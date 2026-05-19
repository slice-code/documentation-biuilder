(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.CrudEngine = factory());
})(this, (function () {
  'use strict';

  const CrudEngine = {
    /** Preset field (JSON) lalu muat opsi select — sebelum FormBuilder.prepareFormSchema */
    async prepareFormSchemaForCrud(schema, apiClient, initialData = {}, opts = {}) {
      let form = schema.form || {};
      if (typeof FormFieldPresets !== 'undefined' && FormFieldPresets.resolveFormSchema) {
        form = await FormFieldPresets.resolveFormSchema(form, schema);
      }
      const payload = { ...form, ...(opts.hideButtons ? { hideButtons: true } : {}) };
      return FormBuilder.prepareFormSchema(payload, apiClient, initialData);
    },

    // Build complete CRUD UI from JSON schema
    build(schema, options = {}) {
      const {
        apiClient = null,
        container = null,
        permissions = null
      } = options;

      const resource = schema.resource;
      let tableInstance = null;
      let currentPermissions = permissions || {};
      let lastPage = 1;
      let lastPerPage = parseInt(localStorage.getItem(`crud_perPage_${schema.resource}`)) || schema.table?.features?.perPage || 10;
      let lastSearch = null;
      let lastSortColumn = schema.table?.defaultSort?.column || null;
      let lastSortDirection = schema.table?.defaultSort?.direction || 'asc';

      // Check permissions
      const canCreate = this.checkPermission('create', schema.permissions, currentPermissions);
      const canRead = this.checkPermission('read', schema.permissions, currentPermissions);
      const canUpdate = this.checkPermission('update', schema.permissions, currentPermissions);
      const canDelete = this.checkPermission('delete', schema.permissions, currentPermissions);

      // Container - full height flex column
      const crudContainer = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#fff'
      });

      // Header bar: title + search + create button (responsive)
      const header = el('div').css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.65rem',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid #e2e8f0',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        flexShrink: '0',
        position: 'relative',
        zIndex: '10',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)'
      });

      // Title (left side)
      const titleEl = el('h2')
        .text(schema.title || 'CRUD')
        .css({
          margin: '0',
          fontSize: '1.35rem',
          fontWeight: '700',
          color: '#0f172a',
          whiteSpace: 'nowrap',
          flexShrink: '0',
          letterSpacing: '-0.02em'
        });
      header.child(titleEl);

      const searchWrap = el('div').css({
        flex: '1',
        minWidth: '200px',
        display: 'flex',
        alignItems: 'center',
        position: 'relative'
      });
      searchWrap.child(el('i').class('fas fa-search').css({
        position: 'absolute',
        left: '0.85rem',
        color: '#94a3b8',
        fontSize: '0.85rem',
        pointerEvents: 'none'
      }));
      const searchInput = el('input')
        .attr('type', 'text')
        .attr('placeholder', 'Search records...')
        .class('crud-dt-search')
        .css({
          width: '100%',
          padding: '0.55rem 0.85rem 0.55rem 2.35rem',
          borderRadius: '0.625rem',
          border: '1px solid #cbd5e1',
          fontSize: '0.875rem',
          outline: 'none',
          backgroundColor: '#fff',
          color: '#0f172a',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
        });
      searchWrap.child(searchInput);
      header.child(searchWrap);

      // Clear Sort button (appears when sorting is active)
      const clearSortBtn = el('button').attr('type', 'button').css({
        padding: '0.55rem 1rem',
        borderRadius: '0.625rem',
        border: '1px solid #f59e0b',
        backgroundColor: '#fffbeb',
        color: '#b45309',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: '600',
        display: 'none', // Hidden by default, shown when sorting active
        alignItems: 'center',
        gap: '0.45rem',
        whiteSpace: 'nowrap',
        flexShrink: '0',
        transition: 'all 0.15s ease'
      });
      clearSortBtn.child(el('i').class('fas fa-sort-amount-down-alt'));
      clearSortBtn.child(el('span').text('Clear Sort'));
      clearSortBtn.click(() => {
        // Reset to default sort from schema
        const defaultColumn = schema.table?.defaultSort?.column || null;
        const defaultDirection = schema.table?.defaultSort?.direction || 'asc';
        
        lastSortColumn = defaultColumn;
        lastSortDirection = defaultDirection;
        
        // Hide clear button
        clearSortBtn.css({ display: 'none' });
        
        // Reload data with default sort
        this.loadData(schema, apiClient, tableInstance, lastSearch, lastSortColumn, lastSortDirection, lastPage, lastPerPage);
        
        // Notify table to update sort indicators
        if (tableInstance && typeof tableInstance.resetSort === 'function') {
          tableInstance.resetSort(defaultColumn, defaultDirection);
        }
      });
      header.child(clearSortBtn);

      // Export Excel (SheetJS)
      if (typeof CrmExport !== 'undefined' && schema.resource) {
        const exportBtn = el('button').attr('type', 'button').css({
          padding: '0.55rem 1rem',
          borderRadius: '0.625rem',
          border: '1px solid #cbd5e1',
          backgroundColor: '#fff',
          color: '#334155',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          whiteSpace: 'nowrap',
          flexShrink: '0'
        });
        exportBtn.child(el('i').class('fas fa-file-excel').css({ color: '#16a34a' }));
        exportBtn.child(el('span').text('Excel'));
        exportBtn.click(() => {
          CrmExport.runExport(() => CrmExport.exportTableXlsx(schema.resource));
        });
        header.child(exportBtn);
      }

      // Create button (right side)
      if (canCreate) {
        const createButton = el('button')
          .css({
            padding: '0.55rem 1.1rem',
            borderRadius: '0.625rem',
            border: 'none',
            background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
            flexShrink: '0',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
          });

        createButton.child(el('i').class('fas fa-plus'));
        createButton.child(el('span').text(schema.createButtonLabel || 'Add New'));

        createButton.click(() => {
          this.openCreateModal(schema, apiClient, tableInstance, refreshTable);
        });

        header.child(createButton);
      }

      crudContainer.child(header);

      if (schema.listSektorFilters && schema.listSektorFilters.length) {
        schema._sektorPrefix = schema._sektorPrefix || '';
        const filterBar = el('div').css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          padding: '0.75rem 1.25rem 0.75rem',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        });
        const chipButtons = [];
        schema.listSektorFilters.forEach((f) => {
          const active = (schema._sektorPrefix || '') === (f.prefix || '');
          const chip = el('button').attr('type', 'button').text(f.label).css({
            padding: '0.35rem 0.7rem',
            borderRadius: '999px',
            border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
            background: active ? '#2563eb' : '#fff',
            color: active ? '#fff' : '#475569',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer'
          });
          chipButtons.push({ chip, prefix: f.prefix || '' });
          chip.click(() => {
            schema._sektorPrefix = f.prefix || '';
            chipButtons.forEach(({ chip: c, prefix }) => {
              const isOn = prefix === schema._sektorPrefix;
              c.css({
                border: isOn ? '1px solid #2563eb' : '1px solid #cbd5e1',
                background: isOn ? '#2563eb' : '#fff',
                color: isOn ? '#fff' : '#475569'
              });
            });
            lastPage = 1;
            this.loadData(schema, apiClient, tableInstance, lastSearch, lastSortColumn, lastSortDirection, 1, lastPerPage);
          });
          filterBar.child(chip);
        });
        crudContainer.child(filterBar);
      }

      // Refresh function that preserves current pagination and sort state
      const refreshTable = () => {
        this.loadData(schema, apiClient, tableInstance, lastSearch, lastSortColumn, lastSortDirection, lastPage, lastPerPage);
      };

      // Prepare table columns with actions
      const tableSchema = {
        ...schema.table,
        columns: schema.table.columns.map(col => {
          if (col.type === 'actions') {
            const actions = [];
            
            if (col.actions) {
              col.actions.forEach(action => {
                if (action === 'edit' && canUpdate) {
                  actions.push({
                    icon: 'fas fa-edit',
                    label: 'Edit',
                    onClick: (row) => this.openEditModal(schema, apiClient, tableInstance, row, refreshTable)
                  });
                } else if (action === 'delete' && canDelete) {
                  actions.push({
                    icon: 'fas fa-trash',
                    label: 'Delete',
                    variant: 'danger',
                    confirm: true,
                    onClick: (row) => this.deleteRow(schema, apiClient, tableInstance, row, refreshTable)
                  });
                } else if (action === 'convert' && schema.resource === 'leads') {
                  actions.push({
                    icon: 'fas fa-random',
                    label: 'Convert',
                    onClick: (row) => this.convertLeadRow(apiClient, row, refreshTable)
                  });
                } else if (action === 'timeline') {
                  const timelineTypes = ['customers', 'leads', 'deals', 'companies'];
                  if (timelineTypes.includes(schema.resource) && typeof TimelinePanel !== 'undefined') {
                    actions.push({
                      icon: 'fas fa-history',
                      label: 'Timeline',
                      onClick: (row) => TimelinePanel.open(apiClient, schema.resource, row)
                    });
                  }
                } else if (action === 'detail' && schema.resource === 'personal') {
                  actions.push({
                    icon: 'fas fa-eye',
                    label: 'Detail',
                    onClick: (row) => {
                      const bid = row.id_biodata;
                      if (bid && typeof layout !== 'undefined') {
                        layout.navigate('/biodata/' + encodeURIComponent(bid));
                      }
                    }
                  });
                } else if (action === 'admin' && schema.resource === 'personal') {
                  actions.push({
                    icon: 'fas fa-landmark',
                    label: 'Admin',
                    onClick: (row) => {
                      const bid = row.id_biodata;
                      if (bid && typeof layout !== 'undefined') {
                        layout.navigate('/biodata/' + encodeURIComponent(bid) + '/admin');
                      }
                    }
                  });
                } else if (action === 'upload' && schema.resource === 'personal') {
                  actions.push({
                    icon: 'fas fa-cloud-arrow-up',
                    label: 'Dokumen',
                    onClick: (row) => {
                      const bid = row.id_biodata;
                      if (bid && typeof layout !== 'undefined') {
                        layout.navigate('/biodata/' + encodeURIComponent(bid) + '/upload');
                      }
                    }
                  });
                } else if (action === 'printPdf' && schema.enableRecordPdf && typeof PrintSuratClient !== 'undefined') {
                  const pk = schema.printPkField || 'id';
                  actions.push({
                    icon: 'fas fa-file-pdf',
                    label: 'PDF',
                    variant: 'danger',
                    onClick: async (row) => {
                      const rid = row[pk] ?? row.id_pembuatan ?? row.id;
                      if (!rid) {
                        if (typeof layout !== 'undefined') layout.toast('ID record tidak ditemukan', { type: 'error' });
                        return;
                      }
                      try {
                        await PrintSuratClient.downloadRecordPdf(schema.resource, rid);
                        if (typeof layout !== 'undefined') layout.toast('PDF diunduh.', { type: 'success' });
                      } catch (e) {
                        if (typeof layout !== 'undefined') layout.toast(e.message || 'Gagal cetak PDF', { type: 'error' });
                      }
                    }
                  });
                } else if (action === 'exportPinjaman' && schema.enableSuratPengajuanExcel && typeof PrintSuratClient !== 'undefined') {
                  const pk = schema.printPkField || 'id';
                  actions.push({
                    icon: 'fas fa-file-excel',
                    label: 'Excel',
                    variant: 'success',
                    onClick: async (row) => {
                      const rid = row[pk] ?? row.id_surat_aju ?? row.id;
                      if (!rid) {
                        if (typeof layout !== 'undefined') layout.toast('ID record tidak ditemukan', { type: 'error' });
                        return;
                      }
                      try {
                        await PrintSuratClient.downloadSuratPengajuanExcel(rid);
                        if (typeof layout !== 'undefined') layout.toast('Excel diunduh.', { type: 'success' });
                      } catch (e) {
                        if (typeof layout !== 'undefined') layout.toast(e.message || 'Gagal export', { type: 'error' });
                      }
                    }
                  });
                } else if (action === 'print' && schema.enableRecordPrint && typeof PrintSuratClient !== 'undefined') {
                  const pk = schema.printPkField || 'id';
                  actions.push({
                    icon: 'fas fa-print',
                    label: 'Print',
                    variant: 'warning',
                    onClick: async (row) => {
                      const rid = row[pk] ?? row.id_pembuatan ?? row.id_pembuatanpap ?? row.id;
                      if (!rid) {
                        if (typeof layout !== 'undefined') layout.toast('ID record tidak ditemukan', { type: 'error' });
                        return;
                      }
                      const idTki = row.id_tki || row.id_biodata;
                      if (!idTki) {
                        if (typeof layout !== 'undefined') {
                          layout.toast('Isi ID TKI pada data ini sebelum cetak', { type: 'error' });
                        }
                        return;
                      }
                      try {
                        await PrintSuratClient.downloadRecordWord(schema.resource, rid);
                        if (typeof layout !== 'undefined') layout.toast('Word diunduh.', { type: 'success' });
                      } catch (e) {
                        if (typeof layout !== 'undefined') layout.toast(e.message || 'Gagal cetak', { type: 'error' });
                      }
                    }
                  });
                } else if (typeof action === 'object') {
                  actions.push(action);
                }
              });
            }

            return {
              ...col,
              actions: actions
            };
          }
          return col;
        })
      };

      // Build table (search disabled - handled by CRUD header)
      const tableSchemaNoSearch = { 
        ...tableSchema, 
        features: { 
          ...tableSchema.features, 
          search: false, 
          perPage: lastPerPage,
          // Default sortable to true if not explicitly disabled
          sortable: tableSchema.features?.sortable !== false
        } 
      };
      tableInstance = TableBuilder.build(tableSchemaNoSearch, {
        data: [],
        onSearch: (query) => {
          lastSearch = query;
          lastPage = 1;
          this.loadData(schema, apiClient, tableInstance, query, lastSortColumn, lastSortDirection, 1, lastPerPage);
        },
        onSort: (column, direction, multiColumns) => {
          lastSortColumn = column;
          lastSortDirection = direction;
          // Use multi-column sort if available, otherwise fallback to single
          this.loadData(schema, apiClient, tableInstance, lastSearch, column, direction, lastPage, lastPerPage, multiColumns);
        },
        onSortChange: (sortColumns) => {
          // Show/hide clear sort button based on active sorting
          const hasActiveSort = sortColumns && sortColumns.length > 0;
          const hasDefaultSort = schema.table?.defaultSort?.column;
          
          // Show button if there's sorting AND it's different from default
          if (hasActiveSort && sortColumns[0]?.column !== hasDefaultSort) {
            clearSortBtn.css({ display: 'flex' });
          } else if (hasActiveSort && sortColumns[0]?.direction !== (schema.table?.defaultSort?.direction || 'asc')) {
            clearSortBtn.css({ display: 'flex' });
          } else {
            clearSortBtn.css({ display: 'none' });
          }
        },
        onPageChange: (page) => {
          lastPage = page;
          this.loadData(schema, apiClient, tableInstance, lastSearch, lastSortColumn, lastSortDirection, page, lastPerPage);
        },
        onPerPageChange: (newPerPage, page) => {
          lastPerPage = newPerPage;
          lastPage = page;
          localStorage.setItem(`crud_perPage_${schema.resource}`, newPerPage);
          this.loadData(schema, apiClient, tableInstance, lastSearch, lastSortColumn, lastSortDirection, page, newPerPage);
        }
      });

      // Wire search input from header to table (with debounce for server-side search)
      let searchTimeout = null;
      searchInput.on('input', (e) => {
        const query = e.target.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          lastSearch = query;
          lastPage = 1;
          this.loadData(schema, apiClient, tableInstance, query, lastSortColumn, lastSortDirection, 1, lastPerPage);
        }, 400);
      });

      // Table goes directly in container (table-builder handles its own scroll)
      crudContainer.child(tableInstance.el);

      // Load initial data with default sort
      if (canRead && apiClient) {
        this.loadData(schema, apiClient, tableInstance, lastSearch, lastSortColumn, lastSortDirection, lastPage, lastPerPage);
      }

      return {
        el: crudContainer,
        get: () => crudContainer.get(),
        table: tableInstance,
        loadData: refreshTable,
        openCreateModal: () => this.openCreateModal(schema, apiClient, tableInstance, refreshTable),
        openEditModal: (row) => this.openEditModal(schema, apiClient, tableInstance, row, refreshTable),
        deleteRow: (row) => this.deleteRow(schema, apiClient, tableInstance, row, refreshTable),
        setPermissions: (perms) => {
          currentPermissions = perms;
        },
        refresh: refreshTable
      };
    },

    // Load data from API
    async loadData(schema, apiClient, tableInstance, search = null, sortColumn = null, sortDirection = null, page = 1, perPageOverride = null, multiColumns = null) {
      if (!apiClient || !tableInstance) return;

      tableInstance.setLoading(true);

      try {
        const resource = schema.resource;
        let endpoint = resource;

        // Build query parameters
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        
        // Support multi-column sort
        if (multiColumns && multiColumns.length > 0) {
          // Format: sort=column1:asc,column2:desc
          const sortParams = multiColumns.map(s => `${s.column}:${s.direction}`).join(',');
          params.set('sort', sortParams);
        } else if (sortColumn) {
          // Legacy single sort
          params.set('sort', sortColumn);
          if (sortDirection) params.set('order', sortDirection);
        }
        
        params.set('page', page);
        params.set('perPage', perPageOverride || schema.table.features?.perPage || 10);
        if (schema._sektorPrefix) {
          params.set('sektor_prefix', schema._sektorPrefix);
        }

        const queryString = params.toString();
        if (queryString) {
          endpoint = `${resource}?${queryString}`;
        }

        const response = await apiClient.read(endpoint);
        
        // Handle different response formats
        let data = [];
        if (Array.isArray(response)) {
          data = response;
        } else if (response.data && Array.isArray(response.data)) {
          data = response.data;
        } else if (response.items && Array.isArray(response.items)) {
          data = response.items;
        }

        // Pass server pagination info if available
        const serverPagination = response.pagination || null;
        tableInstance.setData(data, serverPagination);
      } catch (error) {
        console.error('Error loading data:', error);
        tableInstance.setData([]);
      } finally {
        tableInstance.setLoading(false);
      }
    },

    // Open create modal or new page
    openCreateModal(schema, apiClient, tableInstance, refreshTable) {
      if (!apiClient) {
        console.error('ApiClient not provided');
        return;
      }

      if (schema.createPath && typeof layout !== 'undefined' && layout.navigate) {
        layout.navigate(schema.createPath);
        return;
      }

      const formDisplay = schema.formDisplay || 'modal'; // 'modal' or 'newpage'

      if (formDisplay === 'newpage') {
        this.openCreateAsNewPage(schema, apiClient, tableInstance, refreshTable);
      } else {
        this.openCreateAsModal(schema, apiClient, tableInstance, refreshTable);
      }
    },

    // Open create form as modal
    async openCreateAsModal(schema, apiClient, tableInstance, refreshTable) {
      const formSchema = await this.prepareFormSchemaForCrud(schema, apiClient, {}, { hideButtons: true });

      const form = FormBuilder.build(formSchema, {
        apiClient,
        onSubmit: async (formData) => {
          try {
            await apiClient.create(schema.resource, formData);
            
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Data created successfully', { type: 'success' });
            }
            
            layout.closeModal();
            refreshTable();
          } catch (error) {
            console.error('Error creating data:', error);
            if (typeof layout !== 'undefined' && layout.toast) {
              layout.toast('Error creating data', { type: 'error' });
            }
          }
        }
      });

      if (typeof layout !== 'undefined' && layout.modal) {
        layout.modal({
          title: `Create ${schema.title || 'New Item'}`,
          content: form.el,
          footer: this.createModalFooter(schema, apiClient, tableInstance, null, 'create'),
          dismissible: true,
          size: schema.modalSize || 'medium' // 'small', 'medium', 'large', 'full'
        });
      }
    },

    // Open create form as new page
    openCreateAsNewPage(schema, apiClient, tableInstance, refreshTable) {
      const formPagePath = `/${schema.resource}/create`;
      const listPath = schema.path || `/${schema.resource}`;

      if (typeof layout !== 'undefined') {
        layout.addPage({
          path: formPagePath,
          component: async () => {
            const preparedForm = await CrudEngine.prepareFormSchemaForCrud(schema, apiClient, {});
            const form = FormBuilder.build(preparedForm, {
              apiClient,
              onSubmit: async (formData) => {
                try {
                  await apiClient.create(schema.resource, formData);
                  if (typeof layout !== 'undefined' && layout.toast) {
                    layout.toast('Data created successfully', { type: 'success' });
                  }
                  layout.navigate(listPath);
                  refreshTable();
                } catch (error) {
                  console.error('Error creating data:', error);
                  if (typeof layout !== 'undefined' && layout.toast) {
                    layout.toast('Error creating data', { type: 'error' });
                  }
                }
              },
              onCancel: () => layout.navigate(listPath)
            });

            const pageContainer = el('div').css({
              width: '100%',
              padding: '2rem',
              boxSizing: 'border-box'
            });

            pageContainer.child(
              el('h1').css({ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' })
                .text(`Create ${schema.title || 'New Item'}`)
            );

            const card = el('div').css({
              backgroundColor: '#fff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              width: '100%',
              boxSizing: 'border-box'
            });
            card.child(form.el.css({ width: '100%' }));
            pageContainer.child(card);

            return pageContainer.get();
          },
          hideLayout: false
        });

        layout.navigate(formPagePath);
        if (typeof layout.resetPageScroll === 'function') {
          layout.resetPageScroll();
        }
      }
    },

    // Open edit modal or new page
    async openEditModal(schema, apiClient, tableInstance, row, refreshTable) {
      if (!apiClient) {
        console.error('ApiClient not provided');
        return;
      }

      const formDisplay = schema.formDisplay || 'modal';

      if (formDisplay === 'newpage') {
        await this.openEditAsNewPage(schema, apiClient, tableInstance, row, refreshTable);
      } else {
        await this.openEditAsModal(schema, apiClient, tableInstance, row, refreshTable);
      }
    },

    // Open edit form as modal
    async openEditAsModal(schema, apiClient, tableInstance, row, refreshTable) {
      // Fetch fresh data from API before opening edit form
      const id = row.id || row._id;
      let freshData = row; // Fallback to row data if fetch fails
      
      // Show loading spinner overlay
      let loadingOverlayEl = null;
      if (typeof layout !== 'undefined') {
        // Create loading overlay
        const loadingOverlay = el('div').css({
          position: 'fixed',
          inset: '0',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: '9999',
          backdropFilter: 'blur(2px)'
        });
        
        // Spinner
        const spinner = el('div').css({
          width: '56px',
          height: '56px',
          border: '5px solid rgba(255, 255, 255, 0.3)',
          borderTop: '5px solid #3b82f6',
          borderRadius: '50%',
          animation: 'crud-spin 0.8s linear infinite'
        });
        
        loadingOverlay.child(spinner);
        
        // Add animation if not exists
        if (!document.getElementById('crud-spin-style')) {
          const style = document.createElement('style');
          style.id = 'crud-spin-style';
          style.textContent = '@keyframes crud-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
          document.head.appendChild(style);
        }
        
        // Store DOM element reference
        loadingOverlayEl = loadingOverlay.get();
        document.body.appendChild(loadingOverlayEl);
      }
      
      try {
        const response = await apiClient.read(`${schema.resource}/${id}`);
        if (response && response.data) {
          freshData = response.data;
        } else if (response && !response.data) {
          // Handle direct response (not wrapped in data property)
          freshData = response;
        }
      } catch (error) {
        console.warn('Failed to fetch fresh data, using cached row data:', error);
        if (typeof layout !== 'undefined' && layout.toast) {
          layout.toast('Using cached data (fetch failed)', { type: 'warning', duration: 2000 });
        }
        // Continue with cached data from table
      }

      // Hide loading spinner
      if (loadingOverlayEl && loadingOverlayEl.parentNode) {
        loadingOverlayEl.remove();
        loadingOverlayEl = null;
      }

      try {
        const formSchema = await this.prepareFormSchemaForCrud(schema, apiClient, freshData, { hideButtons: true });

        const form = FormBuilder.build(formSchema, {
          apiClient,
          initialData: freshData,
          onSubmit: async (formData) => {
            try {
              const updateId = freshData.id || freshData._id;
              await apiClient.update(`${schema.resource}/${updateId}`, formData);
              
              if (typeof layout !== 'undefined' && layout.toast) {
                layout.toast('Data updated successfully', { type: 'success' });
              }
              
              layout.closeModal();
              refreshTable();
            } catch (error) {
              console.error('Error updating data:', error);
              if (typeof layout !== 'undefined' && layout.toast) {
                layout.toast('Error updating data', { type: 'error' });
              }
            }
          }
        });

        if (typeof layout !== 'undefined' && layout.modal) {
          layout.modal({
            title: `Edit ${schema.title || 'Item'}`,
            content: form.el,
            footer: this.createModalFooter(schema, apiClient, tableInstance, freshData, 'edit'),
            dismissible: true,
            size: schema.modalSize || 'medium'
          });
        }
      } catch (error) {
        console.error('Error preparing form:', error);
        // Ensure overlay is removed even if form preparation fails
        if (loadingOverlayEl && loadingOverlayEl.parentNode) {
          loadingOverlayEl.remove();
          loadingOverlayEl = null;
        }
        if (typeof layout !== 'undefined' && layout.toast) {
          layout.toast('Failed to load form', { type: 'error' });
        }
      }
    },

    // Open edit form as new page
    async openEditAsNewPage(schema, apiClient, tableInstance, row, refreshTable) {
      const id = row.id || row._id;
      const formPagePath = `/${schema.resource}/edit/${id}`;
      const listPath = schema.path || `/${schema.resource}`;

      if (typeof layout !== 'undefined') {
        layout.addPage({
          path: formPagePath,
          component: async () => {
            // Show loading state
            const loadingContainer = el('div').css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem',
              gap: '1rem'
            });
            
            // Spinner
            const spinner = el('div').css({
              width: '64px',
              height: '64px',
              border: '5px solid #e2e8f0',
              borderTop: '5px solid #3b82f6',
              borderRadius: '50%',
              animation: 'crud-spin 0.8s linear infinite'
            });
            
            const loadingText = el('p').css({
              fontSize: '1.125rem',
              color: '#64748b',
              fontWeight: '500'
            }).text('Loading data...');
            
            loadingContainer.child(spinner);
            loadingContainer.child(loadingText);
            
            // Add spin animation if not already added
            if (!document.getElementById('crud-spin-style')) {
              const style = document.createElement('style');
              style.id = 'crud-spin-style';
              style.textContent = '@keyframes crud-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
              document.head.appendChild(style);
            }

            // Fetch fresh data from API
            let freshData = row;
            try {
              const response = await apiClient.read(`${schema.resource}/${id}`);
              if (response && response.data) {
                freshData = response.data;
              } else if (response && !response.data) {
                freshData = response;
              }
            } catch (error) {
              console.warn('Failed to fetch fresh data, using cached row data:', error);
              if (typeof layout !== 'undefined' && layout.toast) {
                layout.toast('Using cached data (fetch failed)', { type: 'warning', duration: 2000 });
              }
            }

            const preparedForm = await CrudEngine.prepareFormSchemaForCrud(schema, apiClient, freshData);
            const form = FormBuilder.build(preparedForm, {
              apiClient,
              initialData: freshData,
              onSubmit: async (formData) => {
                try {
                  const updateId = freshData.id || freshData._id;
                  await apiClient.update(`${schema.resource}/${updateId}`, formData);
                  if (typeof layout !== 'undefined' && layout.toast) {
                    layout.toast('Data updated successfully', { type: 'success' });
                  }
                  layout.navigate(listPath);
                  refreshTable();
                } catch (error) {
                  console.error('Error updating data:', error);
                  if (typeof layout !== 'undefined' && layout.toast) {
                    layout.toast('Error updating data', { type: 'error' });
                  }
                }
              },
              onCancel: () => layout.navigate(listPath)
            });

            const pageContainer = el('div').css({
              width: '100%',
              padding: '2rem',
              boxSizing: 'border-box'
            });

            pageContainer.child(
              el('h1').css({ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' })
                .text(`Edit ${schema.title || 'Item'}`)
            );

            const card = el('div').css({
              backgroundColor: '#fff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              width: '100%',
              boxSizing: 'border-box'
            });
            card.child(form.el.css({ width: '100%' }));
            pageContainer.child(card);

            return pageContainer.get();
          },
          hideLayout: false
        });

        layout.navigate(formPagePath);
        if (typeof layout.resetPageScroll === 'function') {
          layout.resetPageScroll();
        }
      }
    },

    // Delete row
    async deleteRow(schema, apiClient, tableInstance, row, refreshTable) {
      if (!apiClient) {
        console.error('ApiClient not provided');
        return;
      }

      if (typeof layout !== 'undefined' && layout.confirm) {
        layout.confirm({
          title: 'Delete Confirmation',
          message: `Are you sure you want to delete this ${schema.title?.toLowerCase() || 'item'}?`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          onConfirm: async () => {
            try {
              const id = row.id || row._id;
              await apiClient.delete(`${schema.resource}/${id}`);
              
              if (typeof layout !== 'undefined' && layout.toast) {
                layout.toast('Data deleted successfully', { type: 'success' });
              }
              
              refreshTable();
            } catch (error) {
              console.error('Error deleting data:', error);
            }
          }
        });
      }
    },

    // Check permission
    checkPermission(action, permissions) {
      if (typeof CrmRbac !== 'undefined') {
        return CrmRbac.can(action, permissions);
      }
      if (!permissions || !permissions[action]) return true;
      return true;
    },

    async convertLeadRow(apiClient, row, refreshTable) {
      if (row.is_converted) {
        const msg = 'This lead has already been converted.';
        if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: 'warning' });
        else alert(msg);
        return;
      }
      const name = row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
      if (!confirm(`Convert lead "${name}" to a customer?`)) return;

      try {
        const res = await apiClient.request(`/leads/${row.id}/convert`, {
          method: 'POST',
          body: JSON.stringify({ createDeal: true })
        });
        const code = res.data?.customer?.customer_code || '';
        const msg = code ? `Customer ${code} created successfully.` : 'Lead converted successfully.';
        if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: 'success' });
        else alert(msg);
        if (refreshTable) refreshTable();
      } catch (err) {
        const msg = err.data?.error || err.message || 'Failed to convert lead';
        if (typeof layout !== 'undefined' && layout.toast) layout.toast(msg, { type: 'error' });
        else alert(msg);
      }
    },

    // Create modal footer with save/cancel buttons
    createModalFooter(schema, apiClient, tableInstance, row, mode) {
      const footer = el('div').css({
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.75rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb'
      });

      // Cancel button
      const cancelButton = el('button')
        .text('Cancel')
        .css({
          padding: '0.65rem 1.25rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          backgroundColor: '#fff',
          color: '#374151',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: '500'
        })
        .click(() => {
          if (typeof layout !== 'undefined') {
            layout.closeModal();
          }
        });

      // Save button
      const saveButton = el('button')
        .text(mode === 'create' ? 'Create' : 'Save')
        .css({
          padding: '0.65rem 1.25rem',
          borderRadius: '0.5rem',
          border: 'none',
          backgroundColor: '#2563eb',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: '500'
        })
        .click(() => {
          // Trigger form submit - find form and dispatch submit event
          const form = document.querySelector('#crud-form');
          if (form) {
            form.requestSubmit();
          }
        });

      footer.child(cancelButton);
      footer.child(saveButton);

      return footer;
    }
  };

  return CrudEngine;
}));
