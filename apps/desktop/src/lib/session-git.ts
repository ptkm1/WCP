export type SessionGitCommit = {
  sha: string;
  subject: string;
};

export type SessionGitActivity = {
  startedBranch?: string | null;
  endedBranch?: string | null;
  startedHead?: string | null;
  endedHead?: string | null;
  commits?: SessionGitCommit[];
  worktreePath?: string | null;
};

export function parseSessionGitActivity(
  payloadJson?: string | null,
): SessionGitActivity | null {
  const raw = payloadJson?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      git?: SessionGitActivity;
    };
    return parsed.git ?? null;
  } catch {
    return null;
  }
}

export function formatSessionBranchLabel(activity: SessionGitActivity | null) {
  const started = activity?.startedBranch?.trim() || null;
  const ended = activity?.endedBranch?.trim() || null;
  if (started && ended && started !== ended) {
    return `${started} → ${ended}`;
  }
  return ended || started;
}

export function formatSessionTimeRange(
  startedAt: string,
  endedAt: string | null | undefined,
  formatTime: (value: string) => string,
) {
  const start = formatTime(startedAt);
  if (!endedAt) {
    return start;
  }
  return `${start}–${formatTime(endedAt)}`;
}
