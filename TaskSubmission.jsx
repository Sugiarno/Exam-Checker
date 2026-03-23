import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Pastikan path client supabase benar

const TaskSubmission = ({ taskId, studentId }) => {
  const [submission, setSubmission] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [complaint, setComplaint] = useState("");

  useEffect(() => {
    fetchSubmissionData();
  }, [taskId, studentId]);

  // 1. Ambil data submission dan file terkait
  const fetchSubmissionData = async () => {
    setLoading(true);
    try {
      // Ambil data induk dari tabel 'submissions'
      const { data: subData, error: subError } = await supabase
        .from('submissions')
        .select('*')
        .eq('task_id', taskId)
        .eq('student_id', studentId)
        .single();

      if (subData) {
        setSubmission(subData);
        // Ambil data file dari tabel 'submission_files'
        const { data: fileData } = await supabase
          .from('submission_files')
          .select('*')
          .eq('submission_id', subData.id)
          .order('page_number', { ascending: true });
        
        setFiles(fileData || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Logika Upload (Hanya muncul jika belum ada submission atau status 'reset_allowed')
  const handleFileUpload = async (event) => {
    setUploading(true);
    const uploadedFiles = Array.from(event.target.files);
    
    // a. Buat baris di tabel submissions (jika belum ada)
    let currentSubId = submission?.id;
    
    if (!submission || submission.status === 'reset_allowed') {
      const { data, error } = await supabase
        .from('submissions')
        .upsert({ 
          task_id: taskId, 
          student_id: studentId, 
          status: 'submitted',
          is_locked: true 
        })
        .select()
        .single();
      
      if (error) return alert("Gagal membuat data submission");
      currentSubId = data.id;
    }

    // b. Upload ke Storage & Simpan ke submission_files
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const filePath = `tasks/${taskId}/${studentId}/${Date.now()}_${file.name}`;
      
      const { error: storageError } = await supabase.storage
        .from('assignments') // Ganti dengan nama bucket Anda
        .upload(filePath, file);

      if (!storageError) {
        await supabase.from('submission_files').insert({
          submission_id: currentSubId,
          file_url: filePath,
          page_number: i + 1
        });
      }
    }
    
    fetchSubmissionData();
    setUploading(false);
  };

  // 3. Fungsi Minta Reset (Update Status)
  const requestReset = async () => {
    const { error } = await supabase
      .from('submissions')
      .update({ status: 'pending_reset' })
      .eq('id', submission.id);
    
    if (!error) fetchSubmissionData();
  };

  // 4. Fungsi Kirim Komplain
  const submitComplaint = async () => {
    const { error } = await supabase
      .from('submissions')
      .update({ 
        complaint_note: complaint,
        status: 'complained' 
      })
      .eq('id', submission.id);
    
    if (!error) {
      alert("Komplain berhasil dikirim ke guru.");
      fetchSubmissionData();
    }
  };

  if (loading) return <p>Memuat data tugas...</p>;

  // --- TAMPILAN LOGIC ---

  // TAMPILAN A: BELUM UPLOAD / BOLEH UPLOAD ULANG
  if (!submission || submission.status === 'reset_allowed') {
    return (
      <div className="p-4 border rounded-lg">
        <h3 className="font-bold mb-2 text-lg">Upload Tugas Anda</h3>
        <input 
          type="file" 
          multiple 
          onChange={handleFileUpload} 
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700"
        />
        {uploading && <p className="mt-2 text-blue-500">Sedang mengupload...</p>}
      </div>
    );
  }

  // TAMPILAN B: SUDAH UPLOAD (PREVIEW & STATUS)
  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
        <div>
          <span className="text-sm text-gray-500">Status Tugas:</span>
          <p className="font-bold uppercase text-blue-600">{submission.status.replace('_', ' ')}</p>
        </div>
        {submission.grade && (
          <div className="text-right">
            <span className="text-sm text-gray-500">Nilai Anda:</span>
            <p className="text-3xl font-bold text-green-600">{submission.grade}</p>
          </div>
        )}
      </div>

      {/* Grid Preview Gambar/File */}
      <div className="grid grid-cols-2 gap-4">
        {files.map((file, idx) => (
          <div key={file.id} className="border p-2 rounded relative">
            <span className="absolute top-1 left-1 bg-black text-white text-xs px-2 rounded">Hal {file.page_number}</span>
            <img 
              src={`${process.env.REACT_APP_SUPABASE_URL}/storage/v1/object/public/assignments/${file.file_url}`} 
              alt="preview" 
              className="w-full h-48 object-cover rounded"
            />
          </div>
        ))}
      </div>

      {/* Tombol Aksi berdasarkan Status */}
      <div className="border-t pt-4">
        {submission.status === 'submitted' && (
          <button 
            onClick={requestReset}
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          >
            Salah Upload? Minta Reset ke Guru
          </button>
        )}

        {submission.status === 'pending_reset' && (
          <p className="text-orange-500 italic">Menunggu persetujuan guru untuk reset tugas...</p>
        )}

        {submission.status === 'graded' && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2 text-red-600">Ada masalah dengan nilai?</h4>
            <textarea 
              className="w-full border p-2 rounded" 
              placeholder="Tuliskan alasan komplain Anda di sini..."
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
            />
            <button 
              onClick={submitComplaint}
              className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Kirim Komplain
            </button>
          </div>
        )}

        {submission.status === 'complained' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
             <strong>Komplain Anda sedang ditinjau:</strong> "{submission.complaint_note}"
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskSubmission;