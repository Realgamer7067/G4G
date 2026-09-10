import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_NAV } from "@/components/admin/nav-items";
import { Sidebar } from "@/components/admin/sidebar";
import { can, requireUser } from "@/lib/auth/guard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = ADMIN_NAV.filter((item) => can(user, item.permission));
  return <AdminShell sidebar={<Sidebar items={items} user={user} />}>{children}</AdminShell>;
}
