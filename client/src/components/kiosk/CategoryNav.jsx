import React from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { sfx } from '../../utils/audio';
import './KioskView.css';

export function CategoryNav() {
  const categories = useMenuStore((state) => state.categories);
  const selectedCategory = useMenuStore((state) => state.selectedCategory);
  const setSelectedCategory = useMenuStore((state) => state.setSelectedCategory);

  const handleSelect = (catName) => {
    sfx.playTap();
    setSelectedCategory(catName);
  };

  return (
    <div className="category-scroll-container kiosk-cat-scroll-bar">
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.name;
        return (
          <button
            key={cat.id || cat.name}
            type="button"
            className={`cat-pill ui-pill-cat ui-pill-cat-emerald ${isActive ? 'active' : ''}`}
            onClick={() => handleSelect(cat.name)}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
