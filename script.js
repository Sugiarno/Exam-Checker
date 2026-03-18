// ==========================================
// 1. KONFIGURASI & STATE
// ==========================================
const supabaseUrl = 'https://vhvryershcomgwxezggo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnJ5ZXJzaGNvbWd3eGV6Z2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDcyNDQsImV4cCI6MjA3ODE4MzI0NH0.Ul-kcLoMGKdbQB_J6YJkTFrgTYMqc1f4FRhBHgOUWW8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let dataTugasLokal = []; // Cache untuk fitur filter fast-search
let keranjangSoal = [];
let keranjangKunci = [];

// ==========================================
// 2. ELEMEN UI (DOM)
// ==========================================
const views = {
    login: document.getElementById('view-login'),
    guru: document.getElementById('view-guru'),
    siswa: document.getElementById('view-siswa'),
    nav: document.getElementById('main-nav')
};

const loginForm = {
    email: document.getElementById('input-email'),
    pass: document.getElementById('input-password'),
    btn: document.getElementById('btn-login'),
    error: document.getElementById('login-error')
};

// ==========================================
// 3. LOGIKA AUTH (LOGIN/LOGOUT)
// ==========================================

async function handleLogin() {
    const email = loginForm.email.value;
    const password = loginForm.pass.value;

    if (!email || !password) return alert("Email dan password wajib diisi!");

    loginForm.btn.innerText = "Memproses...";
    loginForm.error.style.display = "none";

    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (authError) throw authError;

        const { data: userData, error: userError } = await supabaseClient
            .from('users').select('*').eq('id', authData.user.id).single();
        if (userError) throw userError;

        tampilkanHalamanBerdasarkanRole(userData);
    } catch (error) {
        loginForm.error.innerText = "Login Gagal: Akun tidak ditemukan.";
        loginForm.error.style.display = "block";
    } finally {
        loginForm.btn.innerText = "Masuk";
    }
}

function tampilkanHalamanBerdasarkanRole(user) {
    // Sembunyikan semua view dulu
    Object.values(views).forEach(v => v?.classList.add('hidden'));
    
    // Tampilkan Navigasi
    views.nav.classList.remove('hidden');
    document.getElementById('user-name').innerText = user.full_name;
    document.getElementById('user-role-badge').innerText = user.role.toUpperCase();

    // --- LOGIKA PENGALIHAN ---
    if (user.role === 'guru') {
        // Jika Guru, tetap di halaman ini dan munculkan dashboard guru
        views.guru.classList.remove('hidden');
        inisialisasiDashboardGuru();
    } 
    else if (user.role === 'siswa') {
        // JIKA SISWA, PINDAHKAN KE HALAMAN SISWA.HTML
        window.location.href = 'siswa.html'; 
    }
}

// ==========================================
// 4. FITUR GURU: DAFTAR TUGAS & FILTER
// ==========================================

async function inisialisasiDashboardGuru() {
    await muatDropdownFilter(); // Isi dropdown Mapel & Kelas di toolbar
    await muatDaftarTugas();    // Ambil data tugas
}

async function muatDaftarTugas() {
    const container = document.getElementById('container-daftar-tugas');
    container.innerHTML = '<p>Memuat data...</p>';

    const { data, error } = await supabaseClient
        .from('tasks')
        .select('id, title, created_at, subjects(name), classes(name)')
        .order('created_at', { ascending: false });

    if (!error) {
        dataTugasLokal = data;
        renderTugas(dataTugasLokal);
    }
}

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

// Fitur Filter & Cari (Gabungan)
function filterTugas() {
    const keyword = document.getElementById('input-cari').value.toLowerCase();
    const mapel = document.getElementById('select-filter-mapel').value;
    const kelas = document.getElementById('select-filter-kelas').value;

    const hasil = dataTugasLokal.filter(t => {
        const matchNama = t.title.toLowerCase().includes(keyword);
        const matchMapel = mapel === "" || t.subjects?.name === mapel;
        const matchKelas = kelas === "" || t.classes?.name === kelas;
        return matchNama && matchMapel && matchKelas;
    });
    renderTugas(hasil);
}

// ==========================================
// 5. FITUR GURU: MODAL & UPLOAD KE N8N
// ==========================================

