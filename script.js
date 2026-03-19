// ==========================================
// BLOK 1: KONFIGURASI SUPABASE & STATE GLOBAL
// ==========================================

// Inisialisasi koneksi ke database Supabase Anda
const supabaseUrl = 'https://vhvryershcomgwxezggo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnJ5ZXJzaGNvbWd3eGV6Z2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDcyNDQsImV4cCI6MjA3ODE4MzI0NH0.Ul-kcLoMGKdbQB_J6YJkTFrgTYMqc1f4FRhBHgOUWW8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variabel Global (State) untuk menyimpan data sementara di memori browser
let dataTugasLokal = [];     // Menyimpan daftar tugas agar filter pencarian lebih cepat (tanpa loading server)
let keranjangSoal = [];      // Array penyimpan file soal sebelum dikirim ke n8n
let keranjangKunci = [];     // Array penyimpan file kunci jawaban sebelum dikirim ke n8n
let idTugasDihapus = null;   // Menyimpan ID tugas sementara saat modal konfirmasi hapus muncul

// Mengelompokkan elemen UI (DOM) agar lebih mudah dipanggil
const views = {
    login: document.getElementById('view-login'),
    guru: document.getElementById('view-guru'),
    nav: document.getElementById('main-nav')
};

// ==========================================
// BLOK 2: SISTEM NOTIFIKASI TOAST (UI/UX)
// ==========================================

// Fungsi ini bertugas memunculkan kotak notifikasi melayang di pojok layar
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    // Menentukan warna garis pinggir berdasarkan tipe (success/error/info)
    toast.className = `toast ${type}`;
    
    // Menentukan ikon
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    
    // Memasukkan isi HTML ke dalam kotak toast
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    
    // Animasi masuk (muncul setelah 10 milidetik)
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Menghilangkan toast secara otomatis setelah 4 detik
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300); // Hapus elemen dari HTML setelah animasi selesai
    }, 4000);
}

// ==========================================
// BLOK 3: SISTEM AUTENTIKASI (LOGIN & LOGOUT)
// ==========================================

async function handleLogin() {
    const email = document.getElementById('input-email').value;
    const password = document.getElementById('input-password').value;
    const btnLogin = document.getElementById('btn-login');

    // Validasi sederhana jika input kosong
    if (!email || !password) return showToast("Email dan password wajib diisi!", "error");

    btnLogin.innerText = "Memproses...";

    try {
        // 1. Cek email dan password ke Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (authError) throw authError;

        // 2. Jika berhasil, ambil data lengkap user (seperti 'role' dan 'nama') dari tabel 'users'
        const { data: userData, error: userError } = await supabaseClient
            .from('users').select('*').eq('id', authData.user.id).single();
        if (userError) throw userError;

        // 3. Arahkan user ke halaman yang tepat berdasarkan role
        tampilkanHalamanBerdasarkanRole(userData);
    } catch (error) {
        showToast("Login Gagal: Akun tidak ditemukan atau password salah.", "error");
    } finally {
        btnLogin.innerText = "Masuk"; // Kembalikan teks tombol
    }
}

function tampilkanHalamanBerdasarkanRole(user) {
    // Sembunyikan semua tampilan terlebih dahulu
    Object.values(views).forEach(v => v?.classList.add('hidden'));
    
    // Tampilkan Navigasi Atas dan set nama user
    views.nav.classList.remove('hidden');
    document.getElementById('user-name').innerText = user.full_name;
    document.getElementById('user-role-badge').innerText = user.role.toUpperCase();

    // Logika Pengalihan (Redirect)
    if (user.role === 'guru') {
        views.guru.classList.remove('hidden'); // Munculkan dashboard guru
        inisialisasiDashboardGuru();           // Tarik data tugas dari database
    } else if (user.role === 'siswa') {
        window.location.href = 'siswa.html';   // Pindahkan ke file HTML siswa
    }
}

// ==========================================
// BLOK 4: MANAJEMEN TUGAS (BACA, FILTER, HAPUS)
// ==========================================

async function inisialisasiDashboardGuru() {
    await muatDropdownFilter(); // Isi pilihan Mapel & Kelas di alat pencarian
    await muatDaftarTugas();    // Tarik daftar kartu tugas
}

// Fungsi untuk mengambil data tugas dari tabel Supabase
async function muatDaftarTugas() {
    const container = document.getElementById('container-daftar-tugas');
    container.innerHTML = '<p>Memuat data...</p>';

    // Query untuk mengambil tugas beserta nama kelas dan mapel (relasi tabel)
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('id, title, created_at, subjects(name), classes(name)')
        .order('created_at', { ascending: false });

    if (!error) {
        dataTugasLokal = data; // Simpan ke variabel global untuk fitur filter
        renderTugas(dataTugasLokal); // Tampilkan ke layar
    }
}

