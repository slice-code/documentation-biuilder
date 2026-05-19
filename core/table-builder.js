(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.TableBuilder = factory());
})(this, (function () {
  'use strict';

  // Tema visual datatable (hanya styling, tidak mengubah layout/fungsi)
  const DT = {
    font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    paginationBg: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    paginationBorder: '1px solid #e2e8f0',
    theadBg: '#f1f5f9',
    theadColor: '#475569',
    theadBorder: '2px solid #e2e8f0',
    rowBorder: '1px solid #f1f5f9',
    rowHover: '#f8fafc',
    rowAlt: '#fafbfc',
    rowSelected: '#eff6ff',
    text: '#0f172a',
    muted: '#64748b',
    accent: '#2563eb',
    accentSoft: '#dbeafe',
    dangerSoft: '#fef2f2',
    danger: '#dc2626',
    radius: '0.5rem',
    shadowSm: '0 1px 2px rgba(15, 23, 42, 0.05)',
    shadowMd: '0 4px 12px rgba(15, 23, 42, 0.06)'
  };

  let spinStyleInjected = false;
  function ensureTableStyles() {
    if (spinStyleInjected || document.querySelector('style[data-crud-table-style]')) return;
    spinStyleInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-crud-table-style', 'true');
    style.textContent = `
      @keyframes crud-table-spin {
        to { transform: rotate(360deg); }
      }
      .crud-dt-search:focus {
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
      }
    `;
    document.head.appendChild(style);
  }

  const TableBuilder = {
    // Build table from JSON schema
    build(schema, options = {}) {
      ensureTableStyles();
      const {
        data = [],
        onDataChange = () => {},
        onPageChange = () => {},
        onPerPageChange = () => {},
        onSort = () => {},
        onSortChange = () => {}, // New callback for sort state changes
        onSearch = () => {},
        onSelectionChange = () => {}
      } = options;

      let tableData = [...data];
      let currentPage = 1;
      let perPage = schema.features?.perPage || 10;
      let sortColumn = null;
      let sortDirection = 'asc';
      let sortColumns = []; // Multi-column sort: [{ column, direction }, ...]
      let searchQuery = '';
      let selectedRows = new Set();
      let isLoading = false;

      // Default sortable to true if not explicitly set
      const isSortable = schema.features?.sortable !== false;
      const isMultiSort = schema.features?.multiSort !== false; // Default enable multi-sort

      // Table container
      const container = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        flex: '1',
        overflow: 'auto',
        fontFamily: DT.font,
        backgroundColor: '#fff',
        margin: '0',
        minHeight: '0'
      });

      // Search bar
      let searchInput = null;
      if (schema.features?.search) {
        const searchContainer = el('div').css({
          display: 'flex',
          gap: '0.5rem',
          padding: '0 0 0.75rem 0',
          backgroundColor: '#fff'
        });

        searchInput = el('input')
          .attr('type', 'text')
          .attr('placeholder', 'Search...')
          .css({
            flex: '1',
            padding: '0.65rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #d1d5db',
            fontSize: '0.95rem',
            outline: 'none'
          })
          .on('input', (e) => {
            searchQuery = e.target.value;
            currentPage = 1;
            onSearch(searchQuery);
            this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
          });

        searchContainer.child(searchInput);
        container.child(searchContainer);
      }

      // Table wrapper (only tbody scrolls, thead stays fixed via sticky)
      const tableWrapper = el('div').css({
        overflowY: 'auto',
        overflowX: 'auto',
        flex: '0 1 auto',
        maxHeight: '100%',
        minHeight: '0',
        position: 'relative',
        backgroundColor: '#fff',
        borderLeft: DT.paginationBorder,
        borderRight: DT.paginationBorder,
        borderBottom: DT.paginationBorder,
        borderRadius: '0'
      });

      // Table element
      const table = el('table').css({
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '0',
        fontSize: '0.875rem',
        color: DT.text
      });

      // Table header (sticky - stays fixed while body scrolls)
      const thead = el('thead').css({
        backgroundColor: DT.theadBg,
        borderBottom: DT.theadBorder,
        position: 'sticky',
        top: '0',
        zIndex: '2',
        boxShadow: DT.shadowSm
      });

      const headerRow = el('tr');

      // Selection checkbox column
      if (schema.features?.selectable) {
        headerRow.child(
          el('th').css({
            padding: '0.85rem 0.75rem',
            textAlign: 'left',
            fontWeight: '600',
            width: '50px',
            backgroundColor: DT.theadBg,
            color: DT.theadColor,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }).child(
            el('input')
              .attr('type', 'checkbox')
              .css({ width: '1rem', height: '1rem', cursor: 'pointer' })
              .on('change', (e) => {
                if (e.target.checked) {
                  filteredData().forEach((row, idx) => selectedRows.add(idx));
                } else {
                  selectedRows.clear();
                }
                onSelectionChange(Array.from(selectedRows).map(idx => filteredData()[idx]));
                this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
              })
          )
        );
      }

      // Data columns
      const columnSortUpdaters = []; // Store update functions for each column
      
      schema.columns.forEach(column => {
        // Default sortable to true for all columns EXCEPT actions type
        const columnSortable = column.sortable !== false && column.type !== 'actions';
        
        const th = el('th').css({
          padding: '0.85rem 1rem',
          textAlign: 'left',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          cursor: columnSortable && isSortable ? 'pointer' : 'default',
          backgroundColor: DT.theadBg,
          color: DT.theadColor,
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          userSelect: 'none',
          transition: 'color 0.15s ease',
          position: 'relative'
        }).text(column.label || '');

        if (columnSortable && isSortable) {
          // Sort icon container
          const sortIconWrap = el('span').css({
            display: 'inline-flex',
            alignItems: 'center',
            marginLeft: '0.35rem',
            gap: '0.15rem'
          });

          // Up arrow (asc)
          const iconAsc = el('i').class('fas fa-sort-up').css({
            fontSize: '0.65rem',
            opacity: '0.3',
            color: DT.theadColor,
            transition: 'opacity 0.15s, color 0.15s'
          });

          // Down arrow (desc)
          const iconDesc = el('i').class('fas fa-sort-down').css({
            fontSize: '0.65rem',
            opacity: '0.3',
            color: DT.theadColor,
            transition: 'opacity 0.15s, color 0.15s'
          });

          // Sort order badge (for multi-sort)
          const sortBadge = el('span').css({
            display: 'none',
            fontSize: '0.6rem',
            fontWeight: '700',
            backgroundColor: DT.accent,
            color: '#fff',
            borderRadius: '50%',
            width: '14px',
            height: '14px',
            textAlign: 'center',
            lineHeight: '14px',
            marginLeft: '0.2rem'
          });

          sortIconWrap.child([iconAsc, iconDesc]);
          th.child(sortIconWrap);
          th.child(sortBadge);

          // Update icon states based on current sort
          const updateSortIcons = () => {
            // Check if this column is in multi-sort array
            const sortIndex = sortColumns.findIndex(s => s.column === column.key);
            const isActive = sortIndex !== -1;
            
            if (isActive) {
              const direction = sortColumns[sortIndex].direction;
              if (direction === 'asc') {
                iconAsc.css({ opacity: '1', color: DT.accent });
                iconDesc.css({ opacity: '0.3', color: DT.theadColor });
              } else {
                iconAsc.css({ opacity: '0.3', color: DT.theadColor });
                iconDesc.css({ opacity: '1', color: DT.accent });
              }
              th.css({ color: DT.accent });
              
              // Show badge with sort order number
              if (isMultiSort && sortColumns.length > 1) {
                sortBadge.css({ display: 'inline-block' }).text(String(sortIndex + 1));
              } else {
                sortBadge.css({ display: 'none' });
              }
            } else {
              iconAsc.css({ opacity: '0.3', color: DT.theadColor });
              iconDesc.css({ opacity: '0.3', color: DT.theadColor });
              th.css({ color: DT.theadColor });
              sortBadge.css({ display: 'none' });
            }
          };
          
          // Store updater for external access
          columnSortUpdaters.push(updateSortIcons);

          // Initial state
          updateSortIcons();

          th.click((e) => {
            if (isMultiSort && e.shiftKey) {
              // Multi-column sort with Shift+Click
              const existingIndex = sortColumns.findIndex(s => s.column === column.key);
              
              if (existingIndex !== -1) {
                // Toggle direction for existing column
                sortColumns[existingIndex].direction = 
                  sortColumns[existingIndex].direction === 'asc' ? 'desc' : 'asc';
              } else {
                // Add new column to sort array
                sortColumns.push({ column: column.key, direction: 'asc' });
              }
              
              // Update legacy single-sort variables for backward compatibility
              sortColumn = sortColumns[0]?.column || null;
              sortDirection = sortColumns[0]?.direction || 'asc';
            } else {
              // Single-column sort (regular click) - reset multi-sort
              sortColumns = [{ column: column.key, direction: 'asc' }];
              
              if (sortColumn === column.key) {
                // Toggle direction
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                sortColumns[0].direction = sortDirection;
              } else {
                // New column, start with asc
                sortColumn = column.key;
                sortDirection = 'asc';
              }
            }
            
            // Update visual indicators for ALL sortable columns
            updateSortIcons();
            
            // Notify sort state change (for clear button visibility)
            onSortChange(sortColumns);
            
            // Call onSort with both single and multi-sort info
            onSort(sortColumn, sortDirection, sortColumns);
            this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
          });
        }

        headerRow.child(th);
      });

      thead.child(headerRow);
      table.child(thead);

      // Table body
      const tbody = el('tbody');
      table.child(tbody);
      tableWrapper.child(table);

      // Pagination (above table)
      let paginationContainer = null;
      let handlePageChange = null;
      let loadingSpinner = null;
      if (schema.features?.pagination) {
        paginationContainer = el('div').css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.65rem 1rem',
          borderBottom: DT.paginationBorder,
          borderTop: DT.paginationBorder,
          borderLeft: DT.paginationBorder,
          borderRight: DT.paginationBorder,
          borderRadius: '0',
          background: DT.paginationBg,
          flexShrink: '0',
          fontSize: '0.8125rem',
          color: DT.muted,
          position: 'relative',
          zIndex: '5',
          boxShadow: DT.shadowSm
        });

        // Per page selector
        const perPageContainer = el('div').css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        });

        perPageContainer.child(el('span').text('Show').css({ fontWeight: '500', color: DT.muted }));
        
        const perPageSelect = el('select')
          .css({
            padding: '0.35rem 0.55rem',
            borderRadius: '0.375rem',
            border: '1px solid #cbd5e1',
            fontSize: '0.8125rem',
            outline: 'none',
            backgroundColor: '#fff',
            color: DT.text,
            cursor: 'pointer',
            boxShadow: DT.shadowSm
          });

        const perPageOptions = schema.features?.perPageOptions || [5, 10, 25, 50, 100];
        perPageOptions.forEach(option => {
          const opt = el('option')
            .attr('value', option)
            .text(option);
          if (option === perPage) {
            opt.attr('selected', 'selected');
          }
          perPageSelect.child(opt);
        });

        perPageSelect.on('change', (e) => {
          perPage = parseInt(e.target.value);
          currentPage = 1;
          onPerPageChange(perPage, currentPage);
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
          this.renderPagination(paginationContainer, schema, filteredData().length, currentPage, perPage, handlePageChange);
        });

        perPageContainer.child(perPageSelect);
        perPageContainer.child(el('span').text('rows').css({ color: DT.muted }));

        // Ensure select shows correct value
        perPageSelect.el.value = perPage;
        paginationContainer.child(perPageContainer);

        // Loading spinner (shown next to pagination info)
        loadingSpinner = el('div').css({
          display: 'none',
          width: '14px',
          height: '14px',
          border: '2px solid #e2e8f0',
          borderTop: `2px solid ${DT.accent}`,
          borderRadius: '50%',
          animation: 'crud-table-spin 0.65s linear infinite',
          flexShrink: '0',
          marginLeft: '0.5rem'
        });
        paginationContainer.child(loadingSpinner);

        // Page change handler
        handlePageChange = (page) => {
          currentPage = page;
          onPageChange(page);
        };

        // Pagination buttons
        const paginationButtons = this.createPaginationButtons(
          schema,
          filteredData().length,
          currentPage,
          perPage,
          handlePageChange
        );

        paginationContainer.child(paginationButtons);
        container.child(paginationContainer);
      }

      // Table wrapper after pagination
      container.child(tableWrapper);

      // Bulk actions
      let bulkActionsContainer = null;
      if (schema.features?.selectable && schema.features?.bulkActions?.length > 0) {
        bulkActionsContainer = el('div').css({
          display: 'none',
          gap: '0.5rem',
          padding: '0.75rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '0.5rem',
          border: '1px solid #bae6fd'
        });

        schema.features.bulkActions.forEach(action => {
          const button = el('button')
            .text(action.label)
            .css({
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid #0284c7',
              backgroundColor: '#fff',
              color: '#0284c7',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            });

          if (action.icon) {
            button.child(el('i').class(action.icon));
          }

          button.click(() => {
            const selected = Array.from(selectedRows).map(idx => filteredData()[idx]);
            action.onClick(selected);
          });

          bulkActionsContainer.child(button);
        });

        container.child(bulkActionsContainer);
      }

      // Initial render
      this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
      
      if (paginationContainer) {
        this.renderPagination(paginationContainer, schema, filteredData().length, currentPage, perPage, handlePageChange);
      }

      // Helper function to filter and sort data
      function filteredData() {
        let filtered = [...tableData];

        // Apply search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(row => {
            return schema.columns.some(column => {
              if (column.type === 'actions') return false;
              const value = row[column.key];
              return value && String(value).toLowerCase().includes(query);
            });
          });
        }

        // Apply multi-column sort
        if (sortColumns.length > 0) {
          filtered.sort((a, b) => {
            // Iterate through each sort column
            for (const sort of sortColumns) {
              const aVal = a[sort.column];
              const bVal = b[sort.column];
              
              if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
              if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
              // If equal, continue to next sort column
            }
            return 0;
          });
        }

        return filtered;
      }

      // Return table API
      return {
        el: container,
        get: () => container.get(),
        setData: (newData, serverPagination) => {
          tableData = [...newData];
          if (serverPagination) {
            // Server-side pagination: use server's page info
            currentPage = serverPagination.page || 1;
            perPage = serverPagination.perPage || perPage;
          } else {
            currentPage = 1;
          }
          selectedRows.clear();
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows, serverPagination);
          if (paginationContainer) {
            const totalItems = serverPagination ? serverPagination.total : filteredData().length;
            this.renderPagination(paginationContainer, schema, totalItems, currentPage, perPage, handlePageChange);
          }
          onDataChange(tableData);
        },
        getData: () => [...tableData],
        getSelectedRows: () => Array.from(selectedRows).map(idx => filteredData()[idx]),
        setLoading: (loading) => {
          isLoading = loading;
          if (loading) {
            // Dim table and show spinner
            tbody.css({ opacity: '0.5', pointerEvents: 'none', transition: 'opacity 0.15s' });
            if (loadingSpinner) loadingSpinner.css({ display: 'block' });
          } else {
            tbody.css({ opacity: '1', pointerEvents: 'auto', transition: 'opacity 0.15s' });
            if (loadingSpinner) loadingSpinner.css({ display: 'none' });
          }
        },
        refresh: () => {
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
        },
        resetSort: (column, direction) => {
          // Reset sort state to default
          if (column) {
            sortColumns = [{ column, direction }];
            sortColumn = column;
            sortDirection = direction;
          } else {
            sortColumns = [];
            sortColumn = null;
            sortDirection = 'asc';
          }
          
          // Update all column sort icons
          columnSortUpdaters.forEach(updater => updater());
          
          // Trigger sort change notification
          onSortChange(sortColumns);
          
          // Re-render table with new sort
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
        },
        resetSelection: () => {
          selectedRows.clear();
          onSelectionChange([]);
          this.renderTableBody(tbody, schema, filteredData(), currentPage, perPage, selectedRows);
        }
      };
    },

    // Render table body
    renderTableBody(tbody, schema, data, page, perPage, selectedRows, serverPagination) {
      // Clear the existing tbody
      tbody.empty();

      if (data.length === 0) {
        const colSpan = schema.columns.length + (schema.features?.selectable ? 1 : 0);
        tbody.child(
          el('tr').child(
            el('td')
              .attr('colspan', colSpan)
              .css({
                textAlign: 'center',
                padding: '3rem 1.5rem',
                color: DT.muted,
                backgroundColor: '#fafbfc'
              })
              .child([
                el('div').css({ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.75rem' }).child(
                  el('i').class('fas fa-inbox')
                ),
                el('div').text(schema.emptyText || 'No records found').css({
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  color: DT.muted
                })
              ])
          )
        ).get();
        return;
      }

      // Paginate (skip if server already paginated)
      let pageData;
      let startIdx;
      if (serverPagination) {
        pageData = data;
        startIdx = 0;
      } else {
        const start = (page - 1) * perPage;
        const end = start + perPage;
        pageData = data.slice(start, end);
        startIdx = start;
      }

      pageData.forEach((row, idx) => {
        const globalIdx = startIdx + idx;
        const isSelected = selectedRows.has(globalIdx);
        const isEven = idx % 2 === 1;
        const baseBg = isSelected ? DT.rowSelected : (isEven ? DT.rowAlt : '#ffffff');

        const tr = el('tr').css({
          borderBottom: DT.rowBorder,
          backgroundColor: baseBg,
          transition: 'background-color 0.15s ease, box-shadow 0.15s ease'
        }).hover(
          function() {
            if (!isSelected) this.style.backgroundColor = DT.rowHover;
          },
          function() {
            this.style.backgroundColor = isSelected ? DT.rowSelected : (isEven ? DT.rowAlt : '#ffffff');
          }
        );

        // Selection checkbox
        if (schema.features?.selectable) {
          tr.child(
            el('td').css({ padding: '0.75rem' }).child(
              el('input')
                .attr('type', 'checkbox')
                .attr('checked', selectedRows.has(globalIdx) ? 'checked' : null)
                .css({ width: '1rem', height: '1rem', cursor: 'pointer' })
                .on('change', (e) => {
                  if (e.target.checked) {
                    selectedRows.add(globalIdx);
                  } else {
                    selectedRows.delete(globalIdx);
                  }
                })
            )
          );
        }

        // Data cells
        schema.columns.forEach(column => {
          const td = el('td').css({
            padding: '0.8rem 1rem',
            color: column.type === 'actions' ? 'inherit' : DT.text,
            fontSize: '0.875rem',
            verticalAlign: 'middle'
          });

          if (column.type === 'actions') {
            const actionsContainer = el('div').css({
              display: 'flex',
              gap: '0.35rem',
              justifyContent: 'flex-end'
            });

            const actions = column.actions || [];
            actions.forEach(action => {
              const isDanger = action.variant === 'danger';
              const isWarning = action.variant === 'warning';
              const button = el('button')
                .attr('title', action.label || '')
                .css({
                  width: '2rem',
                  height: '2rem',
                  padding: '0',
                  borderRadius: '0.5rem',
                  border: '1px solid',
                  borderColor: isDanger ? '#fecaca' : isWarning ? '#fde68a' : '#bfdbfe',
                  backgroundColor: isDanger ? DT.dangerSoft : isWarning ? '#fef3c7' : DT.accentSoft,
                  color: isDanger ? DT.danger : isWarning ? '#b45309' : DT.accent,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease'
                });

              if (action.icon) {
                button.child(el('i').class(action.icon));
              } else {
                button.child(el('span').text((action.label || '?').charAt(0)));
              }

              button.click(() => {
                if (action.confirm) {
                  if (typeof layout !== 'undefined' && layout.confirm) {
                    layout.confirm({
                      title: 'Confirm',
                      message: `Are you sure you want to ${action.label.toLowerCase()}?`,
                      onConfirm: () => action.onClick(row)
                    });
                  } else {
                    action.onClick(row);
                  }
                } else {
                  action.onClick(row);
                }
              });

              actionsContainer.child(button);
            });

            td.child(actionsContainer);
          } else if (column.render) {
            td.html(column.render(row[column.key], row));
          } else {
            td.text(row[column.key] ?? '');
          }

          tr.child(td);
        });

        tbody.child(tr);
      });

      // Flush buffered children to DOM
      tbody.get();
    },

    // Create pagination buttons
    createPaginationButtons(schema, totalItems, currentPage, perPage, onPageChange) {
      const container = el('div').css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        flexWrap: 'wrap',
        justifyContent: 'flex-end'
      });

      const totalPages = Math.ceil(totalItems / perPage);

      // Info text
      container.child(
        el('span')
          .css({
            fontSize: '0.8125rem',
            color: DT.muted,
            marginRight: '0.65rem',
            padding: '0.25rem 0.6rem',
            backgroundColor: '#fff',
            borderRadius: '999px',
            border: '1px solid #e2e8f0',
            fontWeight: '500'
          })
          .text(`Page ${currentPage} / ${totalPages || 1} · ${totalItems} records`)
      );

      // Previous button
      const prevButton = el('button')
        .text('‹')
        .css({
          minWidth: '2rem',
          height: '2rem',
          padding: '0 0.5rem',
          borderRadius: '0.5rem',
          border: '1px solid #cbd5e1',
          backgroundColor: '#fff',
          color: currentPage === 1 ? '#94a3b8' : DT.text,
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          fontSize: '1rem',
          lineHeight: '1',
          boxShadow: DT.shadowSm,
          transition: 'background-color 0.15s ease'
        });
      if (currentPage === 1) prevButton.attr('disabled', true);
      prevButton.click(() => {
        if (currentPage > 1) onPageChange(currentPage - 1);
      });

      container.child(prevButton);

      // Page numbers
      const maxButtons = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let endPage = Math.min(totalPages, startPage + maxButtons - 1);

      if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
      }

      if (startPage > 1) {
        container.child(this.createPageButton(1, currentPage, onPageChange));
        if (startPage > 2) {
          container.child(el('span').text('...').css({ color: '#6b7280' }));
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        container.child(this.createPageButton(i, currentPage, onPageChange));
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          container.child(el('span').text('...').css({ color: '#6b7280' }));
        }
        container.child(this.createPageButton(totalPages, currentPage, onPageChange));
      }

      // Next button
      const nextButton = el('button')
        .text('›')
        .css({
          minWidth: '2rem',
          height: '2rem',
          padding: '0 0.5rem',
          borderRadius: '0.5rem',
          border: '1px solid #cbd5e1',
          backgroundColor: '#fff',
          color: currentPage === totalPages || totalPages === 0 ? '#94a3b8' : DT.text,
          cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer',
          fontSize: '1rem',
          lineHeight: '1',
          boxShadow: DT.shadowSm,
          transition: 'background-color 0.15s ease'
        });
      if (currentPage === totalPages || totalPages === 0) nextButton.attr('disabled', true);
      nextButton.click(() => {
        if (currentPage < totalPages) onPageChange(currentPage + 1);
      });

      container.child(nextButton);

      return container;
    },

    // Create single page button
    createPageButton(page, currentPage, onPageChange) {
      const active = page === currentPage;
      return el('button')
        .text(page)
        .css({
          minWidth: '2rem',
          height: '2rem',
          padding: '0 0.35rem',
          borderRadius: '0.5rem',
          border: '1px solid',
          borderColor: active ? DT.accent : '#cbd5e1',
          backgroundColor: active ? DT.accent : '#fff',
          color: active ? '#fff' : DT.text,
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: active ? '600' : '500',
          lineHeight: '1',
          textAlign: 'center',
          boxShadow: active ? '0 2px 8px rgba(37, 99, 235, 0.35)' : DT.shadowSm,
          transition: 'all 0.15s ease'
        })
        .click(() => {
          if (page !== currentPage) {
            onPageChange(page);
          }
        });
    },

    // Render pagination
    renderPagination(container, schema, totalItems, currentPage, perPage, onPageChange) {
      // Remove old pagination buttons (keep per-page selector = first child)
      const children = container.el.children;
      // Remove all children except the first one (perPageContainer)
      while (children.length > 1) {
        children[children.length - 1].remove();
      }

      // Create new pagination
      const pagination = this.createPaginationButtons(
        schema,
        totalItems,
        currentPage,
        perPage,
        onPageChange || (() => {})
      );

      container.ch = [];
      container.child(pagination);
      container.get();
    }
  };

  return TableBuilder;
}));
