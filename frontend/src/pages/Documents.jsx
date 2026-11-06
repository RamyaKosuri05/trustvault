import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  Upload,
  CheckCircle2,
  X
} from 'lucide-react';

const permBadge = {
  owner: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20',
  edit: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  read: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20',
  metadata: 'bg-slate-100 dark:bg-white/[0.03] text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-white/5',
};

const Documents = ({ scope = 'all', pageTitle = 'Documents' }) => {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isGrantsFilter = searchParams.get('filter') === 'grants';

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

  // Determine displayed documents based on grant filter
  const displayedDocuments = isGrantsFilter
    ? documents.filter(doc => doc.user_permission !== 'owner' || doc.shared || doc.has_grants)
    : documents;

  const currentTitle = isGrantsFilter 
    ? 'Document Grant Permission Controls' 
    : pageTitle;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {currentTitle}
            </h1>
            {isGrantsFilter && (
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold inline-flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Active Grants Filtered</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[#334155] dark:text-slate-400 mt-1 font-mono">
            {isGrantsFilter
              ? 'Displaying active delegated permissions and granted document controls'
              : 'Per-document isolation · Strict cryptographic validation · SHA-256 hashed'}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {isGrantsFilter && (
            <button
              onClick={() => setSearchParams({})}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 transition-all duration-200"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}

          {/* Upload is STRICTLY restricted to Document Owners (NEVER Admin or Viewer) */}
          {user?.role === 'owner' && (
            <Link
              to="/upload"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-300 hover:shadow-indigo-500/30"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl p-3 flex flex-col md:flex-row gap-3 items-center shadow-sm dark:shadow-2xl">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-xs rounded-xl py-2 px-3 text-slate-800 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
          >
            <option value="" className="bg-white dark:bg-[#08090C]">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-white dark:bg-[#08090C]">{c.name}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto">
          <button
            onClick={() => {
              if (isGrantsFilter) {
                setSearchParams({});
              } else {
                setSearchParams({ filter: 'grants' });
              }
            }}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
              isGrantsFilter
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 shadow-sm'
                : 'bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isGrantsFilter ? 'Active Grants Active' : 'Filter Active Grants'}</span>
          </button>
        </div>
      </div>

      {/* Documents Table Container */}
      <div className="bg-white dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#475569] dark:text-slate-400 font-mono">
            Loading secure document index...
          </div>
        ) : displayedDocuments.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex items-center justify-center">
              {isGrantsFilter ? (
                <Share2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              ) : (
                <Lock className="w-5 h-5 text-slate-500" />
              )}
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {isGrantsFilter ? 'No Active Grants available' : 'No reachable documents'}
            </p>
            <p className="text-xs text-[#475569] dark:text-slate-500 font-mono">
              {isGrantsFilter 
                ? 'There are currently no active permission delegations or granted documents available.' 
                : 'You hold no active grants or no documents match your filter.'}
            </p>
            {isGrantsFilter && (
              <button
                onClick={() => setSearchParams({})}
                className="mt-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition duration-200"
              >
                View All Documents
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.04] bg-slate-50 dark:bg-white/[0.01]">
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Document
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Owner
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Category
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Size · Version
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Permission
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {displayedDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-150 group"
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <Link
                            to={`/documents/${doc.id}`}
                            className="font-semibold text-slate-900 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm transition-colors duration-150 inline-block cursor-pointer hover:underline"
                          >
                            {doc.name}
                          </Link>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{doc.original_filename}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-800 dark:text-slate-300 font-medium">{doc.owner_name}</td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs text-[#0f172a] dark:text-slate-300 bg-slate-100 dark:bg-white/[0.03] px-2 py-0.5 rounded border border-slate-200 dark:border-white/5">
                        {doc.category_name || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-xs text-[#334155] dark:text-slate-300 bg-slate-100 dark:bg-white/[0.03] px-2 py-0.5 rounded border border-slate-200 dark:border-white/5">
                        {(doc.file_size / 1024).toFixed(1)} KB · v{doc.version_number}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${permBadge[doc.user_permission] || permBadge.metadata}`}>
                        {doc.user_permission || 'metadata'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {doc.can_download ? (
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all duration-200"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="p-1.5 text-slate-400 dark:text-slate-600 inline-block" title="Download blocked">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}

                        {doc.user_permission === 'owner' && (
                          <>
                            <Link
                              to={`/documents/${doc.id}`}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg inline-block transition-all duration-200"
                              title="Manage Permissions"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200"
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
