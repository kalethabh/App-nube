import { useId } from 'react';

/** El símbolo de anuncios-IA (by Kalethabh): un cuadro verde lima con un play y un destello, en negro. */
export function Logo({ tamano = 32, className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-f`} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C8FC80" />
          <stop offset=".55" stopColor="#9DF626" />
          <stop offset="1" stopColor="#86E012" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="16" y1="1" x2="16" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".32" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill={`url(#${id}-f)`} />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill={`url(#${id}-b)`} />
      <rect x="2" y="2" width="28" height="28" rx="8" fill="none" stroke="#0a0a0a" strokeOpacity=".12" />
      <path d="M12.6 10.4c0-1 1.1-1.6 1.9-1.1l8.4 5.3c.8.5.8 1.7 0 2.2l-8.4 5.3c-.8.5-1.9-.1-1.9-1.1z" fill="#0a0a0a" />
      <path d="M23.6 4.6l.75 1.9 1.9.75-1.9.75-.75 1.9-.75-1.9-1.9-.75 1.9-.75z" fill="#0a0a0a" />
    </svg>
  );
}
