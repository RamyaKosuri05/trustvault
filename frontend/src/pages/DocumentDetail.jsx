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
  ArrowLeft 
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
      setError(err.response?.data?.detail || 'Document unreachable or not found.');
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
    return <div className="p-8 text-center text-xs text-slate-500">Loading document details...</div>;
  }

  if (error || !doc) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl border border-slate-200 mt-12 space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Access Blocked</h2>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          onClick={() => navigate('/documents')}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          Return to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Document Overview Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
              {doc.user_permission || 'Metadata Only'}
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{doc.name}</h1>
            <p className="text-xs text-slate-500 mt-1">{doc.description || 'No description provided.'}</p>
          </div>
          {doc.can_download && (
            <button
              onClick={() => documentService.download(doc.id, doc.original_filename)}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
          <div>
            <span className="text-slate-400 block text-[11px]">Original File</span>
            <span className="font-mono">{doc.original_filename}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Size & Version</span>
            <span>{(doc.file_size / 1024).toFixed(1)} KB (v{doc.version_number})</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">MIME Type</span>
            <span className="font-mono">{doc.mime_type}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">SHA-256 Checksum</span>
            <span className="font-mono text-[10px]">{doc.checksum_sha256.substring(0, 16)}...</span>
          </div>
        </div>
      </div>

      {/* Permissions Management (Owner or Admin) */}
      {(doc.user_permission === 'owner' || user?.role === 'admin') && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-2">
              <Share2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-800">Strict Document Access Grants</h2>
            </div>
          </div>

          {/* Grant Form (Owner only) */}
          {doc.user_permission === 'owner' && (
            <form onSubmit={handleGrant} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-700">Grant Access to User</div>
              {grantError && <p className="text-xs text-rose-500">{grantError}</p>}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Target user email (e.g. viewer@trustvault.demo)"
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={permLevel}
                  onChange={(e) => setPermLevel(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                >
                  <option value="read">Read Only</option>
                  <option value="edit">Edit (Metadata & Versions)</option>
                </select>
                <button
                  type="submit"
                  disabled={grantLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {grantLoading ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
            </form>
          )}

          {/* Active Grants List */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
              <thead>
                <tr className="text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2 px-3">Grantee</th>
                  <th className="py-2 px-3">Permission</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      No active grants. Only the owner can access this document.
                    </td>
                  </tr>
                ) : (
                  permissions.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{p.grantee_name}</div>
                        <div className="text-[11px] text-slate-400">{p.grantee_email}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold uppercase text-[11px]">
                        {p.permission}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.revoked_at
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {p.revoked_at ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!p.revoked_at && doc.user_permission === 'owner' && (
                          <button
                            onClick={() => handleRevoke(p.id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold"
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
