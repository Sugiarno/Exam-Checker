// 1. Inisialisasi Koneksi Supabase
// Nama variabel diubah menjadi 'supabaseClient' agar tidak bentrok dengan library CDN di HTML
const supabaseUrl = 'https://vhvryershcomgwxezggo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnJ5ZXJzaGNvbWd3eGV6Z2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDcyNDQsImV4cCI6MjA3ODE4MzI0NH0.Ul-kcLoMGKdbQB_J6YJkTFrgTYMqc1f4FRhBHgOUWW8';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. Deklarasi Elemen UI
const viewLogin = document.getElementById('view-login');
const viewGuru = document.getElementById('view-guru');
const viewSiswa = document.getElementById('view-siswa');
const viewOrangTua = document.getElementById('view-orangtua');
const mainNav = document.getElementById('main-nav');
const loginError = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

// 3. Fungsi untuk Menyembunyikan Semua Tampilan
function hideAllViews() {
    const allViews = document.querySelectorAll('.role-view');
    allViews.forEach(view => {
        if (view) view.classList.add('hidden');
    });
}

// 4. Fungsi Utama: Proses Login
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const emailInput = document.getElementById('input-email');
        const passwordInput = document.getElementById('input-password');
        
        // Cek jika input kosong
        if (!emailInput || !passwordInput || !emailInput.value || !passwordInput.value) {
            if (loginError) {
                loginError.innerText = "Email dan password tidak boleh kosong.";
                loginError.style.display = "block";
            }
            return;
        }

        const email = emailInput.value;
        const password = passwordInput.value;

        btnLogin.innerText = "Memproses...";
        if (loginError) loginError.style.display = "none";

        try {
            // A. Autentikasi ke Supabase
            const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (authError) throw authError;

            // B. Ambil role dari tabel 'users'
            const userId = authData.user.id;
            const { data: userData, error: userError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (userError) throw userError;

            // C. Tampilkan Dashboard yang Sesuai
            tampilkanDashboard(userData);

        } catch (error) {
            console.error("Error Login:", error);
            if (loginError) {
                loginError.innerText = "Gagal masuk. Pastikan email dan kata sandi benar.";
                loginError.style.display = "block";
            }
        } finally {
            btnLogin.innerText = "Masuk";
        }
    });
}

// 5. Fungsi untuk Mengatur Tampilan Berdasarkan Role
function tampilkanDashboard(userData) {
    hideAllViews();
    if (mainNav) mainNav.classList.remove('hidden'); 
    
    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role-badge');
    
    if (userNameEl) userNameEl.innerText = userData.full_name || 'Pengguna';
    if (userRoleEl) userRoleEl.innerText = (userData.role || 'Role').toUpperCase();

    // Logika pengalihan halaman berdasarkan role
    if (userData.role === 'guru' && viewGuru) {
        viewGuru.classList.remove('hidden');
        muatDataTugasGuru(); 
    } else if (userData.role === 'siswa' && viewSiswa) {
        viewSiswa.classList.remove('hidden');
    } else if (userData.role === 'orang_tua' && viewOrangTua) {
        viewOrangTua.classList.remove('hidden');
    }
}

// 6. Fungsi Tarik Data Tugas (Contoh untuk Guru)
async function muatDataTugasGuru() {
    try {
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('*');
        
        if (error) throw error;
        
        console.log("Data Tugas Berhasil Ditarik:", tasks);
    } catch (error) {
        console.error("Gagal menarik data tugas:", error.message);
    }
}

// 7. Fungsi Logout
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            await supabaseClient.auth.signOut();
        } catch (error) {
            console.error("Error saat logout:", error);
        }
        
        if (mainNav) mainNav.classList.add('hidden');
        hideAllViews();
        if (viewLogin) viewLogin.classList.remove('hidden');
        
        const emailInput = document.getElementById('input-email');
        const passwordInput = document.getElementById('input-password');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
    });
}

// ==========================================
// JEMBATAN 2: KIRIM JAWABAN SISWA KE N8N
// ==========================================

const btnSubmit = document.getElementById('btn-submit');
const fileInput = document.getElementById('file-input');

