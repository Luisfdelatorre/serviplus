import { useState, useEffect } from 'react';

/**
 * ============================================================================
 * HOOK DE PROTECCIÓN DE PANTALLA: PIXEL SHIFT (DESPLAZAMIENTO DE PÍXELES)
 * ============================================================================
 * Previene la fatiga de diodos LED y retención de imagen en televisores y
 * monitores de cocina comerciales o pantallas de turnos.
 * 
 * Desplaza suavemente el contenedor completo entre -2px y +2px en una órbita
 * circular cada 90 segundos con una transición lenta de 2.5 segundos.
 * 
 * Es 100% imperceptible para el ojo humano a la distancia de trabajo, pero
 * garantiza que las líneas fijas, textos del reloj y bordes cambien
 * constantemente de diodos LED físicos en el panel.
 * ============================================================================
 */

const PIXEL_ORBIT = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 2 },
  { x: -1, y: 1 },
  { x: -2, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -2 },
  { x: 1, y: -1 }
];

export function usePixelShift(intervalMs = 90000) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % PIXEL_ORBIT.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  const offset = PIXEL_ORBIT[step];

  return {
    offset,
    style: {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      transition: 'transform 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
      willChange: 'transform'
    }
  };
}