// Fungsi untuk "menggambar" kartu tugas ke dalam HTML
function renderTugas(daftar) {
    const container = document.getElementById('container-daftar-tugas');
    container.innerHTML = daftar.length ? '' : '<p>Tidak ada tugas ditemukan.</p>';

    daftar.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-card';
        div.innerHTML = `
            <h3>${task.title}</h3>
            <p>📚 ${task.subjects?.name} | 👥 ${task.classes?.name}</p>
            <div class="card-actions">
                <button onclick="hapusTugas('${task.id}', '${task.title}')" class="btn-hapus-tugas">🗑️ Hapus</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// Fungsi penyaring (Filter) berbasis teks dan dropdown
function filterTugas() {
    const keyword = document.getElementById('input-cari').value.toLowerCase();
    const mapel = document.getElementById('select-filter-mapel').value;
    const kelas = document.getElementById('select-filter-kelas').value;

    // Saring dataTugasLokal berdasarkan kriteria yang dipilih
    const hasil = dataTugasLokal.filter(t => {
        const matchNama = t.title.toLowerCase().includes(keyword);
        const matchMapel = mapel === "" || t.subjects?.name === mapel;
        const matchKelas = kelas === "" || t.classes?.name === kelas;
        return matchNama && matchMapel && matchKelas;
    });
    
    renderTugas(hasil); // Tampilkan hasil saringan
}

// --- LOGIKA CUSTOM DELETE MODAL ---
function hapusTugas(id, judul) {
    idTugasDihapus = id; // Simpan ID tugas yang diklik ke memori
    document.getElementById('teks-konfirmasi').innerText = `Apakah Anda yakin ingin menghapus tugas "${judul}"? Semua data terkait akan hilang.`;
    document.getElementById('modal-konfirmasi-hapus').classList.remove('hidden'); // Munculkan modal
}

document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
    document.getElementById('modal-konfirmasi-hapus').classList.add('hidden'); // Tutup modal jika batal
    idTugasDihapus = null;
});

document.getElementById('btn-confirm-delete')?.addEventListener('click', async () => {
    if (!idTugasDihapus) return;
    
    const modal = document.getElementById('modal-konfirmasi-hapus');
    const btn = document.getElementById('btn-confirm-delete');
    
    btn.innerText = "Menghapus...";
    btn.disabled = true;

    try {
        // Hapus data dari Supabase berdasarkan ID
        const { error } = await supabaseClient.from('tasks').delete().eq('id', idTugasDihapus);
        if (error) throw error;
        
        showToast("Tugas berhasil dihapus!", "success");
        muatDaftarTugas(); // Segarkan tampilan kartu tugas
    } catch (err) {
        showToast("Gagal menghapus dari database.", "error");
    } finally {
        modal.classList.add('hidden');
        btn.innerText = "Hapus";
        btn.disabled = false;
        idTugasDihapus = null; // Bersihkan memori ID
    }
});

// ==========================================
// BLOK 5: SISTEM KERANJANG FILE & UPLOAD TUGAS
// ==========================================

// Fungsi untuk memantau perubahan pada input file (Saat user memilih file dari komputer)
function setupFileCart(inputId, previewId, keranjang) {
    const inputElement = document.getElementById(inputId);
    const previewContainer = document.getElementById(previewId);
    if (!inputElement) return;

    inputElement.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => keranjang.push(file)); // Masukkan file ke memori (Array)
        inputElement.value = ''; // Reset input asli agar file sama bisa dipilih lagi jika dihapus
        updateFilePreview(previewContainer, keranjang); // Gambar ulang tampilan kotak file
    });
}

// Fungsi untuk menggambar daftar file yang ada di dalam keranjang
function updateFilePreview(container, keranjang) {
    container.innerHTML = ''; // Bersihkan tampilan lama sebelum digambar ulang

    keranjang.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'file-name';
        fileNameSpan.innerText = `📄 ${file.name}`;
        
        const btnHapus = document.createElement('button');
        btnHapus.type = 'button';
        btnHapus.className = 'btn-hapus-file';
        btnHapus.innerText = '✕';
        
        // Logika hapus per file (Closure: mengingat index spesifik file ini)
        btnHapus.onclick = function() {
            keranjang.splice(index, 1); // Hapus objek file dari memori Array
            updateFilePreview(container, keranjang); // Gambar ulang layarnya
        };
        
        fileItem.appendChild(fileNameSpan);
        fileItem.appendChild(btnHapus);
        container.appendChild(fileItem);
    });
}

// FUNGSI PENTING: Membersihkan seluruh isi form saat tugas berhasil dibuat atau modal dibuka
function resetFormTugas() {
    document.getElementById('input-nama-tugas').value = '';
    document.getElementById('input-mapel').value = '';
    document.getElementById('input-kelas').value = '';

    // KUNCI BUG FIX: Menggunakan .length = 0 membuang isi array tanpa memutus koneksi memori
    keranjangSoal.length = 0;
    keranjangKunci.length = 0;

    // Hapus tampilan file yang "nyangkut" di layar
    updateFilePreview(document.getElementById('preview-soal'), keranjangSoal);
    updateFilePreview(document.getElementById('preview-kunci'), keranjangKunci);
}

// ==========================================
// BLOK 6: MENGIRIM DATA KE WEBHOOK N8N
// ==========================================

async function simpanTugasKeN8N() {
    const btn = document.getElementById('btn-simpan-tugas');
    const modal = document.getElementById('modal-buat-tugas');
    
    // 1. Kumpulkan data dari form teks
    const payload = {
        mapel: document.getElementById('input-mapel').value,
        kelas: document.getElementById('input-kelas').value,
        judul: document.getElementById('input-nama-tugas').value
    };

    // 2. Cegah pengiriman jika data kosong
    if (!payload.mapel || !payload.kelas || !payload.judul || keranjangKunci.length === 0) {
        return showToast("Mohon lengkapi semua data dan wajib unggah kunci jawaban!", "error");
    }

    btn.innerText = "Sedang Mengirim...";
    btn.disabled = true;

    // 3. Susun data menggunakan FormData (Format standar untuk mengirim kombinasi teks & file)
    const fd = new FormData();
    fd.append('subject_id', payload.mapel);
    fd.append('class_id', payload.kelas);
    fd.append('nama_tugas', payload.judul);
    keranjangSoal.forEach((f, i) => fd.append(`file_soal_${i}`, f));
    keranjangKunci.forEach((f, i) => fd.append(`file_kunci_${i}`, f));

    try {
        // 4. Tembakkan ke n8n
        const res = await fetch('https://n8n.srv867549.hstgr.cloud/webhook-test/buat-tugas', { method: 'POST', body: fd });
        
        if (res.ok) {
            showToast("Tugas berhasil dipublikasikan ke siswa!", "success");
            modal.classList.add('hidden'); // Tutup modal
            
            resetFormTugas(); // Panggil fungsi pembersih form
            muatDaftarTugas(); // Tarik ulang data tugas agar folder baru langsung muncul
        } else {
            throw new Error();
        }
    } catch (e) {
        showToast("Gagal terhubung ke server n8n.", "error");
    } finally {
        btn.innerText = "Simpan Tugas";
        btn.disabled = false;
    }
}

// ==========================================
// BLOK 7: HELPER DROPDOWN & EVENT LISTENERS
// ==========================================

// Mengambil nama Mapel dan Kelas dari database untuk diisi ke elemen <select>
async function muatDropdownModal() {
    const { data: m } = await supabaseClient.from('subjects').select('*');
    const { data: k } = await supabaseClient.from('classes').select('*');
    document.getElementById('input-mapel').innerHTML = '<option value="">-- Pilih Mapel --</option>' + m.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    document.getElementById('input-kelas').innerHTML = '<option value="">-- Pilih Kelas --</option>' + k.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
}

async function muatDropdownFilter() {
    const { data: m } = await supabaseClient.from('subjects').select('name');
    const { data: k } = await supabaseClient.from('classes').select('name');
    document.getElementById('select-filter-mapel').innerHTML = '<option value="">Semua Mapel</option>' + m.map(x => `<option value="${x.name}">${x.name}</option>`).join('');
    document.getElementById('select-filter-kelas').innerHTML = '<option value="">Semua Kelas</option>' + k.map(x => `<option value="${x.name}">${x.name}</option>`).join('');
}

// Menghubungkan fungsi-fungsi di atas ke tombol HTML saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    // Tombol Auth
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.onclick = handleLogin;
    
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => location.reload(); // Reload untuk kembali ke view awal

    // Tombol Buka/Tutup Modal Guru
    document.getElementById('btn-buka-modal')?.addEventListener('click', () => {
        resetFormTugas(); // Selalu pastikan form bersih sebelum modal terbuka
        document.getElementById('modal-buat-tugas').classList.remove('hidden');
        muatDropdownModal(); // Isi pilihan dropdown
    });
    document.getElementById('btn-tutup-modal')?.addEventListener('click', () => {
        document.getElementById('modal-buat-tugas').classList.add('hidden');
    });

    // Aksi Submit dan Filter
    document.getElementById('btn-simpan-tugas')?.addEventListener('click', simpanTugasKeN8N);
    document.getElementById('input-cari')?.addEventListener('input', filterTugas);
    document.getElementById('select-filter-mapel')?.addEventListener('change', filterTugas);
    document.getElementById('select-filter-kelas')?.addEventListener('change', filterTugas);

    // Inisialisasi Keranjang File Pertama Kali
    setupFileCart('input-file-soal', 'preview-soal', keranjangSoal);
    setupFileCart('input-file-kunci', 'preview-kunci', keranjangKunci);
});