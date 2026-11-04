import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentService } from '../services/documentService';
import { categoryService } from '../services/dashboardService';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Trash2, 
  Share2, 
  ShieldCheck, 
  Calendar, 
  Layers, 
  Lock 
} from 'lucide-react';

const Documents = ({ scope = 'all', pageTitle = 'Documents' }) => {
  const { user, isAdmin } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (selectedCategory) params.category_id = selectedCategory;
      if (scope) params.scope = scope;

      const data = await documentService.list(params);
      setDocuments(data.items || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const cats = await categoryService.list();
        setCategories(cats || []);
      } catch (err) {}
    };
    fetchCats();
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [search, selectedCategory, scope]);

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    try {
      await documentService.download(doc.id, doc.original_filename);
    } catch (err) {
      alert(err.response?.data?.detail || 'Download forbidden or failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to soft-delete this document? Active permission grants will be immediately revoked.')) {
      return;
    }
    try {
      await documentService.delete(id);
      fetchDocs();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete document.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Zero-trust per-document isolation with strict boundary checks
          </p>
        </div>

        {user?.role === 'owner' && (
          <Link
            to="/upload"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            Upload Document
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Lock className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No reachable documents found</p>
            <p className="text-xs">You either hold no active grants or no documents match your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Size & Version</th>
                  <th className="py-3 px-4">Permission</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{doc.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {doc.original_filename}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{doc.owner_name}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-medium">
                        {doc.category_name || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {(doc.file_size / 1024).toFixed(1)} KB (v{doc.version_number})
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                          doc.user_permission === 'owner'
                            ? 'bg-blue-100 text-blue-700'
                            : doc.user_permission === 'edit'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.user_permission === 'read'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {doc.user_permission || 'metadata only'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {doc.can_download ? (
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                          title="Stream Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      ) : (
                        <span
                          className="p-1.5 text-slate-300 cursor-not-allowed inline-block"
                          title="Admin Content Download Blocked (Requires Owner Grant)"
                        >
                          <Lock className="w-4 h-4" />
                        </span>
                      )}

                      {/* Manage Permissions (Owner only) */}
                      {doc.user_permission === 'owner' && (
                        <>
                          <Link
                            to={`/documents/${doc.id}`}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded inline-block transition"
                            title="Manage Permissions & History"
                          >
                            <Share2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                            title="Soft Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;
