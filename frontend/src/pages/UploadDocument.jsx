import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentService } from '../services/documentService';
import { categoryService } from '../services/dashboardService';
import { UploadCloud, CheckCircle, AlertCircle, FileText, ArrowLeft, Shield } from 'lucide-react';

const UploadDocument = () => {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const data = await categoryService.list();
        setCategories(data || []);
      } catch (err) {}
    };
    fetchCats();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      if (!name) {
        setName(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) formData.append('description', description);
    if (categoryId) formData.append('category_id', categoryId);

    try {
      const doc = await documentService.upload(formData);
      setSuccess(`Document uploaded successfully! Checksum: ${doc.checksum_sha256.substring(0, 16)}...`);
      setTimeout(() => navigate('/documents'), 1500);
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        err.response?.data?.message || 
        'Upload failed. Ensure file type and size comply with security standards.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/50 transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Upload Document</h1>
          <p className="text-xs text-slate-400 font-mono">Magic bytes validation · SHA-256 integrity · Private storage</p>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/[0.07] p-7 rounded-2xl shadow-xl">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-400 text-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-3 text-emerald-400 text-xs">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* File Drag and Drop Zone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
              Select Document File
            </label>
            <div className="border border-dashed border-white/10 hover:border-indigo-500/40 rounded-2xl p-8 text-center transition-all duration-300 bg-slate-950/40 hover:bg-indigo-500/[0.02]">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                accept=".pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg"
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 mb-3 shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  {file ? file.name : 'Click to select or drag and drop file'}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 font-mono">
                  Supported: PDF, DOCX, XLSX, TXT, PNG, JPG (Max 10 MB)
                </span>
                {file && (
                  <span className="mt-2.5 font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    {(file.size / 1024).toFixed(1)} KB selected
                  </span>
                )}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
              Document Title
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Executive Financial Audit"
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            >
              <option value="" className="bg-[#0b0f19]">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0b0f19]">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide sensitive handling notes or context..."
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? 'Validating Magic Bytes & Hashing...' : 'Submit to Secure Vault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadDocument;
