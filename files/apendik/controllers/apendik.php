<?php if (!defined('BASEPATH')) exit('Maaf, akses secara langsung tidak diperkenankan.');

class Apendik extends MX_Controller{
    public function __construct(){
            parent::__construct();
            $this->load->model('modalku'); 
            $this->load->model('M_session'); 
    }
    
    function index(){
        $session = $this->M_session->get_session();
        if (!$session['session_userid'] && !$session['session_status']){
            //user belum login
            $data['namamodule'] = "login";
            $data['namafileview'] = "login";
            echo Modules::run('template/login_template', $data);
        }
        else{
        $id_user = $session['session_userid'];
        $status = $session['session_status'];
            //user sudah login
            if ($id_user && $status==1){
            //user sudah login
                redirect('apendik/document_send_taiwan/MF-1633');
            }
        }
    }





    function apendik_a($kategori, $key){



        header ("Content-type: text/html; charset=utf-8");
        require_once 'PHPWord/PHPWord.php';
        $PHPWord = new PHPWord();


        if ($kategori == 'a') {
            $document = $PHPWord->loadTemplate('files/apendik_a.docx');
        }elseif ($kategori == 'b') {
            $document = $PHPWord->loadTemplate('files/apendik_b.docx');
        }elseif ($kategori == 'c') {
            $document = $PHPWord->loadTemplate('files/apendik_c.docx');
        }elseif ($kategori == 'd') {
            $document = $PHPWord->loadTemplate('files/apendik_d.docx');
        }elseif ($kategori == 'b10') {
            $document = $PHPWord->loadTemplate('files/b10.docx');
        }elseif ($kategori == 'b10.2') {
            $document = $PHPWord->loadTemplate('files/B10.2.docx');
        }elseif ($kategori == 'C6') {
            $document = $PHPWord->loadTemplate('files/C6.docx');
        }elseif ($kategori == 'C7') {
            $document = $PHPWord->loadTemplate('files/C7.docx');
        }elseif ($kategori == 'C8') {
            $document = $PHPWord->loadTemplate('files/C8.docx');
        }elseif ($kategori == 'C9') {
            $document = $PHPWord->loadTemplate('files/C9.docx');
        }elseif ($kategori == 'C10') {
            $document = $PHPWord->loadTemplate('files/C10.docx');
        }elseif ($kategori == 'C11') {
            $document = $PHPWord->loadTemplate('files/C11.docx');
        }elseif ($kategori == 'C12') {
            $document = $PHPWord->loadTemplate('files/C12.docx');
        }elseif ($kategori == 'C13') {
            $document = $PHPWord->loadTemplate('files/C13.docx');
        }elseif ($kategori == 'C14') {
            $document = $PHPWord->loadTemplate('files/C14.docx');
        }elseif ($kategori == 'C15') {
            $document = $PHPWord->loadTemplate('files/C15.docx');
        }elseif ($kategori == 'C16') {
            $document = $PHPWord->loadTemplate('files/C16.docx');
        }elseif ($kategori == 'C17') {
            $document = $PHPWord->loadTemplate('files/C17.docx');
        }elseif ($kategori == 'amplopabc') {
            $document = $PHPWord->loadTemplate('files/amplopabc.docx');
        }elseif ($kategori == 'D.02') {
            $document = $PHPWord->loadTemplate('files/D.02.docx');
        }elseif ($kategori == 'pppt') {
            $document = $PHPWord->loadTemplate('files/PERNYATAAN PENGEMBALIAN PAJAK TKI.docx');
        }elseif ($kategori == 'spt') {
            $document = $PHPWord->loadTemplate('files/SURAT PERNYATAAN TKA.docx');
        }elseif ($kategori == 'ptdat') {
            $document = $PHPWord->loadTemplate('files/PERJANJIAN TKA DAN AGEN TAIWAN.docx');
        }
// -------------------------------// content //--------------------------------------------------------// 
        $data = $this->db->query("
               SELECT
    a.id_biodata,
    a.nama,
    a.jeniskelamin,
    a.warganegara,
    a.nama_mandarin,
    b.kode_agen,
    c.nama AS nama_agen,
    c.namamandarin AS mandarin_agen,

IF (
    b.namamajikan = 0,
    d.nama,
    b.namamajikan
) AS nama_majikan,

IF (
    b.namataiwan = 0,
    d.namamajikan,
    b.namataiwan
) AS majikan_mandarin,
 e.nopaspor,
 f.no_suhan,
 g.no_visapermit,
 DATE(h.tglberangkat) AS tgltiba,
 h.statsuhandok,
 h.statvpdok,
 d.alamat_mandarin,
 d.alamat,
 d.hp,
 c.nosiup,
 c.alamat AS alamatagen2,
 c.alamatmandarin AS alamatmandarinagen,
 c.nosiup,
 c.notel AS notelpagen,
 c.direktur,
 c.direktur2 AS direkturmandarin,
i.nama_bank,
j.isikredit,
h.ketdoksuhan,
h.ketdokvp
FROM
    personal a
LEFT JOIN majikan b ON a.id_biodata = b.id_biodata
LEFT JOIN dataagen c ON b.kode_agen = c.id_agen
LEFT JOIN datamajikan d ON b.kode_majikan = d.id_majikan
LEFT JOIN paspor e ON a.id_biodata = e.id_biodata
LEFT JOIN datasuhan f ON b.kode_suhan = f.id_suhan
LEFT JOIN datavisapermit g ON b.kode_visapermit = g.id_visapermit
LEFT JOIN visa h ON a.id_biodata = h.id_biodata
LEFT JOIN signingbank i ON a.id_biodata = i.id_biodata
LEFT JOIN datakreditbank j ON i.idkredit = j.id_kreditbank
                WHERE a.id_biodata = '$key'

            ")->row();

        $tanggal_tiba = $data->tgltiba;

        $tanggal_tiba = explode("-", $tanggal_tiba);


        if ($data->jeniskelamin == '男') {
            $jenis_kelamin = 'Pria';
        }elseif ($data->jeniskelamin == '女') {
            $jenis_kelamin = 'Wanita';
        }else{
            $jenis_kelamin = '';
        }


        $document->setValue('{agenmandarin}', $data->mandarin_agen);     
        $document->setValue('{jeniskelamin}', $data->jeniskelamin);     
        $document->setValue('{jeniskelaminindo}', strtoupper($jenis_kelamin));     
        $document->setValue('{warganegara}', $data->warganegara);     
        $document->setValue('{majikanmandarin}', $data->majikan_mandarin);     
        $document->setValue('{namamandarin}', $data->nama_mandarin);     
        $document->setValue('{namaagen}', $data->nama_agen);     
        $document->setValue('{namamajikan}', $data->nama_majikan);     
        $document->setValue('{nama}', $data->nama);     
        $document->setValue('{idtki}', $data->id_biodata);     
        $document->setValue('{nopaspor}', $data->nopaspor);     
        $document->setValue('{tglkedatangan}', $data->tgltiba);     
        $document->setValue('{suhan}', $data->no_suhan);     
        $document->setValue('{visapermit}', $data->no_visapermit);     
        $document->setValue('{keasliansuhan}', $data->statsuhandok);     
        $document->setValue('{keaslianvisapermit}', $data->statvpdok);     
        $document->setValue('{alamat_mandarin}', $data->alamat_mandarin);     
        $document->setValue('{alamat}', $data->alamat);     
        $document->setValue('{hp}', $data->hp);   
        $document->setValue('{tgl}', $tanggal_tiba[2]);   
        $document->setValue('{bln}', $tanggal_tiba[1]);   
        $document->setValue('{thn}', $tanggal_tiba[0]);   
        $document->setValue('{namabank}', $data->nama_bank);   
        $document->setValue('{typekredit}', $data->isikredit);
        $document->setValue('{ketdoksuhan}', $data->ketdoksuhan);
        $document->setValue('{ketdokvp}', $data->ketdokvp);
        $document->setValue('{nosiup}', $data->nosiup);
        $document->setValue('{direktur}', $data->direktur);
        $document->setValue('{direkturmandarin}', $data->direkturmandarin);
        $document->setValue('{notelpagen}', $data->notelpagen);
        $document->setValue('{alamatagen2}', $data->alamatagen2);
        $document->setValue('{alamatmandarinagen}', $data->alamatmandarinagen);
        $idagen = $data->kode_agen;
        echo "<pre>";

        $dapatkan_agen = $this->db->query("SELECT * FROM dataagen WHERE id_agen = '$idagen'")->row();
        var_dump($dapatkan_agen);
        echo $data->alamatagen2;

//  ------------------------------------------- save file ------------------------------------------------------------------//

        // $tmp_file = 'biodata_cong_yi/apendik_a.docx';
        // $document->save($tmp_file);

   


// ------------------------------------------- download file --------------------------------------------------------------//

        // redirect('apendik/hasil/'.$key.'/'.$kategori.'/'.$data->nama);

    }

    function hasil($key, $kategori, $nama){

        require_once 'gugus/phpword/PHPWord.php';
        $PHPWord = new PHPWord();
        $document = $PHPWord->loadTemplate('biodata_cong_yi/apendik_a.docx');

        if ($kategori == 'a') {
            $namafile = "Apendik A ".date("d-m-Y");
        }elseif ($kategori == 'b') {
            $namafile = "Apendik B ".date("d-m-Y");
        }elseif ($kategori == 'c') {
            $namafile = "Apendik C ".date("d-m-Y");
        }elseif ($kategori == 'd') {
            $namafile = "Apendik D ".date("d-m-Y");
        }elseif ($kategori == 'b10') {
            $namafile = "b10 ".date("d-m-Y");
        }elseif ($kategori == 'b10.2') {
            $namafile = "b10.2 ".date("d-m-Y");
        }elseif ($kategori == 'C6') {
            $namafile = "C6 ".date("d-m-Y");
        }elseif ($kategori == 'C7') {
            $namafile = "C7 ".date("d-m-Y");
        }elseif ($kategori == 'C8') {
            $namafile = "C8 ".date("d-m-Y");
        }elseif ($kategori == 'C9') {
            $namafile = "C9 ".date("d-m-Y");
        }elseif ($kategori == 'C10') {
            $namafile = "C10 ".date("d-m-Y");
        }elseif ($kategori == 'C11') {
            $namafile = "C11 ".date("d-m-Y");
        }elseif ($kategori == 'C12') {
            $namafile = "C12 ".date("d-m-Y");
        }elseif ($kategori == 'C13') {
            $namafile = "C13 ".date("d-m-Y");
        }elseif ($kategori == 'C14') {
            $namafile = "C14 ".date("d-m-Y");
        }elseif ($kategori == 'C15') {
            $namafile = "C15 ".date("d-m-Y");
        }elseif ($kategori == 'C16') {
            $namafile = "C16 ".date("d-m-Y");
        }elseif ($kategori == 'C17') {
            $namafile = "C17 ".date("d-m-Y");
        }elseif ($kategori == 'amplopabc') {
            $namafile = "amplopabc ".date("d-m-Y");
        }elseif ($kategori == 'D.02') {
            $namafile = "D.02 ".date("d-m-Y");
        }elseif ($kategori == 'pppt') {
            $namafile = " PERNYATAAN PENGEMBALIAN PAJAK TKI ".date("d-m-Y");
        }elseif ($kategori == 'spt') {
            $namafile = " SURAT PERNYATAAN TKA ".date("d-m-Y");
        }elseif ($kategori == 'ptdat') {
            $namafile = " PERJANJIAN TKA DAN AGEN TAIWAN ".date("d-m-Y");
        }


        $filename = 'biodata_cong_yi/apendik_a_result.docx';
        $isinya=$document->save($filename);
        header("Content-Description: File Transfer");
        header('Content-Disposition: attachment; filename= '.$nama.' '.$namafile.'.docx');
        header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        header('Content-Transfer-Encoding: binary');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Expires: 0');
            
        flush();
        readfile($isinya);
        unlink($isinya); // deletes the temporary file
        exit;
    }



    function document_send_taiwan($key){
        header ("Content-type: text/html; charset=utf-8");
        require_once 'PHPWord/PHPWord.php';
        $PHPWord = new PHPWord();
        $document = $PHPWord->loadTemplate('files/document_send_taiwan.docx');
// -------------------------------------------- area data ------------------------------------------------------------------//

$data = $this->db->query("

        SELECT
            a.id_biodata,
            a.nama,
            a.nama_mandarin,
            b.kode_agen,
            c.nama AS nama_agen,
            c.namamandarin AS mandarin_agen,

        IF (
            b.namamajikan = 0,
            d.nama,
            b.namamajikan
        ) AS nama_majikan,

        IF (
            b.namataiwan = 0,
            d.namamajikan,
            b.namataiwan
        ) AS majikan_mandarin,
         e.nopaspor,
         f.no_suhan,
         g.no_visapermit,
         DATE(h.tglberangkat) AS tgltiba,
         h.statsuhandok,
         h.statvpdok,
         d.alamat_mandarin,
         d.alamat,
         d.hp,
         h.jddok,
         h.arcdok,
         h.icdok,
         h.apendik_a,
         h.apendik_b,
         h.apendik_c,
         h.apendik_d,
         h.ketdoksuhan,
         h.ketdokvp,
         h.isidok1,
         h.isidok2,
         h.isidok3,
         h.isidok4,
         h.isidok5,
         h.isidok6,
         h.isidok7,
         h.isidok8,
         h.statdok1,
         h.statdok2,
         h.statdok3,
         h.statdok4,
         h.statdok5,
         h.statdok6,
         h.statdok7,
         h.statdok8,
         h.tempatsuhandok,
         h.tempatvpdok

        FROM
            personal a
        LEFT JOIN majikan b ON a.id_biodata = b.id_biodata
        LEFT JOIN dataagen c ON b.kode_agen = c.id_agen
        LEFT JOIN datamajikan d ON b.kode_majikan = d.id_majikan
        LEFT JOIN paspor e ON a.id_biodata = e.id_biodata
        LEFT JOIN datasuhan f ON b.kode_suhan = f.id_suhan
        LEFT JOIN datavisapermit g ON b.kode_visapermit = g.id_visapermit
        LEFT JOIN visa h ON a.id_biodata = h.id_biodata
        WHERE a.id_biodata = '$key'
")->row();




    $document->setValue('{agenmandarin}', $data->mandarin_agen);     
        $document->setValue('{majikanmandarin}', $data->majikan_mandarin);     
        $document->setValue('{namamandarin}', $data->nama_mandarin);     
        $document->setValue('{namaagen}', $data->nama_agen);     
        $document->setValue('{namamajikan}', $data->nama_majikan);     
        $document->setValue('{nama}', $data->nama);     
        $document->setValue('{idtki}', $data->id_biodata);     
        $document->setValue('{nopaspor}', $data->nopaspor);     
        $document->setValue('{tglkedatangan}', $data->tgltiba);     
        $document->setValue('{suhan}', $data->no_suhan);     
        $document->setValue('{visapermit}', $data->no_visapermit);     
        $document->setValue('{keasliansuhan}', $data->statsuhandok);     
        $document->setValue('{keaslianvisapermit}', $data->statvpdok);     
        $document->setValue('{alamat_mandarin}', $data->alamat_mandarin);     
        $document->setValue('{alamat}', $data->alamat);     
        $document->setValue('{hp}', $data->hp);   
        $document->setValue('{tgl}', $tanggal_tiba[2]);   
        $document->setValue('{bln}', $tanggal_tiba[1]);   
        $document->setValue('{thn}', $tanggal_tiba[0]);  
        $document->setValue('{jd}', $data->jddok);  
        $document->setValue('{arc}', $data->arcdok);  
        $document->setValue('{ic}', $data->icdok);
        $document->setValue('{ketdoksuhan}', $data->ketdoksuhan);
        $document->setValue('{ketdokvp}', $data->ketdokvp);
        $document->setValue('{negaratujuan}', $data->tempatsuhandok);
        $document->setValue('{negaratujuan2}', $data->tempatvpdok);

        if ($data->apendik_b != '') {
            $document->setValue('{apendik_b}', '附索引B - TERLAMPIR APPENDIX B');
            $document->setValue('{apendik_b_terlampir}', '按要求SESUAI PERMINTAAN');
        }else{
            $document->setValue('{apendik_b}' ,'');
            $document->setValue('{apendik_b_terlampir}' ,'');
        }

        $permintaan_agen = array();
        $permintaan_agen_terlampir = array();

        if ($data->apendik_a != '') {
            $permintaan_agen[] = "附索引A - TERLAMPIR APPENDIX A";
            $permintaan_agen_terlampir[] = "按要求SESUAI PERMINTAAN";
        }else{
            $permintaan_agen[] = "";
            $permintaan_agen_terlampir[] = "";
        }

        if ($data->apendik_c != '') {
            $permintaan_agen[] = "附索引C - TERLAMPIR APPENDIX C";
            $permintaan_agen_terlampir[] = "按要求SESUAI PERMINTAAN";
        }else{
            $permintaan_agen[] = "";
            $permintaan_agen_terlampir[] = "";
        }

        if ($data->apendik_d != '') {
            $permintaan_agen[] = "附索引D - TERLAMPIR APPENDIX D";
            $permintaan_agen_terlampir[] = "按要求SESUAI PERMINTAAN";
        }else{
            $permintaan_agen[] = "";
            $permintaan_agen_terlampir[] = "";
        }


        $isidok = array();
        if ($data->isidok1 != "") {
            $isidok[] =  $data->isidok1;
        }

        if ($data->isidok2 != "") {
            $isidok[] =  $data->isidok2;
        }

        if ($data->isidok3 != "") {
            $isidok[] =  $data->isidok3;
        }

        if ($data->isidok4 != "") {
            $isidok[] =  $data->isidok4;
        }

        if ($data->isidok5 != "") {
            $isidok[] =  $data->isidok5;
        }

        if ($data->isidok6 != "") {
            $isidok[] =  $data->isidok6;
        }

        if ($data->isidok7 != "") {
            $isidok[] =  $data->isidok7;
        }

        if ($data->isidok8 != "") {
            $isidok[] =  $data->isidok8;
        }

        $statdok = array();

        if ($data->statdok1 != "") {
            $statdok[] =  $data->statdok1;
        }

        if ($data->statdok2 != "") {
            $statdok[] =  $data->statdok2;
        }

        if ($data->statdok3 != "") {
            $statdok[] =  $data->statdok3;
        }

        if ($data->statdok4 != "") {
            $statdok[] =  $data->statdok4;
        }

        if ($data->statdok5 != "") {
            $statdok[] =  $data->statdok5;
        }

        if ($data->statdok6 != "") {
            $statdok[] =  $data->statdok6;
        }

        if ($data->statdok7 != "") {
            $statdok[] =  $data->statdok7;
        }

        if ($data->statdok8 != "") {
            $statdok[] =  $data->statdok8;
        }

        $nodoklain = array();
        
        if (count($statdok) == 0) {
            $statdok[] = "";
            $nodoklain[] = "";
        }else{
            for ($i=0; $i < count($isidok); $i++) { 
                $nodoklain[] = $i+16;
            }
        }

        if (count($isidok) == 0) {
            $isidok[] = "";
        }


        $doklain = array(
            'no' => $nodoklain,
            'isidok' => $isidok,
            'statdok' => $statdok 
        );

        $document->cloneRow('datalain', $doklain);


        $data_apendik = array(
            'apendik' => $permintaan_agen,
            'terlampir' => $permintaan_agen_terlampir,
        );

        $document->cloneRow('data', $data_apendik);

        $pinho = substr($data->id_biodata, -7, 2) ;

        if ($pinho == "FI" || $pinho == "MI") {
            $pinhonya = 'informal';
        }elseif ($pinho == "FF" || $pinho == "MF") {
            $pinhonya = 'formal';
        }

        echo $pinhonya;

        $dapatkan_dokument_permintaan_agen = $this->modalku->buatarray("dokumen", "dokumen", "detail_dokumen", $data->kode_agen, "id_agen", " AND ( status = '$pinhonya' OR status = '') AND type_permintaan = 'Permintaan Agen'" );

        $dapatkan_dokument_permintaan_agen_status = $this->modalku->buatarray("stats", "stats", "detail_dokumen", $data->kode_agen, "id_agen", " AND ( status = '$pinhonya' OR status = '') AND type_permintaan = 'Permintaan Agen'" );

        $dapatkan_dokument_permintaan_majikan = $this->modalku->buatarray("dokumen", "dokumen", "detail_dokumen", $data->kode_agen, "id_agen", " AND ( status = '$pinhonya' OR status = '') AND type_permintaan = 'Permintaan Majikan'" );

        $dapatkan_dokument_permintaan_majikan_status = $this->modalku->buatarray("stats", "stats", "detail_dokumen", $data->kode_agen, "id_agen", " AND ( status = '$pinhonya' OR status = '') AND type_permintaan = 'Permintaan Majikan'" );


        $dapatkan_data_detail_document = $this->db->query("SELECT * FROM detail_dokumen WHERE id_agen = '$data->kode_agen'")->result();
        echo "<pre>";


        if (count($dapatkan_dokument_permintaan_majikan)==0) {
            $dapatkan_dokument_permintaan_majikan = array("");
            $dapatkan_dokument_permintaan_majikan_status = array("");
        }

        $permintaan = array(
            'permintaan_majikan' => $dapatkan_dokument_permintaan_majikan,
            'permintaan_majikan_status' => $dapatkan_dokument_permintaan_majikan_status,
        );

        $document->cloneRow('apendik', $permintaan);


        if (count($dapatkan_dokument_permintaan_agen)==0) {
            $dapatkan_dokument_permintaan_agen = array("");
            $dapatkan_dokument_permintaan_majikan_status = array("");
        }

        $permintaan2 = array(
            'permintaan_majikan' => $dapatkan_dokument_permintaan_agen,
            'permintaan_majikan_status' => $dapatkan_dokument_permintaan_agen_status,
        );

        $document->cloneRow('apendik2', $permintaan2);

//  ------------------------------------------- save file ------------------------------------------------------------------//

        $tmp_file = 'biodata_cong_yi/document_send_taiwan_master.docx';
        $document->save($tmp_file);


// ------------------------------------------- download file --------------------------------------------------------------//

        redirect('apendik/result_print_out/');
    }

    function result_print_out(){
         require_once 'gugus/phpword/PHPWord.php';
        $PHPWord = new PHPWord();
        $document = $PHPWord->loadTemplate('biodata_cong_yi/document_send_taiwan_master.docx');

      

        $filename = 'biodata_cong_yi/apendik_a_result.docx';
        $isinya=$document->save($filename);
        header("Content-Description: File Transfer");
        header('Content-Disposition: attachment; filename= document send to taiwan.docx');
        header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        header('Content-Transfer-Encoding: binary');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Expires: 0');
            
        flush();
        readfile($isinya);
        unlink($isinya); // deletes the temporary file
        exit;
    }

}