import { BookOpen, CodeXml, GitBranch, Lightbulb, Mic, Rocket, Trophy, Users, type LucideIcon } from "lucide-react";
import type { ABOUT_ACTIVITY_ICONS } from "@/lib/homepage/sections/schema";

export const ACTIVITY_ICONS: Record<(typeof ABOUT_ACTIVITY_ICONS)[number], LucideIcon> = {
  book: BookOpen,
  code: CodeXml,
  users: Users,
  rocket: Rocket,
  trophy: Trophy,
  lightbulb: Lightbulb,
  branch: GitBranch,
  mic: Mic,
};
