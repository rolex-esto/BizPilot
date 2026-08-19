"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  TrendingDown,
  Layers,
  Edit2,
  X,
  Trash2,
  Archive,
  Check,
  Search,
  Filter,
  EyeOff,
  Eye,
} from "lucide-react";
import { ModuleIntroModal, AboutPageButton, useModuleIntro, ModuleIntroConfig } from "@/components/ModuleIntroModal";

const INVENTORY_INTRO_CONFIG: ModuleIntroConfig = {
  moduleKey: "inventory",
  title: "Your Products",
  badge: "Products",
  icon: <Package className="w-6 h-6 text-amber-600" />,
  subtitle: "Keep track of what you sell, how much you charge, and how many you have in stock.",
  whatYouCanDo: [
    "Add new products with prices and stock quantities",
    "Update stock when new items arrive or when you sell something",
    "Get alerts when products are running low",
    "Organize products into categories",
  ],
  whyItMatters:
    "You'll always know what you have available before accepting a customer's order — no more accidentally selling something you don't have.",
  nextAction: "Check your low-stock products or add a new product.",
};

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  category: string;
  price: number;
  costPrice?: number | null;
  stockQuantity: number;
  safetyStockThreshold: number;
  imageUrl?: string | null;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string | null;
  productCount: number;
}

