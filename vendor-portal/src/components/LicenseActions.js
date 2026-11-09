'use client';

import { useState } from 'react';
import { ConfirmButton, KeyReveal, useMutation } from './ui';

export function LicenseStatusActions({ license }) {
  const revoke = useMutation();
  const reinstate = useMutation();
  const rotate = useMutation();
  const [licenseKey, setLicenseKey] = useState(null);

  return (
    <>
      <ConfirmButton
        label="Regenerar clave"
        message="La clave actual dejará de servir para nuevas activaciones. Los equipos ya activados siguen funcionando."
        confirmLabel="Regenerar"
        busy={rotate.busy} error={rotate.error}
        onConfirm={async () => {
          const data = await rotate.run('POST', `/api/vendor/licenses/${license.id}/rotate-key`);
          if (data) setLicenseKey(data.licenseKey);
          return data;
        }}
      />
      {license.status === 'REVOKED' ? (
        <ConfirmButton
          label="Reactivar licencia" variant="primary" confirmLabel="Reactivar"
          message="Los equipos activos volverán a recibir estado activo en el próximo heartbeat."
          busy={reinstate.busy} error={reinstate.error}
          onConfirm={() => reinstate.run('PATCH', `/api/vendor/licenses/${license.id}`, { action: 'reinstate' })}
        />
      ) : (
        <ConfirmButton
          label="Revocar licencia" variant="danger" confirmLabel="Revocar" reason reasonRequired
          message="Los equipos lo sabrán en el próximo heartbeat: verán un aviso, podrán cerrar pedidos y turno, y tras 72 h se bloquean pedidos nuevos. No se borran datos."
          busy={revoke.busy} error={revoke.error}
          onConfirm={({ reason }) => revoke.run('PATCH', `/api/vendor/licenses/${license.id}`, { action: 'revoke', reason })}
        />
      )}
      <KeyReveal licenseKey={licenseKey} onClose={() => setLicenseKey(null)} />
    </>
  );
}

export function SeatActions({ seat }) {
  const release = useMutation();
  const revoke = useMutation();
  const clear = useMutation();
  return (
    <span className="dash-actions">
      {seat.status === 'ACTIVE' && (
        <ConfirmButton
          label="Liberar puesto" small confirmLabel="Liberar" reason
          title="Liberar puesto"
          message="Libera el cupo para activar la licencia en un PC nuevo. Este equipo pasará a estado liberado en su próximo heartbeat."
          busy={release.busy} error={release.error}
          onConfirm={({ reason }) => release.run('PATCH', `/api/vendor/seats/${seat.id}`, { action: 'release', reason })}
        />
      )}
      {seat.status !== 'REVOKED' && (
        <ConfirmButton
          label="Revocar" small variant="danger" confirmLabel="Revocar equipo" reason reasonRequired
          title="Revocar equipo"
          message="Este equipo no podrá volver a activarse con esta licencia."
          busy={revoke.busy} error={revoke.error}
          onConfirm={({ reason }) => revoke.run('PATCH', `/api/vendor/seats/${seat.id}`, { action: 'revoke', reason })}
        />
      )}
      {seat.duplicateFlag && seat.status === 'ACTIVE' && (
        <ConfirmButton
          label="Quitar marca" small confirmLabel="Quitar marca"
          title="Quitar marca de duplicado"
          message="Úsalo después de revisar el caso con el restaurante. La copia detectada sigue revocada."
          busy={clear.busy} error={clear.error}
          onConfirm={() => clear.run('PATCH', `/api/vendor/seats/${seat.id}`, { action: 'clear_flag' })}
        />
      )}
    </span>
  );
}

export function EscrowActions({ licenseId, canAuthorize, openGrant }) {
  const authorize = useMutation();
  const cancel = useMutation();
  return (
    <span className="dash-actions">
      {openGrant ? (
        <ConfirmButton
          label="Cancelar autorización" variant="danger" confirmLabel="Cancelar autorización"
          message="El equipo ya no podrá recuperar la clave con esta autorización."
          busy={cancel.busy} error={cancel.error}
          onConfirm={() => cancel.run('DELETE', `/api/vendor/escrow-grants/${openGrant.id}`)}
        />
      ) : (
        <ConfirmButton
          label="Autorizar restauración" variant="primary" confirmLabel="Autorizar 24 h"
          disabled={!canAuthorize} reason reasonRequired password
          title="Autorizar recuperación de clave"
          message="Abre una ventana de 24 h para UNA recuperación de la clave custodiada, solo desde el equipo activo de esta licencia. Úsalo durante una restauración (liberar puesto → activar PC nuevo → recuperar clave)."
          busy={authorize.busy} error={authorize.error}
          onConfirm={({ reason, password }) => authorize.run('POST', `/api/vendor/licenses/${licenseId}/escrow-grants`, { reason, password })}
        />
      )}
    </span>
  );
}
