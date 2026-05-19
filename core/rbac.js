(function (global) {
  'use strict';

  const ROLE_KEY = 'crm_role';
  const DEFAULT_ROLE = 'admin';

  const CrmRbac = {
    getRole() {
      return localStorage.getItem(ROLE_KEY) || DEFAULT_ROLE;
    },

    setRole(role) {
      if (role) localStorage.setItem(ROLE_KEY, role);
    },

    can(action, permissions) {
      if (!permissions || !permissions[action]) return true;
      const allowed = permissions[action];
      if (!Array.isArray(allowed) || !allowed.length) return true;
      return allowed.includes(this.getRole());
    }
  };

  global.CrmRbac = CrmRbac;
})(typeof window !== 'undefined' ? window : global);
