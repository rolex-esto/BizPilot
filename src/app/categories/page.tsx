"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Search,
  Package,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  description?: string | null;
  productCount: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.status === "success") {
        setCategories(data.categories);
      }
    } catch {
      setErrorMsg("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { setErrorMsg("Please enter a category name."); return; }
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSuccessMsg(`Category "${data.category.name}" created!`);
        setIsAddOpen(false);
        setNewName("");
        setNewDesc("");
        fetchCategories();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg(data.error || "Failed to create category.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) { setErrorMsg("Category name cannot be empty."); return; }
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSuccessMsg("Category updated!");
        setEditingId(null);
        fetchCategories();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg(data.error || "Failed to update category.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/categories/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSuccessMsg("Category deleted.");
        setDeleteTarget(null);
        fetchCategories();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg(data.error || "Failed to delete category.");
        setDeleteTarget(null);
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            Categories
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize your products into categories for easier management.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorMsg}
          <button onClick={() => setErrorMsg("")} className="ml-auto text-rose-400 hover:text-rose-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Search */}
      {categories.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-amber-400"
          />
        </div>
      )}

      {/* Category List */}
      {loading ? (
        <div className="py-12 text-center">
          <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No categories yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create your first category to organize your products. Categories help you find and manage products faster.
          </p>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
          >
            + Create Your First Category
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map((cat) => (
              <div key={cat.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                {editingId === cat.id ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 p-2 rounded-lg border border-amber-300 text-xs font-semibold focus:outline-none focus:border-amber-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="flex-1 p-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdate(cat.id)}
                        disabled={saving}
                        className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {cat.productCount} {cat.productCount === 1 ? "product" : "products"}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditDesc(cat.description || ""); }}
                        className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Edit category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {filtered.length === 0 && searchQuery && (
              <div className="p-8 text-center text-xs text-slate-500">
                No categories match "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link to Inventory */}
      <div className="text-center">
        <Link href="/inventory" className="text-xs text-amber-600 hover:text-amber-700 font-semibold">
          ← Back to Products & Inventory
        </Link>
      </div>

      {/* Add Category Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                Add New Category
              </h3>
              <button onClick={() => { setIsAddOpen(false); setErrorMsg(""); }} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Laptops, Accessories, Phone Cases"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="A short description of this category"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => { setIsAddOpen(false); setErrorMsg(""); }} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">
              Delete "{deleteTarget.name}"?
            </h3>
            {deleteTarget.productCount > 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <p className="font-semibold">This category can't be deleted yet.</p>
                <p className="mt-1">{deleteTarget.productCount} product{deleteTarget.productCount > 1 ? "s are" : " is"} currently assigned to this category. Move them to another category first.</p>
              </div>
            ) : (
              <p className="text-xs text-slate-600">This category isn't being used by any products. It's safe to delete.</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs">
                Cancel
              </button>
              {deleteTarget.productCount === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {saving ? "Deleting..." : "Delete Category"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
