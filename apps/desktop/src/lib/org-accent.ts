export type OrganizationAccent = {
  bg: string;
  border: string;
  text: string;
};

const ORGANIZATION_ACCENT_PALETTE: OrganizationAccent[] = [
  {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/35",
    text: "text-emerald-300",
  },
  {
    bg: "bg-sky-500/15",
    border: "border-sky-500/35",
    text: "text-sky-300",
  },
  {
    bg: "bg-violet-500/15",
    border: "border-violet-500/35",
    text: "text-violet-300",
  },
  {
    bg: "bg-amber-500/15",
    border: "border-amber-500/35",
    text: "text-amber-300",
  },
  {
    bg: "bg-rose-500/15",
    border: "border-rose-500/35",
    text: "text-rose-300",
  },
  {
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/35",
    text: "text-cyan-300",
  },
  {
    bg: "bg-orange-500/15",
    border: "border-orange-500/35",
    text: "text-orange-300",
  },
  {
    bg: "bg-fuchsia-500/15",
    border: "border-fuchsia-500/35",
    text: "text-fuchsia-300",
  },
];

function hashOrganizationId(organizationId: string): number {
  let hash = 0;
  for (let index = 0; index < organizationId.length; index += 1) {
    hash = (hash * 31 + organizationId.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getOrganizationAccent(
  organizationId: string,
): OrganizationAccent {
  return ORGANIZATION_ACCENT_PALETTE[
    hashOrganizationId(organizationId) % ORGANIZATION_ACCENT_PALETTE.length
  ];
}
