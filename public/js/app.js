// ==========================================================
// SERVIPLUS / POCKETBIKE - SMART KIOSK & KDS POS (IPAD LANDSCAPE)
// ==========================================================

// Web Audio API Sound Generator
class SoundFX {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  // Sonido de campana para cocina (nueva orden)
  playOrderBell() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }
  // Sonido de éxito cuando una orden está lista
  playReadyChime() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.3, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + (i + 1) * 0.2);
    });
  }
  playTap() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

const sfx = new SoundFX();

// En Aldelo para Colombia los valores vienen en miles (ej: 8 = $8.000 COP, 2.5 = $2.500 COP)
function formatCOP(aldeloVal) {
  const num = parseFloat(aldeloVal) || 0;
  const cop = Math.round(num * 1000);
  return '$' + cop.toLocaleString('es-CO');
}

// APPLICATION STATE
const state = {
  activeTab: 'kiosk',
  categories: [],
  selectedCategory: null,
  searchQuery: '',
  cart: [],
  activeOrders: [],
  employees: [],
  currentCashier: 1,
  checkoutType: 'EAT_IN', // 'EAT_IN' o 'TAKE_OUT'
  checkoutStep: 1,
  allTables: [],
  selectedTable: null,
  selectedTableGroup: null,
  kdsFilter: 'PREP',
  kdsPage: 1,
  kdsScale: localStorage.getItem('kds_scale') || 'normal',
  kdsAutoFit: localStorage.getItem('kds_autofit') === 'true',
  kdsItemChecks: {},
  paymentMethod: 'WOMPI_QR',
  cashTendered: 0
};

// SOCKET.IO REAL-TIME CONNECTION (con fallback seguro)
const socket = (typeof io !== 'undefined') ? io() : {
  on: () => { },
  emit: () => { }
};

socket.on('connect', () => {
  const dot = document.getElementById('conn-dot');
  const txt = document.getElementById('conn-text');
  if (dot) dot.style.background = '#10b981';
  if (txt) txt.textContent = (typeof t === 'function' ? t('status_online') : 'En línea');
});

socket.on('disconnect', () => {
  const dot = document.getElementById('conn-dot');
  const txt = document.getElementById('conn-text');
  if (dot) dot.style.background = '#ef4444';
  if (txt) txt.textContent = (typeof t === 'function' ? t('status_offline') : 'Desconectado');
});

// Evento: Nueva orden recibida en tiempo real
socket.on('order:new', (order) => {
  sfx.playOrderBell();
  state.activeOrders.unshift(order);
  renderKDS();
  renderTurns();
});

// Evento: Cambio de estado de orden en tiempo real
socket.on('order:status_changed', ({ orderId, status, tableReady }) => {
  const ord = state.activeOrders.find(o => o.id === orderId);
  if (ord) {
    ord.status = status;
    if (tableReady !== undefined) ord.tableReady = tableReady;
    if (status === '2' || tableReady) {
      sfx.playReadyChime();
    }
  }
  renderKDS();
  renderTurns();
});

// Evento: Cambio de estado operativo exclusivo de cocina (KDS) en tiempo real
socket.on('kds:status_changed', ({ orderId, kdsStatus, itemChecks, tableReady }) => {
  const ord = state.activeOrders.find(o => o.id === orderId);
  if (ord) {
    ord.kdsStatus = kdsStatus;
    ord.tableReady = (kdsStatus === 'READY');
    ord.packagerPrinted = (kdsStatus === 'SERVED');
    if (itemChecks) {
      if (!ord.kdsItemChecks) ord.kdsItemChecks = {};
      Object.assign(ord.kdsItemChecks, itemChecks);
      Object.assign(state.kdsItemChecks, itemChecks);
    }
    if (kdsStatus === 'READY' || tableReady) {
      sfx.playReadyChime();
    }
  }
  renderKDS();
  renderTurns();
});

// --- API CLIENT ---
async function fetchMenu() {
  try {
    const res = await fetch('/api/menu');
    const json = await res.json();
    if (json.success) {
      state.categories = json.data;
      if (state.categories.length > 0) {
        state.selectedCategory = state.categories[0].name;
      }
      renderKioskCategories();
      renderKioskProducts();
      renderFrontDeskProducts();
    }
  } catch (err) {
    console.error('Error fetching menu:', err);
  }
}

async function fetchEmployees() {
  try {
    const res = await fetch('/api/employees');
    const json = await res.json();
    if (json.success) {
      state.employees = json.data;
      renderCashierSelect();
    }
  } catch (err) {
    console.error('Error fetching employees:', err);
  }
}

async function fetchActiveOrders() {
  try {
    const res = await fetch('/api/orders/active');
    const json = await res.json();
    if (json.success) {
      state.activeOrders = json.data;
      renderKDS();
      renderTurns();
    }
  } catch (err) {
    console.error('Error fetching active orders:', err);
  }
}

async function fetchTables() {
  try {
    const res = await fetch('/api/tables?_t=' + Date.now());
    const json = await res.json();
    if (json.success && json.data) {
      state.allTables = json.data.filter(t => !t.inActive);
      if (!state.selectedTable && state.allTables.length > 0) {
        state.selectedTable = state.allTables.find(t => t.name === '1') || state.allTables[0];
      }
      renderTableGrid();
    }
  } catch (err) {
    console.error('Error fetching tables:', err);
  }
}

// --- TAB NAVIGATION ---
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sfx.playTap();
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const viewId = tab.dataset.view;
      state.activeTab = viewId;
      document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
      const activeSection = document.getElementById(`view-${viewId}`);
      if (activeSection) activeSection.classList.add('active');
    });
  });
}

// ==========================================================
// 1. KIOSK AUTOSERVICIO (MCDONALD'S STYLE)
// ==========================================================

// Image mapper for categories
function getCategoryImageUrl(catName) {
  const lower = (catName || '').toLowerCase();
  if (lower.includes('kebab')) return '/images/kebab.jpg';
  if (lower.includes('shawarma')) return '/images/shawarma.jpg';
  if (lower.includes('refresco') || lower.includes('gaseosa') || lower.includes('bebida') || lower.includes('drink')) return '/images/bebidas.jpg';
  if (lower.includes('cerveza') || lower.includes('vino') || lower.includes('beer') || lower.includes('trago')) return '/images/bebidas.jpg';
  if (lower.includes('pizza')) return '/images/pizza.jpg';
  if (lower.includes('aperitivo') || lower.includes('alita') || lower.includes('extra') || lower.includes('papa')) return '/images/aperitivo.jpg';
  if (lower.includes('lasa') || lower.includes('pasta')) return '/images/lasana.jpg';
  if (lower.includes('calzon')) return '/images/calzone.jpg';
  if (lower.includes('promo') || lower.includes('domicilio')) return '/images/banner.jpg';
  return '/images/kebab.jpg';
}

function getCategoryIcon(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('kebab')) return '🥙';
  if (lower.includes('shawarma')) return '🌯';
  if (lower.includes('refresco') || lower.includes('gaseosa') || lower.includes('drink')) return '🥤';
  if (lower.includes('cerveza') || lower.includes('vino') || lower.includes('beer')) return '🍷';
  if (lower.includes('pizza')) return '🍕';
  if (lower.includes('lasa') || lower.includes('pasta')) return '🍝';
  if (lower.includes('calzon')) return '🥟';
  if (lower.includes('aperitivo') || lower.includes('alita') || lower.includes('nugget')) return '🍗';
  if (lower.includes('extra') || lower.includes('queso')) return '🧀';
  if (lower.includes('domicilio')) return '🛵';
  if (lower.includes('promo')) return '⭐';
  if (lower.includes('trago') || lower.includes('cocktail') || lower.includes('licor')) return '🍹';
  return '🍽️';
}

function renderKioskCategories() {
  const container = document.getElementById('kiosk-cats');
  const frontDeskContainer = document.getElementById('frontdesk-cats');
  if (!container && !frontDeskContainer) return;

  const html = state.categories.map(cat => `
    <button class="kiosk-cat-btn ${cat.name === state.selectedCategory ? 'active' : ''}" onclick="selectCategory('${cat.name}')">
      <div class="kiosk-cat-thumb">
        <img src="${getCategoryImageUrl(cat.name)}" alt="${cat.name}">
      </div>
      <div class="kiosk-cat-title">${cat.name}</div>
      <div class="kiosk-cat-count">${typeof t === 'function' ? t('items_count', { n: cat.items.length }) : `${cat.items.length} prod.`}</div>
    </button>
  `).join('');

  if (container) container.innerHTML = html;
  if (frontDeskContainer) frontDeskContainer.innerHTML = html;
}

