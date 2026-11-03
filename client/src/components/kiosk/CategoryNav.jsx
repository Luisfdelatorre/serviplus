import React from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { sfx } from '../../utils/audio';

export function CategoryNav() {
  const categories = useMenuStore((state) => state.categories);
  const selectedCategory = useMenuStore((state) => state.selectedCategory);
  const setSelectedCategory = useMenuStore((state) => state.setSelectedCategory);

  const handleSelect = (catName) => {
    sfx.playTap();
    setSelectedCategory(catName);
  };

  return (
    <div className="category-scroll-container" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.name;
        return (
          <button
            key={cat.id || cat.name}
            className={`cat-pill ${isActive ? 'active' : ''}`}
            onClick={() => handleSelect(cat.name)}
            style={{
              padding: '8px 16px',
              borderRadius: '999px',
              border: isActive ? '1px solid #10b981' : '1px solid #e2e8f0',
              background: isActive ? '#10b981' : '#f8fafc',
              color: isActive ? '#ffffff' : '#334155',
              fontWeight: 700,
              fontSize: '0.95rem',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