if (btnSubmit && fileInput) {
    btnSubmit.addEventListener('click', async () => {
        // 1. Cek apakah siswa sudah memilih file
        const file = fileInput.files[0];
        if (!file) {
            alert("Silakan klik ikon kamera dan pilih foto jawaban terlebih dahulu!");
            return;
        }

        // 2. Siapkan data yang akan dikirim (menggunakan FormData agar bisa mengirim file gambar)
        const formData = new FormData();
        formData.append('file_jawaban', file);
        
        // Opsional: Kita bisa ikut sertakan nama siswa yang sedang login
        const namaSiswa = document.getElementById('user-name').innerText;
        formData.append('nama_siswa', namaSiswa);
        
        // Nanti kita akan tambahkan ID Tugas dari Supabase di sini
        formData.append('id_tugas', '8181cd87-0b05-464e-a8ac-313f61ac6504');

        // 3. Ganti URL ini dengan Test URL dari Webhook n8n Anda!
        const n8nWebhookUrl = 'https://n8n.srv867549.hstgr.cloud/webhook-test/upload-jawaban';

        // 4. Ubah tampilan tombol saat proses pengiriman
        btnSubmit.innerText = "Mengunggah...";
        btnSubmit.style.backgroundColor = "#9CA3AF"; // Warna abu-abu
        btnSubmit.disabled = true;

        try {
            // 5. Tembakkan data ke n8n menggunakan Fetch API
            const response = await fetch(n8nWebhookUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Gagal terhubung ke server n8n");

            // Jika berhasil
            alert("Berhasil! Jawaban Anda telah terkirim dan sedang diperiksa oleh AI.");
            
            // Kosongkan form setelah berhasil
            fileInput.value = '';
            document.querySelector('.upload-text').innerHTML = '<span>Klik untuk unggah</span> foto jawaban lainnya';

        } catch (error) {
            console.error("Error Upload:", error);
            alert("Terjadi kesalahan saat mengirim foto. Pastikan n8n sedang aktif (Listen for test event).");
        } finally {
            // Kembalikan tampilan tombol ke semula
            btnSubmit.innerText = "Kirim untuk Dikoreksi";
            btnSubmit.style.backgroundColor = "var(--primary-color)";
            btnSubmit.disabled = false;
        }
    });
}

// Tambahan estetika: Mengubah teks saat file berhasil dipilih oleh siswa
if (fileInput) {
    fileInput.addEventListener('change', (event) => {
        const fileName = event.target.files[0]?.name;
        if (fileName) {
            document.querySelector('.upload-text').innerHTML = `File terpilih: <span style="color: #059669;">${fileName}</span>`;
        }
    });
}

// ==========================================
// FITUR GURU: BUAT TUGAS BARU
// ==========================================
const btnBukaModal = document.getElementById('btn-buka-modal');
const btnTutupModal = document.getElementById('btn-tutup-modal');
const modalBuatTugas = document.getElementById('modal-buat-tugas');
const btnSimpanTugas = document.getElementById('btn-simpan-tugas');

if (btnBukaModal) {
    // Buka dan Tutup Modal
    btnBukaModal.addEventListener('click', () => modalBuatTugas.classList.remove('hidden'));
    btnTutupModal.addEventListener('click', () => modalBuatTugas.classList.add('hidden'));

    // Proses Simpan Tugas
// Proses Simpan Tugas
        btnSimpanTugas.addEventListener('click', async () => {
            // 1. Tarik semua nilai dari form
            const mapel = document.getElementById('input-mapel').value;
            const kelas = document.getElementById('input-kelas').value;
            const namaTugas = document.getElementById('input-nama-tugas').value;
            const fileSoal = document.getElementById('input-file-soal').files[0];
            const fileKunci = document.getElementById('input-file-kunci').files[0];

            // 2. Validasi (Pastikan kolom wajib tidak kosong)
            if (!mapel || !kelas || !namaTugas || !fileKunci) {
                alert("Mata Pelajaran, Kelas, Judul Tugas, dan Kunci Jawaban wajib diisi!");
                return;
            }

            // Ubah tombol jadi loading
            btnSimpanTugas.innerText = "Mengunggah...";
            btnSimpanTugas.style.backgroundColor = "#9CA3AF";
            btnSimpanTugas.disabled = true;

            // 3. Bungkus semua data ke dalam FormData
            const formData = new FormData();
            formData.append('mata_pelajaran', mapel);
            formData.append('kelas', kelas);
            formData.append('nama_tugas', namaTugas);
            formData.append('file_kunci', fileKunci);
            
            // File soal bersifat opsional, jadi kita cek dulu apakah guru mengunggahnya
            if (fileSoal) {
                formData.append('file_soal', fileSoal);
            }

            // URL Webhook n8n KHUSUS untuk pembuatan tugas
            const n8nCreateTaskWebhook = 'https://n8n.srv867549.hstgr.cloud/webhook-test/buat-tugas'; 

            try {
                // 4. Kirim ke n8n
                const response = await fetch(n8nCreateTaskWebhook, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error("Gagal terhubung ke server n8n");

                alert("Berhasil! Tugas baru telah dibuat dan file tersimpan di Google Drive.");
                modalBuatTugas.classList.add('hidden');
                
                // Bersihkan form setelah berhasil
                document.getElementById('input-mapel').value = '';
                document.getElementById('input-kelas').value = '';
                document.getElementById('input-nama-tugas').value = '';
                document.getElementById('input-file-soal').value = '';
                document.getElementById('input-file-kunci').value = '';

            } catch (error) {
                console.error("Error pembuatan tugas:", error);
                alert("Gagal membuat tugas. Pastikan n8n sedang aktif menerima data.");
            } finally {
                // Kembalikan tombol ke kondisi semula
                btnSimpanTugas.innerText = "Simpan Tugas";
                btnSimpanTugas.style.backgroundColor = "var(--primary-color)";
                btnSimpanTugas.disabled = false;
            }
        });
}