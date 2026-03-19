// ==========================================
// 1. KONFIGURASI SUPABASE & STATE
// ==========================================
const supabaseUrl = 'https://vhvryershcomgwxezggo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnJ5ZXJzaGNvbWd3eGV6Z2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDcyNDQsImV4cCI6MjA3ODE4MzI0NH0.Ul-kcLoMGKdbQB_J6YJkTFrgTYMqc1f4FRhBHgOUWW8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let dataSiswaLokal = null;
let dataTugasSiswaLokal = []; // Menampung semua tugas untuk difilter
let tugasTerpilih = null;     // Menampung ID tugas yang sedang diklik

// ==========================================
// 2. INISIALISASI HALAMAN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
        window.location.href = 'dashboard.html'; 
        return;
    }

    try {
        const { data: userData, error: userError } = await supabaseClient
            .from('users').select('*').eq('id', user.id).single();

        if (userError) throw userError;

        dataSiswaLokal = userData;
        document.getElementById('user-name').innerText = userData.full_name || 'Siswa';

        if (userData.class_id) {
            muatDaftarTugasSiswa(userData.class_id);
        } else {
            document.getElementById('container-tugas-siswa').innerHTML = '<p>Akun Anda belum memiliki Kelas.</p>';
        }
        muatRiwayatNilai(user.id);
    } catch (err) {
        alert("Gagal memuat profil.");
    }
});

// ==========================================
// 3. FITUR KARTU TUGAS & FILTER
// ==========================================

// Mengambil tugas dari database (Diurutkan dari yang Paling Baru)
async function muatDaftarTugasSiswa(classId) {
    const container = document.getElementById('container-tugas-siswa');
    
    try {
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('id, title, created_at, subjects(name)')
            .eq('class_id', classId)
            .order('created_at', { ascending: false }); // ORDER TERBARU DI ATAS

        if (error) throw error;

        dataTugasSiswaLokal = tasks;
        
        // Buat dropdown mapel dinamis khusus dari tugas yang ada
        isiDropdownMapelSiswa(tasks); 
        
        renderKartuTugasSiswa(dataTugasSiswaLokal);
    } catch (err) {
        container.innerHTML = '<p style="color:red;">Gagal memuat tugas.</p>';
    }
}

