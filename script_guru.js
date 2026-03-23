// ==========================================
// 1. KONFIGURASI SUPABASE & STATE
// ==========================================
const supabaseUrl = import.meta.env.VITE_Supabase_Url;
const supabaseKey = import.meta.env.VITE_Supabase_Key;
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let dataTugasLokal = [];
let keranjangSoal = [];
let keranjangKunci = [];
let idTugasDihapus = null;

// ==========================================
// 2. INISIALISASI (AUTH GUARD & DATA AWAL)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Satpam: Jika tidak login, tendang ke login
    if (!user) { window.location.href = 'index.html'; return; }

    try {
        // Ambil profil guru menggunakan 'nama_asli'
        const { data: profil, error: profilError } = await supabaseClient
            .from('users')
            .select('nama_asli, role')
            .eq('id', user.id)
            .single();

        if (profilError || profil.role !== 'guru') {
            alert("Akses Ditolak! Anda bukan Guru.");
            window.location.href = 'index.html';
            return;
        }

        // Tampilkan nama di Navbar
        const elName = document.getElementById('user-name');
        if (elName) elName.innerText = profil.nama_asli;

        // Jalankan fungsi muat data
        muatDropdownDasar();
        muatDaftarTugas();
        muatRekapNilaiSemuaSiswa();
        setupEventListeners();

    } catch (err) {
        console.error("Gagal Inisialisasi Guru:", err);
    }
});

// ==========================================
// 3. LOGIKA REKAP NILAI (PENTING: SESUAI SQL)
// ==========================================