function selectCategory(catName) {
  sfx.playTap();
  state.selectedCategory = catName;
  state.searchQuery = '';
  const searchInput = document.getElementById('kiosk-search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('kiosk-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';

  renderKioskCategories();
  renderKioskProducts();
}

function handleSearch(val) {
  state.searchQuery = val || '';
  const clearBtn = document.getElementById('kiosk-search-clear');
  if (clearBtn) clearBtn.style.display = state.searchQuery.length > 0 ? 'block' : 'none';
  renderKioskProducts();
}

function clearSearch() {
  sfx.playTap();
  state.searchQuery = '';
  const searchInput = document.getElementById('kiosk-search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('kiosk-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderKioskProducts();
}

function renderKioskProducts() {
  const container = document.getElementById('kiosk-products');
  const title = document.getElementById('kiosk-cat-title');
  const countBadge = document.getElementById('kiosk-items-count-badge');
  if (!container) return;

  let itemsToRender = [];
  let currentCat = state.categories.find(c => c.name === state.selectedCategory);

  if (state.searchQuery && state.searchQuery.trim().length > 0) {
    const q = state.searchQuery.trim().toLowerCase();
    state.categories.forEach(c => {
      c.items.forEach(item => {
        if (item.name.toLowerCase().includes(q)) {
          itemsToRender.push({ ...item, categoryName: c.name });
        }
      });
    });
    if (title) title.textContent = typeof t === 'function' ? t('search_results', { q: state.searchQuery }) : `Resultados para "${state.searchQuery}"`;
    if (countBadge) countBadge.textContent = typeof t === 'function' ? t('items_found', { n: itemsToRender.length }) : `${itemsToRender.length} encontrados`;
  } else {
    if (currentCat) {
      itemsToRender = currentCat.items.map(item => ({ ...item, categoryName: currentCat.name }));
      if (title) title.textContent = `${getCategoryIcon(currentCat.name)} ${currentCat.name}`;
      if (countBadge) countBadge.textContent = typeof t === 'function' ? t('items_count', { n: itemsToRender.length }) : `${itemsToRender.length} productos`;
    }
  }

  if (itemsToRender.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <div style="font-size: 3rem; margin-bottom: 10px;">🔍</div>
        <p style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">No se encontraron productos</p>
        <p style="font-size: 0.9rem;">Prueba buscando con otro término o selecciona una categoría.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = itemsToRender.map(item => {
    const inCartItems = state.cart.filter(c => c.id === item.id);
    const qty = inCartItems.reduce((sum, c) => sum + (c.quantity || 1), 0);
    return `
    <div class="product-card" onclick="addToCart(${item.id})">
      ${qty > 0 ? `<div class="product-badge-qty">${qty}</div>` : ''}
      <div class="product-card-img-wrap">
        <img src="${getCategoryImageUrl(item.categoryName)}" alt="${item.name}" class="product-card-img">
      </div>
      <div class="product-card-body">
        <div class="product-card-title">${item.name}</div>
      </div>
      <div class="product-card-footer">
        <div class="product-card-price">${formatCOP(item.price)}</div>
        <div class="product-add-circle" style="width: 40px; height: 40px; border-radius: 50%; background: #ffffff; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1); border: 1px solid rgba(0, 0, 0, 0.04); color: #0f172a; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; flex-shrink: 0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: auto;">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

function addToCart(itemId) {
  sfx.playTap();
  let found = null;
  state.categories.forEach(c => {
    const it = c.items.find(i => i.id === itemId);
    if (it) found = it;
  });
  if (!found) return;

  if (found.modifiers && found.modifiers.length > 0) {
    openModifierModal(found);
    return;
  }

  const existing = state.cart.find(c => c.id === itemId && (!c.modifiers || c.modifiers.length === 0));
  if (existing) {
    existing.quantity++;
  } else {
    state.cart.push({ ...found, basePrice: found.price, quantity: 1, notes: '', cartItemId: String(itemId), modifiers: [] });
  }
  state.lastAddedId = itemId;
  renderCart();
  scrollCartToItem(itemId);
}

// Modal interactivo de personalización con modificadores (Salsas, Toppings y Extras)
function openModifierModal(item) {
  let modalEl = document.getElementById('kiosk-modifier-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'kiosk-modifier-modal';
    modalEl.className = 'modal-overlay';
    document.body.appendChild(modalEl);
  }

  const allMods = item.modifiers || [];
  const baseMods = allMods.filter(m => !m.price || Number(m.price) === 0);
  const extraMods = allMods.filter(m => m.price && Number(m.price) > 0);

  let selectedModIds = new Set();
  let quantity = 1;
  let customNotes = '';

  function renderModalContent() {
    const selectedList = allMods.filter(m => selectedModIds.has(m.id));
    const extraTotal = selectedList.reduce((sum, m) => sum + (Number(m.price) || 0), 0);
    const unitPrice = (Number(item.price) || 0) + extraTotal;
    const finalTotal = unitPrice * quantity;

    modalEl.innerHTML = `
      <div class="modifier-modal-card" style="background:#ffffff; border-radius:24px; width:100%; max-width:540px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
        
        <!-- Header -->
        <div style="padding:16px 20px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; background:#fafafa;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:52px; height:52px; border-radius:12px; background:#ffffff; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
              <img src="${getCategoryImageUrl(item.categoryName)}" alt="${item.name}" style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div>
              <h2 style="font-size:1.2rem; font-weight:900; color:#0f172a; margin:0;">${item.name}</h2>
              <div style="font-size:0.9rem; font-weight:800; color:#059669; margin-top:2px;">Base: ${formatCOP(item.price)}</div>
            </div>
          </div>
          <button type="button" onclick="closeModifierModal()" style="width:34px; height:34px; border-radius:50%; border:none; background:#f1f5f9; color:#64748b; font-size:1.1rem; font-weight:900; cursor:pointer;">✕</button>
        </div>

        <!-- Body -->
        <div style="flex:1; overflow-y:auto; padding:18px 20px; display:flex; flex-direction:column; gap:18px;">
          
          ${baseMods.length > 0 ? `
            <div>
              <div style="font-weight:900; font-size:0.95rem; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span>🥣</span> Salsas y Toppings <span style="font-size:0.75rem; color:#059669; background:#ecfdf5; padding:2px 8px; border-radius:9999px;">Sin costo</span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px;">
                ${baseMods.map(m => {
                  const isChecked = selectedModIds.has(m.id);
                  return `
                    <button type="button" onclick="toggleModInModal(${m.id})" style="padding:10px; border-radius:12px; border:${isChecked ? '2px solid #059669' : '1.5px solid #e2e8f0'}; background:${isChecked ? '#ecfdf5' : '#ffffff'}; color:${isChecked ? '#047857' : '#334155'}; font-weight:800; font-size:0.83rem; text-align:left; cursor:pointer; display:flex; align-items:center; justify-content:space-between;">
                      <span>${m.name}</span>
                      <span style="font-size:0.8rem;">${isChecked ? '✓' : ''}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${extraMods.length > 0 ? `
            <div>
              <div style="font-weight:900; font-size:0.95rem; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span>🧀</span> Adicionales y Extras
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:8px;">
                ${extraMods.map(m => {
                  const isChecked = selectedModIds.has(m.id);
                  return `
                    <button type="button" onclick="toggleModInModal(${m.id})" style="padding:10px 12px; border-radius:12px; border:${isChecked ? '2px solid #f59e0b' : '1.5px solid #e2e8f0'}; background:${isChecked ? '#fffdf0' : '#ffffff'}; color:#0f172a; font-weight:800; font-size:0.85rem; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:4px;">
                      <div style="display:flex; justify-content:space-between; width:100%;">
                        <span>${m.name}</span>
                        <span>${isChecked ? '✓' : ''}</span>
                      </div>
                      <div style="color:#b45309; font-weight:900; font-size:0.82rem;">+${formatCOP(m.price)}</div>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <div>
            <div style="font-weight:800; font-size:0.9rem; color:#0f172a; margin-bottom:6px;">📝 Instrucciones especiales</div>
            <input type="text" id="mod-modal-notes" value="${customNotes}" placeholder="Ej. Sin cebolla, carne bien cocida..." oninput="updateNotesInModal(this.value)" style="width:100%; padding:10px 12px; border-radius:10px; border:1.5px solid #e2e8f0; font-size:0.85rem; outline:none; box-sizing:border-box;">
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:14px 20px; border-top:1px solid #f1f5f9; display:flex; align-items:center; gap:12px; background:#ffffff;">
          <div style="display:flex; align-items:center; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:2px;">
            <button type="button" onclick="changeQtyInModal(-1)" style="width:32px; height:32px; border-radius:8px; border:none; background:#ffffff; font-weight:900; font-size:1.1rem; cursor:pointer;">-</button>
            <span style="min-width:30px; text-align:center; font-weight:900; font-size:0.95rem;">${quantity}</span>
            <button type="button" onclick="changeQtyInModal(1)" style="width:32px; height:32px; border-radius:8px; border:none; background:#ffffff; font-weight:900; font-size:1.1rem; cursor:pointer;">+</button>
          </div>

          <button type="button" onclick="confirmAddFromModal()" style="flex:1; padding:12px 18px; border-radius:14px; border:none; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; font-weight:900; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:space-between; box-shadow:0 6px 16px rgba(16,185,129,0.35);">
            <span>Agregar al Pedido</span>
            <span style="background:rgba(0,0,0,0.18); padding:3px 10px; border-radius:8px;">${formatCOP(finalTotal)}</span>
          </button>
        </div>
      </div>
    `;
  }

  window.toggleModInModal = function(modId) {
    sfx.playTap();
    if (selectedModIds.has(modId)) selectedModIds.delete(modId);
    else selectedModIds.add(modId);
    renderModalContent();
  };

  window.changeQtyInModal = function(delta) {
    sfx.playTap();
    quantity = Math.max(1, quantity + delta);
    renderModalContent();
  };

  window.updateNotesInModal = function(val) {
    customNotes = val;
  };

  window.confirmAddFromModal = function() {
    sfx.playTap();
    const selectedList = allMods.filter(m => selectedModIds.has(m.id));
    const extraTotal = selectedList.reduce((sum, m) => sum + (Number(m.price) || 0), 0);
    const unitPrice = (Number(item.price) || 0) + extraTotal;
    const modKey = selectedList.map(m => m.id).sort().join('_');
    const cleanNotes = customNotes.trim();
    const cartItemId = `${item.id}${modKey ? `_m${modKey}` : ''}${cleanNotes ? `_n${cleanNotes}` : ''}`;

    const existing = state.cart.find(c => (c.cartItemId || c.id) === cartItemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      state.cart.push({
        ...item,
        basePrice: Number(item.price) || 0,
        price: unitPrice,
        modifiers: selectedList,
        notes: cleanNotes,
        quantity: quantity,
        cartItemId: cartItemId
      });
    }
    closeModifierModal();
    renderCart();
    scrollCartToItem(cartItemId);
  };

  window.closeModifierModal = function() {
    modalEl.classList.remove('active');
  };

  renderModalContent();
  modalEl.classList.add('active');
}

// Desplaza la lista del carrito hasta el producto agregado y lo resalta
function scrollCartToItem(itemId) {
  ['cart-items-list', 'frontdesk-cart-items'].forEach(listId => {
    const list = document.getElementById(listId);
    if (!list) return;
    const row = list.querySelector(`.cart-item[data-item-id="${itemId}"]`);
    if (!row) return;

    requestAnimationFrame(() => {
      const rowTop = row.offsetTop;
      const rowBottom = rowTop + row.offsetHeight;
      const viewTop = list.scrollTop;
      const viewBottom = viewTop + list.clientHeight;

      if (rowBottom > viewBottom) {
        list.scrollTo({ top: rowBottom - list.clientHeight + 12, behavior: 'smooth' });
      } else if (rowTop < viewTop) {
        list.scrollTo({ top: Math.max(0, rowTop - 12), behavior: 'smooth' });
      }

      row.classList.remove('cart-item-flash');
      void row.offsetWidth; // reiniciar animación
      row.classList.add('cart-item-flash');
    });
  });
}

function updateCartQty(cartItemId, delta) {
  sfx.playTap();
  const item = state.cart.find(c => (c.cartItemId || c.id) == cartItemId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(c => (c.cartItemId || c.id) != cartItemId);
  }
  renderCart();
}

function setOrderType(type) {
  sfx.playTap();
  state.checkoutType = type;

  const btnEat = document.getElementById('btn-eat-in');
  const btnTakeaway = document.getElementById('btn-takeaway');
  const badgeEat = document.getElementById('badge-eat-in');
  const badgeTake = document.getElementById('badge-takeout');
  const titleInst = document.getElementById('modal-title-instruction');
  const eatContainer = document.getElementById('eat-in-table-container');
  const takeContainer = document.getElementById('takeout-container');

  if (type === 'EAT_IN') {
    if (btnEat) {
      btnEat.className = "flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl font-heading font-bold text-base transition-all duration-150 bg-white text-emerald-700 shadow-sm border border-slate-800 ring-1 ring-slate-800 cursor-pointer";
    }
    if (badgeEat) badgeEat.style.display = 'inline-block';
    if (btnTakeaway) {
      btnTakeaway.className = "flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl font-heading font-semibold text-slate-600 hover:text-slate-800 transition-all duration-150 bg-slate-100/60 border border-slate-300 cursor-pointer";
    }
    if (badgeTake) badgeTake.style.display = 'none';

    if (eatContainer) eatContainer.style.display = 'block';
    if (takeContainer) takeContainer.style.display = 'none';
    if (titleInst) titleInst.textContent = "¿Cuál es tu número de localizador o mesa?";
  } else {
    if (btnTakeaway) {
      btnTakeaway.className = "flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl font-heading font-bold text-base transition-all duration-150 bg-white text-emerald-700 shadow-sm border border-slate-800 ring-1 ring-slate-800 cursor-pointer";
    }
    if (badgeTake) badgeTake.style.display = 'inline-block';
    if (btnEat) {
      btnEat.className = "flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl font-heading font-semibold text-slate-600 hover:text-slate-800 transition-all duration-150 bg-slate-100/60 border border-slate-300 cursor-pointer";
    }
    if (badgeEat) badgeEat.style.display = 'none';

    if (eatContainer) eatContainer.style.display = 'none';
    if (takeContainer) takeContainer.style.display = 'block';
    if (titleInst) titleInst.textContent = "Pedido Para Llevar";
  }

  updateTableBanner();
}

function renderTableGrid() {
  const gridContainer = document.getElementById('number-grid');
  if (!gridContainer) return;

  // Solo mostramos el primer grupo de mesas (Main / Salón Principal)
  let tablesList = [];
  if (state.allTables && state.allTables.length > 0) {
    // Filtrar exclusivamente el grupo 1 / Main Dining Room
    const mainTables = state.allTables.filter(t => t.groupId === 1 || (t.groupName && t.groupName.toLowerCase().includes('main')));
    tablesList = (mainTables.length > 0 ? mainTables : state.allTables).slice().sort((a, b) => {
      const numA = parseInt(a.name);
      const numB = parseInt(b.name);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.name).localeCompare(String(b.name));
    });
  } else {
    for (let i = 1; i <= 27; i++) {
      tablesList.push({ id: i, name: String(i) });
    }
  }

  // Si no hay mesa seleccionada, por defecto sugerimos la 16 o la primera
  if (!state.selectedTable && !state.standNumber) {
    const defaultT = tablesList.find(t => t.name === '16') || tablesList[0];
    if (defaultT) {
      state.selectedTable = defaultT;
      state.standNumber = String(defaultT.name);
    }
  }

  gridContainer.innerHTML = tablesList.map(t => {
    const isSelected = (state.selectedTable && (state.selectedTable.id === t.id || state.selectedTable.name === String(t.name))) ||
      (state.standNumber === String(t.name));

    if (isSelected) {
      return `
        <button class="kiosk-num-btn is-active touch-press h-12 sm:h-14 rounded-xl font-heading font-extrabold text-base sm:text-lg border transition-all flex items-center justify-center bg-brand-500 text-white border-brand-600 shadow-md ring-4 ring-brand-100 cursor-pointer" type="button" onclick="selectTable(${t.id || t.name}, '${t.name}')">
          <span class="relative">
            ${t.name}
            <span class="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-amber-300"></span>
          </span>
        </button>
      `;
    }

    return `
      <button class="kiosk-num-btn touch-press h-12 sm:h-14 rounded-xl font-heading font-extrabold text-base sm:text-lg border transition-all flex items-center justify-center bg-white text-slate-700 border-slate-200/80 shadow-xs hover:border-brand-400 hover:bg-emerald-50/30 cursor-pointer" type="button" onclick="selectTable(${t.id || t.name}, '${t.name}')">
        ${t.name}
      </button>
    `;
  }).join('');

  updateTableBanner();
}



function filterTableGroup(groupName) {
  sfx.playTap();
  state.selectedTableGroup = groupName;
  renderTableGrid();
}

function selectTable(tableId, tableName) {
  sfx.playTap();
  state.selectedTable = { id: tableId, name: String(tableName) };
  state.standNumber = String(tableName);
  renderTableGrid();
}

function selectNoNumber() {
  sfx.playTap();
  state.selectedTable = null;
  state.standNumber = null;

  document.querySelectorAll('.kiosk-num-btn').forEach(btn => {
    btn.classList.remove('is-active', 'bg-brand-500', 'text-white', 'border-brand-600', 'ring-4', 'ring-brand-100');
    btn.classList.add('bg-white', 'text-slate-700', 'border-slate-200/80');
  });

  const chipText = document.getElementById('chip-type-text');
  const chipIcon = document.getElementById('chip-type-icon');
  if (chipText) chipText.textContent = typeof t === 'function' ? t('chip_no_pager') : 'Llamar por Ticket (Sin localizador)';
  if (chipIcon) chipIcon.textContent = '🎫';
}

function updateTableBanner() {
  const chipText = document.getElementById('chip-type-text');
  const chipIcon = document.getElementById('chip-type-icon');

  if (state.checkoutType === 'EAT_IN') {
    const tName = state.selectedTable ? state.selectedTable.name : (state.standNumber || '14');
    if (chipText) chipText.textContent = typeof t === 'function' ? t('chip_table_prefix', { n: tName }) : `Mesa #${tName}`;
    if (chipIcon) chipIcon.textContent = '🍽️';
  } else {
    if (chipText) chipText.textContent = typeof t === 'function' ? t('chip_takeaway') : 'Para Llevar (Retiro por turno)';
    if (chipIcon) chipIcon.textContent = '🛍️';
  }
}

function goToStep(step) {
  sfx.playTap();
  state.checkoutStep = step;

  const step1El = document.getElementById('checkout-step-1');
  const step2El = document.getElementById('checkout-step-2');
  const dot1 = document.getElementById('step-dot-1');
  const dot2 = document.getElementById('step-dot-2');
  const dot3 = document.getElementById('step-dot-3');
  const stepLabel = document.getElementById('modal-step-label');
  const backText = document.getElementById('btn-back-text');
  const submitLabel = document.getElementById('btn-submit-label');
  const submitPrice = document.getElementById('btn-submit-price');

  const total = state.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  if (submitPrice) submitPrice.textContent = formatCOP(total);

  if (step === 1) {
    if (step1El) step1El.style.display = 'block';
    if (step2El) step2El.style.display = 'none';
    if (dot1) dot1.className = 'w-8 h-1.5 rounded-full bg-brand-600 transition-all';
    if (dot2) dot2.className = 'w-8 h-1.5 rounded-full bg-slate-200 transition-all';
    if (dot3) dot3.className = 'w-8 h-1.5 rounded-full bg-slate-200 transition-all';
    if (stepLabel) stepLabel.textContent = typeof t === 'function' ? t('modal_step1_label') : 'Paso 1: Localizador o Mesa';
    if (backText) backText.textContent = typeof t === 'function' ? t('btn_back_menu') : 'Volver al Menú';
    if (submitLabel) submitLabel.textContent = typeof t === 'function' ? t('btn_continue_pay') : 'Continuar al Pago';
    renderTableGrid();
  } else if (step === 2) {
    if (state.checkoutType === 'EAT_IN' && !state.selectedTable && state.standNumber) {
      state.selectedTable = { id: parseInt(state.standNumber) || 14, name: state.standNumber };
    }
    updateTableBanner();

    if (step1El) step1El.style.display = 'none';
    if (step2El) step2El.style.display = 'block';
    if (dot1) dot1.className = 'w-8 h-1.5 rounded-full bg-brand-600 transition-all';
    if (dot2) dot2.className = 'w-8 h-1.5 rounded-full bg-brand-600 transition-all';
    if (dot3) dot3.className = 'w-8 h-1.5 rounded-full bg-slate-200 transition-all';
    if (stepLabel) stepLabel.textContent = typeof t === 'function' ? t('modal_step2_label') : 'Paso 2: Método de Pago y Confirmación';
    if (backText) backText.textContent = typeof t === 'function' ? t('btn_back_step1') : 'Volver a Localizador';
    if (submitLabel) {
      if (state.paymentMethod === 'WOMPI_QR') {
        submitLabel.textContent = typeof t === 'function' ? t('btn_simulate_wompi') : 'Simular Pago Exitoso Wompi';
      } else if (state.paymentMethod === 'CASH') {
        submitLabel.textContent = typeof t === 'function' ? t('btn_cash_submit') : 'Cobrar en Efectivo y Crear Orden';
      } else {
        submitLabel.textContent = typeof t === 'function' ? t('btn_confirm_order') : 'Confirmar Pedido';
      }
    }
  }
}

function handleModalBack() {
  if (state.checkoutStep === 2) {
    goToStep(1);
  } else {
    closeCheckout();
  }
}

function handleModalSubmit() {
  if (state.checkoutStep === 1) {
    goToStep(2);
  } else {
    confirmOrder();
  }
}

function cancelCurrentOrder() {
  if (state.cart.length === 0) return;
  sfx.playTap();
  state.cart = [];
  renderCart();
}

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const frontDeskList = document.getElementById('frontdesk-cart-items');
  const countEl = document.getElementById('cart-items-count');
  const fdCountEl = document.getElementById('frontdesk-items-count');
  const totalEl = document.getElementById('cart-total-amount');
  const fdTotalEl = document.getElementById('frontdesk-total-amount');
  const checkoutBtn = document.getElementById('cart-checkout-btn');

  const total = state.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const count = state.cart.reduce((acc, i) => acc + i.quantity, 0);

  if (countEl) countEl.textContent = typeof t === 'function' ? t('cart_items_count', { n: count }) : `${count} ítems`;
  if (fdCountEl) fdCountEl.textContent = typeof t === 'function' ? t('cart_items_count', { n: count }) : `${count} ítems`;
  if (totalEl) totalEl.textContent = formatCOP(total);
  if (fdTotalEl) fdTotalEl.textContent = formatCOP(total);
  if (checkoutBtn) checkoutBtn.disabled = state.cart.length === 0;

  const emptyTitle = typeof t === 'function' ? t('cart_empty_title') : 'Tu orden está vacía';
  const emptyDesc = typeof t === 'function' ? t('cart_empty_desc') : 'Selecciona productos a la izquierda para empezar.';
  const unitText = typeof t === 'function' ? t('cart_unit') : 'c/u';

  const emptyHtml = `
    <div class="cart-empty">
      <div class="cart-empty-icon">🥙</div>
      <p><strong>${emptyTitle}</strong><br>${emptyDesc}</p>
    </div>
  `;

  if (state.cart.length === 0) {
    if (list) list.innerHTML = emptyHtml;
    if (frontDeskList) frontDeskList.innerHTML = emptyHtml;
    return;
  }

  const itemsHtml = state.cart.map(item => {
    const itemKey = item.cartItemId || item.id;
    const modsHtml = (item.modifiers && item.modifiers.length > 0)
      ? `<div style="font-size:0.75rem; color:#b45309; font-weight:700; margin-top:2px;">+ ${item.modifiers.map(m => m.name).join(', ')}</div>`
      : '';
    const noteHtml = item.notes
      ? `<div style="font-size:0.72rem; color:#64748b; font-style:italic; margin-top:2px;">📝 ${item.notes}</div>`
      : '';
    return `
    <div class="cart-item" data-item-id="${itemKey}">
      <div class="cart-item-header">
        <div style="flex:1;">
          <div class="cart-item-name">${item.name}</div>
          ${modsHtml}
          ${noteHtml}
        </div>
        <div class="cart-item-price">${formatCOP(item.price * item.quantity)}</div>
      </div>
      <div class="cart-item-footer">
        <div class="cart-item-unit">${formatCOP(item.price)} ${unitText}</div>
        <div class="cart-qty-stepper">
          <button class="qty-btn" onclick="updateCartQty('${itemKey}', -1)">−</button>
          <span class="qty-number">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty('${itemKey}', 1)">+</button>
        </div>
      </div>
    </div>
  `;
  }).join('');

  if (list) list.innerHTML = itemsHtml;
  if (frontDeskList) frontDeskList.innerHTML = itemsHtml;

  updateProductBadges();
}

function updateProductBadges() {
  document.querySelectorAll('.product-card').forEach(card => {
    const onclickAttr = card.getAttribute('onclick');
    if (!onclickAttr) return;
    const match = onclickAttr.match(/addToCart\((\d+)\)/);
    if (!match) return;
    const itemId = parseInt(match[1]);
    const qty = state.cart
      .filter(c => c.id === itemId)
      .reduce((sum, c) => sum + (c.quantity || 1), 0);

    let badge = card.querySelector('.product-badge-qty');
    if (qty > 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'product-badge-qty';
        card.appendChild(badge);
      }
      badge.textContent = qty;
    } else if (badge) {
      badge.remove();
    }
  });
}

// CHECKOUT MODAL & WOMPI QR
function openCheckout(isFrontDesk = false) {
  sfx.playTap();
  const modal = document.getElementById('checkout-modal');
  const total = state.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const count = state.cart.reduce((acc, i) => acc + i.quantity, 0);

  const sumItemsEl = document.getElementById('modal-summary-items');
  const sumTotalEl = document.getElementById('modal-summary-total');
  const submitPriceEl = document.getElementById('btn-submit-price');
  const modalTotalText = document.getElementById('modal-total-text');

  if (modalTotalText) modalTotalText.textContent = formatCOP(total);
  if (sumItemsEl) sumItemsEl.textContent = `${count} ítems`;
  if (sumTotalEl) sumTotalEl.textContent = formatCOP(total);
  if (submitPriceEl) submitPriceEl.textContent = formatCOP(total);

  const cashOption = document.getElementById('pay-opt-cash');
  const dataphoneOption = document.getElementById('pay-opt-dataphone');
  if (isFrontDesk) {
    if (cashOption) cashOption.style.display = 'flex';
    if (dataphoneOption) dataphoneOption.style.display = 'flex';
    selectPaymentMethod('CASH');
  } else {
    if (cashOption) cashOption.style.display = 'none';
    if (dataphoneOption) dataphoneOption.style.display = 'none';
    selectPaymentMethod('WOMPI_QR');
  }

  setOrderType(state.checkoutType || 'EAT_IN');
  fetchTables();
  goToStep(1);
  modal.classList.add('active');
}

function closeCheckout() {
  sfx.playTap();
  document.getElementById('checkout-modal').classList.remove('active');
}

function selectPaymentMethod(method) {
  sfx.playTap();
  state.paymentMethod = method;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`pay-opt-${method.toLowerCase().replace('_', '-')}`);
  if (btn) btn.classList.add('active');

  const qrBox = document.getElementById('qr-payment-box');
  const cashBox = document.getElementById('cash-payment-box');
  const confirmBtn = document.getElementById('btn-submit') || document.getElementById('confirm-order-btn');
  const submitLabel = document.getElementById('btn-submit-label');

  const setBtnText = (txt) => {
    if (submitLabel) submitLabel.textContent = txt;
    if (confirmBtn && !submitLabel) confirmBtn.textContent = txt;
  };

  if (method === 'WOMPI_QR') {
    if (qrBox) qrBox.style.display = 'block';
    if (cashBox) cashBox.style.display = 'none';
    setBtnText(typeof t === 'function' ? t('btn_simulate_wompi') : 'Simular Pago Exitoso Wompi');
    generateQR();
  } else if (method === 'CASH') {
    if (qrBox) qrBox.style.display = 'none';
    if (cashBox) cashBox.style.display = 'block';
    setBtnText(typeof t === 'function' ? t('btn_cash_submit') : 'Cobrar en Efectivo y Crear Orden');
    calcCashChange();
  } else {
    if (qrBox) qrBox.style.display = 'none';
    if (cashBox) cashBox.style.display = 'none';
    setBtnText(typeof t === 'function' ? t('btn_dataphone_submit') : 'Confirmar Pago con Datáfono');
  }
}

async function generateQR() {
  const qrImg = document.getElementById('wompi-qr-img');
  const amountEl = document.getElementById('wompi-amount-display');
  const total = state.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);

  if (amountEl) {
    amountEl.textContent = `${formatCOP(total)} COP`;
  }

  try {
    const res = await fetch('/api/payments/wompi/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total })
    });
    const json = await res.json();
    if (json.success && json.data) {
      state.currentWompiIntent = json.data;
      const checkoutUrl = json.data.checkoutUrl;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkoutUrl)}`;
      if (qrImg) qrImg.src = qrApiUrl;

      // Escuchar confirmación en tiempo real si el webhook emite el pago
      if (socket && json.data.reference) {
        socket.off(`payment:${json.data.reference}`);
        socket.on(`payment:${json.data.reference}`, (tx) => {
          console.log('[Wompi Socket Payment Approved]:', tx);
          if (tx && (tx.status === 'APPROVED' || tx.status === 'SUCCESS')) {
            confirmOrder();
          }
        });
      }
      return;
    }
  } catch (err) {
    console.warn('[Wompi Intent API fallback]:', err.message);
  }

  // Fallback directo a Wompi Checkout con amount-in-cents
  const amountCOP = Math.round(total * 1000);
  const amountInCents = amountCOP * 100;
  const ref = `SP-${Date.now()}`;
  const checkoutUrl = `https://checkout.wompi.co/p/?currency=COP&amount-in-cents=${amountInCents}&reference=${ref}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkoutUrl)}`;
  if (qrImg) qrImg.src = qrUrl;
}

function calcCashChange(customVal = null) {
  const total = state.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const input = document.getElementById('cash-tendered-input');
  if (customVal !== null && input) {
    // Si viene de los botones rápidos de billetes (10 = $10.000 COP, 20 = $20.000 COP, etc.)
    input.value = customVal * 1000;
  }
  let rawTendered = parseFloat(input ? input.value : 0) || 0;
  // Si el usuario escribe 50000 o 50: normalizar al valor base de Aldelo (miles)
  let tenderedAldelo = rawTendered >= 100 ? (rawTendered / 1000) : rawTendered;
  const changeAldelo = Math.max(0, tenderedAldelo - total);
  const changeEl = document.getElementById('cash-change-display');
  if (changeEl) {
    changeEl.textContent = formatCOP(changeAldelo);
    changeEl.style.color = (tenderedAldelo >= total && total > 0) ? '#10b981' : '#ef4444';
  }
}

async function confirmOrder() {
  if (state.cart.length === 0) return;
  sfx.playTap();
  const confirmBtn = document.getElementById('btn-submit') || document.getElementById('confirm-order-btn');
  const submitLabel = document.getElementById('btn-submit-label');
  if (confirmBtn) confirmBtn.disabled = true;
  if (submitLabel) {
    submitLabel.textContent = typeof t === 'function' ? t('btn_processing') : 'Procesando en Aldelo...';
  } else if (confirmBtn) {
    confirmBtn.textContent = typeof t === 'function' ? t('btn_processing') : 'Procesando en Aldelo...';
  }

  try {
    const isEatIn = state.checkoutType === 'EAT_IN';
    const chosenTable = (isEatIn && state.selectedTable) ? state.selectedTable : (isEatIn ? { id: 14, name: '14' } : null);
    const payload = {
      employeeId: state.currentCashier || 1,
      items: state.cart,
      paymentMethod: state.paymentMethod || 'WOMPI_QR',
      orderType: isEatIn ? 1 : 2,
      tableId: chosenTable ? chosenTable.id : null,
      notes: isEatIn ? `Mesa ${chosenTable ? chosenTable.name : '14'}` : 'Para Llevar',
      isPaid: true
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.success) {
      closeCheckout();
      showOrderSuccess(json.data.orderNumber, json.data.id || json.data.orderId, chosenTable ? chosenTable.name : null, isEatIn);
      state.cart = [];
      renderCart();
    } else {
      alert('Error creando la orden: ' + json.error);
    }
  } catch (err) {
    console.error('Error confirming order:', err);
    alert('Error al conectar con el servidor.');
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
    const defaultBtnTxt = state.paymentMethod === 'WOMPI_QR'
      ? (typeof t === 'function' ? t('btn_simulate_wompi') : 'Simular Pago Exitoso Wompi')
      : (typeof t === 'function' ? t('btn_confirm_order') : 'Confirmar Pedido');
    if (submitLabel) {
      submitLabel.textContent = defaultBtnTxt;
    } else if (confirmBtn) {
      confirmBtn.textContent = defaultBtnTxt;
    }
  }
}

function showOrderSuccess(orderNumber, orderId, tableName, isEatIn) {
  sfx.playReadyChime();
  const modal = document.getElementById('success-modal');
  const labelEl = document.getElementById('success-badge-label');
  const numEl = document.getElementById('success-order-num');
  const instrEl = document.getElementById('success-stand-instruction');
  const idEl = document.getElementById('success-order-id');

  if (isEatIn && tableName) {
    if (labelEl) labelEl.textContent = typeof t === 'function' ? t('success_table_label') : 'Tu Mesa:';
    if (numEl) numEl.textContent = typeof t === 'function' ? t('kds_table', { n: tableName }) : `Mesa #${tableName}`;
    if (instrEl) instrEl.textContent = typeof t === 'function' ? t('success_table_instr', { n: tableName }) : `Toma asiento en la Mesa #${tableName}. Enseguida te llevamos tu comida.`;
  } else {
    if (labelEl) labelEl.textContent = typeof t === 'function' ? t('success_order_label') : 'Tu Número de Turno:';
    if (numEl) numEl.textContent = `#${orderNumber}`;
    if (instrEl) instrEl.textContent = typeof t === 'function' ? t('success_takeaway_instr') : 'Mira el monitor de turnos cuando tu pedido esté listo para retirar.';
  }

  if (idEl) idEl.textContent = typeof t === 'function' ? t('success_aldelo_id', { id: orderId }) : `Orden Aldelo ID: ${orderId}`;
  modal.classList.add('active');
}

function closeSuccessModal() {
  sfx.playTap();
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.remove('active');
  state.cart = [];
  renderCart();
}

// ==========================================================
// 2. KDS (COMMERCIAL INDUSTRIAL KITCHEN DISPLAY SYSTEM)
// ==========================================================
function toggleKdsFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => { });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
    }
  }
}

