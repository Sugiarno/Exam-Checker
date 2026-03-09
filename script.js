// 1. Inisialisasi Koneksi Supabase
const supabaseUrl = 'https://vhvryershcomgwxezggo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodnJ5ZXJzaGNvbWd3eGV6Z2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDcyNDQsImV4cCI6MjA3ODE4MzI0NH0.Ul-kcLoMGKdbQB_J6YJkTFrgTYMqc1f4FRhBHgOUWW8';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Elemen UI
const viewLogin = document.getElementById('view-login');
const viewGuru = document.getElementById('view-guru');
const viewSiswa = document.getElementById('view-siswa');
const mainNav = document.getElementById('main-nav');
const loginError = document.getElementById('login-error');

// 2. Fungsi untuk Menyembunyikan Semua Tampilan
function hideAllViews() {
    const allViews = document.querySelectorAll('.role-view');
    allViews.forEach(view => view.classList.add('hidden'));
}

// 3. Fungsi Utama: Proses Login
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('input-email').value;
    const password = document.getElementById('input-password').value;
    const btnLogin = document.getElementById('btn-login');

    btnLogin.innerText = "Memproses...";
    loginError.style.display = "none";

    try {
        // A. Cek email dan password ke sistem Autentikasi Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (authError) throw authError;

        // B. Jika berhasil masuk, ambil data role dari tabel 'users' yang kita buat di Tahap 1
        const userId = authData.user.id;
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        // C. Tampilkan Dashboard yang Sesuai
        tampilkanDashboard(userData);

    } catch (error) {
        loginError.innerText = error.message || "Gagal masuk. Periksa kredensial Anda.";
        loginError.style.display = "block";
    } finally {
        btnLogin.innerText = "Masuk";
    }
});

// 4. Fungsi untuk Mengatur Tampilan Berdasarkan Role
function tampilkanDashboard(userData) {
    hideAllViews();
    mainNav.classList.remove('hidden'); // Munculkan navigasi atas
    
    // Setel nama dan badge
    document.getElementById('user-name').innerText = userData.full_name;
    document.getElementById('user-role-badge').innerText = userData.role.toUpperCase();

    // Arahkan ke blok HTML yang tepat
    if (userData.role === 'guru') {
        viewGuru.classList.remove('hidden');
        muatDataTugasGuru(); // Tarik data untuk tabel guru
    } else if (userData.role === 'siswa') {
        viewSiswa.classList.remove('hidden');
    } else if (userData.role === 'orang_tua') {
        document.getElementById('view-orangtua').classList.remove('hidden');
    }
}

// 5. Fungsi Tarik Data: Contoh Jembatan HTML ke Supabase Database
async function muatDataTugasGuru() {
    // Mengambil daftar tugas dari tabel 'tasks'
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*');
    
    if (error) {
        console.error("Gagal menarik data tugas:", error);
        return;
    }
    
    console.log("Data Tugas Berhasil Ditarik:", tasks);
    // Di sini nantinya Anda bisa menulis kode untuk memasukkan data 'tasks' ini ke dalam tabel HTML
}

// 6. Fungsi Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    mainNav.classList.add('hidden');
    hideAllViews();
    viewLogin.classList.remove('hidden');
    
    // Kosongkan form input
    document.getElementById('input-email').value = '';
    document.getElementById('input-password').value = '';
});