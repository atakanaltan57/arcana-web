import type { ShareTarget } from "@/lib/share";

type IconProps = {
  className?: string;
};

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3" />
      <path d="M13.5 3.5c.4 2.6 2.2 4.3 4.8 4.5" />
    </svg>
  );
}

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z" />
      <path d="M9.3 8.4c.2-.5.6-.5.9-.5l.6 1.4c.1.3 0 .5-.2.7l-.4.5c.6 1.2 1.6 2.1 2.8 2.7l.5-.5c.2-.2.4-.2.7-.1l1.4.6c0 .4-.1.8-.5 1.1-.6.5-1.5.6-2.5.2-1.9-.8-3.4-2.3-4-4.1-.3-.9-.1-1.6.7-2z" />
    </svg>
  );
}

const ICONS: Record<ShareTarget, (props: IconProps) => React.JSX.Element> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  whatsapp: WhatsAppIcon,
};

export function ShareIcon({ target, className }: IconProps & { target: ShareTarget }) {
  const Icon = ICONS[target];
  return <Icon className={className} />;
}