function setKdsPage(page) {
  sfx.playTap();
  state.kdsPage = page;
  renderKDS();
}

function setKdsCardScale(scale) {
  sfx.playTap();
  state.kdsScale = scale;
  try {
    localStorage.setItem('kds_scale', scale);
  } catch (e) { }

  const btnCompact = document.getElementById('kds-scale-btn-compact');
  const btnNormal = document.getElementById('kds-scale-btn-normal');
  const btnLarge = document.getElementById('kds-scale-btn-large');
  if (btnCompact) btnCompact.classList.toggle('active', scale === 'compact');
  if (btnNormal) btnNormal.classList.toggle('active', scale === 'normal');
  if (btnLarge) btnLarge.classList.toggle('active', scale === 'large');

  const container = document.getElementById('kds-orders-grid');
  if (container) {
    container.classList.remove('scale-compact', 'scale-normal', 'scale-large');
    container.classList.add(`scale-${scale}`);
  }

  state.kdsPage = 1;
  renderKDS();
}

function toggleKdsDynamicFit() {
  sfx.playTap();
  state.kdsAutoFit = !state.kdsAutoFit;
  try {
    localStorage.setItem('kds_autofit', state.kdsAutoFit ? 'true' : 'false');
  } catch (e) { }

  const btn = document.getElementById('kds-autofit-btn');
  if (btn) btn.classList.toggle('active', state.kdsAutoFit);

  const container = document.getElementById('kds-orders-grid');
  if (container) {
    container.classList.toggle('autofit-active', state.kdsAutoFit);
  }

  state.kdsPage = 1;
  renderKDS();
}