async function muatRekapNilaiSemuaSiswa() {
    const tbody = document.getElementById('table-body-rekap');
    if (!tbody) return;

    try {
        // Join ke users(nama_asli) dan tasks->subjects(name)
        const { data: subs, error } = await supabaseClient
            .from('submissions')
            .select(`
                score,
                status,
                created_at,
                users (nama_asli),
                tasks (title, subjects (name))
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = subs.length ? '' : '<tr><td colspan="5" style="text-align:center;">Belum ada riwayat nilai.</td></tr>';

        subs.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600;">${s.users?.nama_asli || 'Siswa'}</td>
                <td>${s.tasks?.subjects?.name || '-'}</td>
                <td>${s.tasks?.title || '-'}</td>
                <td style="font-weight: bold; color: var(--primary-color);">${s.score || '0'}</td>
                <td><span class="badge">${s.status || 'Selesai'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Eror Rekap Nilai:", err);
    }
}

// ==========================================
// 4. MANAJEMEN DAFTAR TUGAS
// ==========================================

async function muatDaftarTugas() {
    const container = document.getElementById('container-daftar-tugas');
    if (!container) return;

    try {
        // PERBAIKAN: Menggunakan 'nama_kelas' sesuai hasil SQL Anda
        const { data, error } = await supabaseClient
            .from('tasks')
            .select('id, title, created_at, subjects(name), classes(nama_kelas)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        dataTugasLokal = data;
        renderKartuTugas(data);
    } catch (err) {
        console.error("Eror Muat Tugas:", err);
    }
}

function renderKartuTugas(daftar) {
    const container = document.getElementById('container-daftar-tugas');
    if (!container) return;

    container.innerHTML = daftar.length ? '' : '<p class="loading-text">Belum ada tugas dibuat.</p>';

    daftar.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-card';
        div.innerHTML = `
            <h3>${task.title}</h3>
            <p>📚 ${task.subjects?.name || 'Umum'} | 👥 ${task.classes?.nama_kelas || 'Semua'}</p>
            <div class="card-actions">
                <button onclick="konfirmasiHapus('${task.id}', '${task.title}')" class="btn-hapus-tugas">🗑️ Hapus</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// ==========================================
// 5. PENGIRIMAN KE N8N (BUAT TUGAS BARU)
// ==========================================

async function simpanTugasKeN8N() {
    const payload = {
        mapel: document.getElementById('input-mapel').value,
        kelas: document.getElementById('input-kelas').value,
        judul: document.getElementById('input-nama-tugas').value
    };

    if (!payload.mapel || !payload.kelas || !payload.judul || keranjangKunci.length === 0) {
        return showToast("Mohon lengkapi semua data!", "error");
    }

    showLoading("Mengirim Tugas ke AI...");

    const fd = new FormData();
    fd.append('subject_id', payload.mapel);
    fd.append('class_id', payload.kelas);
    fd.append('nama_tugas', payload.judul);

    keranjangSoal.forEach((f, i) => fd.append(`file_soal_${i}`, f));
    keranjangKunci.forEach((f, i) => fd.append(`file_kunci_${i}`, f));

    try {
        const res = await fetch(import.meta.env.VITE_N8N_Production_url_guru, { method: 'POST', body: fd });
        if (res.ok) {
            showToast("Tugas Berhasil Terbit!", "success");
            document.getElementById('modal-buat-tugas').classList.add('hidden');
            resetFormTugas();
            muatDaftarTugas();
        }
    } catch (e) {
        showToast("Gagal terhubung ke n8n.", "error");
    } finally {
        hideLoading();
    }
}

// ==========================================
// 6. EVENT LISTENERS & DROPDOWNS
// ==========================================

function setupEventListeners() {
    // Tombol Buka Modal
    const btnBuka = document.getElementById('btn-buka-modal');
    if (btnBuka) {
        btnBuka.onclick = () => {
            resetFormTugas();
            document.getElementById('modal-buat-tugas').classList.remove('hidden');
        };
    }

    // Tombol Logout
    const btnLogout = document.getElementById('btn-logout-guru');
    if (btnLogout) {
        btnLogout.onclick = async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        };
    }

    // File Input Handlers
    document.getElementById('input-file-soal')?.addEventListener('change', (e) => {
        keranjangSoal = Array.from(e.target.files);
        updatePreview('preview-soal', keranjangSoal);
    });
    document.getElementById('input-file-kunci')?.addEventListener('change', (e) => {
        keranjangKunci = Array.from(e.target.files);
        updatePreview('preview-kunci', keranjangKunci);
    });

    // Form Action
    document.getElementById('btn-simpan-tugas')?.addEventListener('click', simpanTugasKeN8N);
    document.getElementById('btn-tutup-modal')?.addEventListener('click', () => {
        document.getElementById('modal-buat-tugas').classList.add('hidden');
    });
}

async function muatDropdownDasar() {
    const { data: m } = await supabaseClient.from('subjects').select('id, name');
    const { data: k } = await supabaseClient.from('classes').select('id, nama_kelas');
    
    const fill = (id, data, label, prop) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<option value="">${label}</option>` + 
            data.map(x => `<option value="${x.id}">${x[prop]}</option>`).join('');
    };

    fill('input-mapel', m, '-- Pilih Mapel --', 'name');
    fill('input-kelas', k, '-- Pilih Kelas --', 'nama_kelas');
    fill('select-filter-mapel', m, 'Semua Mapel', 'name');
    fill('select-filter-kelas', k, 'Semua Kelas', 'nama_kelas');
}

// ==========================================
// 7. UTILITIES (TOAST, LOADER, RESET)
// ==========================================

function updatePreview(id, files) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = files.map(f => `<div class="file-item">📄 ${f.name}</div>`).join('');
}

function resetFormTugas() {
    const fields = ['input-nama-tugas', 'input-mapel', 'input-kelas'];
    fields.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    keranjangSoal = []; keranjangKunci = [];
    updatePreview('preview-soal', []); updatePreview('preview-kunci', []);
}

function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.innerText = msg;
    container.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

function showLoading(text) {
    const l = document.getElementById('global-loader');
    const lt = document.getElementById('loader-text');
    if (l && lt) { lt.innerText = text; l.classList.remove('hidden'); }
}

function hideLoading() {
    const l = document.getElementById('global-loader');
    if (l) l.classList.add('hidden');
}

// Global Konfirmasi Hapus
window.konfirmasiHapus = (id, judul) => {
    idTugasDihapus = id;
    const modal = document.getElementById('modal-konfirmasi-hapus');
    const text = document.getElementById('teks-konfirmasi');
    if (modal && text) {
        text.innerText = `Hapus tugas "${judul}"?`;
        modal.classList.remove('hidden');
    }
};

document.getElementById('btn-confirm-delete')?.addEventListener('click', async () => {
    if (!idTugasDihapus) return;
    showLoading("Menghapus...");
    await supabaseClient.from('tasks').delete().eq('id', idTugasDihapus);
    hideLoading();
    document.getElementById('modal-konfirmasi-hapus').classList.add('hidden');
    muatDaftarTugas();
    showToast("Terhapus.", "success");
});

document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
    document.getElementById('modal-konfirmasi-hapus').classList.add('hidden');
});