// src/components/homepage/sections/hero.tsx
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LogoTile } from "@/components/brand/logo-tile";
import { Picture } from "@/components/media/picture";
import { HeroIntroOnce } from "@/components/motion/hero-intro-once";
import { Magnetic } from "@/components/motion/magnetic";
import { ParallaxTilt } from "@/components/motion/parallax-tilt";
import { Rings } from "@/components/site/rings";
import { SocialIcon, socialLinks } from "@/components/site/social-icons";
import { Spotlight } from "@/components/site/spotlight";
import { LinkButton } from "@/components/ui/link-button";
import { getPublicEvents, type EventCardDTO } from "@/lib/data/events";
import { getCurrentTeam, type PublicTeamMember } from "@/lib/data/team";
import { dateBadge } from "@/lib/events/format";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";
import type { Socials } from "@/lib/settings/schema";
import { cn } from "@/lib/utils/cn";

/** Wraps the highlighted word where it appears in the heading; appends it for headings written before it existed. */
function Headline({ heading, highlight }: { heading: string; highlight?: string }) {
  if (!highlight) return <>{heading}</>;
  const at = heading.toLowerCase().indexOf(highlight.toLowerCase());
  const mark = (text: string) => <span className="text-leaf">{text}</span>;
  if (at === -1)
    return (
      <>
        {heading} {mark(highlight)}
      </>
    );
  return (
    <>
      {heading.slice(0, at)}
      {mark(heading.slice(at, at + highlight.length))}
      {heading.slice(at + highlight.length)}
    </>
  );
}

function Background({ variant }: { variant: SectionOfType<"hero">["content"]["backgroundVariant"] }) {
  if (variant === "rings") return <Rings className="pointer-events-none absolute -right-48 top-1/2 -z-10 size-[760px] -translate-y-1/2 opacity-40" />;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      {variant !== "glow" && <div className={cn("absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_40%,#000_20%,transparent_75%)]", variant === "grid" ? "bg-[linear-gradient(rgb(147_168_154/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(147_168_154/0.08)_1px,transparent_1px)] bg-[size:48px_48px]" : "bg-dots")} />}
      <div className="absolute -right-40 -top-40 size-[640px] rounded-full bg-[radial-gradient(circle,rgb(92_201_123/0.16),transparent_65%)]" />
    </div>
  );
}

function NextUpChip({ event, timezone }: { event: EventCardDTO; timezone: string }) {
  const badge = dateBadge(event.startAt, timezone);
  return (
    <Link
      href={`/events/${event.slug}`}
      className="hero-chip-in group absolute -right-3 top-8 z-10 flex max-w-[16rem] items-center gap-3 rounded-2xl border border-white/10 bg-night/75 p-3 pr-4 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-leaf/40 sm:-right-6"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-leaf text-night">
        <span className="grid text-center leading-none">
          <span className="font-display text-lg font-extrabold">{badge.day}</span>
          <span className="font-mono text-[10px] font-semibold">{badge.month}</span>
        </span>
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="text-xs text-muted">Next up</span>
        <span className="truncate text-sm font-semibold text-frost">{event.title}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-leaf" aria-hidden="true" />
    </Link>
  );
}

/** "Prof. Jitendra Mathur" → "Jitendra": honorifics make poor captions. */
const firstName = (name: string) => name.split(/\s+/).find((w) => !/^(prof|dr|mr|mrs|ms)\.?$/i.test(w)) ?? name;

