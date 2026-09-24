import type { ShareKind } from "@/lib/share";

type IconProps = {
  className?: string;
};

function ImageIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <circle cx="9.5" cy="9" r="1.6" />
      <path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" />
    </svg>
  );
}

function VideoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5.5" width="12" height="13" rx="2.5" />
      <path d="M15.5 10.5l5-3v9l-5-3z" />
    </svg>
  );
}

export function ShareUploadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V3.5M7.5 8L12 3.5 16.5 8" />
      <path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

const ICONS: Record<ShareKind, (props: IconProps) => React.JSX.Element> = {
  image: ImageIcon,
  video: VideoIcon,
};

export function ShareIcon({ kind, className }: IconProps & { kind: ShareKind }) {
  const Icon = ICONS[kind];
  return <Icon className={className} />;
}
