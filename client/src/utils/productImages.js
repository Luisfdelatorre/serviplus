// Image mapper matching product or category to available image assets
export function getProductImageUrl(item = {}, categoryName = '') {
  // If item already has a direct custom image
  if (item.image) return item.image;
  if (item.imageUrl) return item.imageUrl;

  const target = `${item.name || ''} ${categoryName || ''}`.toLowerCase();

  if (target.includes('shawarma')) return '/images/shawarma.png';
  if (target.includes('pizza')) return '/images/pizza.jpg';
  if (target.includes('calzon')) return '/images/calzone.jpg';
  if (target.includes('lasa') || target.includes('pasta')) return '/images/lasana.jpg';
  if (target.includes('refresco') || target.includes('gaseosa') || target.includes('bebida') || target.includes('drink') || target.includes('agua') || target.includes('jugo')) {
    return '/images/bebidas.jpg';
  }
  if (target.includes('cerveza') || target.includes('vino') || target.includes('beer') || target.includes('trago') || target.includes('licor')) {
    return '/images/bebidas.jpg';
  }
  if (target.includes('aperitivo') || target.includes('alita') || target.includes('extra') || target.includes('papa') || target.includes('frita') || target.includes('combo')) {
    return '/images/aperitivo.jpg';
  }
  if (target.includes('promo') || target.includes('domicilio')) {
    return '/images/banner.jpg';
  }
  if (target.includes('kebab')) {
    return '/images/kebab.png';
  }

  // Default fallback
  return '/images/kebab.png';
}

export function getCategoryImageUrl(catName = '') {
  const lower = (catName || '').toLowerCase();
  if (lower.includes('kebab')) return '/images/kebab.png';
  if (lower.includes('shawarma')) return '/images/shawarma.png';
  if (lower.includes('refresco') || lower.includes('gaseosa') || lower.includes('bebida') || lower.includes('drink')) return '/images/bebidas.jpg';
  if (lower.includes('cerveza') || lower.includes('vino') || lower.includes('beer') || lower.includes('trago')) return '/images/bebidas.jpg';
  if (lower.includes('pizza')) return '/images/pizza.jpg';
  if (lower.includes('aperitivo') || lower.includes('alita') || lower.includes('extra') || lower.includes('papa')) return '/images/aperitivo.jpg';
  if (lower.includes('lasa') || lower.includes('pasta')) return '/images/lasana.jpg';
  if (lower.includes('calzon')) return '/images/calzone.jpg';
  if (lower.includes('promo') || lower.includes('domicilio')) return '/images/banner.jpg';
  return '/images/kebab.png';
}

export function getCategoryIcon(name = '') {
  const lower = (name || '').toLowerCase();
  if (lower.includes('kebab')) return '🥙';
  if (lower.includes('shawarma')) return '🌯';
  if (lower.includes('pizza')) return '🍕';
  if (lower.includes('calzon')) return '🥟';
  if (lower.includes('lasa') || lower.includes('pasta')) return '🍝';
  if (lower.includes('refresco') || lower.includes('gaseosa') || lower.includes('drink')) return '🥤';
  if (lower.includes('cerveza') || lower.includes('vino') || lower.includes('beer')) return '🍺';
  if (lower.includes('aperitivo') || lower.includes('papa')) return '🍟';
  if (lower.includes('alita') || lower.includes('pollo')) return '🍗';
  if (lower.includes('postre') || lower.includes('helado')) return '🍨';
  return '🍽️';
}
