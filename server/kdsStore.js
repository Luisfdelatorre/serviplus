const fs = require('fs');
const path = require('path');

const KDS_FILE = path.join(__dirname, '..', 'kds_state.dat');
const LEGACY_KDS_FILE = path.join(__dirname, '..', 'kds_state.json');

// Estados simplificados de cocina (KDS):
// PREPARING: Toda orden entra directamente en preparación (TableReady = False)
// READY: La cocina presiona el botón "Listo" (TableReady = True)
// SERVED: La orden fue despachada / entregada
const KDS_STATUSES = {
  WAITING_PAYMENT: 'WAITING_PAYMENT',
  PREPARING: 'PREPARING',
  PENDING: 'PREPARING',
  COOKING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED'
};

let memoryStore = {};

// Cargar estado inicial desde archivo
try {
  if (fs.existsSync(KDS_FILE)) {
    const raw = fs.readFileSync(KDS_FILE, 'utf8');
    memoryStore = JSON.parse(raw);
  } else if (fs.existsSync(LEGACY_KDS_FILE)) {
    const raw = fs.readFileSync(LEGACY_KDS_FILE, 'utf8');
    memoryStore = JSON.parse(raw);
  }
} catch (e) {
  console.error('[KDS Store] Error loading kds_state, initializing empty:', e.message);
  memoryStore = {};
}

function persist() {
  try {
    fs.writeFileSync(KDS_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (e) {
    console.error('[KDS Store] Error saving kds_state.json:', e.message);
  }
}

const kdsStore = {
  KDS_STATUSES,

  getKdsState(orderId, fallbackTableReady = false, fallbackPackagerPrinted = false) {
    const key = String(orderId);
    if (memoryStore[key]) {
      return memoryStore[key];
    }
    // Si no está en memoria, deducir según PackagerAlreadyPrinted o TableReady de Aldelo
    let initialStatus = KDS_STATUSES.PREPARING;
    if (fallbackPackagerPrinted) {
      initialStatus = KDS_STATUSES.SERVED;
    } else if (fallbackTableReady) {
      initialStatus = KDS_STATUSES.READY;
    }

    return {
      kdsStatus: initialStatus,
      itemChecks: {},
      updatedAt: new Date().toISOString()
    };
  },

  setKdsState(orderId, { kdsStatus, itemChecks = null }) {
    const key = String(orderId);
    const current = memoryStore[key] || {
      kdsStatus: KDS_STATUSES.PREPARING,
      itemChecks: {},
      createdAt: new Date().toISOString()
    };

    if (kdsStatus && KDS_STATUSES[kdsStatus]) {
      current.kdsStatus = kdsStatus;
    }

    if (itemChecks !== null && typeof itemChecks === 'object') {
      current.itemChecks = Object.assign({}, current.itemChecks, itemChecks);
    }

    current.updatedAt = new Date().toISOString();
    memoryStore[key] = current;
    persist();

    return current;
  },

  getAllKdsStates() {
    return memoryStore;
  }
};

module.exports = kdsStore;
