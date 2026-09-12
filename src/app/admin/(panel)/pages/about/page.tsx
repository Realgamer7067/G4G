import type { Metadata } from "next";
import { Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPageSetting } from "@/lib/data/pages";
import { aboutContentSchema, ABOUT_DEFAULTS } from "@/lib/pages/about-schema";
import { AboutForm } from "./about-form";

export const metadata: Metadata = { title: "About page" };

export default async function AboutAdminPage() {
  await requirePagePermission("pages.manage");
  const setting = await getPageSetting("ABOUT");
  const parsed = aboutContentSchema.safeParse(setting?.content);
  const values = parsed.success ? parsed.data : ABOUT_DEFAULTS;
  return (
    <div className="grid gap-6">
      <Panel title="About page" description="Content shown on the public /about page.">
        <AboutForm values={values} />
      </Panel>
    </div>
  );
}
