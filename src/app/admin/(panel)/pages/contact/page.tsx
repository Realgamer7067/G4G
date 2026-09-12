import type { Metadata } from "next";
import { Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPageSetting } from "@/lib/data/pages";
import { CONTACT_DEFAULTS, contactContentSchema } from "@/lib/pages/contact-schema";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact page" };

export default async function ContactAdminPage() {
  await requirePagePermission("pages.manage");
  const setting = await getPageSetting("CONTACT");
  const parsed = contactContentSchema.safeParse(setting?.content);
  const values = parsed.success ? parsed.data : CONTACT_DEFAULTS;
  return (
    <div className="grid gap-6">
      <Panel title="Contact page" description="Content shown on the public /contact page. Email, phone, address and map link are edited in Site Settings.">
        <ContactForm values={values} />
      </Panel>
    </div>
  );
}