// Resolver estado simplificado de cocina (KDS):
// PREPARING: Toda orden entra de una vez en preparación (TableReady = False)
// READY: La cocina presiona el botón "Listo" (TableReady = True)
// SERVED: Despachada / entregada al cliente (TableReady = False, PackagerAlreadyPrinted = True)
function getOrderKdsStatus(order) {
  if (order.kdsStatus === 'SERVED' || order.packagerPrinted) return 'SERVED';
  if (order.tableReady || order.TableReady || order.kdsStatus === 'READY') return 'READY';
  return 'PREPARING';
}

function setKdsFilter(filter) {
  sfx.playTap();
  state.kdsFilter = (filter === 'READY') ? 'READY' : 'PREP';
  state.kdsPage = 1;

  const tabPrep = document.getElementById('kds-tab-prep');
  const tabReady = document.getElementById('kds-tab-ready');

  if (tabPrep) tabPrep.classList.toggle('active', state.kdsFilter === 'PREP');
  if (tabReady) tabReady.classList.toggle('active', state.kdsFilter === 'READY');

  renderKDS();
}

function formatRegularTime(dateObj) {
  if (!dateObj) return '';
  const d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

function updateKdsClock() {
  const clockEl = document.getElementById('kds-live-clock');
  if (!clockEl) return;
  clockEl.textContent = formatRegularTime(new Date());
}

// Actualizar estado exclusivo de COCINA (KDS):
// PREPARING -> READY (TableReady=True) -> SERVED (Entregada / Despachada)
async function updateKdsState(orderId, nextKdsStatus, itemChecks = null) {
  sfx.playTap();
  try {
    const payload = { kdsStatus: nextKdsStatus };
    if (itemChecks) payload.itemChecks = itemChecks;

    const res = await fetch(`/api/orders/${orderId}/kds-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      const ord = state.activeOrders.find(o => o.id === orderId);
      if (ord) {
        ord.kdsStatus = nextKdsStatus;
        if (nextKdsStatus === 'READY') {
          ord.tableReady = true;
          ord.packagerPrinted = false;
          sfx.playReadyChime();
        } else if (nextKdsStatus === 'SERVED') {
          ord.tableReady = false;
          ord.packagerPrinted = true;
          sfx.playSuccess();
        } else {
          ord.tableReady = false;
          ord.packagerPrinted = false;
        }
        if (itemChecks) {
          if (!ord.kdsItemChecks) ord.kdsItemChecks = {};
          Object.assign(ord.kdsItemChecks, itemChecks);
        }
      }
      renderKDS();
      renderTurns();
    }
  } catch (err) {
    console.error('[KDS] Error updating kitchen state:', err);
  }
}

async function toggleKdsItemCheck(orderId, itemId, event) {
  if (event) event.stopPropagation();
  sfx.playTap();
  const key = `${orderId}_${itemId}`;
  const nextVal = !state.kdsItemChecks[key];
  state.kdsItemChecks[key] = nextVal;

  const ord = state.activeOrders.find(o => o.id === orderId);
  if (ord) {
    if (!ord.kdsItemChecks) ord.kdsItemChecks = {};
    ord.kdsItemChecks[key] = nextVal;
  }

  renderKDS();
  renderTurns();

  try {
    await fetch(`/api/orders/${orderId}/kds-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kdsStatus: ord ? getOrderKdsStatus(ord) : 'PREPARING',
        itemChecks: { [key]: nextVal }
      })
    });
  } catch (e) {
    console.error('[KDS Sync Error]', e);
  }
}

