import { useId } from 'react';

/** El símbolo de Kads Studio (by Kalethabh): una K verde lima sobre negro, con el punto de la IA. Igual a public/kads-icono.svg (y sus PNG). */
export function Logo({ tamano = 32, className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--marca-1, #C8FC80)" />
          <stop offset=".55" stopColor="var(--marca-2, #9DF626)" />
          <stop offset="1" stopColor="var(--marca-3, #7AD10E)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#0A0A0A" />
      <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="15.25" fill="none" stroke="var(--acento, #9DF626)" strokeOpacity=".3" strokeWidth="1.5" />
      <path d="M21 14v36M42 15L26.5 32 42 49" fill="none" stroke={`url(#${id}-g)`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50.5" cy="12.5" r="3.4" fill={`url(#${id}-g)`} />
    </svg>
  );
}
