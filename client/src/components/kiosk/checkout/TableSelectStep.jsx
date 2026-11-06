import React from 'react';

export function TableSelectStep({
  tables = [],
  tableId,
  tableGroup,
  onSelectTable,
  onChangeService,
  onNext
}) {
  const distinctGroups = Array.from(new Set(tables.map((t) => t.groupName || 'Main Dining Room'))).filter(Boolean);
  const activeGroup = tableGroup || distinctGroups[0] || 'Main Dining Room';
  const filteredTables = distinctGroups.length > 1
    ? tables.filter((t) => (t.groupName || 'Main Dining Room') === activeGroup)
    : tables;

  const sortedTables = [...filteredTables].sort((a, b) => {
    const numA = parseInt(a.name || a.id, 10);
    const numB = parseInt(b.name || b.id, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a.name || a.id).localeCompare(String(b.name || b.id));
  });

  return (
    <div className="checkout-step-page animate-step-fade">
      {/* Header de la Página de Mesas */}
      <div className="checkout-section-header">
        <div>
          <h2 className="checkout-title-h2">¿En qué mesa te ubicarás?</h2>
          <p className="checkout-subtitle-p">
            Toca el número de tu mesa para que el personal te lleve la orden directamente
          </p>
        </div>

        {tableId ? (
          <span className="checkout-table-selected-badge">
            ✓ Mesa #{tableId} Seleccionada
          </span>
        ) : (
          <span className="checkout-table-empty-badge">
            ⚠️ Selecciona tu mesa para continuar
          </span>
        )}
      </div>

      {/* Cuadrícula Táctil Espaciosa de las Mesas */}
      <div className="checkout-tables-center-scroll">
        <div className="checkout-tables-grid">
          {sortedTables.map((t) => {
            const tableNum = parseInt(t.name || t.id, 10);
            const isSelected = tableId !== null && (tableId === t.id || tableId === tableNum);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTable(tableNum)}
                className={`checkout-table-card ${isSelected ? 'selected' : ''}`}
              >
                <span className="checkout-table-card-sub">MESA</span>
                <span>{t.name || t.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer con Total y Botón Continuar */}
      <div className="checkout-footer-bar">
        <div>
          <div className="checkout-footer-total-lbl">MODALIDAD</div>
          <div className="checkout-footer-mode-value">
            🍽️ Comer en Mesa {tableId ? `#${tableId}` : '(Por elegir)'}
          </div>
        </div>

        <div className="checkout-footer-actions">
          <button
            type="button"
            onClick={onChangeService}
            className="checkout-btn-add-more"
          >
            ← Cambiar a Para Llevar
          </button>

          <button
            type="button"
            disabled={!tableId}
            onClick={onNext}
            className={`checkout-btn-emerald-action ${tableId ? 'pulse-emerald-btn' : ''}`}
          >
            <span>{tableId ? 'Continuar al Pago →' : '⚠️ Selecciona tu Mesa'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

