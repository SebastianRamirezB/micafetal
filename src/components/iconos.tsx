import type { ReactNode } from "react";

type IconoProps = { size?: number; grosor?: number; className?: string };

function Trazo({
  size = 22,
  grosor = 2.2,
  className,
  children,
}: IconoProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        fill="#2f6b3a"
        stroke="#f6f4ef"
        strokeWidth="1.5"
      />
      <ellipse
        cx="20"
        cy="20"
        rx="9"
        ry="12.5"
        transform="rotate(28 20 20)"
        fill="#8b3a1f"
      />
      <path
        d="M24.6 11.5C19 15 23.5 23 15.4 28.5"
        fill="none"
        stroke="#f6f4ef"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconoSenal({
  cortada,
  ...p
}: IconoProps & { cortada?: boolean }) {
  return (
    <Trazo size={20} grosor={2.4} {...p}>
      <path d="M2 9a15 15 0 0 1 20 0" />
      <path d="M5 12.5a10 10 0 0 1 14 0" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19.5" r="1.2" fill="currentColor" />
      {cortada && <path d="M3 3l18 18" />}
    </Trazo>
  );
}

export function IconoPin(p: IconoProps) {
  return (
    <Trazo {...p}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Trazo>
  );
}

export function IconoGirando({ className = "", ...p }: IconoProps) {
  return (
    <Trazo grosor={2.6} className={`animate-spin ${className}`} {...p}>
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </Trazo>
  );
}

export function IconoCelularReloj(p: IconoProps) {
  return (
    <Trazo {...p}>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M12 7v4l2.5 1.5" />
      <path d="M10.5 18.5h3" />
    </Trazo>
  );
}

export function IconoCelularCheck(p: IconoProps) {
  return (
    <Trazo {...p}>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </Trazo>
  );
}

export function IconoMontana(p: IconoProps) {
  return (
    <Trazo {...p}>
      <path d="M3 20l6-9 4 5 3-4 5 8z" />
      <circle cx="17" cy="6" r="2" />
    </Trazo>
  );
}

const CHEVRON = {
  derecha: "M9 5l7 7-7 7",
  arriba: "M6 15l6-6 6 6",
  abajo: "M6 9l6 6 6-6",
};

export function IconoChevron({
  dir,
  ...p
}: IconoProps & { dir: keyof typeof CHEVRON }) {
  return (
    <Trazo grosor={2.6} {...p}>
      <path d={CHEVRON[dir]} />
    </Trazo>
  );
}

export function IconoMira(p: IconoProps) {
  return (
    <Trazo grosor={2.4} {...p}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </Trazo>
  );
}

export function IconoNubeCortada(p: IconoProps) {
  return (
    <Trazo {...p}>
      <path d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z" />
      <path d="M3 3l18 18" />
    </Trazo>
  );
}

export function IconoRelojArena(p: IconoProps) {
  return (
    <Trazo {...p}>
      <path d="M7 3h10" />
      <path d="M7 21h10" />
      <path d="M8 3c0 5 8 5 8 9s-8 4-8 9" />
      <path d="M16 3c0 5-8 5-8 9s8 4 8 9" />
    </Trazo>
  );
}

export function IconoReloj(p: IconoProps) {
  return (
    <Trazo size={20} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Trazo>
  );
}

export function IconoCheck(p: IconoProps) {
  return (
    <Trazo grosor={3} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Trazo>
  );
}

/** Signo de admiración alto, para el nivel MEDIO. */
export function IconoExclamacion(p: IconoProps) {
  return (
    <Trazo grosor={3} {...p}>
      <path d="M12 5v9" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" />
    </Trazo>
  );
}

/** Signo de admiración compacto, para los avisos. */
export function IconoAlerta(p: IconoProps) {
  return (
    <Trazo grosor={2.6} {...p}>
      <path d="M12 7v6" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" />
    </Trazo>
  );
}

export function IconoTriangulo(p: IconoProps) {
  return (
    <Trazo grosor={2.6} {...p}>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </Trazo>
  );
}

export function IconoLista(p: IconoProps) {
  return (
    <Trazo {...p}>
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </Trazo>
  );
}

export function IconoPregunta(p: IconoProps) {
  return (
    <Trazo {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </Trazo>
  );
}

export function IconoTermometro(p: IconoProps) {
  return (
    <Trazo size={26} grosor={2} {...p}>
      <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" />
      <path d="M12 9v7" />
    </Trazo>
  );
}

export function IconoGota(p: IconoProps) {
  return (
    <Trazo size={26} grosor={2} {...p}>
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
    </Trazo>
  );
}

export function IconoLluvia(p: IconoProps) {
  return (
    <Trazo size={26} grosor={2} {...p}>
      <path d="M7 14a4.5 4.5 0 0 1-.8-8.9A6 6 0 0 1 17.8 6.1 4 4 0 0 1 17 14z" />
      <path d="M8 17l-1 3" />
      <path d="M12 17l-1 3" />
      <path d="M16 17l-1 3" />
    </Trazo>
  );
}

export function IconoAntena(p: IconoProps) {
  return (
    <Trazo grosor={2} {...p}>
      <path d="M12 10v11" />
      <path d="M8 21h8" />
      <circle cx="12" cy="8" r="2" />
      <path d="M7.8 3.8a6 6 0 0 0 0 8.4" />
      <path d="M16.2 3.8a6 6 0 0 1 0 8.4" />
    </Trazo>
  );
}

export function IconoGuardar(p: IconoProps) {
  return (
    <Trazo size={24} {...p}>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v5h7V3" />
      <path d="M8 21v-6h8v6" />
    </Trazo>
  );
}

export function IconoMenos(p: IconoProps) {
  return (
    <Trazo size={24} grosor={2.8} {...p}>
      <path d="M5 12h14" />
    </Trazo>
  );
}

export function IconoMas(p: IconoProps) {
  return (
    <Trazo size={24} grosor={2.8} {...p}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Trazo>
  );
}

export function IconoCerrar(p: IconoProps) {
  return (
    <Trazo size={20} grosor={2.4} {...p}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Trazo>
  );
}

export function IconoSemaforo(p: IconoProps) {
  return (
    <Trazo size={28} grosor={2} {...p}>
      <rect x="7" y="2" width="10" height="20" rx="3" />
      <circle cx="12" cy="7" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="17" r="1.7" />
    </Trazo>
  );
}

export function IconoSolNube(p: IconoProps) {
  return (
    <Trazo size={28} grosor={2} {...p}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 2v1.5" />
      <path d="M2 8h1.5" />
      <path d="M3.8 3.8l1 1" />
      <path d="M12.2 3.8l-1 1" />
      <path d="M9 20h9a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.4 1.2A3 3 0 0 0 9 20z" />
    </Trazo>
  );
}

export function IconoLapiz(p: IconoProps) {
  return (
    <Trazo size={28} grosor={2} {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </Trazo>
  );
}

/** Dibujos de lo que el caficultor puede encontrar en el lote. */
export function DibujoHallazgo({
  tipo,
}: {
  tipo: "nada" | "roya" | "broca" | "ambas";
}) {
  const marco = {
    width: 42,
    height: 42,
    viewBox: "0 0 40 40",
    className: "flex-none",
  } as const;

  if (tipo === "nada") {
    return (
      <svg aria-hidden="true" {...marco}>
        <path
          d="M8 33C8 18 16 8 33 7c0 16-9 25-25 26z"
          fill="#e5f2e7"
          stroke="#2f6b3a"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M8 33L25 16"
          fill="none"
          stroke="#2f6b3a"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (tipo === "roya") {
    return (
      <svg aria-hidden="true" {...marco}>
        <path
          d="M6 34C6 18 15 7 34 6c0 17-10 27-28 28z"
          fill="#e5f2e7"
          stroke="#2f6b3a"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M6 34L25 15"
          fill="none"
          stroke="#2f6b3a"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="24" cy="24" r="3.6" fill="#d9822b" />
        <circle cx="16" cy="19" r="2.8" fill="#b54708" />
        <circle cx="27" cy="12.5" r="2.4" fill="#d9822b" />
        <circle cx="15" cy="28" r="2" fill="#b54708" />
      </svg>
    );
  }
  if (tipo === "broca") {
    return (
      <svg aria-hidden="true" {...marco}>
        <ellipse
          cx="20"
          cy="20"
          rx="11"
          ry="15"
          transform="rotate(28 20 20)"
          fill="#8b3a1f"
        />
        <path
          d="M25.6 8.5C18.6 13 24.4 23 14.4 31.5"
          fill="none"
          stroke="#f6f4ef"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="15"
          cy="15"
          r="3.4"
          fill="#1f1f1f"
          stroke="#f6f4ef"
          strokeWidth="1.6"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" {...marco}>
      <path
        d="M3 30C3 18 9 10 22 9c0 12-7 20-19 21z"
        fill="#e5f2e7"
        stroke="#2f6b3a"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="21" r="2.4" fill="#b54708" />
      <circle cx="17.5" cy="15" r="1.8" fill="#d9822b" />
      <ellipse
        cx="29"
        cy="25"
        rx="7"
        ry="10"
        transform="rotate(28 29 25)"
        fill="#8b3a1f"
      />
      <path
        d="M32.5 17.3C28 20.5 32 26 25.6 32.5"
        fill="none"
        stroke="#f6f4ef"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle
        cx="26"
        cy="21.5"
        r="2.2"
        fill="#1f1f1f"
        stroke="#f6f4ef"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function DibujoFloracion({
  tipo,
}: {
  tipo: "no" | "empezando" | "plena";
}) {
  const marco = {
    width: 32,
    height: 32,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#2f6b3a",
  } as const;
  const trazo = {
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  if (tipo === "no") {
    return (
      <svg aria-hidden="true" {...marco} {...trazo}>
        <path d="M12 21V9" />
        <path d="M12 14c-3.2 0-5.2-2-5.2-5.2 3.2 0 5.2 2 5.2 5.2z" />
        <path d="M12 11.5c3.2 0 5.2-2 5.2-5.2-3.2 0-5.2 2-5.2 5.2z" />
      </svg>
    );
  }
  if (tipo === "empezando") {
    return (
      <svg aria-hidden="true" {...marco} {...trazo}>
        <path d="M12 21V8" />
        <path d="M12 15c-3 0-4.8-1.8-4.8-4.8 3 0 4.8 1.8 4.8 4.8z" />
        <circle cx="12" cy="5.2" r="2.2" fill="#ffffff" />
        <circle cx="17" cy="9" r="1.6" fill="#ffffff" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" {...marco} strokeWidth={1.6}>
      <circle cx="12" cy="6.4" r="3" fill="#ffffff" />
      <circle cx="17.3" cy="10.3" r="3" fill="#ffffff" />
      <circle cx="15.3" cy="16.5" r="3" fill="#ffffff" />
      <circle cx="8.7" cy="16.5" r="3" fill="#ffffff" />
      <circle cx="6.7" cy="10.3" r="3" fill="#ffffff" />
      <circle cx="12" cy="12" r="2.2" fill="#e0a526" stroke="none" />
    </svg>
  );
}
