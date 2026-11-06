import { useState, useEffect } from 'react';

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
    step,
    offset,
    shiftClass: `pixel-shift-orbit pixel-shift-step-${step}`,
    style: {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      transition: 'transform 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
      willChange: 'transform'
    }
  };
}
