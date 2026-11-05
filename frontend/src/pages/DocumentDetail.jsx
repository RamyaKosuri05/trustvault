import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentService } from '../services/documentService';
import { permissionService } from '../services/permissionService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Download, 
  Share2, 
  Clock, 
  Trash2, 
  UserPlus, 
  CheckCircle, 
  AlertCircle, 
  History, 
  ShieldCheck, 
  ArrowLeft,
  Lock,
  Key
} from 'lucide-react';

const DocumentDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Permission form states
  const [emailInput, setEmailInput] = useState('');
  const [permLevel, setPermLevel] = useState('read');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState('');

  const loadDoc = async () => {
    try {
      const data = await documentService.getById(id);
      setDoc(data);

      if (data.user_permission === 'owner' || user?.role === 'admin') {
        const perms = await permissionService.list(id);
        setPermissions(perms || []);
      }

      const vers = await documentService.getVersions(id);
      setVersions(vers || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Document unreachable or access denied.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoc();
  }, [id]);

  const handleGrant = async (e) => {
    e.preventDefault();
    setGrantError('');
    setGrantLoading(true);

    try {
      await permissionService.grant(id, {
        email: emailInput.trim(),
        permission: permLevel,
      });
      setEmailInput('');
      const perms = await permissionService.list(id);
      setPermissions(perms || []);
    } catch (err) {
      setGrantError(err.response?.data?.detail || 'Failed to grant permission.');
    } finally {
      setGrantLoading(false);
    }
  };

  const handleRevoke = async (permId) => {
    if (!window.confirm('Revoke this permission grant immediately? Access will cease on next request.')) return;
    try {
      await permissionService.revoke(id, permId);
      const perms = await permissionService.list(id);
      setPermissions(perms || []);
    } catch (err) {
      alert(err.response?.data?.detail || 'Revocation failed.');
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400 font-mono">Loading confidential document record...</div>;
  }

  if (error || !doc) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/[0.07] shadow-xl mt-12 space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-rose-400" />
        </div>
        <h2 className="text-base font-bold text-white tracking-tight">Access Blocked</h2>
        <p className="text-xs text-slate-400">{error}</p>
        <button
          onClick={() => navigate('/documents')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all duration-200"
        >
          Return to Documents
        </button>
      </div>
    );
  }

  const permBadge = {
    owner: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    edit: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    read: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  }[doc.user_permission] || 'bg-slate-800 text-slate-400 border-white/5';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Document Overview Card */}
      <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/[0.07] shadow-xl space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border ${permBadge}`}>
              {doc.user_permission || 'Metadata Only'}
            </span>
            <h1 className="text-2xl font-bold text-white mt-2 tracking-tight">{doc.name}</h1>
            <p className="text-xs text-slate-400 mt-1">{doc.description || 'No description provided.'}</p>
          </div>
          {doc.can_download && (
            <button
              onClick={() => documentService.download(doc.id, doc.original_filename)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-300 hover:shadow-indigo-500/30"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/[0.05] text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-semibold font-mono">Original File</span>
            <span className="font-mono text-xs text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-white/5 truncate block mt-1">
              {doc.original_filename}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-semibold font-mono">Size · Version</span>
            <span className="font-mono text-xs text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-white/5 truncate block mt-1">
              {(doc.file_size / 1024).toFixed(1)} KB (v{doc.version_number})
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-semibold font-mono">MIME Type</span>
            <span className="font-mono text-xs text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-white/5 truncate block mt-1">
              {doc.mime_type}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-semibold font-mono">SHA-256 Checksum</span>
            <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 truncate block mt-1">
              {doc.checksum_sha256?.substring(0, 16)}...
            </span>
          </div>
        </div>
      </div>

      {/* Permissions Management (Owner or Admin) */}
      {(doc.user_permission === 'owner' || user?.role === 'admin') && (
        <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/[0.07] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
            <div className="flex items-center space-x-2.5">
              <Key className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">Access Control Grants</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">Immediate revocation enforced</span>
          </div>

          {/* Grant Form (Owner only) */}
          {doc.user_permission === 'owner' && (
            <form onSubmit={handleGrant} className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-white/10">
              <div className="text-xs font-semibold text-slate-300">Grant Access to User</div>
              {grantError && <p className="text-xs text-rose-400 font-mono">{grantError}</p>}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Target user email (e.g. viewer@trustvault.demo)"
                  className="flex-1 px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
                <select
                  value={permLevel}
                  onChange={(e) => setPermLevel(e.target.value)}
                  className="px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="read">Read Only</option>
                  <option value="edit">Edit (Metadata & Versions)</option>
                </select>
                <button
                  type="submit"
                  disabled={grantLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200 disabled:opacity-50 whitespace-nowrap"
                >
                  {grantLoading ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
            </form>
          )}

          {/* Active Grants List */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/[0.05] bg-slate-950/40">
                  <th className="py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Grantee</th>
                  <th className="py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Permission</th>
                  <th className="py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 font-mono text-xs">
                      No active grants. Only the owner can access this document.
                    </td>
                  </tr>
                ) : (
                  permissions.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{p.grantee_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.grantee_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-white/5 uppercase">
                          {p.permission}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            p.revoked_at
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {p.revoked_at ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!p.revoked_at && doc.user_permission === 'owner' && (
                          <button
                            onClick={() => handleRevoke(p.id)}
                            className="text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded-lg hover:bg-rose-500/10 transition text-xs"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentDetail;
