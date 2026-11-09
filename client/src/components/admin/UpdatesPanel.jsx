import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyUpdate, checkForUpdates, fetchUpdateStatus, UPDATES_QUERY_KEY } from '../../api/updates';
import { showAlert, showConfirm } from '../../store/useAlertDialogStore';
import './UpdatesPanel.css';

const APPLY_POLL_MS = 10000;

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Nunca';
}

/** Panel de actualizaciones: buscar, ver la versión disponible y aplicarla a petición del gerente. */
export function UpdatesPanel() {
  const queryClient = useQueryClient();
  const [applying, setApplying] = useState(false);
  const { data: status, isLoading } = useQuery({
    queryKey: UPDATES_QUERY_KEY,
    queryFn: fetchUpdateStatus,
    refetchInterval: applying ? APPLY_POLL_MS : false,
    retry: false
  });

  // Mientras se aplica, el servicio se reinicia: las peticiones pueden fallar un rato.
  useEffect(() => {
    if (status && !status.inProgress && applying) setApplying(false);
  }, [status, applying]);

  const check = useMutation({
    mutationFn: checkForUpdates,
    onSuccess: (data) => queryClient.setQueryData(UPDATES_QUERY_KEY, data),
    onError: (err) => showAlert({ variant: 'error', title: 'No se pudo buscar', description: err.message })
  });

  const apply = useMutation({
    mutationFn: applyUpdate,
    onSuccess: () => {
      setApplying(true);
      showAlert({
        variant: 'info',
        title: 'Actualización en curso',
        description: 'El sistema se reiniciará en unos minutos. Las pantallas se reconectarán solas.'
      });
    },
    onError: (err) => showAlert({ variant: 'error', title: 'No se pudo actualizar', description: err.message })
  });

  const onApply = async () => {
    const confirmed = await showConfirm({
      variant: 'warning',
      title: `¿Actualizar a la versión ${status.available.version}?`,
      description: 'Se detendrá el servicio un momento. Haz esto cuando no haya pedidos en curso.',
      actionLabel: 'Actualizar ahora'
    });
    if (confirmed) apply.mutate();
  };

  if (isLoading || !status) {
    return <section className="upd-card"><p className="upd-muted">Consultando actualizaciones…</p></section>;
  }

  const busy = applying || status.inProgress;
  const last = status.lastResult;

  return (
    <section className="upd-card" aria-label="Actualizaciones">
      <header className="upd-header">
        <div>
          <h2 className="upd-title">Versión {status.currentVersion}</h2>
          <p className="upd-muted">Canal: {status.channel} · Última búsqueda: {formatDate(status.lastCheckAt)}</p>
        </div>
        <button type="button" className="upd-btn upd-btn--ghost" onClick={() => check.mutate()} disabled={check.isPending || busy}>
          {check.isPending ? 'Buscando…' : 'Buscar actualizaciones'}
        </button>
      </header>

      {!status.canApply && (
        <p className="upd-note">Las actualizaciones se aplican desde el equipo instalado. Aquí solo puedes ver el estado.</p>
      )}

      {status.available && !busy && (
        <div className="upd-available">
          <p className="upd-available-title">Hay una versión nueva: {status.available.version}</p>
          <p className="upd-muted">Publicada: {formatDate(status.available.releasedAt)}</p>
          <button type="button" className="upd-btn upd-btn--primary" onClick={onApply} disabled={!status.canApply || apply.isPending}>
            Actualizar ahora
          </button>
        </div>
      )}

      {busy && (
        <p className="upd-progress" role="status">Aplicando la actualización… si la pantalla se desconecta un momento, es normal.</p>
      )}

      {!status.available && !busy && !status.lastError && <p className="upd-muted">Estás usando la versión más reciente.</p>}

      {status.lastError && !busy && (
        <p className="upd-error" role="alert">No se pudo consultar: {status.lastError.message}</p>
      )}

      {last && !busy && (
        <p className={`upd-result ${last.status === 'applied' ? 'is-ok' : 'is-warn'}`}>
          {last.status === 'applied' && `Se actualizó a la versión ${last.version} el ${formatDate(last.at)}.`}
          {last.status === 'rolled_back' && `La versión ${last.version} no pudo iniciar y se restauró la anterior. Motivo: ${last.error}`}
          {last.status === 'failed' && `La actualización no se aplicó: ${last.error}`}
        </p>
      )}

    </section>
  );
}

export default UpdatesPanel;
