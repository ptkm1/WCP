import {
  Ban,
  Building2,
  CheckCircle2,
  CheckSquare,
  FolderGit2,
  GitBranch,
  History,
  Image,
  KeyRound,
  Layers,
  Lightbulb,
  Link2,
  ListTodo,
  Paperclip,
  PenLine,
  PlayCircle,
  Plug,
  Plus,
  Save,
  ScanSearch,
  Search,
  Shield,
  Sparkles,
  StickyNote,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type MainView =
  | "today"
  | "backlog"
  | "organizations"
  | "repos"
  | "history";

export const MAIN_VIEW_ICONS: Record<MainView, LucideIcon> = {
  today: Sparkles,
  backlog: ListTodo,
  organizations: Building2,
  repos: FolderGit2,
  history: History,
};

export const CONTEXT_STEP_ICONS: Record<number, LucideIcon> = {
  1: Building2,
  2: FolderGit2,
  3: ScanSearch,
  4: UserCog,
  5: Shield,
  6: CheckCircle2,
};

export const ORG_TAB_ICONS: Record<string, LucideIcon> = {
  company: Building2,
  projects: Layers,
  repos: GitBranch,
  identity: KeyRound,
  integrations: Plug,
};

export const HISTORY_KIND_ICONS: Record<string, LucideIcon> = {
  all: History,
  session: PlayCircle,
  decision: Lightbulb,
  note: StickyNote,
  artifact: Paperclip,
  block: Ban,
  change: PenLine,
  dependency: Link2,
  repository: FolderGit2,
  task: CheckSquare,
};

export const SEARCH_KIND_ICONS: Record<string, LucideIcon> = {
  task: CheckSquare,
  note: StickyNote,
  session: PlayCircle,
  artifact: Paperclip,
  repository: FolderGit2,
  dependency: Link2,
};

export const ACTION_ICONS = {
  add: Plus,
  building: Building2,
  image: Image,
  save: Save,
  search: Search,
  contextSwitch: GitBranch,
} as const;

export function getHistoryKindIcon(kind: string): LucideIcon {
  return HISTORY_KIND_ICONS[kind] ?? History;
}

export function getSearchKindIcon(kind: string): LucideIcon {
  return SEARCH_KIND_ICONS[kind] ?? Search;
}
