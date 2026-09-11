import { siDiscord, siGithub, siInstagram, siWhatsapp, siX, siYoutube } from "simple-icons";
import { Link2 } from "lucide-react";
import type { Socials } from "@/lib/settings/schema";

type Network = Exclude<keyof Socials, "custom">;

const BRAND_PATHS: Partial<Record<Network, string>> = {
  github: siGithub.path,
  instagram: siInstagram.path,
  youtube: siYoutube.path,
  discord: siDiscord.path,
  whatsapp: siWhatsapp.path,
  x: siX.path,
};

export const SOCIAL_NAMES: Record<Network, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  github: "GitHub",
  youtube: "YouTube",
  discord: "Discord",
  whatsapp: "WhatsApp",
  x: "X",
};

export function SocialIcon({ network, className = "size-4" }: { network: Network | "custom"; className?: string }) {
  if (network === "custom") return <Link2 aria-hidden="true" className={className} />;
  if (network === "linkedin") {
    // simple-icons no longer ships LinkedIn; a neutral outline glyph instead.
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d={BRAND_PATHS[network]} />
    </svg>
  );
}

/** Non-empty social links in display order. */
export function socialLinks(socials: Socials): { key: string; network: Network | "custom"; label: string; url: string }[] {
  const order: Network[] = ["instagram", "linkedin", "github", "youtube", "discord", "whatsapp", "x"];
  return [
    ...order.filter((n) => socials[n]).map((n) => ({ key: n, network: n, label: SOCIAL_NAMES[n], url: socials[n] })),
    ...socials.custom.map((c, i) => ({ key: `custom-${i}`, network: "custom" as const, label: c.label, url: c.url })),
  ];
}
