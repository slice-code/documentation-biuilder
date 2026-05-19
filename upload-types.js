/**
 * Daftar jenis upload dokumen (plan §8A.5c — hub detailupload).
 * Dipakai server & browser.
 */
(function (root, factory) {
  const types = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = types;
  } else {
    root.UploadTypes = types;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HUB_TYPES = [
    { type: 'upload_visa', label: 'Visa' },
    { type: 'upload_ketaiwan', label: 'Keterangan Taiwan' },
    { type: 'upload_ktp', label: 'KTP' },
    { type: 'upload_kk', label: 'Kartu Keluarga' },
    { type: 'upload_aktelahir', label: 'Akte Kelahiran' },
    { type: 'upload_ijasah', label: 'Ijazah' },
    { type: 'upload_suratnikah', label: 'Surat Nikah' },
    { type: 'upload_suratijinkeluarga', label: 'Surat Ijin Keluarga' },
    { type: 'upload_pasporlama', label: 'Paspor Lama' },
    { type: 'upload_asuransilama', label: 'Asuransi Lama' },
    { type: 'upload_perjanjianpenempatan', label: 'Perjanjian Penempatan' },
    { type: 'upload_pasporbaru', label: 'Paspor Baru' },
    { type: 'upload_kehilanganpaspor', label: 'Kehilangan Paspor' },
    { type: 'upload_medikal', label: 'Medikal' },
    { type: 'upload_serkes', label: 'Serkes' },
    { type: 'upload_medikalfull', label: 'Medikal Full' },
    { type: 'upload_sertifikatujian', label: 'Sertifikat Ujian' },
    { type: 'upload_kpapra', label: 'KPAPra' },
    { type: 'upload_pk', label: 'PK' },
    { type: 'upload_suhan', label: 'Suhan' },
    { type: 'upload_visapermit', label: 'Visa Permit' },
    { type: 'upload_fotovisa', label: 'Foto Visa' },
    { type: 'upload_tiket', label: 'Tiket' },
    { type: 'upload_visaarrival', label: 'Visa Arrival' },
    { type: 'upload_arc', label: 'ARC' },
    { type: 'upload_legalitas', label: 'Legalitas' },
    { type: 'upload_skuasa', label: 'Surat Kuasa' },
    { type: 'upload_spernyataan', label: 'Surat Pernyataan' },
    { type: 'upload_kabur', label: 'Kabur' },
    { type: 'upload_job', label: 'Job' },
    { type: 'upload_agen', label: 'Agen' },
    { type: 'upload_suhankabur', label: 'Suhan Kabur' },
    { type: 'upload_pkeluarga', label: 'PK Keluarga' },
    { type: 'upload_berkas', label: 'Berkas' },
    { type: 'upload_slain', label: 'Surat Lain' },
    { type: 'upload_skck', label: 'SKCK' },
    { type: 'upload_kpa', label: 'KPA' },
    { type: 'upload_spik', label: 'SPIK' },
    { type: 'upload_legal', label: 'Legal' },
    { type: 'upload_waris', label: 'Waris' },
    { type: 'upload_sikb', label: 'SIKB' },
    { type: 'upload_spaw', label: 'SPAW' },
    { type: 'upload_sppf', label: 'SPPF' },
    { type: 'upload_ppi', label: 'PPI' },
    { type: 'upload_sppppj', label: 'SPPPPJ' }
  ];

  const EXTRA_TYPES = [
    { type: 'upload_keterangan', label: 'Keterangan', hub: false },
    { type: 'upload_desuhan', label: 'Desuhan', hub: false },
    { type: 'upload_devisapermit', label: 'Devisa Permit', hub: false },
    { type: 'upload_pasportampil', label: 'Paspor Tampil', hub: false },
    { type: 'upload_ttdt', label: 'TTDT', hub: false },
    { type: 'upload_servak', label: 'Servak', hub: false },
    { type: 'upload_skckpolres', label: 'SKCK Polres', hub: false }
  ];

  const byType = Object.create(null);
  HUB_TYPES.forEach((t) => { byType[t.type] = t; });
  EXTRA_TYPES.forEach((t) => { byType[t.type] = t; });

  return {
    HUB_TYPES,
    EXTRA_TYPES,
    ALL_TYPES: [...HUB_TYPES, ...EXTRA_TYPES],
    getLabel(type) {
      return byType[type]?.label || type;
    },
    isAllowed(type) {
      return Boolean(byType[type]);
    }
  };
});
