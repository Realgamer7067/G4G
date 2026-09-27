import { Picture } from "@/components/media/picture";
import { PageIntro } from "@/components/site/page-intro";
import { assertPageEnabled } from "@/lib/data/pages";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { aboutContentSchema, ABOUT_DEFAULTS } from "@/lib/pages/about-schema";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("ABOUT", { title: "About us", description: "Who we are and what we build." });
}

export default async function AboutPage() {
  const page = await assertPageEnabled("ABOUT");
  const parsed = aboutContentSchema.safeParse(page.content);
  const content = parsed.success ? parsed.data : ABOUT_DEFAULTS;
  const upload = content.imageId ? await db.upload.findUnique({ where: { id: content.imageId }, select: publicImageSelect }) : null;
  const image = toPublicImage(upload);

  const paragraphs = content.body.split(/\r?\n/).filter(Boolean);

  return (
    <div className="pb-24">
      <PageIntro layout="stacked" eyebrow={page.navLabel} title={content.heading || page.navLabel} />
      <div className="container-x grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-20">
        <div className="grid max-w-[62ch] gap-6">
          {paragraphs.map((para, i) => (
            <p key={i} className={i === 0 ? "text-2xl leading-snug tracking-tight text-frost" : "text-lg leading-relaxed text-muted"}>
              {para}
            </p>
          ))}
        </div>
        {image && (
          <div className="relative lg:sticky lg:top-28">
            <div aria-hidden="true" className="absolute -inset-3 -z-10 rotate-[-2deg] rounded-[32px] bg-leaf/10" />
            <Picture image={image} sizes="(min-width: 1024px) 520px, 100vw" alt="" className="block overflow-hidden rounded-[28px]" imgClassName="aspect-[4/5] w-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