function renderKDS() {
  const container = document.getElementById('kds-orders-grid');
  const paginationEl = document.getElementById('kds-pagination-controls');
  if (!container) return;

  if (!state.kdsPage) state.kdsPage = 1;
  if (!state.kdsScale) state.kdsScale = localStorage.getItem('kds_scale') || 'normal';

  // Aplicar clases de escala visual al grid
  container.classList.remove('scale-compact', 'scale-normal', 'scale-large');
  container.classList.add(`scale-${state.kdsScale}`);
  container.classList.toggle('autofit-active', !!state.kdsAutoFit);

  // Sincronizar botones de escala y auto-ajuste activos
  const btnCompact = document.getElementById('kds-scale-btn-compact');
  const btnNormal = document.getElementById('kds-scale-btn-normal');
  const btnLarge = document.getElementById('kds-scale-btn-large');
  const btnAutoFit = document.getElementById('kds-autofit-btn');
  if (btnCompact) btnCompact.classList.toggle('active', state.kdsScale === 'compact');
  if (btnNormal) btnNormal.classList.toggle('active', state.kdsScale === 'normal');
  if (btnLarge) btnLarge.classList.toggle('active', state.kdsScale === 'large');
  if (btnAutoFit) btnAutoFit.classList.toggle('active', !!state.kdsAutoFit);

  // Filtrar órdenes válidas (excluir anuladas 3)
  const validOrders = state.activeOrders.filter(o => o.status !== '3');

  // 1. En preparación: pendientes ordenados de más viejos a más nuevos (FIFO cocina)
  const prepOrders = validOrders
    .filter(o => getOrderKdsStatus(o) === 'PREPARING')
    .sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return tA - tB;
    });

  // 2. Listas: SOLO órdenes de las últimas 10 horas (<= 600 min), ordenadas de MÁS NUEVAS a MÁS VIEJAS
  const MAX_READY_MINUTES = 10 * 60; // 600 minutos
  const readyOrders = validOrders
    .filter(o => {
      if (getOrderKdsStatus(o) !== 'READY') return false;
      const elapsed = getElapsedMinutes(o.createdAt);
      return elapsed <= MAX_READY_MINUTES;
    })
    .sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return (tB - tA) || (b.id - a.id);
    });

  // Actualizar contadores
  const prepCountEl = document.getElementById('kds-prep-count');
  const readyCountEl = document.getElementById('kds-ready-count');

  if (prepCountEl) prepCountEl.textContent = prepOrders.length;
  if (readyCountEl) readyCountEl.textContent = readyOrders.length;

  // Seleccionar grupo según pestaña activa
  const ordersToShow = (state.kdsFilter === 'READY') ? readyOrders : prepOrders;

  // Paginación adaptativa según tamaño de tarjeta, resolución y modo dinámico:
  // En modo Auto-Ajuste (Dinámico) las tarjetas son compactas y caben muchas más órdenes.
  const isUltraWide = window.innerWidth >= 1800;
  let pageSize = 8;
  if (state.kdsAutoFit) {
    if (state.kdsScale === 'compact') {
      pageSize = isUltraWide ? 18 : 14;
    } else if (state.kdsScale === 'large') {
      pageSize = isUltraWide ? 12 : 9;
    } else {
      pageSize = isUltraWide ? 15 : 12;
    }
  } else {
    if (state.kdsScale === 'compact') {
      pageSize = isUltraWide ? 12 : 10;
    } else if (state.kdsScale === 'large') {
      pageSize = isUltraWide ? 8 : 6;
    } else {
      pageSize = isUltraWide ? 10 : 8;
    }
  }

  const totalPages = Math.max(1, Math.ceil(ordersToShow.length / pageSize));
  if (state.kdsPage > totalPages) state.kdsPage = 1;

  if (paginationEl) {
    paginationEl.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
      <button class="kds-page-btn ${p === state.kdsPage ? 'active' : ''}" onclick="setKdsPage(${p})">${p}</button>
    `).join('');
  }

  if (ordersToShow.length === 0) {
    const emptyMsg = (state.kdsFilter === 'READY')
      ? '🎉 No hay pedidos listos.'
      : '🎉 No hay pedidos en preparación.';

    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:90px 20px; color:#64748b; font-size:1.25rem; font-weight:700;">
        ${emptyMsg}
      </div>
    `;
    return;
  }

  const pagedOrders = ordersToShow.slice((state.kdsPage - 1) * pageSize, state.kdsPage * pageSize);

  container.innerHTML = pagedOrders.map(order => {
    const elapsedMinutes = getElapsedMinutes(order.createdAt);
    const kdsStatus = getOrderKdsStatus(order);
    const isPaid = order.isPaid || order.status === '2';

    // Formato de hora regular 12h AM/PM (ej: 7:15 PM)
    const orderTimeStr = order.createdAt ? formatRegularTime(order.createdAt) : '';

    let elapsedText = '';
    if (elapsedMinutes < 60) {
      elapsedText = `${elapsedMinutes} min`;
    } else if (elapsedMinutes < 1440) {
      const hrs = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      elapsedText = `${hrs}h ${mins}m`;
    } else {
      elapsedText = `>24h`;
    }

    let urgencyClass = 'urgency-green';
    let statusBadgeHtml = '';
    let actionButtonsHtml = '';

    if (kdsStatus === 'READY') {
      urgencyClass = 'urgency-emerald';
      statusBadgeHtml = `<span class="kds-status-badge badge-ready">🟢 ¡Lista!</span>`;
      actionButtonsHtml = `
        <div style="display:flex; align-items:center; width:100%; gap:8px;">
          <!-- Botón Revertir con icono SVG -->
          <button type="button" aria-label="Revertir pedido" class="btn-kds-revert" onclick="updateKdsState(${order.id}, 'PREPARING')">
            <svg style="width:15px; height:15px; color:#64748b;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 10h10a5 5 0 0 1 5 5v2m-15-7l4-4m-4 4l4 4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"></path>
            </svg>
            <span>Revertir</span>
          </button>
          <!-- Botón Principal: Marcar como Entregada con badge SVG -->
          <button type="button" aria-label="Marcar pedido como entregada" class="btn-kds-served group" onclick="updateKdsState(${order.id}, 'SERVED')">
            <span style="width:20px; height:20px; border-radius:6px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center;">
              <svg style="width:14px; height:14px; color:#ffffff; stroke-width:3;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </span>
            <span style="white-space:nowrap; text-shadow:0 1px 2px rgba(0,0,0,0.15);">Marcar como Entregada</span>
          </button>
        </div>
      `;
    } else {
      // PREPARING (TableReady = False): Botón de alta prominencia para pasar a READY
      urgencyClass = (elapsedMinutes >= 15) ? 'urgency-red' : 'urgency-green';
      statusBadgeHtml = `<span class="kds-status-badge badge-cooking">🍳 En Preparación</span>`;
      actionButtonsHtml = `
        <button type="button" aria-label="Marcar pedido como lista" class="btn-kds-ready group" onclick="updateKdsState(${order.id}, 'READY')">
          <span style="width:20px; height:20px; border-radius:6px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center;">
            <svg style="width:14px; height:14px; color:#ffffff; stroke-width:3;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </span>
          <span style="white-space:nowrap; text-shadow:0 1px 2px rgba(0,0,0,0.15);">Marcar como Lista</span>
        </button>
      `;
    }

    const orderTitle = `#${order.orderNumber} : Mesa ${order.tableId}`;

    return `
      <div class="kds-card ${urgencyClass}">
        <div class="kds-card-header">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="kds-header-title">${orderTitle}</span>
          </div>
          <div class="kds-header-right">
            <span class="kds-elapsed-pill" id="kds-elapsed-${order.id}">⏱️ ${elapsedText}</span>
            ${orderTimeStr ? `<span class="kds-entry-time">${orderTimeStr}</span>` : ''}
          </div>
        </div>

        <div class="kds-card-items">
          ${(order.items || []).map((it, idx) => {
      const checkKey = `${order.id}_${it.id || idx}`;
      const isChecked = !!(order.kdsItemChecks && order.kdsItemChecks[checkKey]) || !!state.kdsItemChecks[checkKey];
      return `
              <div class="kds-item-row ${isChecked ? 'checked' : ''}" onclick="toggleKdsItemCheck(${order.id}, ${it.id || idx}, event)">
                <div class="kds-item-left">
                  <span class="kds-item-text"><strong>${it.quantity} x</strong> ${it.name}</span>
                </div>
                <div class="kds-check-circle">${isChecked ? '✓' : ''}</div>
              </div>
            `;
    }).join('')}
        </div>

        <div class="kds-card-action">
          ${actionButtonsHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Actualizar estado general de la orden en Aldelo POS (1=OpenOrder, 2=SettledOrder, 3=VoidedOrder)
async function updateOrderStatus(orderId, status, tableReady = null) {
  sfx.playTap();
  try {
    const payload = { status };
    if (tableReady !== null) payload.tableReady = tableReady;
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      const ord = state.activeOrders.find(o => o.id === orderId);
      if (ord) {
        ord.status = status;
        if (tableReady !== null) ord.tableReady = tableReady;
        if (status === '2') ord.kdsStatus = 'SERVED';
      }
      renderKDS();
      renderTurns();
    }
  } catch (err) {
    console.error('Error updating order status in Aldelo:', err);
  }
}

// Anular orden según Aldelo POS (3 = VoidedOrder)
async function voidOrder(orderId) {
  if (!confirm(`¿Está seguro de anular la orden #${orderId}? Esta acción marcará la orden como VoidedOrder en Aldelo.`)) {
    return;
  }
  await updateOrderStatus(orderId, '3');
}

