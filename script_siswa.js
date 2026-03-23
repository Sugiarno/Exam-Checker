// ==========================================
// 1. KONFIGURASI SUPABASE & STATE
// ==========================================
const supabaseUrl = import.meta.env.VITE_Supabase_Url;
const supabaseKey = import.meta.env.VITE_Supabase_Key;
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let dataSiswaLokal = null;
let dataTugasSiswaLokal = [];
let tugasTerpilih = null;
let keranjangJawaban = [];

// ==========================================
// 2. INISIALISASI HALAMAN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }

    try {
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*, classes(nama_kelas)') 
            .eq('id', user.id)
            .single();

        if (userError) throw userError;

        dataSiswaLokal = userData;
        document.getElementById('user-name').innerText = userData.nama_asli || 'Siswa';

        if (userData.class_id) {
            muatDaftarTugasSiswa(userData.class_id);
            muatRiwayatNilai(userData.id);
        }
        
        setupEventListeners();

    } catch (err) {
        console.error("Gagal inisialisasi:", err);
    }
});

// ==========================================
// 3. LOGIKA DAFTAR TUGAS
// ==========================================

async function muatDaftarTugasSiswa(classId) {
    try {
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('id, title, created_at, subjects(name)')
            .eq('class_id', classId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        dataTugasSiswaLokal = tasks;
        renderKartuTugasSiswa(tasks);
    } catch (err) {
        console.error("Gagal muat tugas:", err);
    }
}

function renderKartuTugasSiswa(daftarTugas) {
    const container = document.getElementById('container-tugas-siswa');
    if (!container) return;
    container.innerHTML = '';

    if (daftarTugas.length === 0) {
        container.innerHTML = '<p class="loading-text">Tidak ada tugas untuk kelas Anda.</p>';
        return;
    }

    daftarTugas.forEach(task => {
        const mapel = task.subjects?.name || "Tugas";
        const tgl = new Date(task.created_at).toLocaleDateString('id-ID');

        const card = document.createElement('div');
        card.className = 'task-card';
        card.style.cursor = 'pointer'; 
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span class="badge" style="background:var(--bg-main); color:var(--primary-color);">${mapel}</span>
                <span style="font-size:12px; color:#9ca3af;">${tgl}</span>
            </div>
            <h3 style="margin: 10px 0;">${task.title}</h3>
            <button class="btn-outline" style="width:100%; pointer-events:none;">Buka Tugas</button>
        `;

        // BAGIAN PENTING: Menghubungkan klik kartu ke fungsi detail
        card.onclick = () => bukaDetailTugas(task.id, task.title, mapel);
        container.appendChild(card);
    });
}

// ==========================================
// 4. LOGIKA DETAIL TUGAS (YANG TADI HILANG)
// ==========================================

async function bukaDetailTugas(idTugas, judulTugas, mapel) {
    tugasTerpilih = idTugas;
    
    // Switch View
    document.getElementById('panel-daftar-tugas').classList.add('hidden');
    document.getElementById('panel-detail-tugas').classList.remove('hidden');
    
    document.getElementById('detail-judul-tugas').innerText = judulTugas;
    document.getElementById('detail-mapel-tugas').innerText = mapel;

    // Ambil File Soal
    const listSoal = document.getElementById('list-file-soal');
    listSoal.innerHTML = '<p>Memuat lampiran...</p>';

    const { data: files } = await supabaseClient
        .from('task_files')
        .select('file_name, file_url')
        .eq('task_id', idTugas)
        .eq('file_type', 'soal');

    if (!files || files.length === 0) {
        listSoal.innerHTML = '<p style="font-size:13px; color:#6b7280;">Tidak ada file soal.</p>';
    } else {
        listSoal.innerHTML = files.map(f => `
            <div class="file-item">
                <a href="${f.file_url}" target="_blank">📄 Download: ${f.file_name}</a>
            </div>
        `).join('');
    }
}

// ==========================================
// 5. SISTEM UPLOAD & RIWAYAT
// ==========================================

async function muatRiwayatNilai(userId) {
    const tbody = document.getElementById('riwayat-tugas-siswa');
    if (!tbody) return;

    const { data: subs } = await supabaseClient
        .from('submissions')
        .select('score, status, created_at, tasks(title)')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

    if (!subs || subs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada riwayat.</td></tr>';
        return;
    }

    tbody.innerHTML = subs.map(s => `
        <tr>
            <td>${s.tasks?.title}</td>
            <td>${new Date(s.created_at).toLocaleDateString()}</td>
            <td><span class="badge">${s.status}</span></td>
            <td style="font-weight:bold;">${s.score || '...'}</td>
        </tr>
    `).join('');
}

function setupEventListeners() {
    // Tombol Kembali
    document.getElementById('btn-kembali')?.addEventListener('click', () => {
        tugasTerpilih = null;
        keranjangJawaban = [];
        renderPreviewJawaban();
        document.getElementById('panel-detail-tugas').classList.add('hidden');
        document.getElementById('panel-daftar-tugas').classList.remove('hidden');
    });

    // Upload Handlers
    document.getElementById('file-jawaban-galeri')?.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(f => keranjangJawaban.push(f));
        renderPreviewJawaban();
    });

    document.getElementById('btn-kirim-jawaban')?.addEventListener('click', kirimJawabanKeN8N);

    // Logout
    document.getElementById('btn-logout-siswa')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    });
}

function renderPreviewJawaban() {
    const container = document.getElementById('preview-jawaban-siswa');
    if(container) {
        container.innerHTML = keranjangJawaban.map((f, i) => `
            <div class="file-item">📎 ${f.name} <button onclick="hapusFile(${i})">✕</button></div>
        `).join('');
    }
}

window.hapusFile = (i) => {
    keranjangJawaban.splice(i, 1);
    renderPreviewJawaban();
};

async function kirimJawabanKeN8N() {
    if (!tugasTerpilih || keranjangJawaban.length === 0) return alert("Pilih tugas & upload file!");
    
    showLoading("Mengirim ke AI...");
    const fd = new FormData();
    fd.append('task_id', tugasTerpilih);
    fd.append('student_id', dataSiswaLokal.id);
    fd.append('student_name', dataSiswaLokal.nama_asli);

    keranjangJawaban.forEach((f, i) => fd.append(`file_jawaban_${i}`, f));

    try {
        const res = await fetch(import.meta.env.VITE_N8N_Production_url_siswa2, { method: 'POST', body: fd });
        if (res.ok) {
            alert("Berhasil terkirim!");
            keranjangJawaban = [];
            document.getElementById('btn-kembali').click();
            muatRiwayatNilai(dataSiswaLokal.id);
        }
    } catch (e) {
        alert("Gagal kirim.");
    } finally {
        hideLoading();
    }
}

// UTILS
function showLoading(txt) { 
    const l = document.getElementById('global-loader');
    if(l) { document.getElementById('loader-text').innerText = txt; l.classList.remove('hidden'); }
}
function hideLoading() { document.getElementById('global-loader')?.classList.add('hidden'); }