function setupFileCart(inputId, previewId, keranjang) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    input.addEventListener('change', () => {
        Array.from(input.files).forEach(f => keranjang.push(f));
        input.value = '';
        updatePreview(preview, keranjang);
    });
}

function updatePreview(container, keranjang) {
    container.innerHTML = '';
    keranjang.forEach((file, i) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `<span>📄 ${file.name}</span><button onclick="hapusDariKeranjang(${i}, '${container.id}')">✕</button>`;
        container.appendChild(item);
    });
}

window.hapusDariKeranjang = (index, containerId) => {
    if (containerId === 'preview-soal') keranjangSoal.splice(index, 1);
    else keranjangKunci.splice(index, 1);
    updatePreview(document.getElementById(containerId), containerId === 'preview-soal' ? keranjangSoal : keranjangKunci);
};

async function simpanTugasKeN8N() {
    const btn = document.getElementById('btn-simpan-tugas');
    const payload = {
        mapel: document.getElementById('input-mapel').value,
        kelas: document.getElementById('input-kelas').value,
        judul: document.getElementById('input-nama-tugas').value
    };

    if (!payload.mapel || !payload.kelas || !payload.judul || keranjangKunci.length === 0) {
        return alert("Mohon lengkapi semua data dan kunci jawaban!");
    }

    btn.innerText = "Sedang Mengirim...";
    btn.disabled = true;

    const fd = new FormData();
    fd.append('subject_id', payload.mapel);
    fd.append('class_id', payload.kelas);
    fd.append('nama_tugas', payload.judul);
    keranjangSoal.forEach((f, i) => fd.append(`file_soal_${i}`, f));
    keranjangKunci.forEach((f, i) => fd.append(`file_kunci_${i}`, f));

    try {
        const res = await fetch('https://n8n.srv867549.hstgr.cloud/webhook-test/buat-tugas', { method: 'POST', body: fd });
        if (res.ok) {
            alert("Berhasil disimpan!");
            location.reload(); // Cara termudah untuk reset semua state
        }
    } catch (e) {
        alert("Gagal terhubung ke n8n.");
    } finally {
        btn.innerText = "Simpan Tugas";
        btn.disabled = false;
    }
}

// ==========================================
// 6. EVENT LISTENERS UTAMA
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Auth
    if (loginForm.btn) loginForm.btn.onclick = handleLogin;
    if (document.getElementById('btn-logout')) {
        document.getElementById('btn-logout').onclick = () => location.reload();
    }

    // Modal Guru
    const modal = document.getElementById('modal-buat-tugas');
    document.getElementById('btn-buka-modal')?.addEventListener('click', () => {
        modal.classList.remove('hidden');
        muatDropdownModal();
    });
    document.getElementById('btn-tutup-modal')?.addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('btn-simpan-tugas')?.addEventListener('click', simpanTugasKeN8N);

    // Filter toolbar
    document.getElementById('input-cari')?.addEventListener('input', filterTugas);
    document.getElementById('select-filter-mapel')?.addEventListener('change', filterTugas);
    document.getElementById('select-filter-kelas')?.addEventListener('change', filterTugas);

    // Setup Upload
    if (document.getElementById('input-file-soal')) {
        setupFileCart('input-file-soal', 'preview-soal', keranjangSoal);
        setupFileCart('input-file-kunci', 'preview-kunci', keranjangKunci);
    }
});

// Helper: Isi dropdown modal
async function muatDropdownModal() {
    const { data: m } = await supabaseClient.from('subjects').select('*');
    const { data: k } = await supabaseClient.from('classes').select('*');
    
    const selM = document.getElementById('input-mapel');
    const selK = document.getElementById('input-kelas');
    
    selM.innerHTML = '<option value="">-- Pilih Mapel --</option>' + m.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    selK.innerHTML = '<option value="">-- Pilih Kelas --</option>' + k.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
}

// Helper: Isi dropdown filter toolbar
async function muatDropdownFilter() {
    const { data: m } = await supabaseClient.from('subjects').select('name');
    const { data: k } = await supabaseClient.from('classes').select('name');
    
    document.getElementById('select-filter-mapel').innerHTML = '<option value="">Semua Mapel</option>' + m.map(x => `<option value="${x.name}">${x.name}</option>`).join('');
    document.getElementById('select-filter-kelas').innerHTML = '<option value="">Semua Kelas</option>' + k.map(x => `<option value="${x.name}">${x.name}</option>`).join('');
}