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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Document Categories</h1>
        <p className="text-xs text-slate-500 mt-1 font-mono">
          Taxonomy management for organizing confidential records
        </p>
      </div>

      <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm border border-slate-200 dark:border-white/[0.06] p-5 rounded-2xl shadow-sm dark:shadow-none">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-3 flex items-center space-x-2">
          <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Add Category</span>
        </h2>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category Name (e.g. Legal & IP)"
            className="flex-1 px-3.5 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Optional Description"
            className="flex-1 px-3.5 py-2 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition-all duration-200 hover:shadow-blue-500/30 whitespace-nowrap"
          >
            Create Category
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading categories...</div>
        ) : (
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-transparent">
                <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Name</th>
                <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Description</th>
                <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-all duration-150">
                  <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-slate-200">{c.name}</td>
                  <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400">{c.description || '—'}</td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-all duration-200"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
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


