import React, { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { Users, Shield, Check, X, Search, UserX, UserCheck, UserPlus, AlertCircle } from 'lucide-react';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create User modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.list({ q: search });
      setUsers(data.items || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      await userService.create({
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      setShowCreateModal(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('viewer');
      fetchUsers();
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Failed to provision user account.');
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleStatus = async (targetUser) => {
    if (targetUser.id === user.id) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }
    const newStatus = !targetUser.is_active;
    const confirmMsg = newStatus
      ? `Reactivate account for ${targetUser.email}?`
      : `Deactivate ${targetUser.email}? All active sessions will be terminated immediately.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await userService.updateStatus(targetUser.id, newStatus);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Status update failed.');
    }
  };

  const roleBadge = {
    admin: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    owner: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    viewer: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">User Management</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Administrative account lifecycle · Session invalidation on status change
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-300"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision User</span>
        </button>
      </div>

      {/* Provision User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] pb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Provision New User</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Bob Johnson"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="bob@company.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password (min 10 chars)</label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#08090C] border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="owner">Owner (Upload & Share)</option>
                  <option value="admin">Admin (System Governance)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  {createLoading ? 'Provisioning...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-3 flex items-center shadow-2xl">
        <Search className="w-4 h-4 text-slate-400 mr-2.5 ml-2" />
        <input
          type="text"
          placeholder="Filter users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
        />
      </div>

      <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-mono">Loading user directory...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">User</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">Role</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">Account Status</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">Created Date</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-200 text-sm">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${roleBadge[u.role] || 'bg-white/[0.03] text-slate-400 border border-white/10'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => toggleStatus(u)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-200 ${
                            u.is_active
                              ? 'text-rose-400 hover:bg-rose-500/10 border border-rose-500/20'
                              : 'text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
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

export default UserManagement;