// Menampilkan kartu tugas ke layar
function renderKartuTugasSiswa(daftarTugas) {
    const container = document.getElementById('container-tugas-siswa');
    container.innerHTML = '';

    if (daftarTugas.length === 0) {
        container.innerHTML = '<p style="color:#9ca3af; grid-column: 1 / -1; text-align: center;">Tidak ada tugas yang sesuai.</p>';
        return;
    }

    daftarTugas.forEach(task => {
        const tglBuat = new Date(task.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const mapel = task.subjects?.name || 'Umum';

        const card = document.createElement('div');
        card.className = 'task-card';
        // Memberikan cursor pointer agar siswa tahu ini bisa diklik
        card.style.cursor = 'pointer'; 
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="font-size:12px; color:var(--primary-color); font-weight:bold;">${mapel}</span>
                <span style="font-size:12px; color:#9ca3af;">${tglBuat}</span>
            </div>
            <h3 style="margin: 0 0 15px 0; font-size:16px;">${task.title}</h3>
            <button class="btn-outline" style="width:100%; border-color:var(--primary-color); color:var(--primary-color);">Buka Tugas</button>
        `;

        // Jika kartu diklik, buka panel detail
        card.addEventListener('click', () => bukaDetailTugas(task.id, task.title, mapel));
        container.appendChild(card);
    });
}

// Logika Pencarian & Filter
function filterTugasSiswa() {
    const keyword = document.getElementById('input-cari-siswa').value.toLowerCase();
    const mapel = document.getElementById('select-filter-mapel-siswa').value;

    const hasil = dataTugasSiswaLokal.filter(t => {
        const matchNama = t.title.toLowerCase().includes(keyword);
        const matchMapel = mapel === "" || t.subjects?.name === mapel;
        return matchNama && matchMapel;
    });
    
    renderKartuTugasSiswa(hasil);
}

// Mengambil daftar mapel unik dari tugas yang tersedia untuk filter dropdown
function isiDropdownMapelSiswa(tasks) {
    const dropdown = document.getElementById('select-filter-mapel-siswa');
    const mapelUnik = [...new Set(tasks.map(t => t.subjects?.name).filter(n => n))];
    
    dropdown.innerHTML = '<option value="">Semua Mapel</option>';
    mapelUnik.forEach(mapel => {
        dropdown.innerHTML += `<option value="${mapel}">${mapel}</option>`;
    });
}

// Event Listener untuk input pencarian dan dropdown
document.getElementById('input-cari-siswa').addEventListener('input', filterTugasSiswa);
document.getElementById('select-filter-mapel-siswa').addEventListener('change', filterTugasSiswa);

// ==========================================
// 4. LOGIKA BUKA/TUTUP DETAIL TUGAS
// ==========================================

async function bukaDetailTugas(idTugas, judulTugas, mapel) {
    tugasTerpilih = idTugas; // Simpan ke variabel global
    
    // 1. Sembunyikan grid, Tampilkan detail
    document.getElementById('panel-daftar-tugas').classList.add('hidden');
    document.getElementById('panel-detail-tugas').classList.remove('hidden');
    
    // 2. Ubah Teks Judul
    document.getElementById('detail-judul-tugas').innerText = judulTugas;
    document.getElementById('detail-mapel-tugas').innerText = mapel;

    // 3. Ambil file soal (PDF) dari database
    const listSoal = document.getElementById('list-file-soal');
    listSoal.innerHTML = '<p style="font-size:13px; color:#6b7280;">Sedang memuat lampiran...</p>';

    const { data: files } = await supabaseClient
        .from('task_files')
        .select('file_name, file_url')
        .eq('task_id', idTugas)
        .eq('file_type', 'soal');

    if (!files || files.length === 0) {
        listSoal.innerHTML = `
            <div style="background:#F9FAFB; padding:12px; border-radius:8px; border:1px solid #E5E7EB;">
                <p style="margin:0; font-size:13px; color:#6B7280;">Tidak ada file lampiran soal dari Guru.</p>
            </div>`;
    } else {
        listSoal.innerHTML = files.map(f => `
            <div class="file-item" style="margin-bottom: 8px; border-left: 4px solid var(--primary-color);">
                <a href="${f.file_url}" target="_blank" style="color:var(--text-main); font-weight:600; text-decoration:none; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:20px;">📄</span> Download Soal: ${f.file_name}
                </a>
            </div>
        `).join('');
    }
}

// Tombol Kembali
document.getElementById('btn-kembali').addEventListener('click', () => {
    tugasTerpilih = null;
    document.getElementById('panel-detail-tugas').classList.add('hidden');
    document.getElementById('panel-daftar-tugas').classList.remove('hidden');
    
    // Reset file input agar bersih saat memilih tugas lain
    document.getElementById('file-jawaban').value = '';
    document.getElementById('status-pilih-file').innerHTML = '<span>Klik untuk pilih foto</span> atau ambil gambar';
});

// ==========================================
// 5. KIRIM JAWABAN KE N8N
// ==========================================

document.getElementById('btn-kirim-jawaban').addEventListener('click', async () => {
    const input = document.getElementById('file-jawaban');
    const btn = document.getElementById('btn-kirim-jawaban');

    if (!tugasTerpilih) return alert("Pilih tugas terlebih dahulu!");
    if (!input.files[0]) return alert("Silakan unggah foto jawaban Anda!");

    btn.innerText = "Sedang Mengirim...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    const fd = new FormData();
    fd.append('file_jawaban', input.files[0]);
    fd.append('task_id', tugasTerpilih); // Menggunakan variabel global
    fd.append('student_id', dataSiswaLokal.id);
    fd.append('student_name', dataSiswaLokal.full_name);

    const n8nWebhook = 'https://n8n.srv867549.hstgr.cloud/webhook-test/upload-jawaban';

    try {
        const response = await fetch(n8nWebhook, { method: 'POST', body: fd });
        if (!response.ok) throw new Error("Gagal terhubung ke server");

        alert("Berhasil! Jawaban terkirim dan sedang dikoreksi AI.");
        location.reload(); 
    } catch (err) {
        alert("Terjadi kesalahan saat mengirim jawaban.");
    } finally {
        btn.innerText = "🚀 Kirim Jawaban Sekarang";
        btn.disabled = false;
        btn.style.opacity = "1";
    }
});

// ==========================================
// 6. RIWAYAT & LAINNYA
// ==========================================

async function muatRiwayatNilai(userId) {
    const tbody = document.getElementById('riwayat-tugas-siswa');
    const { data: subs, error } = await supabaseClient
        .from('submissions')
        .select('score, status, created_at, tasks(title)')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

    if (error || !subs || subs.length === 0) return;

    tbody.innerHTML = subs.map(s => `
        <tr>
            <td>${s.tasks?.title || 'Tugas'}</td>
            <td>${new Date(s.created_at).toLocaleDateString('id-ID')}</td>
            <td><span class="status-done">${s.status || 'Terkirim'}</span></td>
            <td style="font-weight:bold; color:var(--primary-color)">${s.score || '...'}</td>
        </tr>
    `).join('');
}

document.getElementById('btn-logout-siswa').onclick = () => {
    supabaseClient.auth.signOut().then(() => window.location.href = 'dashboard.html');
};

document.getElementById('file-jawaban').onchange = (e) => {
    const label = document.getElementById('status-pilih-file');
    if (e.target.files[0]) {
        label.innerHTML = `Terpilih: <strong style="color:var(--success)">${e.target.files[0].name}</strong>`;
    }
};