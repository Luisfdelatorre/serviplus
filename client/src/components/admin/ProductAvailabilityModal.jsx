import React, { useState, useEffect, useMemo } from 'react';
import { fetchAdminProducts, toggleProductActive } from '../../api';
import { formatCOP } from '../../utils/format';
import { sfx } from '../../utils/audio';
import {
  Package,
  Search,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export function ProductAvailabilityModal({ isOpen, onClose }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [togglingId, setTogglingId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Error cargando productos:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleToggle = async (product) => {
    const nextState = !product.isActive;
    setTogglingId(product.id);
    sfx.playTap();

    try {
      await toggleProductActive(product.id, nextState);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: nextState } : p))
      );
      showToast(
        nextState
          ? `🟢 "${product.name}" marcado como DISPONIBLE`
          : `🔴 "${product.name}" marcado como AGOTADO (86'd)`
      );
    } catch (err) {
      console.error('Error toggling product:', err);
      alert('Error actualizando disponibilidad: ' + err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchCat = selectedCat === 'ALL' || p.categoryName === selectedCat;
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [products, search, selectedCat]);

  const inactiveCount = useMemo(() => {
    return products.filter((p) => !p.isActive).length;
  }, [products]);

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay">
      <div className="admin-settings-container product-stock-modal pavail-s-1">
        {/* Header */}
        <div className="admin-settings-header pavail-s-2">
          <div className="admin-settings-title-group">
            <div className={`ui-icon-box-xl ${inactiveCount > 0 ? 'ui-icon-box-rose' : 'ui-icon-box-emerald'}`}>
              <Package size={22} color="#fff" />
            </div>
            <div>
              <h2>Control de Disponibilidad (Agotados / 86'd)</h2>
              <p className="pavail-s-3">
                Total: {products.length} platos • <strong className={inactiveCount > 0 ? 'pavail-count-inactive' : 'pavail-count-active'}>{inactiveCount} agotados</strong>
              </p>
            </div>
          </div>
          <button className="admin-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="admin-toast-banner pavail-s-4">
            <AlertCircle size={18} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div className="pavail-s-5">
          <div className="pavail-s-6">
            <Search size={18} className="pavail-s-7" />
            <input
              type="text"
              placeholder="Buscar plato o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pavail-s-8"
            />
          </div>

          <button
            onClick={loadProducts}
            disabled={loading}
            className="pavail-s-9"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refrescar</span>
          </button>
        </div>

        {/* Categorías Pills */}
        <div className="pavail-s-10">
          <button
            onClick={() => setSelectedCat('ALL')}
            className={`ui-pill-cat ui-pill-cat-dark ${selectedCat === 'ALL' ? 'active' : ''}`}
          >
            Todos ({products.length})
          </button>
          {categories.map((cat) => {
            const countInCat = products.filter((p) => p.categoryName === cat).length;
            const inactInCat = products.filter((p) => p.categoryName === cat && !p.isActive).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`ui-pill-cat ui-pill-cat-dark ${selectedCat === cat ? 'active' : ''} ${inactInCat > 0 ? 'has-inactive' : ''}`}
              >
                {cat} ({countInCat}) {inactInCat > 0 && `• ${inactInCat} agotado`}
              </button>
            );
          })}
        </div>

        {/* Lista de Productos */}
        <div className="pavail-s-11">
          {loading ? (
            <div className="pavail-s-12">
              <RefreshCw size={28} className="spin pavail-s-13" />
              <p>Cargando catálogo...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="pavail-s-14">
              No se encontraron productos con el filtro aplicado.
            </div>
          ) : (
            <div className="pavail-s-15">
              {filteredProducts.map((p) => {
                const isToggling = togglingId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`pavail-product-card ${p.isActive ? 'active' : 'inactive'} ${isToggling ? 'toggling' : ''}`}
                  >
                    <div>
                      <div className="pavail-s-16">
                        <span className="pavail-s-17">
                          {p.categoryName}
                        </span>
                        <span className={`pavail-product-price ${p.isActive ? 'active' : 'inactive'}`}>
                          {formatCOP(p.price)}
                        </span>
                      </div>
                      <h4 className={`pavail-product-title ${p.isActive ? 'active' : 'inactive'}`}>
                        {p.name}
                      </h4>
                    </div>

                    <button
                      onClick={() => handleToggle(p)}
                      disabled={isToggling}
                      className={`pavail-toggle-btn ${p.isActive ? 'active' : 'inactive'}`}
                    >
                      {p.isActive ? (
                        <>
                          <CheckCircle2 size={16} />
                          <span>Disponible (Activo)</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={16} />
                          <span>Agotado (Desactivado)</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
