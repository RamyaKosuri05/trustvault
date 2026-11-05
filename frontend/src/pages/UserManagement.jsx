import React, { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { Users, Shield, Check, X, Search, UserX, UserCheck } from 'lucide-react';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
    admin: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    owner: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    viewer: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">User Management</h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Administrative account lifecycle · Session invalidation on status change
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm border border-slate-200 dark:border-white/[0.06] rounded-xl p-3 flex items-center shadow-sm dark:shadow-none">
        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2.5 ml-1" />
        <input
          type="text"
          placeholder="Filter users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none"
        />
      </div>

      <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading user accounts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-transparent">
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">User</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Role</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Account Status</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Created Date</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-all duration-150">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{u.full_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${roleBadge[u.role] || 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-white/10'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          u.is_active
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                            : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/25 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {u.id !== user.id && (
                        <button
                          onClick={() => toggleStatus(u)}
                          className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all duration-200 ${
                            u.is_active
                              ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-300 dark:border-rose-500/20'
                              : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20'
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


