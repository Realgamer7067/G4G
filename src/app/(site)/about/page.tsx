import { Picture } from "@/components/media/picture";
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

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1fr] md:items-center lg:px-8">
      <div className="grid gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{content.heading || page.navLabel}</h1>
        {content.body.split(/\r?\n/).filter(Boolean).map((para, i) => (
          <p key={i} className="text-lg text-muted">
            {para}
          </p>
        ))}
      </div>
      {image && <Picture image={image} sizes="(min-width: 768px) 480px, 100vw" alt="" className="overflow-hidden rounded-3xl" imgClassName="aspect-[4/3] w-full object-cover" />}
    </div>
  );
}
