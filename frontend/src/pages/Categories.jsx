import React, { useState, useEffect } from 'react';
import { categoryService } from '../services/dashboardService';
import { Layers, Plus, Trash2, FolderPlus } from 'lucide-react';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCats = async () => {
    setLoading(true);
    try {
      const data = await categoryService.list();
      setCategories(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await categoryService.create({ name: name.trim(), description: desc.trim() });
      setName('');
      setDesc('');
      fetchCats();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create category.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete category? Associated documents will become Uncategorized.')) return;
    try {
      await categoryService.delete(id);
      fetchCats();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete category.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Document Categories</h1>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Taxonomy management for organizing confidential records
        </p>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/[0.07] p-5 rounded-2xl shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center space-x-2 font-mono">
          <FolderPlus className="w-4 h-4 text-indigo-400" />
          <span>Add Category</span>
        </h2>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category Name (e.g. Legal & IP)"
            className="flex-1 px-3.5 py-2 text-xs bg-slate-950/60 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Optional Description"
            className="flex-1 px-3.5 py-2 text-xs bg-slate-950/60 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-300 whitespace-nowrap"
          >
            Create Category
          </button>
        </form>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-mono">Loading categories...</div>
        ) : (
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="border-b border-white/[0.07] bg-slate-950/40">
                <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Name</th>
                <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Description</th>
                <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-all duration-150">
                  <td className="py-3.5 px-5 font-semibold text-slate-200">
                    <span className="font-mono text-xs text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-white/5">
                      {c.name}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-400">{c.description || '—'}</td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Categories;