export default function InventoryPage() {
  const { isOpen: isIntroOpen, openIntro, closeIntro } = useModuleIntro("inventory");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState(5);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "",
    price: "",
    costPrice: "",
    stockQuantity: "5",
    safetyStockThreshold: "2",
    description: "",
    imageUrl: "",
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [uploading, setUploading] = useState(false);

  const formatPhp = (amt: number) =>
    `₱${amt.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const fetchProducts = async () => {
    try {
      setErrorMsg("");
      const res = await fetch(`/api/products?includeInactive=${showInactive}`);
      const data = await res.json();
      if (data.status === "success") {
        setProducts(data.products);
      } else {
        setErrorMsg(data.error || "Failed to load products.");
      }
    } catch (err: any) {
      setErrorMsg("Network error fetching products.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.status === "success") {
        setCategories(data.categories);
      }
    } catch {
      // Non-critical — category dropdown will just be empty
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [showInactive]);

  const resetForm = () => {
    setFormData({
      sku: "",
      name: "",
      category: "",
      price: "",
      costPrice: "",
      stockQuantity: "5",
      safetyStockThreshold: "2",
      description: "",
      imageUrl: "",
    });
    setErrorMsg("");
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryError("Please enter a category name.");
      return;
    }
    setCategoryLoading(true);
    setCategoryError("");
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim(), description: newCategoryDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        // Refresh categories and auto-select the new one
        await fetchCategories();
        setFormData((prev) => ({ ...prev, category: data.category.name }));
        setIsCategoryModalOpen(false);
        setNewCategoryName("");
        setNewCategoryDesc("");
      } else {
        setCategoryError(data.error || "Failed to create category.");
      }
    } catch {
      setCategoryError("Network error. Please try again.");
    } finally {
      setCategoryLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg("");

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setFormData((prev) => ({ ...prev, imageUrl: data.url }));
      } else {
        setErrorMsg(data.error || "Photo couldn't be uploaded. Please try again.");
      }
    } catch {
      setErrorMsg("Photo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
          stockQuantity: parseInt(formData.stockQuantity) || 0,
          safetyStockThreshold: parseInt(formData.safetyStockThreshold) || 2,
          description: formData.description,
          imageUrl: formData.imageUrl || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSuccessMsg(`Successfully added "${data.product.name}" to inventory!`);
        setIsAddModalOpen(false);
        resetForm();
        fetchProducts();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg(data.error || "Failed to create product.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create product.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
          stockQuantity: parseInt(formData.stockQuantity) || 0,
          safetyStockThreshold: parseInt(formData.safetyStockThreshold) || 2,
          description: formData.description,
          imageUrl: formData.imageUrl || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSuccessMsg(`Updated "${data.product.name}" successfully!`);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg(data.error || "Failed to update product.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update product.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setSuccessMsg(
          product.isActive
            ? `Archived "${product.name}". It is now hidden from active sales.`
            : `Reactivated "${product.name}".`
        );
        fetchProducts();
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;
    setSaving(true);

    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: restockProduct.id,
          adjustmentAmount: restockAmount,
          reason: "Manual supplier restock",
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        setSuccessMsg(`Successfully added +${restockAmount} units to ${restockProduct.name}!`);
        setRestockProduct(null);
        fetchProducts();
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("Error restocking:", err);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      name: p.name,
      category: p.category,
      price: String(p.price),
      costPrice: p.costPrice ? String(p.costPrice) : "",
      stockQuantity: String(p.stockQuantity),
      safetyStockThreshold: String(p.safetyStockThreshold),
      description: p.description || "",
      imageUrl: p.imageUrl || "",
    });
    setErrorMsg("");
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const lowStockCount = products.filter((p) => p.isActive && p.stockQuantity <= p.safetyStockThreshold).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" />
              Your Products
            </h1>
            <AboutPageButton onClick={openIntro} />
          </div>
          <p className="text-xs text-slate-500">
            Keep track of what you sell, your prices, and available stock
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-600/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add New Product
          </button>
          <button
            onClick={fetchProducts}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <ModuleIntroModal config={INVENTORY_INTRO_CONFIG} isOpen={isIntroOpen} onClose={closeIntro} />

      {/* Success Toast */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Products</span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {products.filter((p) => p.isActive).length} Products
          </div>
          <p className="text-xs text-slate-500">Currently available for sale</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock</span>
          <div className="text-xl font-bold text-rose-600 mt-1">{lowStockCount} Items</div>
          <p className="text-xs text-slate-500">May need restocking soon</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Health</span>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            {products.length > 0
              ? Math.round(((products.length - lowStockCount) / products.length) * 100)
              : 100}
            %
          </div>
          <p className="text-xs text-slate-500">Safe stock levels</p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showInactive
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showInactive ? "Showing Archived" : "Show Archived"}
          </button>
        </div>
      </div>

      {/* Products Table or Empty State */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Your Products</h3>
          <span className="text-xs text-slate-500">
            {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"} found
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          /* Elegant Empty State */
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No products in inventory</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? `No products matched "${searchQuery}". Try clearing your search.`
                  : "Add your first product to start managing your inventory and taking orders."}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={() => {
                  resetForm();
                  setIsAddModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-amber-600/20"
              >
                <Plus className="w-4 h-4" /> Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProducts.map((product) => {
              const isLowStock = product.isActive && product.stockQuantity <= product.safetyStockThreshold;
              const isCritical = product.isActive && product.stockQuantity <= 1;

              return (
                <div
                  key={product.id}
                  className={`p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    !product.isActive ? "opacity-60 bg-slate-50/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Product Thumbnail */}
                    <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{product.name}</span>
                        <span className="text-xs font-medium text-slate-500">({product.category})</span>
                        {!product.isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{product.sku}</span>
                        {product.description && <span className="line-clamp-1">{product.description}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 shrink-0 flex-wrap sm:flex-nowrap">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{formatPhp(product.price)}</div>
                      {product.costPrice && (
                        <div className="text-[11px] text-slate-400">Cost: {formatPhp(product.costPrice)}</div>
                      )}
                    </div>

                    <div className="text-right min-w-[90px]">
                      <div
                        className={`text-sm font-bold flex items-center justify-end gap-1 ${
                          !product.isActive
                            ? "text-slate-500"
                            : isCritical
                            ? "text-rose-600"
                            : isLowStock
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {isLowStock && <AlertTriangle className="w-3.5 h-3.5" />}
                        {product.stockQuantity} on hand
                      </div>
                      <div className="text-[10px] text-slate-400">Min safety: {product.safetyStockThreshold}</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {product.isActive && (
                        <button
                          onClick={() => {
                            setRestockProduct(product);
                            setRestockAmount(5);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Add Stock"
                        >
                          <Plus className="w-3.5 h-3.5" /> Restock
                        </button>
                      )}

                      <button
                        onClick={() => openEditModal(product)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                        title="Edit Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleActive(product)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          product.isActive
                            ? "border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        }`}
                        title={product.isActive ? "Deactivate / Archive" : "Reactivate"}
                      >
                        {product.isActive ? <Archive className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingProduct ? "Edit Product" : "Add New Product"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingProduct ? `Editing: ${editingProduct.sku}` : "Add a product to your store"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <form
              onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
              className="space-y-3.5 text-xs"
            >
              {/* Product Photo Upload */}
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">Product Photo</label>
                {formData.imageUrl ? (
                  <div className="relative w-full h-36 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <img src={formData.imageUrl} alt="Product" className="w-full h-full object-contain" />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <label className="px-2 py-1 bg-white/90 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-100">
                        Replace
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
                      </label>
                      <button type="button" onClick={() => setFormData((prev) => ({ ...prev, imageUrl: "" }))} className="px-2 py-1 bg-white/90 border border-rose-200 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50">
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-amber-400 hover:bg-amber-50/30 cursor-pointer transition-colors">
                    {uploading ? (
                      <span className="text-xs text-slate-500 font-medium">Uploading...</span>
                    ) : (
                      <>
                        <Package className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-600">Add a product photo</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, or WEBP (max 5MB)</span>
                      </>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product Code <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="Auto-generated if left blank"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <div className="flex gap-1.5">
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="flex-1 p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:border-amber-500 text-xs"
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                      {/* Include the current value if it's not in the list (legacy data) */}
                      {formData.category && !categories.find((c) => c.name === formData.category) && formData.category !== "" && (
                        <option value={formData.category}>{formData.category}</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 font-bold text-[11px] whitespace-nowrap"
                      title="Add new category"
                    >
                      + New
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Air M2 (8GB RAM, 256GB SSD)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price (₱) *</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    placeholder="45000"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cost / Supplier Price (₱)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="40000"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stock on Hand *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="How many do you have now?"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Warn me below this number"
                    value={formData.safetyStockThreshold}
                    onChange={(e) => setFormData({ ...formData, safetyStockThreshold: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Warranty Specs</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Midnight Blue, 1 Year Apple Warranty, NTC registered."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {saving ? "Saving..." : editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Quick Restock</h3>
                  <p className="text-xs text-slate-500">{restockProduct.name}</p>
                </div>
              </div>
              <button
                onClick={() => setRestockProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestock} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Stock on Hand</label>
                <input
                  type="text"
                  disabled
                  value={`${restockProduct.stockQuantity} units`}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Units to Add (+)</label>
                <input
                  type="number"
                  min={1}
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {saving ? "Saving..." : "Add to Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Add New Category</h3>
              </div>
              <button
                onClick={() => { setIsCategoryModalOpen(false); setCategoryError(""); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {categoryError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {categoryError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Laptops, Accessories, Gadgets"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Computer laptops and notebooks"
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setIsCategoryModalOpen(false); setCategoryError(""); }}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={categoryLoading || !newCategoryName.trim()}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 disabled:opacity-50"
              >
                {categoryLoading ? "Creating..." : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
