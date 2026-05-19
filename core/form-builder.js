(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.FormBuilder = factory());
})(this, (function () {
  'use strict';

  // Pemetaan FK umum → resource API (jika optionsFrom tidak didefinisikan)
  const FK_RELATION_MAP = {
    customer_id: {
      resource: 'customers',
      value: 'id',
      labelFormat: '{{first_name}} {{last_name}}',
      codeField: 'customer_code',
      optionsPerPage: 30
    },
    company_id: {
      resource: 'companies',
      value: 'id',
      label: 'company_name',
      codeField: 'company_code',
      optionsPerPage: 30
    },
    assigned_to: {
      resource: 'users',
      value: 'id',
      label: 'name',
      optionsPerPage: 30
    },
    created_by: {
      resource: 'users',
      value: 'id',
      label: 'name'
    },
    product_id: {
      resource: 'products',
      value: 'id',
      label: 'name'
    },
    lead_id: {
      resource: 'leads',
      value: 'id',
      label: 'full_name',
      codeField: 'lead_code',
      labelFormat: '{{first_name}} {{last_name}}',
      optionsPerPage: 30
    },
    deal_id: {
      resource: 'deals',
      value: 'id',
      label: 'title',
      codeField: 'deal_code',
      optionsPerPage: 30
    },
    tag_id: {
      resource: 'tags',
      value: 'id',
      label: 'name',
      optionsPerPage: 30
    },
    parent_company_id: {
      resource: 'companies',
      value: 'id',
      label: 'company_name',
      codeField: 'company_code',
      optionsPerPage: 30
    }
  };

  let selectSearchStylesInjected = false;
  let selectOutsideClickBound = false;
  const openSearchSelects = new Set();

  function ensureSelectSearchStyles() {
    if (selectSearchStylesInjected || document.querySelector('style[data-crud-select-search]')) return;
    selectSearchStylesInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-crud-select-search', 'true');
    style.textContent = `
      .crud-search-select.is-open .crud-search-select-trigger {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      }
      .crud-search-select-item:hover {
        background-color: #f1f5f9;
      }
      .crud-search-select-item.is-selected {
        background-color: #eff6ff;
        color: #1d4ed8;
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);
  }

  function bindSelectOutsideClick() {
    if (selectOutsideClickBound) return;
    selectOutsideClickBound = true;
    document.addEventListener('click', (e) => {
      openSearchSelects.forEach((api) => {
        if (typeof api.isClickInside === 'function' && api.isClickInside(e)) return;
        if (typeof api.close === 'function') api.close();
        openSearchSelects.delete(api);
      });
    });
  }

  const FormBuilder = {
    /** Tutup semua searchable select terbuka (panel fixed z-index tinggi bisa menutup modal) */
    closeAllSearchSelects() {
      openSearchSelects.forEach((api) => {
        if (typeof api.close === 'function') api.close();
      });
      openSearchSelects.clear();
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.crud-search-select.is-open').forEach((node) => {
          node.classList.remove('is-open');
        });
        document.querySelectorAll('.crud-search-select-panel').forEach((panel) => {
          panel.style.display = 'none';
        });
      }
    },

    // Set disabled dengan benar (jangan pakai attr('disabled', false) — tetap nonaktif di HTML)
    setDisabled(elWrap, isDisabled) {
      if (elWrap && typeof elWrap.disabled === 'function') {
        elWrap.disabled(!!isDisabled);
      }
    },

    // Ambil konfigurasi relasi dari field (optionsFrom eksplisit atau inferensi nama field)
    getRelationConfig(field) {
      if (field.optionsFrom) {
        if (typeof field.optionsFrom === 'string') {
          const inferred = FK_RELATION_MAP[field.name];
          if (inferred && inferred.resource === field.optionsFrom) {
            return inferred;
          }
          return { resource: field.optionsFrom, value: 'id', label: 'name' };
        }
        return field.optionsFrom;
      }
      return FK_RELATION_MAP[field.name] || null;
    },

    needsRemoteOptions(field) {
      if (field.type !== 'select') return false;
      const relation = this.getRelationConfig(field);
      if (!relation) return false;
      if (!field.options || field.options.length === 0) return true;
      // Opsi statis hanya placeholder kosong (mis. "Semua TKI") — tetap muat dari API
      const hasRealOption = field.options.some((o) => {
        const v = o.value;
        return v != null && String(v).trim() !== '';
      });
      return !hasRealOption;
    },

    // Relasi besar: cari via API (tidak load semua baris)
    usesRemoteSearch(field) {
      return this.needsRemoteOptions(field) && field.remoteSearch !== false;
    },

    formatTemplate(row, template) {
      if (!row || !template) return '';
      return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const v = row[key];
        return v != null ? String(v) : '';
      });
    },

    formatOptionValue(row, config) {
      if (!row) return '';
      if (config.valueFormat) {
        return this.formatTemplate(row, config.valueFormat);
      }
      const valueKey = config.value || 'id';
      return row[valueKey] != null ? String(row[valueKey]) : '';
    },

    formatOptionLabel(row, config) {
      if (!row) return '';
      if (config.labelFormat) {
        const text = this.formatTemplate(row, config.labelFormat).trim();
        if (config.codeField && row[config.codeField]) {
          return `${text} (${row[config.codeField]})`.trim();
        }
        return text || this.formatOptionValue(row, config) || String(row[config.value || 'id'] ?? '');
      }
      if (Array.isArray(config.label)) {
        return config.label.map(k => row[k]).filter(v => v != null && v !== '').join(' ').trim();
      }
      const main = row[config.label || 'name'] ?? row.id;
      if (config.codeField && row[config.codeField]) {
        return `${main} (${row[config.codeField]})`;
      }
      return String(main ?? '');
    },

    /** Muat label opsi terpilih (mis. id_biodata FF-0001) via API personal */
    async resolveRemoteSelectValue(field, apiClient, currentValue) {
      const config = this.getRelationConfig(field);
      if (!config || !apiClient || currentValue == null || currentValue === '') {
        return null;
      }
      const valueKey = config.value || 'id';
      const val = String(currentValue);

      if (valueKey === 'id' && /^\d+$/.test(val) && !config.valueFormat) {
        return this.loadSelectOptionById(field, apiClient, currentValue);
      }

      if (config.valueFormat) {
        try {
          const bulkField = { ...field, remoteSearch: false, options: [] };
          const options = await this.loadSelectOptions(bulkField, apiClient, null);
          const found = options.find((o) => String(o.value) === val);
          if (found) return found;
        } catch (e) { /* lanjut fallback */ }
      }

      try {
        const params = new URLSearchParams();
        params.set('search', val);
        params.set('perPage', '30');
        params.set('page', '1');
        const response = await apiClient.read(`${config.resource}?${params.toString()}`);
        const rows = response.data && Array.isArray(response.data) ? response.data : [];
        const row = rows.find((r) => {
          if (config.valueFormat) return this.formatOptionValue(r, config) === val;
          return String(r[valueKey]) === val;
        });
        if (row) {
          return {
            value: val,
            label: this.formatOptionLabel(row, config) || val
          };
        }
      } catch (e) {
        /* fallback label = value */
      }
      return { value: val, label: val };
    },

    // Satu opsi terpilih (mode edit)
    async loadSelectOptionById(field, apiClient, id) {
      const config = this.getRelationConfig(field);
      if (!config || !apiClient || id == null || id === '') return null;

      const resource = config.resource;
      const valueKey = config.value || 'id';

      try {
        const one = await apiClient.read(`${resource}/${id}`);
        const row = one.data || one;
        if (!row) return null;
        const optValue = config.valueFormat
          ? this.formatOptionValue(row, config)
          : (row[valueKey] != null ? String(row[valueKey]) : '');
        if (!optValue) return null;
        return {
          value: optValue,
          label: this.formatOptionLabel(row, config) || `#${id}`
        };
      } catch (e) {
        return { value: String(id), label: `#${id}` };
      }
    },

    // Cari opsi di server (pagination + search) — untuk data besar
    async searchSelectOptions(field, apiClient, search = '') {
      const config = this.getRelationConfig(field);
      if (!config || !apiClient) return { options: [], total: 0 };

      const resource = config.resource;
      const valueKey = config.value || 'id';
      const perPage = config.optionsPerPage || field.optionsPerPage || 30;
      const minLen = field.minSearchLength ?? config.minSearchLength ?? 0;
      const q = String(search || '').trim();

      if (q.length > 0 && q.length < minLen) {
        return { options: [], total: 0, needsMoreChars: true, minLen };
      }

      try {
        const params = new URLSearchParams();
        params.set('perPage', String(perPage));
        params.set('page', '1');
        if (q) params.set('search', q);

        const response = await apiClient.read(`${resource}?${params.toString()}`);
        let rows = [];
        if (response.data && Array.isArray(response.data)) rows = response.data;
        else if (Array.isArray(response)) rows = response;

        const options = rows.map(row => ({
          value: this.formatOptionValue(row, config),
          label: this.formatOptionLabel(row, config)
        })).filter(opt => opt.label && opt.value !== '');

        const total = response.pagination?.total ?? options.length;
        return {
          options,
          total,
          hasMore: total > options.length,
          perPage
        };
      } catch (error) {
        console.error(`Gagal search optionsFrom ${resource}:`, error);
        return { options: [], total: 0 };
      }
    },

    // Muat opsi select dari API (bulk — hanya jika remoteSearch dimatikan)
    async loadSelectOptions(field, apiClient, currentValue = null) {
      if (this.usesRemoteSearch(field)) {
        if (currentValue != null && currentValue !== '') {
          const one = await this.resolveRemoteSelectValue(field, apiClient, currentValue);
          return one ? [one] : [];
        }
        return [];
      }

      const config = this.getRelationConfig(field);
      if (!config || !apiClient) return field.options || [];

      const resource = config.resource;
      const valueKey = config.value || 'id';
      const perPage = config.perPage || field.optionsPerPage || 500;
      const sort = config.sort || field.sort || '';
      const order = config.order || field.order || 'asc';

      try {
        const params = new URLSearchParams();
        params.set('perPage', String(perPage));
        params.set('page', '1');
        if (sort) params.set('sort', sort);
        if (order) params.set('order', order);

        const response = await apiClient.read(`${resource}?${params.toString()}`);
        let rows = [];
        if (response.data && Array.isArray(response.data)) rows = response.data;
        else if (Array.isArray(response)) rows = response;

        const options = rows.map(row => ({
          value: this.formatOptionValue(row, config),
          label: this.formatOptionLabel(row, config)
        })).filter(opt => opt.label && opt.value !== '');

        if (currentValue != null && currentValue !== '' &&
            !options.some(o => o.value === String(currentValue))) {
          const one = await this.resolveRemoteSelectValue(field, apiClient, currentValue);
          if (one) options.unshift(one);
        }

        if (field.prependEmptyOption) {
          const emptyOpt = field.prependEmptyOption;
          if (!options.some((o) => String(o.value) === String(emptyOpt.value))) {
            options.unshift(emptyOpt);
          }
        }

        return options;
      } catch (error) {
        console.error(`Gagal memuat optionsFrom ${resource}:`, error);
        return [];
      }
    },

    // Siapkan schema form: isi field.options dari tabel terkait
    async prepareFormSchema(formSchema, apiClient, initialData = {}) {
      if (!formSchema || !formSchema.fields || !apiClient) {
        return formSchema;
      }

      const fields = await Promise.all(formSchema.fields.map(async (field) => {
        if (!this.needsRemoteOptions(field)) return field;
        const currentValue = initialData[field.name];
        const options = await this.loadSelectOptions(field, apiClient, currentValue);
        return { ...field, options };
      }));

      return { ...formSchema, fields };
    },

    useSearchableSelect(field) {
      return field.type === 'select' && field.searchable !== false;
    },

    // Perbarui isi <select> setelah opsi dimuat (untuk pola async)
    fillSelectOptions(selectWrapper, field, options, selectedValue, formData) {
      if (selectWrapper && selectWrapper._crudSelectApi) {
        selectWrapper._crudSelectApi.setOptions(options, selectedValue);
        if (formData && selectedValue != null && selectedValue !== '') {
          formData[field.name] = String(selectedValue);
        }
        return;
      }

      const selectEl = selectWrapper.el || selectWrapper;
      if (!selectEl || selectEl.tagName !== 'SELECT') return;

      selectEl.innerHTML = '';

      if (field.placeholder) {
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = field.placeholder;
        selectEl.appendChild(ph);
      }

      options.forEach(opt => {
        const option = document.createElement('option');
        option.value = String(opt.value);
        option.textContent = opt.label;
        if (String(opt.value) === String(selectedValue)) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });

      if (selectedValue != null && selectedValue !== '') {
        selectEl.value = String(selectedValue);
        if (formData) formData[field.name] = selectEl.value;
      }
    },

    // Build form from JSON schema
    build(schema, options = {}) {
      const {
        onSubmit = () => {},
        onCancel = () => {},
        initialData = {},
        readOnly = false,
        apiClient = null
      } = options;

      const formData = { ...initialData };
      const fieldElements = {};
      const errorElements = {};
      let isSubmitting = false;

      // Create form container
      const formContainer = el('form')
        .attr('id', 'crud-form') // Add ID for modal footer to trigger submit
        .css({
          display: 'flex',
          flexDirection: schema.layout === 'horizontal' ? 'row' : 'column',
          gap: schema.layout === 'grid' ? '0' : '1rem',
          flexWrap: schema.layout === 'grid' ? 'wrap' : 'nowrap'
        });

      // Create fields container with grid support
      const columns = schema.columns || 1;
      const fieldsContainer = el('div').css({
        display: 'grid',
        gridTemplateColumns: columns > 1 ? `repeat(${columns}, 1fr)` : '1fr',
        gap: schema.gap || '1rem',
        width: '100%'
      });

      schema.fields.forEach(field => {
        const fieldWrapper = this.createField(field, formData, fieldElements, errorElements, readOnly, apiClient);
        
        // Support field colspan (span multiple columns)
        if (field.colspan) {
          fieldWrapper.css({ gridColumn: `span ${field.colspan}` });
        }
        
        fieldsContainer.child(fieldWrapper);
      });

      formContainer.child(fieldsContainer);

      // Create buttons (hide if using modal footer)
      let submitButton = null;
      if (!readOnly && !schema.hideButtons) {
        const buttonsContainer = el('div').css({
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb'
        });

        // Cancel button
        if (schema.cancelText !== false) {
          const cancelButton = el('button')
            .type('button')
            .text(schema.cancelText || 'Cancel')
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
            .click((e) => {
              e.preventDefault();
              onCancel();
            });
          buttonsContainer.child(cancelButton);
        }

        // Submit button
        submitButton = el('button')
          .type('submit')
          .text(schema.submitText || 'Submit')
          .css({
            padding: '0.65rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500',
            opacity: '1',
            transition: 'opacity 0.2s'
          });

        buttonsContainer.child(submitButton);
        formContainer.child(buttonsContainer);
      }

      // Form submit handler
      formContainer.el.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;

        // Validate
        const errors = this.validate(schema.fields, formData);
        if (Object.keys(errors).length > 0) {
          this.showErrors(errors, errorElements);
          return;
        }

        // Clear errors
        this.clearErrors(errorElements);

        // Submit
        isSubmitting = true;
        if (submitButton) submitButton.text('Loading...').css({ opacity: '0.6' });

        try {
          await onSubmit(formData);
        } catch (error) {
          console.error('Form submit error:', error);
        } finally {
          isSubmitting = false;
          if (submitButton) submitButton.text(schema.submitText || 'Submit').css({ opacity: '1' });
        }
      });

      // Return form API
      return {
        el: formContainer,
        get: () => formContainer.get(),
        getData: () => ({ ...formData }),
        setData: (data) => {
          Object.assign(formData, data);
          this.updateFieldValues(schema.fields, formData, fieldElements);
        },
        reset: () => {
          Object.keys(formData).forEach(key => delete formData[key]);
          Object.assign(formData, initialData);
          this.updateFieldValues(schema.fields, formData, fieldElements);
          this.clearErrors(errorElements);
        },
        validate: () => {
          const errors = this.validate(schema.fields, formData);
          this.showErrors(errors, errorElements);
          return errors;
        },
        setLoading: (loading) => {
          isSubmitting = loading;
          if (submitButton) {
            submitButton
              .text(loading ? 'Loading...' : (schema.submitText || 'Submit'))
              .css({ opacity: loading ? '0.6' : '1' });
          }
        }
      };
    },

    // Create single field
    createField(field, formData, fieldElements, errorElements, readOnly, apiClient) {
      const wrapper = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem'
      });

      // Label
      if (field.label !== false) {
        const label = el('label')
          .css({
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151'
          })
          .text(field.label || field.name);

        if (field.required) {
          label.child(el('span').text(' *').css({ color: '#dc2626' }));
        }

        wrapper.child(label);
      }

      // Input element
      let input;
      const value = formData[field.name] || '';

      switch (field.type) {
        case 'textarea':
          input = this.createTextarea(field, value, readOnly, formData);
          break;
        case 'select':
          input = this.createSelect(field, value, readOnly, formData, apiClient);
          break;
        case 'checkbox':
          input = this.createCheckbox(field, value, readOnly, formData);
          break;
        case 'radio':
          input = this.createRadio(field, value, readOnly, formData);
          break;
        default:
          input = this.createInput(field, value, readOnly, formData);
      }

      fieldElements[field.name] = input;
      wrapper.child(input);

      // Error message
      const errorEl = el('div')
        .css({
          fontSize: '0.75rem',
          color: '#dc2626',
          minHeight: '1rem',
          display: 'none'
        });
      errorElements[field.name] = errorEl;
      wrapper.child(errorEl);

      return wrapper;
    },

    // Input dengan pola mask (config field.mask — lihat core/input-mask.js)
    createMaskedInput(field, value, readOnly, formData) {
      const maskCfg = typeof InputMask !== 'undefined'
        ? InputMask.normalizeConfig(field.mask)
        : null;
      const placeholder = field.placeholder || (maskCfg && maskCfg.pattern) || '';

      const input = el('input')
        .attr('type', 'text')
        .attr('name', field.name)
        .attr('placeholder', placeholder)
        .attr('autocomplete', 'off')
        .value(value || '');
      if (field.required) input.attr('required', true);
      if (readOnly) input.attr('readonly', true).attr('disabled', true);
      input
        .css({
          padding: '0.65rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.95rem',
          outline: 'none',
          transition: 'border-color 0.2s',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          letterSpacing: '0.02em'
        })
        .on('focus', function() {
          this.style.borderColor = '#2563eb';
        })
        .on('blur', function() {
          this.style.borderColor = '#d1d5db';
        });

      let maskApi = null;
      if (maskCfg && typeof InputMask !== 'undefined' && !readOnly) {
        maskApi = InputMask.attach(input.el, maskCfg, (formatted) => {
          formData[field.name] = formatted;
        });
        if (value) maskApi.setValue(value);
        else formData[field.name] = maskApi.getValue();
      } else {
        input.on('input', function() {
          formData[field.name] = this.value;
        });
        if (value != null && value !== '') formData[field.name] = String(value);
      }

      input._inputMaskApi = maskApi;
      return input;
    },

    // Create input element
    createInput(field, value, readOnly, formData) {
      if (field.mask && typeof InputMask !== 'undefined') {
        return this.createMaskedInput(field, value, readOnly, formData);
      }

      const input = el('input')
        .attr('type', field.type || 'text')
        .attr('name', field.name)
        .attr('placeholder', field.placeholder || '')
        .value(value);
      if (field.required) input.attr('required', true);
      if (readOnly) input.attr('readonly', true).attr('disabled', true);
      input
        .css({
          padding: '0.65rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.95rem',
          outline: 'none',
          transition: 'border-color 0.2s'
        })
        .on('focus', function() {
          this.style.borderColor = '#2563eb';
        })
        .on('blur', function() {
          this.style.borderColor = '#d1d5db';
        })
        .on('input', function(e) {
          formData[field.name] = field.type === 'number' ? (this.value === '' ? '' : Number(this.value)) : this.value;
        });
      return input;
    },

    // Rich text kosong (untuk validasi)
    isTextareaEmpty(value) {
      if (value == null || value === '') return true;
      if (typeof RichTextEditor !== 'undefined' && RichTextEditor.isHtmlEmpty) {
        return RichTextEditor.isHtmlEmpty(value);
      }
      return String(value).trim() === '';
    },

    // Create textarea — rich editor (Quill) atau fallback plain textarea
    createTextarea(field, value, readOnly, formData) {
      if (typeof RichTextEditor !== 'undefined' && RichTextEditor.isAvailable() && field.richText !== false) {
        const editor = RichTextEditor.create(field, value, readOnly, formData);
        if (editor) return editor;
      }

      const textarea = el('textarea')
        .attr('name', field.name)
        .attr('placeholder', field.placeholder || '')
        .attr('rows', field.rows || 4);
      if (field.required) textarea.attr('required', true);
      if (readOnly) textarea.attr('readonly', true).attr('disabled', true);
      textarea
        .text(value)
        .css({
          padding: '0.65rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.95rem',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          transition: 'border-color 0.2s'
        })
        .on('input', function() {
          formData[field.name] = this.value;
        });
      if (value != null && value !== '') {
        formData[field.name] = String(value);
      }
      return textarea;
    },

    // Create select element (searchable by default)
    createSelect(field, value, readOnly, formData, apiClient) {
      if (this.useSearchableSelect(field)) {
        return this.createSearchableSelect(field, value, readOnly, formData, apiClient);
      }
      return this.createNativeSelect(field, value, readOnly, formData, apiClient);
    },

    createNativeSelect(field, value, readOnly, formData, apiClient) {
      const options = field.options || [];

      const select = el('select')
        .attr('name', field.name);
      if (field.required) select.attr('required', true);
      if (readOnly) select.attr('readonly', true).attr('disabled', true);
      select
        .css({
          padding: '0.65rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.95rem',
          outline: 'none',
          backgroundColor: '#fff',
          cursor: readOnly ? 'not-allowed' : 'pointer'
        });

      // Placeholder option
      if (field.placeholder) {
        select.child(
          el('option')
            .attr('value', '')
            .text(field.placeholder)
        );
      }

      // Options
      options.forEach(opt => {
        const option = el('option')
          .attr('value', String(opt.value))
          .text(opt.label);

        if (String(opt.value) === String(value)) {
          option.attr('selected', 'selected');
        }

        select.child(option);
      });

      select.on('change', function(e) {
        formData[field.name] = this.value;
      });

      // Sync nilai awal ke formData
      if (value != null && value !== '') {
        formData[field.name] = String(value);
      } else if (!formData[field.name] && options.length > 0 && !field.placeholder) {
        formData[field.name] = String(options[0].value);
      }

      // Muat opsi dari tabel lain secara async jika belum ada opsi
      if (apiClient && this.needsRemoteOptions(field)) {
        select.get();
        this.fillSelectOptions(select, field, [{ value: '', label: 'Loading...' }], '', formData);
        this.setDisabled(select, true);

        this.loadSelectOptions(field, apiClient, value).then((loaded) => {
          this.setDisabled(select, readOnly);
          this.fillSelectOptions(select, field, loaded, value ?? formData[field.name], formData);
          select.get();
        }).catch(() => {
          this.setDisabled(select, readOnly);
          this.fillSelectOptions(select, field, [], value, formData);
          select.get();
        });
      }

      return select;
    },

    // Select dengan kotak pencarian (combobox)
    createSearchableSelect(field, value, readOnly, formData, apiClient) {
      ensureSelectSearchStyles();
      bindSelectOutsideClick();

      let allOptions = [...(field.options || [])];
      let isOpen = false;
      const isRemoteSearch = Boolean(apiClient && this.usesRemoteSearch(field));
      let remoteDebounceTimer = null;
      let remoteFetchSeq = 0;
      let remoteMeta = { total: 0, hasMore: false };
      let remoteCache = null;
      let remoteFetchInFlight = null;
      let suppressSearchInput = false;
      const minSearchLength = field.minSearchLength ?? this.getRelationConfig(field)?.minSearchLength ?? 0;

      const wrapper = el('div').class('crud-search-select').css({
        position: 'relative',
        width: '100%'
      });

      const hiddenInput = el('input')
        .attr('type', 'hidden')
        .attr('name', field.name);
      if (field.required) hiddenInput.attr('required', true);

      const labelSpan = el('span').css({
        flex: '1',
        textAlign: 'left',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: '#0f172a'
      });

      const chevron = el('i').class('fas fa-chevron-down').css({
        fontSize: '0.7rem',
        color: '#94a3b8',
        transition: 'transform 0.2s',
        flexShrink: '0'
      });

      const trigger = el('button')
        .attr('type', 'button')
        .class('crud-search-select-trigger')
        .css({
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.65rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          fontSize: '0.95rem',
          backgroundColor: '#fff',
          cursor: readOnly ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxSizing: 'border-box'
        });

      trigger.child([labelSpan, chevron]);

      const panel = el('div')
        .class('crud-search-select-panel')
        .css({
          display: 'none',
          position: 'fixed',
          zIndex: '10050',
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 40px rgba(15, 23, 42, 0.15)',
          overflow: 'hidden',
          boxSizing: 'border-box'
        });

      const searchInput = el('input')
        .attr('type', 'text')
        .attr('placeholder', field.searchPlaceholder || (isRemoteSearch ? 'Type name or code to search...' : 'Search...'))
        .attr('autocomplete', 'off')
        .css({
          width: '100%',
          padding: '0.55rem 0.75rem',
          border: 'none',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '0.875rem',
          outline: 'none',
          boxSizing: 'border-box'
        });

      const list = el('div').class('crud-search-select-list').css({
        maxHeight: '220px',
        overflowY: 'auto',
        padding: '0.25rem 0'
      });

      const getLabel = (val) => {
        if (val == null || val === '') return '';
        const found = allOptions.find((o) => String(o.value) === String(val));
        return found ? found.label : '';
      };

      const setDisplayValue = (val, labelText) => {
        const v = val == null || val === '' ? '' : String(val);
        hiddenInput.el.value = v;
        const text = labelText || getLabel(v) || (v ? `#${v}` : '');
        if (v && text) {
          labelSpan.text(text).css({ color: '#0f172a' });
        } else if (field.placeholder) {
          labelSpan.text(field.placeholder).css({ color: '#94a3b8' });
        } else {
          labelSpan.text('Pilih...').css({ color: '#94a3b8' });
        }
        formData[field.name] = v;
        hiddenInput.get();
      };

      // el.js: wajib .empty() — innerHTML saja tidak mengosongkan antrian .ch (lihat cheatsheet)
      const resetList = () => list.empty();

      const renderOptionsList = (options, footerText = '') => {
        resetList();

        if (options.length === 0) {
          list.child(
            el('div').text(footerText || 'No results').css({
              padding: '0.65rem 0.85rem',
              fontSize: '0.875rem',
              color: '#94a3b8'
            })
          );
          list.get();
          return;
        }

        options.forEach((opt) => {
          const isSelected = String(opt.value) === String(formData[field.name]);
          const item = el('button')
            .attr('type', 'button')
            .class(`crud-search-select-item${isSelected ? ' is-selected' : ''}`)
            .text(opt.label)
            .css({
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '0.55rem 0.85rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.875rem',
              color: '#0f172a',
              cursor: 'pointer'
            });

          item.click((e) => {
            e.stopPropagation();
            setDisplayValue(opt.value, opt.label);
            api.close();
          });

          list.child(item);
        });

        if (footerText) {
          list.child(
            el('div').text(footerText).css({
              padding: '0.45rem 0.85rem',
              fontSize: '0.75rem',
              color: '#94a3b8',
              borderTop: '1px solid #f1f5f9',
              backgroundColor: '#f8fafc'
            })
          );
        }

        list.get();
      };

      const showListLoading = () => {
        resetList();
        list.child(
          el('div').text('Loading...').css({
            padding: '0.65rem 0.85rem',
            fontSize: '0.875rem',
            color: '#64748b'
          })
        );
        list.get();
      };

      const renderList = (query = '') => {
        if (isRemoteSearch) {
          renderOptionsList(allOptions, remoteMeta.footer || '');
          return;
        }

        const q = String(query).trim().toLowerCase();
        const filtered = allOptions.filter((opt) => {
          if (!q) return true;
          return String(opt.label || '').toLowerCase().includes(q) ||
            String(opt.value || '').toLowerCase().includes(q);
        });
        renderOptionsList(filtered);
      };

      const fetchRemoteOptions = async (query = '', force = false) => {
        if (!isRemoteSearch) return;

        const q = String(query ?? '');
        const cacheKey = q;

        if (!force && remoteCache && remoteCache.key === cacheKey) {
          allOptions = remoteCache.options;
          remoteMeta = remoteCache.meta;
          renderList();
          return;
        }

        if (!force && remoteFetchInFlight && remoteFetchInFlight.key === cacheKey) {
          return remoteFetchInFlight.promise;
        }

        const seq = ++remoteFetchSeq;
        showListLoading();

        const run = (async () => {
          const result = await this.searchSelectOptions(field, apiClient, q);
          if (seq !== remoteFetchSeq) return;

          if (result.needsMoreChars) {
            allOptions = [];
            remoteMeta = { total: 0, hasMore: false, footer: '' };
            remoteCache = { key: cacheKey, options: [], meta: remoteMeta };
            renderOptionsList([], `Type at least ${result.minLen} characters to search`);
            return;
          }

          allOptions = result.options || [];
          if (field.prependEmptyOption) {
            const emptyOpt = field.prependEmptyOption;
            allOptions = [emptyOpt, ...allOptions.filter((o) => String(o.value) !== String(emptyOpt.value))];
          }
          const total = result.total || 0;
          let footer = '';
          if (total > allOptions.length) {
            footer = `Showing ${allOptions.length} of ${total} — refine your search`;
          } else if (total > 0 && !q.trim()) {
            footer = `${total} data — ketik untuk memfilter`;
          }
          remoteMeta = { total, hasMore: result.hasMore, footer };
          remoteCache = { key: cacheKey, options: allOptions, meta: remoteMeta };
          renderList();
        })();

        remoteFetchInFlight = { key: cacheKey, promise: run };
        try {
          await run;
        } finally {
          if (remoteFetchInFlight && remoteFetchInFlight.promise === run) {
            remoteFetchInFlight = null;
          }
        }
      };

      const scheduleRemoteSearch = (query) => {
        clearTimeout(remoteDebounceTimer);
        remoteDebounceTimer = setTimeout(() => fetchRemoteOptions(query), 350);
      };

      const positionPanel = () => {
        const rect = trigger.el.getBoundingClientRect();
        const maxH = 280;
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        const openUp = spaceBelow < maxH && spaceAbove > spaceBelow;

        panel.css({
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          top: openUp ? 'auto' : `${rect.bottom + 4}px`,
          bottom: openUp ? `${window.innerHeight - rect.top + 4}px` : 'auto',
          maxHeight: `${Math.min(maxH, openUp ? spaceAbove : spaceBelow)}px`
        });
      };

      const api = {
        isClickInside(e) {
          return wrapper.el && wrapper.el.contains(e.target);
        },
        open() {
          if (readOnly || isOpen) return;
          openSearchSelects.forEach((other) => {
            if (other !== api && typeof other.close === 'function') other.close();
          });
          openSearchSelects.delete(api);
          isOpen = true;
          wrapper.el.classList.add('is-open');
          chevron.css({ transform: 'rotate(180deg)' });
          panel.css({ display: 'block' });
          positionPanel();
          suppressSearchInput = true;
          searchInput.el.value = '';
          suppressSearchInput = false;
          if (isRemoteSearch) {
            fetchRemoteOptions('');
          } else {
            renderList('');
          }
          openSearchSelects.add(api);
          setTimeout(() => searchInput.el.focus(), 0);
        },
        close() {
          if (!isOpen) return;
          isOpen = false;
          clearTimeout(remoteDebounceTimer);
          remoteDebounceTimer = null;
          remoteFetchSeq += 1;
          remoteFetchInFlight = null;
          wrapper.el.classList.remove('is-open');
          chevron.css({ transform: 'rotate(0deg)' });
          panel.css({ display: 'none' });
          openSearchSelects.delete(api);
        },
        setOptions(options, selectedValue) {
          allOptions = (options || []).filter((o) => o.value !== '' || o.label);
          const sel = selectedValue != null ? selectedValue : formData[field.name];
          if (sel != null && sel !== '') {
            const found = allOptions.find((o) => String(o.value) === String(sel));
            setDisplayValue(found ? found.value : sel, found ? found.label : `#${sel}`);
          } else {
            setDisplayValue('', '');
          }
          if (isOpen) renderList(searchInput.el.value);
        },
        setValue(val) {
          api.setOptions(allOptions, val);
        }
      };

      wrapper._crudSelectApi = api;

      trigger.click((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (readOnly) return;
        if (isOpen) return;
        api.open();
      });

      wrapper.el.addEventListener('mousedown', (e) => e.stopPropagation());
      searchInput.click((e) => e.stopPropagation());
      searchInput.on('input', () => {
        if (suppressSearchInput) return;
        const q = searchInput.el.value;
        if (isRemoteSearch) {
          scheduleRemoteSearch(q);
        } else {
          renderList(q);
        }
      });
      panel.click((e) => e.stopPropagation());

      const onReposition = () => {
        if (isOpen) positionPanel();
      };
      window.addEventListener('resize', onReposition);
      window.addEventListener('scroll', onReposition, true);

      panel.child([
        searchInput,
        list
      ]);

      wrapper.child([hiddenInput, trigger, panel]);

      const initial = value != null && value !== '' ? value : formData[field.name];
      if (initial != null && initial !== '') {
        setDisplayValue(initial, getLabel(initial));
      } else if (field.placeholder) {
        setDisplayValue('', '');
      } else if (allOptions.length > 0 && !field.placeholder) {
        setDisplayValue(allOptions[0].value, allOptions[0].label);
      } else {
        setDisplayValue('', '');
      }

      if (readOnly) {
        this.setDisabled(trigger, true);
        this.setDisabled(searchInput, true);
      }

      if (apiClient && this.needsRemoteOptions(field)) {
        if (isRemoteSearch) {
          const initialId = value ?? formData[field.name];
          const hasPreset = allOptions.some((o) => String(o.value) === String(initialId));
          if (initialId != null && initialId !== '' && !hasPreset) {
            this.setDisabled(trigger, true);
            const relCfg = this.getRelationConfig(field);
            const valueKey = relCfg?.value || 'id';
            const useIdLookup = valueKey === 'id' && /^\d+$/.test(String(initialId));
            const finishPreset = (opt) => {
              this.setDisabled(trigger, readOnly);
              if (opt) {
                allOptions = [opt];
                setDisplayValue(opt.value, opt.label);
              }
            };
            if (useIdLookup) {
              this.loadSelectOptionById(field, apiClient, initialId).then(finishPreset);
            } else {
              finishPreset({ value: String(initialId), label: String(initialId) });
            }
          } else if (hasPreset) {
            const preset = allOptions.find((o) => String(o.value) === String(initialId));
            if (preset) setDisplayValue(preset.value, preset.label);
          }
        } else {
          api.setOptions([{ value: '', label: 'Loading...' }], '');
          this.setDisabled(trigger, true);
          this.loadSelectOptions(field, apiClient, value).then((loaded) => {
            this.setDisabled(trigger, readOnly);
            api.setOptions(loaded, value ?? formData[field.name]);
          }).catch(() => {
            this.setDisabled(trigger, readOnly);
            api.setOptions([], value);
          });
        }
      }

      return wrapper;
    },

    // Create checkbox element
    createCheckbox(field, value, readOnly, formData) {
      const container = el('div').css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      });

      const checkbox = el('input')
        .attr('type', 'checkbox')
        .attr('name', field.name)
        .attr('checked', !!value);
      if (readOnly) checkbox.attr('readonly', true).attr('disabled', true);
      checkbox
        .css({
          width: '1rem',
          height: '1rem',
          cursor: readOnly ? 'not-allowed' : 'pointer'
        })
        .on('change', function(e) {
          formData[field.name] = this.checked;
        });

      const label = el('span')
        .css({
          fontSize: '0.95rem',
          color: '#374151'
        })
        .text(field.label || field.name);

      container.child([checkbox, label]);
      return container;
    },

    // Create radio group
    createRadio(field, value, readOnly, formData) {
      const container = el('div').css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      });

      const options = field.options || [];
      options.forEach(opt => {
        const row = el('div').css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        });

        const radio = el('input')
          .attr('type', 'radio')
          .attr('name', field.name)
          .attr('value', opt.value)
          .attr('checked', opt.value === value)
          .css({
            width: '1rem',
            height: '1rem',
            cursor: readOnly ? 'not-allowed' : 'pointer'
          })
          .on('change', function(e) {
            formData[field.name] = this.value;
          });
        if (readOnly) radio.attr('disabled', true);

        const label = el('span')
          .css({
            fontSize: '0.95rem',
            color: '#374151'
          })
          .text(opt.label);

        row.child([radio, label]);
        container.child(row);
      });

      return container;
    },

    // Validate form data
    validate(fields, formData) {
      const errors = {};

      fields.forEach(field => {
        const value = formData[field.name];
        const fieldErrors = [];

        const isEmpty = field.type === 'textarea'
          ? this.isTextareaEmpty(value)
          : (!value || (typeof value === 'string' && value.trim() === ''));

        // Required validation
        if (field.required && isEmpty) {
          fieldErrors.push(`${field.label || field.name} is required`);
        }

        // Skip other validations if empty and not required
        if (isEmpty && !field.required) return;

        const textLen = field.type === 'textarea' && typeof value === 'string'
          ? ((() => {
            const tmp = document.createElement('div');
            tmp.innerHTML = value;
            return (tmp.textContent || '').length;
          })())
          : (typeof value === 'string' ? value.length : 0);

        // Min length (teks tanpa tag HTML)
        if (field.validation?.minLength) {
          if (textLen < field.validation.minLength) {
            fieldErrors.push(`Minimum ${field.validation.minLength} characters`);
          }
        }

        // Max length
        if (field.validation?.maxLength) {
          if (textLen > field.validation.maxLength) {
            fieldErrors.push(`Maximum ${field.validation.maxLength} characters`);
          }
        }

        // Pattern
        if (field.validation?.pattern && typeof value === 'string') {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            fieldErrors.push(field.validation.patternMessage || 'Invalid format');
          }
        }

        // Input mask — semua slot harus terisi
        if (field.mask && typeof InputMask !== 'undefined') {
          const mustComplete = field.required || field.mask.requireComplete !== false;
          if (mustComplete && !InputMask.isComplete(value, field.mask)) {
            const cfg = InputMask.normalizeConfig(field.mask);
            fieldErrors.push(cfg.completeMessage || 'Lengkapi seluruh format nomor');
          }
        }

        // Email
        if (field.type === 'email' && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            fieldErrors.push('Invalid email format');
          }
        }

        // Min number
        if (field.validation?.min && typeof value === 'number') {
          if (value < field.validation.min) {
            fieldErrors.push(`Minimum value is ${field.validation.min}`);
          }
        }

        // Max number
        if (field.validation?.max && typeof value === 'number') {
          if (value > field.validation.max) {
            fieldErrors.push(`Maximum value is ${field.validation.max}`);
          }
        }

        // Custom validation
        if (field.validation?.custom && typeof field.validation.custom === 'function') {
          const customError = field.validation.custom(value, formData);
          if (customError) {
            fieldErrors.push(customError);
          }
        }

        if (fieldErrors.length > 0) {
          errors[field.name] = fieldErrors;
        }
      });

      return errors;
    },

    // Show validation errors
    showErrors(errors, errorElements) {
      Object.keys(errorElements).forEach(fieldName => {
        const errorEl = errorElements[fieldName];
        if (errors[fieldName]) {
          errorEl
            .text(errors[fieldName].join(', '))
            .css({ display: 'block' });
        } else {
          errorEl.css({ display: 'none' });
        }
      });
    },

    // Clear all errors
    clearErrors(errorElements) {
      Object.values(errorElements).forEach(errorEl => {
        errorEl.css({ display: 'none' });
      });
    },

    // Update field values (for edit mode)
    updateFieldValues(fields, formData, fieldElements) {
      fields.forEach(field => {
        const element = fieldElements[field.name];
        if (!element) return;

        const value = formData[field.name];

        if (field.type === 'checkbox') {
          element.el.querySelector('input[type="checkbox"]').checked = !!value;
        } else if (field.type === 'radio') {
          element.el.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.checked = radio.value === value;
          });
        } else if (field.type === 'select') {
          if (element._crudSelectApi) {
            element._crudSelectApi.setValue(value || '');
          } else if (element.el && element.el.tagName === 'SELECT') {
            element.el.value = value || '';
          }
        } else if (field.type === 'textarea') {
          if (element._richEditorApi) {
            element._richEditorApi.setValue(value || '');
          } else if (element.el && element.el.tagName === 'TEXTAREA') {
            element.el.value = value || '';
          }
        } else if (element._inputMaskApi) {
          element._inputMaskApi.setValue(value || '');
        } else {
          element.el.value = value || '';
        }
      });
    }
  };

  return FormBuilder;
}));
