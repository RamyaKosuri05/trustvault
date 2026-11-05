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
  Lock,
  Upload
} from 'lucide-react';

const permBadge = {
  owner: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  edit: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  read: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  metadata: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
};

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
    if (!window.confirm('Soft-delete this document? Active permission grants will be immediately revoked.')) {
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{pageTitle}</h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Per-document isolation · Server-enforced authorization
          </p>
        </div>

        {user?.role === 'owner' && (
          <Link
            to="/upload"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition-all duration-200 hover:shadow-blue-500/30"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search documents by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/[0.08] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all duration-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white/5 border border-white/[0.08] text-xs rounded-lg py-2 px-3 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all duration-200"
          >
            <option value="" className="bg-[#0d1424]">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0d1424]">{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center">
              <Lock className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400">No reachable documents</p>
            <p className="text-xs text-slate-600">You hold no active grants or no documents match your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Document</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Owner</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Category</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Size · Ver</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Permission</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-all duration-150 group"
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 flex-shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 text-sm">{doc.name}</div>
                          <div className="text-[10px] text-slate-600 font-mono mt-0.5">{doc.original_filename}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400">{doc.owner_name}</td>
                    <td className="py-3.5 px-5">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-white/5 text-slate-400 border border-white/[0.06] font-medium">
                        {doc.category_name || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 font-mono text-[11px]">
                      {(doc.file_size / 1024).toFixed(1)} KB <span className="text-slate-600">· v{doc.version_number}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${permBadge[doc.user_permission] || permBadge.metadata}`}>
                        {doc.user_permission || 'metadata'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {doc.can_download ? (
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all duration-200"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-slate-700 inline-block" title="Download blocked">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}

                        {doc.user_permission === 'owner' && (
                          <>
                            <Link
                              to={`/documents/${doc.id}`}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg inline-block transition-all duration-200"
                              title="Manage Permissions"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200"
                              title="Soft Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
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