// ==========================================================
// 3. MONITOR DE TURNOS (STATUS BOARD DIGITAL SIGNAGE CON PREP_TIME)
// ==========================================================
const turnsState = {
  currentPage: 1,
  pageSize: 8
};

function setTurnsPage(pageNum) {
  turnsState.currentPage = pageNum;
  renderTurns();
}

function renderTurns() {
  const modernContainer = document.getElementById('turns-modern-rows');
  const paginationEl = document.getElementById('turns-pagination');
  const legacyPrepContainer = document.getElementById('turns-prep-list');
  const legacyReadyContainer = document.getElementById('turns-ready-list');

  const validOrders = (state.activeOrders || []).filter(o => o.status !== '3');

  // 1. Listos: READY (TableReady = True) - últimas 10 horas, más recientes primero
  const readyOrders = validOrders.filter(o => {
    return getOrderKdsStatus(o) === 'READY' && getElapsedMinutes(o.createdAt) <= (10 * 60);
  }).sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
    return (tB - tA) || (b.id - a.id);
  });

  // 2. En Preparación: PREPARING (TableReady = False), orden cronológico
  const prepOrders = validOrders.filter(o => {
    return getOrderKdsStatus(o) === 'PREPARING';
  }).sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
    return (tA - tB) || (a.id - b.id);
  });

  // Mantener compatibilidad con contenedores legados
  if (legacyPrepContainer) {
    legacyPrepContainer.innerHTML = prepOrders.slice(0, 16).map(o => `
      <div class="turn-badge prep">#${o.orderNumber}</div>
    `).join('');
  }
  if (legacyReadyContainer) {
    legacyReadyContainer.innerHTML = readyOrders.slice(0, 16).map(o => `
      <div class="turn-badge ready">#${o.orderNumber}</div>
    `).join('');
  }

  if (!modernContainer) return;

  const allBoardOrders = [...readyOrders, ...prepOrders];

  if (allBoardOrders.length === 0) {
    modernContainer.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
        <span style="font-size:3rem;">🎉</span>
        <div class="font-extrabold text-base sm:text-lg mt-2 text-slate-600">No hay órdenes en curso</div>
        <p class="text-xs text-slate-400">Las órdenes aparecerán aquí en tiempo real con su tiempo de preparación</p>
      </div>
    `;
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  // Paginación
  const totalPages = Math.ceil(allBoardOrders.length / turnsState.pageSize);
  if (turnsState.currentPage > totalPages) {
    turnsState.currentPage = 1;
  }

  const startIdx = (turnsState.currentPage - 1) * turnsState.pageSize;
  const pageOrders = allBoardOrders.slice(startIdx, startIdx + turnsState.pageSize);

  modernContainer.innerHTML = pageOrders.map((o, idx) => {
    const isReady = getOrderKdsStatus(o) === 'READY';
    const isOdd = idx % 2 === 0;
    const rowBg = isOdd ? 'bg-white border border-slate-200/80 shadow-xs' : 'bg-slate-50/70 border border-slate-100';

    if (isReady) {
      const locText = o.tableId ? `Mesa ${o.tableId}` : 'Mostrador';
      const locBg = o.tableId ? 'bg-[#F59E0B]' : 'bg-[#E53935]';

      return `
        <article class="grid grid-cols-12 gap-3 sm:gap-4 items-center px-4 py-2 rounded-xl ${rowBg} transition-all">
          <div class="col-span-3 font-black text-slate-800 text-sm sm:text-base flex items-center gap-1.5 truncate">
            <span class="text-lg text-emerald-600 font-black">#${o.orderNumber}</span>
            <span class="text-xs font-bold text-slate-500 uppercase">${o.tableId ? `Mesa ${o.tableId}` : 'Retirar'}</span>
          </div>
          <div class="col-span-6">
            <div class="w-full bg-[#00B074] h-7 sm:h-8 rounded-full flex items-center justify-between px-3.5 text-white font-extrabold text-xs sm:text-sm shadow-sm">
              <span class="tracking-wide">¡Listo para retirar! / It's ready!</span>
              <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#00B074] text-xs font-black pulse-check shadow-xs">✓</span>
            </div>
          </div>
          <div class="col-span-3 flex justify-center">
            <span class="inline-block w-36 sm:w-44 text-center py-1 sm:py-1.5 px-3 rounded-full ${locBg} text-white font-black text-xs sm:text-sm tracking-wider shadow-sm uppercase">
              ${locText}
            </span>
          </div>
        </article>
      `;
    } else {
      const elapsedMinutes = getElapsedMinutes(o.createdAt);
      const maxPrep = o.maxPrepTime || o.prepTime || 10;
      const remainingMin = Math.max(0, maxPrep - elapsedMinutes);
      const progressPercent = Math.min(95, Math.max(12, Math.round((elapsedMinutes / maxPrep) * 100)));

      let statusMsg = '¡Preparando!';
      if (progressPercent < 25) {
        statusMsg = '¡Recibida en Cocina!';
      } else {
        statusMsg = `¡Preparando! (${remainingMin} min restantes)`;
      }

      return `
        <article class="grid grid-cols-12 gap-3 sm:gap-4 items-center px-4 py-2 rounded-xl ${rowBg} transition-all">
          <div class="col-span-3 font-bold text-slate-800 text-sm sm:text-base flex items-center gap-1.5 truncate">
            <span class="text-base font-black text-slate-900">#${o.orderNumber}</span>
            <span class="text-xs font-semibold text-slate-500 truncate">${o.tableId ? `Mesa ${o.tableId}` : 'Mostrador'}</span>
          </div>
          <div class="col-span-6">
            <div class="w-full bg-slate-100 border border-slate-200 h-7 sm:h-8 rounded-full overflow-hidden flex relative shadow-inner">
              <div class="bg-[#00B074] h-full flex items-center px-3.5 text-white font-bold text-xs sm:text-sm tracking-wide transition-all duration-500" style="width: ${progressPercent}%;">
                <span class="truncate whitespace-nowrap">${statusMsg}</span>
              </div>
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">${progressPercent}%</span>
            </div>
          </div>
          <div class="col-span-3 flex justify-center">
            <span class="inline-flex items-center gap-1 py-1 px-3 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 font-bold text-xs sm:text-sm shadow-xs">
              <span class="text-amber-500">⏱️</span> ~${remainingMin} min est.
            </span>
          </div>
        </article>
      `;
    }
  }).join('');

  // Renderizar indicador de paginación
  if (paginationEl) {
    if (totalPages <= 1) {
      paginationEl.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-[#00B074] text-white flex items-center justify-center font-black text-xs shadow-md">1</div>
      `;
    } else {
      paginationEl.innerHTML = Array.from({ length: totalPages }).map((_, i) => {
        const pageNum = i + 1;
        const isActive = pageNum === turnsState.currentPage;
        return `
          <button onclick="setTurnsPage(${pageNum})" class="w-7 h-7 rounded-full font-black text-xs transition-all shadow-sm ${isActive ? 'bg-[#00B074] text-white shadow-md scale-110' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}">
            ${pageNum}
          </button>
        `;
      }).join('');
    }
  }
}

