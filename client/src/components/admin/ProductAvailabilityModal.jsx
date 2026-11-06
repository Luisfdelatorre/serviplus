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
      <div className="admin-settings-container product-stock-modal" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="admin-settings-header" style={{ paddingBottom: '16px' }}>
          <div className="admin-settings-title-group">
            <div className="admin-header-badge" style={{ background: inactiveCount > 0 ? '#ef4444' : '#10b981' }}>
              <Package size={22} color="#fff" />
            </div>
            <div>
              <h2>Control de Disponibilidad (Agotados / 86'd)</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                Total: {products.length} platos • <strong style={{ color: inactiveCount > 0 ? '#f87171' : '#4ade80' }}>{inactiveCount} agotados</strong>
              </p>
            </div>
          </div>
          <button className="admin-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="admin-toast-banner" style={{ margin: '0 24px 12px 24px', background: '#0284c7' }}>
            <AlertCircle size={18} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div style={{ padding: '0 24px 12px 24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Buscar plato o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <button
            onClick={loadProducts}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              background: '#334155',
              border: 'none',
              borderRadius: '8px',
              color: '#f8fafc',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refrescar</span>
          </button>
        </div>

        {/* Categorías Pills */}
        <div style={{ padding: '0 24px 12px 24px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
          <button
            onClick={() => setSelectedCat('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: selectedCat === 'ALL' ? '#3b82f6' : '#1e293b',
              color: '#fff',
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
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
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  background: selectedCat === cat ? '#3b82f6' : '#1e293b',
                  color: inactInCat > 0 ? '#fca5a5' : '#cbd5e1',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: inactInCat > 0 ? 600 : 400
                }}
              >
                {cat} ({countInCat}) {inactInCat > 0 && `• ${inactInCat} agotado`}
              </button>
            );
          })}
        </div>

        {/* Lista de Productos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <p>Cargando catálogo...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              No se encontraron productos con el filtro aplicado.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {filteredProducts.map((p) => {
                const isToggling = togglingId === p.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: p.isActive ? '#1e293b' : '#3f1a1a',
                      border: p.isActive ? '1px solid #334155' : '1px solid #ef4444',
                      borderRadius: '10px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      opacity: isToggling ? 0.6 : 1
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {p.categoryName}
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: p.isActive ? '#38bdf8' : '#94a3b8' }}>
                          {formatCOP(p.price)}
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: p.isActive ? '#f8fafc' : '#fca5a5' }}>
                        {p.name}
                      </h4>
                    </div>

                    <button
                      onClick={() => handleToggle(p)}
                      disabled={isToggling}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        background: p.isActive ? '#065f46' : '#991b1b',
                        color: '#fff',
                        transition: 'background 0.2s'
                      }}
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
