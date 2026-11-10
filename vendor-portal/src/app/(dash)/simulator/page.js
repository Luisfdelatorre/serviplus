import { notFound } from 'next/navigation';
import { isDevTools, requirePageOperator } from '@/lib/pageAuth';
import { SimulatorPanel } from './SimulatorPanel';

// Herramienta solo de desarrollo: imita una instalación llamando a la API pública de licencias.
export default async function SimulatorPage() {
  if (!isDevTools) notFound();
  await requirePageOperator();
  return (
    <>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Simulador de app</h1>
          <p className="dash-page-subtitle">
            Imita una instalación de ServiPlus contra <span className="dash-mono">/api/license/*</span>. No disponible en producción.
          </p>
        </div>
      </div>
      <SimulatorPanel />
    </>
  );
}
