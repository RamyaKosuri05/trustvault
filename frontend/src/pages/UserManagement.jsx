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
    admin: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    owner: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    viewer: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Administrative account lifecycle · Session invalidation on status change
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-3 flex items-center shadow-xl">
        <Search className="w-4 h-4 text-slate-400 mr-2.5 ml-2" />
        <input
          type="text"
          placeholder="Filter users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
        />
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-mono">Loading user directory...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/[0.07] bg-slate-950/40">
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">User</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Role</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Account Status</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Created Date</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-all duration-150">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-200 text-sm">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${roleBadge[u.role] || 'bg-slate-800 text-slate-400 border border-white/10'}`}>
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
