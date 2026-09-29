// src/components/homepage/sections/about.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { getPageSetting } from "@/lib/data/pages";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";
import { isPageLive } from "@/lib/pages/registry";
import { ACTIVITY_ICONS } from "../activity-icon";

/** The page's one light "paper" section: a change of topic from the dark hero and event modules. */
export async function AboutSection({ section, image }: { section: SectionOfType<"about">; image: PublicImage | null }) {
  const c = section.content;
  const heading = section.headingOverride || c.heading;
  if (!c.body && !heading && c.activities.length === 0) return null;
  const aboutLive = isPageLive(await getPageSetting("ABOUT"));
  const paragraphs = c.body.split(/\r?\n/).filter(Boolean);
  const activityList =
    c.activities.length > 0 ? (
      <Stagger as="ul" className="grid gap-px overflow-hidden rounded-3xl border border-ink/10 bg-ink/10">
        {c.activities.map((a) => {
          const Icon = ACTIVITY_ICONS[a.icon];
          return (
            <StaggerItem as="li" key={a.id} className="group flex gap-4 bg-paper p-5 transition-colors duration-200 hover:bg-white/60 sm:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink text-leaf transition-transform duration-300 group-hover:-rotate-6">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="grid gap-1">
                <span className="font-display text-lg font-bold tracking-tight">{a.title}</span>
                {a.description && <span className="text-[15px] leading-relaxed text-ink-muted">{a.description}</span>}
              </span>
            </StaggerItem>
          );
        })}
      </Stagger>
    ) : null;

  return (
    <section id={section.anchorId} className="bg-paper text-ink">
      <div className="container-x grid gap-12 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-32">
        <Reveal className="grid content-start gap-8">
          {heading && <h2 className="max-w-xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">{heading}</h2>}
          {paragraphs.length > 0 && (
            <div className="grid max-w-[60ch] gap-4 text-lg leading-relaxed text-ink-muted">
              {paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
          {image && activityList}
          {aboutLive && (
            <Link href="/about" className="group inline-flex w-fit items-center gap-2 font-semibold text-ink">
              <span className="link-sweep">More about us</span>
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          )}
        </Reveal>
        {!image && activityList && <Reveal delay={0.1}>{activityList}</Reveal>}
        {image && (
          <Reveal delay={0.1} className="relative">
            <div aria-hidden="true" className="absolute -inset-3 -z-10 rotate-2 rounded-[32px] bg-ink/8" />
            <Picture
              image={image}
              sizes="(min-width: 1024px) 520px, 100vw"
              alt={image.alt}
              className="overflow-hidden rounded-[28px]"
              imgClassName="aspect-[4/5] w-full object-cover"
            />
          </Reveal>
        )}
      </div>
    </section>
  );
}
