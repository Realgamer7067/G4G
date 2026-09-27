import { Picture } from "@/components/media/picture";
import type { PublicTeamMember } from "@/lib/data/team";
import { cn } from "@/lib/utils/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** A 4:5 portrait; members without a photo get their initials on a tinted panel instead of an empty circle. */
export function MemberPortrait({ member, sizes, className }: { member: PublicTeamMember; sizes: string; className?: string }) {
  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden rounded-[20px] bg-raised", className)}>
      {member.photo ? (
        <Picture
          image={member.photo}
          sizes={sizes}
          alt=""
          imgClassName="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,rgb(92_201_123/0.22),transparent_60%)]">
          <span className="font-display text-5xl font-extrabold tracking-tight text-leaf/80">{initials(member.name)}</span>
        </div>
      )}
    </div>
  );
}
