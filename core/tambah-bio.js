(function (global) {
  'use strict';

  function getApiClient() {
    if (typeof window !== 'undefined' && window.flamboyanApp?.core?.apiClient) {
      return window.flamboyanApp.core.apiClient;
    }
    return new ApiClient({ baseUrl: '/api' });
  }

  function registerTambahBio() {
    if (typeof UiBuilder === 'undefined' || typeof FormBuilder === 'undefined') return;

    UiBuilder.registerComponent('tki-tambah-bio', () => {
      const root = el('div').css({
        maxWidth: '640px',
        margin: '0 auto',
        width: '100%'
      });

      const card = el('div').css({
        background: '#fff',
        borderRadius: '1rem',
        border: '1px solid #e2e8f0',
        padding: '1.5rem 1.75rem',
        boxShadow: '0 4px 24px rgba(15, 23, 42, 0.08)'
      });

      card.child(el('h2').text('Tambah Biodata TKI Baru').css({
        margin: '0 0 0.35rem',
        fontSize: '1.35rem',
        fontWeight: '800',
        color: '#0f172a'
      }));
      card.child(el('p').text('Sistem akan membuat ID biodata otomatis (contoh FF-0006) beserta baris dokumen & SKCK.').css({
        margin: '0 0 1.25rem',
        color: '#64748b',
        fontSize: '0.875rem',
        lineHeight: '1.5'
      }));

      const errEl = el('p').css({ color: '#dc2626', fontSize: '0.875rem', display: 'none', margin: '0 0 0.75rem' });
      const okEl = el('p').css({ color: '#15803d', fontSize: '0.875rem', display: 'none', margin: '0 0 0.75rem' });
      card.child([errEl, okEl]);

      const apiClient = getApiClient();

      const formSchema = {
        columns: 1,
        hideButtons: true,
        fields: [
          {
            name: 'kode_sektor',
            label: 'Sektor',
            type: 'select',
            required: true,
            placeholder: '— Pilih sektor —',
            optionsFrom: {
              resource: 'datasektor',
              value: 'kode_jenis',
              label: ['kode_jenis', 'isi'],
              labelFormat: '{{kode_jenis}} — {{isi}}'
            }
          },
          {
            name: 'nama',
            label: 'Nama Lengkap',
            type: 'text',
            required: true,
            placeholder: 'Nama lengkap calon TKI'
          },
          {
            name: 'jeniskelamin',
            label: 'Jenis Kelamin',
            type: 'select',
            placeholder: '— Ikut default sektor —',
            options: [
              { value: '', label: '— Ikut default sektor —' },
              { value: 'P', label: 'Perempuan' },
              { value: 'L', label: 'Laki-laki' }
            ]
          },
          {
            name: 'kode_sponsor',
            label: 'Sponsor',
            type: 'select',
            placeholder: '— Pilih sponsor (opsional) —',
            optionsFrom: {
              resource: 'datasponsor',
              value: 'kode_sponsor',
              label: ['kode_sponsor', 'isi'],
              labelFormat: '{{kode_sponsor}} — {{isi}}'
            }
          },
          {
            name: 'negara1',
            label: 'Negara Tujuan',
            type: 'select',
            required: true,
            placeholder: '— Pilih negara —',
            searchable: false,
            remoteSearch: false,
            optionsFrom: {
              resource: 'datanegara',
              value: 'isi',
              label: ['isi', 'mandarin'],
              labelFormat: '{{isi}}'
            },
            default: 'Taiwan'
          }
        ]
      };

      const formApi = FormBuilder.build(formSchema, {
        apiClient,
        initialData: { negara1: 'Taiwan' },
        onSubmit: () => {},
        onCancel: () => layout.navigate('/personal')
      });

      card.child(formApi.el);

      const actions = el('div').css({ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.5rem' });
      const submitBtn = el('button').attr('type', 'button').text('Simpan & Buka Detail').css({
        padding: '0.6rem 1.25rem',
        borderRadius: '0.5rem',
        border: 'none',
        background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
        color: '#fff',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '0.875rem'
      });
      const cancelBtn = el('button').attr('type', 'button').text('Batal').css({
        padding: '0.6rem 1.25rem',
        borderRadius: '0.5rem',
        border: '1px solid #cbd5e1',
        background: '#fff',
        color: '#334155',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '0.875rem'
      });
      cancelBtn.click(() => layout.navigate('/personal'));
      actions.child([submitBtn, cancelBtn]);
      card.child(actions);
      root.child(card);

      submitBtn.click(() => {
        errEl.css({ display: 'none' });
        okEl.css({ display: 'none' });

        const formData = formApi.getData();
        const errors = formApi.validate();
        if (Object.keys(errors).length > 0) {
          const first = Object.values(errors)[0][0];
          errEl.text(first || 'Lengkapi data wajib.').css({ display: 'block' });
          return;
        }

        submitBtn.disabled(true).css({ opacity: '0.7', cursor: 'wait' });

        apiClient.post('tki/create', {
          kode_sektor: formData.kode_sektor,
          nama: String(formData.nama || '').trim(),
          jeniskelamin: formData.jeniskelamin || undefined,
          kode_sponsor: formData.kode_sponsor || '',
          negara1: formData.negara1 || 'Taiwan'
        })
          .then((res) => {
            submitBtn.disabled(false).css({ opacity: '1', cursor: 'pointer' });
            if (!res.success) {
              errEl.text(res.error || 'Gagal menyimpan.').css({ display: 'block' });
              return;
            }
            const id = res.data.id_biodata;
            okEl.text(`Berhasil: ${id}`).css({ display: 'block' });
            setTimeout(() => layout.navigate('/biodata/' + encodeURIComponent(id)), 500);
          })
          .catch(() => {
            submitBtn.disabled(false).css({ opacity: '1', cursor: 'pointer' });
            errEl.text('Tidak dapat terhubung ke server.').css({ display: 'block' });
          });
      });

      return root.get();
    });
  }

  registerTambahBio();
})(typeof window !== 'undefined' ? window : global);
