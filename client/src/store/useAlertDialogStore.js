import { create } from 'zustand';

/**
 * Cola global de diálogos de alerta. Reemplaza window.alert / window.confirm
 * con un diálogo propio (ver components/common/AlertDialog.jsx).
 */
let nextId = 1;

export const useAlertDialogStore = create((set, get) => ({
  queue: [],

  push: (dialog) => set((state) => ({ queue: [...state.queue, dialog] })),

  resolveCurrent: (result) => {
    const [current, ...rest] = get().queue;
    if (!current) return;
    set({ queue: rest });
    current.resolve(result);
  },
}));

function openDialog(options, isConfirm) {
  return new Promise((resolve) => {
    useAlertDialogStore.getState().push({
      id: nextId++,
      variant: 'info',
      ...options,
      isConfirm,
      resolve,
    });
  });
}

/**
 * Muestra un diálogo informativo con un solo botón.
 * @param {{ variant?: 'success'|'error'|'warning'|'info', title: string, description?: string, actionLabel?: string }} options
 * @returns {Promise<void>}
 */
export function showAlert(options) {
  return openDialog(options, false).then(() => undefined);
}

/**
 * Muestra un diálogo con Cancelar / Acción. Resuelve true si se confirma.
 * @param {{ variant?: 'success'|'error'|'warning'|'info', title: string, description?: string, actionLabel?: string, cancelLabel?: string }} options
 * @returns {Promise<boolean>}
 */
export function showConfirm(options) {
  return openDialog({ variant: 'warning', ...options }, true);
}
