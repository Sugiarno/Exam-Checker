// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const supabaseUrl = 'https://vhvryershcomgwxezggo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnJ5ZXJzaGNvbWd3eGV6Z2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDcyNDQsImV4cCI6MjA3ODE4MzI0NH0.Ul-kcLoMGKdbQB_J6YJkTFrgTYMqc1f4FRhBHgOUWW8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let dataUserSiswa = null;

// ==========================================
// 2. INISIALISASI HALAMAN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // A. Cek Status Login
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        alert("Sesi berakhir. Silakan login kembali.");
        window.location.href = 'dashboard.html'; // Kembali ke hal login
        return;
    }

    // B. Ambil Data Detail Siswa (Nama & ID Kelas)
    const { data: userData, error } = await supabaseClient
        .from('users')
        .select('*, classes(name)')
        .eq('id', user.id)
        .single();

    if (error) return console.error("Gagal ambil data profil:", error);
    
    dataUserSiswa = userData;
    document.getElementById('user-name').innerText = userData.full_name;
    
    // C. Muat Daftar Tugas untuk Kelas Siswa
    muatTugasSiswa(userData.class_id);
    muatRiwayatNilai(user.id);
});

// ==========================================
// 3. FUNGSI MUAT TUGAS (DROPDOWN)
// ==========================================
async function muatTugasSiswa(classId) {
    const select = document.getElementById('select-tugas-siswa');
    
    const { data: tasks, error } = await supabaseClient
        .from('tasks')
        .select('id, title, subjects(name)')
        .eq('class_id', classId);

    if (error) return;

    select.innerHTML = '<option value="">-- Pilih Tugas --</option>';
    tasks.forEach(task => {
        select.innerHTML += `<option value="${task.id}">${task.title} (${task.subjects?.name})</option>`;
    });
}

// ==========================================
// 4. LOGIKA SAAT TUGAS DIPILIH (LIHAT SOAL)
// ==========================================
document.getElementById('select-tugas-siswa').addEventListener('change', async (e) => {
    const taskId = e.target.value;
    const areaSoal = document.getElementById('area-soal-siswa');
    const areaUpload = document.getElementById('area-upload-jawaban');
    const listFileSoal = document.getElementById('list-file-soal');

    if (!taskId) {
        areaSoal.classList.add('hidden');
        areaUpload.classList.add('hidden');
        return;
    }

    // Tampilkan Area
    areaSoal.classList.remove('hidden');
    areaUpload.classList.remove('hidden');

    // Ambil Link Soal dari Tabel 'task_files'
    const { data: files } = await supabaseClient
        .from('task_files')
        .select('file_url, file_name')
        .eq('task_id', taskId)
        .eq('file_type', 'soal');

    if (files && files.length > 0) {
        listFileSoal.innerHTML = files.map(f => `
            <div class="file-item" style="margin-bottom: 5px;">
                <a href="${f.file_url}" target="_blank" style="text-decoration:none; color:var(--primary-color); font-weight:600;">
                    📥 Download Soal: ${f.file_name}
                </a>
            </div>
        `).join('');
    } else {
        listFileSoal.innerHTML = '<p style="color:#9ca3af; font-size:13px;">Guru tidak melampirkan file soal.</p>';
    }
});

// ==========================================
// 5. KIRIM JAWABAN KE N8N
// ==========================================
document.getElementById('btn-kirim-jawaban').addEventListener('click', async () => {
    const fileInput = document.getElementById('file-jawaban');
    const taskId = document.getElementById('select-tugas-siswa').value;
    const btn = document.getElementById('btn-kirim-jawaban');

    if (!fileInput.files[0]) return alert("Pilih foto jawaban dulu!");

    btn.innerText = "Sedang Mengirim...";
    btn.disabled = true;

    const fd = new FormData();
    fd.append('file_jawaban', fileInput.files[0]);
    fd.append('task_id', taskId);
    fd.append('student_id', dataUserSiswa.id);
    fd.append('student_name', dataUserSiswa.full_name);

    try {
        // Ganti dengan URL Webhook n8n khusus koreksi jawaban
        const res = await fetch('https://n8n.srv867549.hstgr.cloud/webhook-test/upload-jawaban', {
            method: 'POST',
            body: fd
        });

        if (res.ok) {
            alert("Jawaban terkirim! AI sedang memeriksa nilaimu.");
            location.reload();
        }
    } catch (e) {
        alert("Gagal mengirim jawaban ke server.");
    } finally {
        btn.innerText = "🚀 Kirim Jawaban Sekarang";
        btn.disabled = false;
    }
});

// ==========================================
// 6. MUAT RIWAYAT NILAI (DARI TABEL SUBMISSIONS)
// ==========================================
async function muatRiwayatNilai(userId) {
    const tbody = document.getElementById('riwayat-tugas-siswa');
    
    // Asumsi Anda punya tabel 'submissions' untuk menyimpan nilai AI
    const { data: subs, error } = await supabaseClient
        .from('submissions')
        .select('score, status, created_at, tasks(title)')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

    if (error || !subs.length) return;

    tbody.innerHTML = subs.map(s => `
        <tr>
            <td>${s.tasks?.title || 'Tugas'}</td>
            <td>${new Date(s.created_at).toLocaleDateString('id-ID')}</td>
            <td><span class="status-done">${s.status}</span></td>
            <td style="font-weight:bold; color:var(--primary-color)">${s.score || '...'}</td>
        </tr>
    `).join('');
}

// 7. Event Logout
document.getElementById('btn-logout-siswa').onclick = () => {
    supabaseClient.auth.signOut().then(() => location.reload());
};

// Update Teks Nama File Terpilih
document.getElementById('file-jawaban').onchange = (e) => {
    const name = e.target.files[0]?.name;
    if (name) document.getElementById('status-pilih-file').innerText = "Terpilih: " + name;
};