/** Without a hero photo, real faces beat stock imagery: a staggered mosaic of current team portraits. */
function TeamMosaic({ members, next, timezone }: { members: PublicTeamMember[]; next: EventCardDTO | null; timezone: string }) {
  const columns = [members.slice(0, 2), members.slice(2, 4), members.slice(4, 6)].filter((c) => c.length > 0);
  return (
    <div className="hero-media-in relative mx-auto w-full max-w-lg">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {columns.map((col, ci) => (
          <div key={ci} className={cn("grid content-start gap-3 sm:gap-4", ci === 1 && "translate-y-10", ci === 2 && "translate-y-4")}>
            {col.map((m, i) => (
              <figure key={m.id} className="group relative overflow-hidden rounded-[20px] border border-line bg-surface">
                <Picture
                  image={m.photo!}
                  sizes="(min-width: 1024px) 170px, 30vw"
                  alt=""
                  priority={ci === 0 && i === 0}
                  imgClassName="aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgb(8_18_13/0.85),transparent)] px-2.5 pb-2 pt-6 text-[11px] font-semibold leading-tight text-frost">
                  {firstName(m.name)}
                  <span className="block font-normal text-frost/60">{m.title}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ))}
      </div>
      {next && <NextUpChip event={next} timezone={timezone} />}
    </div>
  );
}

function Media({
  main,
  second,
  next,
  timezone,
  team,
}: {
  main: PublicImage | null;
  second: PublicImage | null;
  next: EventCardDTO | null;
  timezone: string;
  team: PublicTeamMember[];
}) {
  if (!main && team.length >= 3) return <TeamMosaic members={team} next={next} timezone={timezone} />;
  if (!main) {
    // No photo and no team yet: an intentional typographic panel instead of a stretched logo.
    return (
      <div className="hero-media-in relative mx-auto w-full max-w-md">
        <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[28px] border border-line bg-surface">
          <div aria-hidden="true" className="bg-dots absolute inset-0 opacity-70" />
          <LogoTile size="lg" priority className="relative" />
        </div>
        {next && <NextUpChip event={next} timezone={timezone} />}
      </div>
    );
  }
  return (
    <ParallaxTilt className="relative mx-auto w-full max-w-md [transform-style:preserve-3d]">
      <div className="hero-media-in relative aspect-[4/5] overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_40px_90px_-40px_rgb(0_0_0/0.95)]">
        <Picture image={main} sizes="(min-width: 1024px) 448px, 90vw" alt={main.alt} priority imgClassName="size-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgb(8_18_13/0.55),transparent_45%)]" />
      </div>
      {second && (
        <div className="hero-chip-in absolute -bottom-8 -left-2 w-36 overflow-hidden rounded-3xl border-4 border-night bg-surface shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)] sm:-left-12 sm:w-48">
          <Picture image={second} sizes="192px" alt={second.alt} imgClassName="aspect-square w-full object-cover" />
        </div>
      )}
      <LogoTile size="md" className="absolute -bottom-5 right-6 hidden sm:grid" />
      {next && <NextUpChip event={next} timezone={timezone} />}
    </ParallaxTilt>
  );
}

export async function HeroSection({
  section,
  socials,
  images,
  now,
  timezone,
}: {
  section: SectionOfType<"hero">;
  socials: Socials;
  images: Record<string, PublicImage>;
  now: Date;
  timezone: string;
}) {
  const c = section.content;
  const main = c.imageId ? (images[c.imageId] ?? null) : null;
  const second = c.secondaryImageId ? (images[c.secondaryImageId] ?? null) : null;
  const next = c.showNextEvent
    ? ((await getPublicEvents())
        .filter((e) => e.lifecycle === "PUBLISHED" && new Date(e.startAt) > now)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] ?? null)
    : null;
  // Portraits for the mosaic fallback: featured members first, only those with a photo.
  const team = main
    ? []
    : ((await getCurrentTeam())?.members ?? [])
        .filter((m) => m.photo)
        .sort((a, b) => Number(b.featured) - Number(a.featured))
        .slice(0, 6);
  const id = section.anchorId || `hero-${section.id}`;

  return (
    <section id={id} className="relative isolate overflow-hidden">
      <HeroIntroOnce targetId={id} />
      <Background variant={c.backgroundVariant} />
      <Spotlight className="rounded-none">
        <div className="container-x grid items-center gap-14 pb-24 pt-12 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pb-20 lg:pt-10">
          <div className="grid max-w-2xl gap-7">
            {c.eyebrow && <p className="hero-in-1 font-mono text-xs uppercase tracking-[0.14em] text-leaf">{c.eyebrow}</p>}
            <h1 className="hero-in-2 font-display text-[clamp(2.75rem,6.2vw,5.4rem)] font-extrabold leading-[0.98] tracking-[-0.035em]">
              <Headline heading={section.headingOverride || c.heading} highlight={c.highlightedWord} />
            </h1>
            {(section.subheadingOverride || c.subheading) && <p className="hero-in-3 max-w-xl text-lg leading-relaxed text-muted">{section.subheadingOverride || c.subheading}</p>}
            {c.ctas.length > 0 && (
              <div className="hero-in-3 flex flex-wrap items-center gap-3 pt-1">
                {c.ctas.map((cta, i) =>
                  cta.style === "primary" ? (
                    <Magnetic key={i}>
                      <LinkButton href={cta.href} size="lg">
                        {cta.label}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </LinkButton>
                    </Magnetic>
                  ) : (
                    <LinkButton key={i} href={cta.href} size="lg" variant="secondary">
                      {cta.label}
                    </LinkButton>
                  ),
                )}
              </div>
            )}
            {c.showSocials && (
              <ul className="hero-in-3 flex gap-2 pt-1" aria-label="Social media">
                {socialLinks(socials).map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      className="grid size-11 place-items-center rounded-full border border-line text-muted transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-leaf/50 hover:text-leaf"
                    >
                      <SocialIcon network={link.network} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {(main || team.length >= 3 || c.showLogoTile || next) && <Media main={main} second={second} next={next} timezone={timezone} team={team} />}
        </div>
      </Spotlight>
    </section>
  );
}