// Auto-rotar páginas del monitor de turnos SOLO si hay más de 1 página (evita parpadeos)
if (!window._turnsAutoRotateInterval) {
  window._turnsAutoRotateInterval = setInterval(() => {
    const validOrders = (state.activeOrders || []).filter(o => o.status !== '3' && getOrderKdsStatus(o) !== 'SERVED');
    const totalPages = Math.ceil(validOrders.length / turnsState.pageSize);
    if (totalPages > 1) {
      turnsState.currentPage = (turnsState.currentPage % totalPages) + 1;
      renderTurns();
    }
  }, 10000);
}

// ==========================================================
// 4. FRONT DESK / CAJA HELPERS
// ==========================================================
function renderCashierSelect() {
  const select = document.getElementById('cashier-dropdown');
  if (!select) return;
  select.innerHTML = state.employees.map(e => `
    <option value="${e.id}" ${e.id === state.currentCashier ? 'selected' : ''}>
      ${e.firstName} ${e.lastName || ''}
    </option>
  `).join('');
  select.addEventListener('change', (ev) => {
    state.currentCashier = parseInt(ev.target.value);
  });
}

function renderFrontDeskProducts() {
  const container = document.getElementById('frontdesk-products');
  const title = document.getElementById('frontdesk-cat-title');
  if (!container) return;
  const currentCat = state.categories.find(c => c.name === state.selectedCategory);
  if (!currentCat) return;
  if (title) title.textContent = `${getCategoryIcon(currentCat.name)} ${currentCat.name}`;

  container.innerHTML = currentCat.items.map(item => {
    const inCart = state.cart.find(c => c.id === item.id);
    const qty = inCart ? inCart.quantity : 0;
    return `
    <div class="product-card" onclick="addToCart(${item.id})">
      ${qty > 0 ? `<div class="product-badge-qty">${qty}</div>` : ''}
      <div class="product-card-img-wrap" style="height:90px;">
        <img src="${getCategoryImageUrl(currentCat.name)}" alt="${item.name}" class="product-card-img">
      </div>
      <div class="product-card-body">
        <div class="product-card-title">${item.name}</div>
      </div>
      <div class="product-card-footer">
        <div class="product-card-price">${formatCOP(item.price)}</div>
        <div class="product-add-pill">+ Cobrar</div>
      </div>
    </div>
  `;
  }).join('');
}

