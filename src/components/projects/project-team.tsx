import { HardHat, ShieldCheck, UserCog, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProjectMemberRow } from "@/modules/projects/queries";

type RoleKey = "LEAD" | "MEMBER" | "INSPECTOR";

const GROUPS: { key: RoleKey; label: string; icon: typeof UserCog; tone: string }[] = [
  { key: "LEAD", label: "Lead engineer", icon: UserCog, tone: "text-primary" },
  { key: "MEMBER", label: "Field team", icon: HardHat, tone: "text-foreground" },
  { key: "INSPECTOR", label: "QA / QC inspectors", icon: ShieldCheck, tone: "text-emerald-600" },
];

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function MemberRow({ member }: { member: ProjectMemberRow }) {
  return (
    <li className="flex items-center gap-3">
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
        {initials(member.name)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{member.name}</p>
        <p className="text-muted-foreground truncate text-xs">{member.email}</p>
      </div>
    </li>
  );
}

export function ProjectTeam({ members }: { members: ProjectMemberRow[] }) {
  const populated = GROUPS.map((group) => ({
    ...group,
    people: members.filter((m) => m.roleOnProject === group.key),
  })).filter((group) => group.people.length > 0);

  if (populated.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <Users className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">No one assigned yet</p>
          <p className="text-muted-foreground text-sm">
            Assign a lead and field engineers from Edit to scope this site to a team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {populated.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={cn("size-4", group.tone)} />
              <h3 className="text-xs font-medium tracking-wide uppercase">{group.label}</h3>
              <span className="text-muted-foreground text-xs tabular-nums">
                {group.people.length}
              </span>
            </div>
            <ul className="space-y-3">
              {group.people.map((member) => (
                <MemberRow key={member.userId} member={member} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
