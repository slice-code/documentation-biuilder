SELECT
    '={no} - 9' no,
    '=sum(H{no}:P{no})' spbg,
    c.tanggal tgl_slip,
    c.data_tki id_biodata,
    p.nama,
    dp.nopaspor,
    (
        IF(ds.`status` = 'formal',
        (SELECT max(
                IF(
                    kode = 'PEMERIKSAAN KESEHATAN', nilai, 0
                )
            )
        FROM spbg_master_formal),
        (SELECT max(
                IF(
                    kode = 'PEMERIKSAAN KESEHATAN', nilai, 0
                )
            )
        FROM spbg_master_informal)
        )
    ) pemeriksaan
    , (
        IF(ds.`status` = 'formal',
        (SELECT max(
                IF(
                    kode = 'PEMERIKSAAN PSIKOLOGI', nilai, 0
                )
            )
        FROM spbg_master_formal),
        (SELECT max(
                IF(
                    kode = 'PEMERIKSAAN PSIKOLOGI', nilai, 0
                )
            )
        FROM spbg_master_informal)
        )
    ) pemeriksaan_psikolog,
    (
        IF(ds.`status` = 'formal',
        (SELECT max(
                IF(kode = 'VISA KERJA', nilai, 0)
            )
        FROM spbg_master_formal),
        (SELECT max(
                IF(kode = 'VISA KERJA', nilai, 0)
            )
        FROM spbg_master_informal)
        )
    ) visa,
    (
        IF(ds.`status` = 'formal',
        (SELECT max(
                IF(
                    kode = 'BPJS KETENAGAKERJAAN', nilai, 0
                )
            )
        FROM spbg_master_formal),
        (SELECT max(
                IF(
                    kode = 'BPJS KETENAGAKERJAAN', nilai, 0
                )
            )
        FROM spbg_master_informal)
        )
    ) bpjs,
    (
        IF(ds.`status` = 'formal',
        (SELECT max(IF(kode = 'SKCK', nilai, 0))
        FROM spbg_master_formal),
        (SELECT max(IF(kode = 'SKCK', nilai, 0))
        FROM spbg_master_informal)
        )
    ) skck,
    IF(
        s.propinsi_tipe IS NOT NULL,
        (
            IF(ds.`status` = 'formal',
            (SELECT max(
                    IF(
                        kode = 'TRANSPORT JAWA', nilai, 0
                    )
                )
            FROM spbg_master_formal),
            (SELECT max(
                    IF(
                        kode = 'TRANSPORT JAWA', nilai, 0
                    )
                )
            FROM spbg_master_informal)
            )
        ),
        '-'
    ) trans_jawa,
    IF(
        s.propinsi_tipe IS NOT NULL,
        (
            IF(ds.`status` = 'formal',
            (SELECT max(
                    IF(
                        kode = 'TRANSPORT LUAR JAWA', nilai, 0
                    )
                )
            FROM spbg_master_formal),
            (SELECT max(
                    IF(
                        kode = 'TRANSPORT LUAR JAWA', nilai, 0
                    )
                )
            FROM spbg_master_informal)
            )
        ),
        '-'
    ) trans_luar,
    (
        IF(ds.`status` = 'formal',
        (SELECT max(
                IF(
                    kode = 'TIKET KEBERANGKATAN', nilai, 0
                )
            )
        FROM spbg_master_formal),
        (SELECT max(
                IF(
                    kode = 'TIKET KEBERANGKATAN', nilai, 0
                )
            )
        FROM spbg_master_informal)
        )
    ) tiket,
    (
        IF(ds.`status` = 'formal',
        (SELECT max(
                IF(
                    kode = 'JASA PERUSAHAAN FORMAL', nilai, 0
                )
            )
        FROM spbg_master_formal),
        (SELECT max(
                IF(
                    kode = 'JASA PERUSAHAAN INFORMAL', nilai, 0
                )
            )
        FROM spbg_master_informal)
        )
    ) jasa,    SUBSTRING_INDEX(c.data_tki, "-", 1) sektor,    ds.`status`
FROM
    spbg_print_accurate c
    LEFT JOIN personal_nama p ON c.data_tki = p.id_biodata
    LEFT JOIN data_paspor dp ON c.data_tki = dp.id_biodata
    LEFT JOIN asal_tki s ON c.data_tki = s.id_biodata
    LEFT JOIN datasektor ds ON SUBSTRING_INDEX(c.data_tki, "-", 1) = ds.kode_jenis
WHERE
    c.tanggal BETWEEN '2025-01-14' AND ' 2025-01-15'