function getElapsedMinutes(dateStr) {
  if (!dateStr) return 0;
  const created = new Date(dateStr);
  const now = new Date();
  const diffMs = now - created;
  return Math.max(0, Math.floor(diffMs / 60000));
}

// Ticker suave de minutos para el KDS: actualiza solo las etiquetas de tiempo sin recrear las tarjetas
function updateKdsElapsedBadges() {
  if (state.activeTab !== 'kds') return;
  (state.activeOrders || []).forEach(order => {
    const el = document.getElementById(`kds-elapsed-${order.id}`);
    if (el) {
      const elapsedMinutes = getElapsedMinutes(order.createdAt);
      let elapsedText = '';
      if (elapsedMinutes < 60) {
        elapsedText = `${elapsedMinutes} min`;
      } else if (elapsedMinutes < 1440) {
        const hrs = Math.floor(elapsedMinutes / 60);
        const mins = elapsedMinutes % 60;
        elapsedText = `${hrs}h ${mins}m`;
      } else {
        elapsedText = `>24h`;
      }
      el.textContent = `⏱️ ${elapsedText}`;
    }
  });
}
setInterval(updateKdsElapsedBadges, 30000);

// INICIALIZACIÓN
window.addEventListener('DOMContentLoaded', () => {
  if (window.i18n) {
    window.i18n.init();
    window.i18n.onChange(() => {
      renderCart();
      renderKioskCategories();
      renderKioskProducts();
      renderKDS();
      updateTableBanner();
      if (state.checkoutStep) {
        goToStep(state.checkoutStep);
      }
    });
  }
  initNavigation();
  fetchMenu();
  fetchEmployees();
  fetchActiveOrders();
  fetchTables();
  updateKdsClock();
  setInterval(updateKdsClock, 1000);
  if (state.kdsScale) {
    const container = document.getElementById('kds-orders-grid');
    if (container) {
      container.classList.remove('scale-compact', 'scale-normal', 'scale-large');
      container.classList.add(`scale-${state.kdsScale}`);
    }
    const btnCompact = document.getElementById('kds-scale-btn-compact');
    const btnNormal = document.getElementById('kds-scale-btn-normal');
    const btnLarge = document.getElementById('kds-scale-btn-large');
    if (btnCompact) btnCompact.classList.toggle('active', state.kdsScale === 'compact');
    if (btnNormal) btnNormal.classList.toggle('active', state.kdsScale === 'normal');
    if (btnLarge) btnLarge.classList.toggle('active', state.kdsScale === 'large');
  }

  const btnAutoFit = document.getElementById('kds-autofit-btn');
  if (btnAutoFit) btnAutoFit.classList.toggle('active', !!state.kdsAutoFit);
  const container = document.getElementById('kds-orders-grid');
  if (container && state.kdsAutoFit) {
    container.classList.add('autofit-active');
  }

  // Listener para reajuste dinámico de grilla al cambiar resolución o modo pantalla completa
  let kdsResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(kdsResizeTimer);
    kdsResizeTimer = setTimeout(() => {
      if (state.activeTab === 'kds') {
        renderKDS();
      }
    }, 150);
  });
});
