/**
 * Preset field form dinonaktifkan.
 * File JSON preset tidak digunakan, tetapi API ini tetap ada agar pemanggil lama aman.
 */
(function (global) {
  'use strict';

  const EMPTY_CONFIG = { presets: {}, fieldPresetByName: {}, rules: [] };
  let _config = EMPTY_CONFIG;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  async function ensureLoaded() {
    return _config;
  }

  function getPreset(presetId) {
    if (!_config?.presets || !presetId) return null;
    return _config.presets[presetId] || null;
  }

  function resolvePresetId(field, formLevelMap) {
    if (field.preset) return field.preset;
    const byName = formLevelMap?.[field.name] || _config?.fieldPresetByName?.[field.name];
    return byName || null;
  }

  function matchRule(field, rule) {
    const m = rule.match || {};
    return Object.keys(m).every((k) => String(field[k] ?? '') === String(m[k]));
  }

  function resolvePresetIdFromRules(field) {
    const rules = _config?.rules || [];
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule.preset && matchRule(field, rule)) return rule.preset;
    }
    return null;
  }

  /** Gabungkan preset ke field (field menang untuk override) */
  function mergeFieldWithPreset(field, presetId) {
    const base = getPreset(presetId);
    if (!base) {
      return field;
    }
    const { preset: _p, ...overrides } = field;
    return { ...deepClone(base), ...overrides, name: overrides.name || base.name };
  }

  /**
   * Terapkan preset pada daftar field form.
   * @param {Array} fields
   * @param {Object} options - { fieldPresetByName, applyRules }
   */
  function resolveFields(fields, options = {}) {
    if (!fields || !Array.isArray(fields)) return fields;
    const formMap = options.fieldPresetByName || {};
    const applyRules = options.applyRules !== false;

    return fields.map((field) => {
      if (!field || typeof field !== 'object') return field;
      if (field.type === 'select' && field.optionsFrom && !field.preset) return field;

      let presetId = resolvePresetId(field, formMap);
      if (!presetId && applyRules) presetId = resolvePresetIdFromRules(field);
      if (!presetId) return field;

      return mergeFieldWithPreset(field, presetId);
    });
  }

  /**
   * Siapkan schema.form (fields + opsi preset per halaman).
   * @param {Object} formSchema - config.form dari appjson / CRUD
   * @param {Object} pageOptions - { fieldPresetByName, applyFieldPresetRules }
   */
  async function resolveFormSchema(formSchema, pageOptions = {}) {
    await ensureLoaded();
    if (!formSchema?.fields) return formSchema;

    const applyRules = pageOptions.applyFieldPresetRules !== false
      && formSchema.applyFieldPresetRules !== false;

    const fields = resolveFields(formSchema.fields, {
      fieldPresetByName: {
        ...(_config.fieldPresetByName || {}),
        ...(pageOptions.fieldPresetByName || {}),
        ...(formSchema.fieldPresetByName || {})
      },
      applyRules
    });

    return { ...formSchema, fields };
  }

  global.FormFieldPresets = {
    ensureLoaded,
    getPreset,
    resolveFields,
    resolveFormSchema,
    mergeFieldWithPreset
  };
})(typeof window !== 'undefined' ? window : global);
