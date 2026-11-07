import { useId } from 'react';

/**
 * Logotipo oficial vectorial de UPAY SOLUTIONS S.A.S.
 * Con gradiente lineal integrado y renderizado SVG de alta definición.
 */
export function UpayLogo({ className = '', size = 28, alt = 'UPAY SOLUTIONS Logo' }) {
  const gradientId = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 1254 1200"
      className={className}
      aria-label={alt}
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="80%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0da8c9" />
          <stop offset="45%" stopColor="#11b8ac" />
          <stop offset="74%" stopColor="#4dc76b" />
          <stop offset="100%" stopColor="#96d14a" />
        </linearGradient>
      </defs>
      <path
        d="M 144 325
          A 88 88 0 0 1 320 325
          L 320 680
          A 298 298 0 0 0 916 680
          L 916 466
          A 88 88 0 0 1 1092 466
          L 1092 677
          A 474 474 0 0 1 144 677
          Z
          M 398 446
          A 77.5 77.5 0 0 1 553 446
          L 553 685
          A 57 57 0 0 0 667 687
          L 667 467
          C 672.5 346 806 401 798 250
          A 101 101 0 1 1 890.5 329
          C 857 329 818 358 821 398
          L 825 676
          A 213.5 213.5 0 0 1 398 676
          Z"
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default UpayLogo;

