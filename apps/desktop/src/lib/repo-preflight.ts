export type PreflightStatus = "ok" | "warning" | "pending";

export type PreflightRow = {
  id: string;
  label: string;
  value: string;
  status: PreflightStatus;
};

type ValidationCheck = {
  key: string;
  status: string;
  expected?: string | null;
  actual?: string | null;
  message: string;
};

type GuardrailLike = {
  expectedGitUserName?: string | null;
  expectedGitUserEmail?: string | null;
  expectedSshHostAlias?: string | null;
  remoteUrl?: string | null;
  validation?: {
    status: string;
    checks: ValidationCheck[];
  } | null;
} | null;

type HookLike = {
  installed?: boolean;
  managedByApp?: boolean;
} | null;

function findCheck(
  checks: ValidationCheck[] | undefined,
  keys: string[],
): ValidationCheck | undefined {
  return checks?.find((check) => keys.includes(check.key));
}

function checkStatus(check: ValidationCheck | undefined): PreflightStatus {
  if (!check) {
    return "pending";
  }
  return check.status === "ok" ? "ok" : "warning";
}

function displayValue(
  check: ValidationCheck | undefined,
  fallback: string,
): string {
  const actual = check?.actual?.trim();
  if (actual) {
    return actual;
  }
  const expected = check?.expected?.trim();
  if (expected) {
    return expected;
  }
  return fallback;
}

export function buildRepoPreflightRows({
  guardrail,
  hookStatus,
  currentBranch,
  loading = false,
}: {
  guardrail: GuardrailLike;
  hookStatus: HookLike;
  currentBranch?: string | null;
  loading?: boolean;
}): PreflightRow[] {
  if (loading) {
    return [
      {
        id: "loading",
        label: "Ambiente",
        value: "Conferindo...",
        status: "pending",
      },
    ];
  }

  const checks = guardrail?.validation?.checks;
  const nameCheck = findCheck(checks, ["gitUserName", "git_user_name"]);
  const emailCheck = findCheck(checks, ["gitUserEmail", "git_user_email"]);
  const sshCheck = findCheck(checks, ["sshHostAlias", "ssh_host_alias"]);
  const remoteCheck = findCheck(checks, ["remote_url", "remoteUrl"]);
  const branchCheck = findCheck(checks, ["branchPattern", "branch_pattern"]);

  const identityName =
    nameCheck?.actual?.trim() || guardrail?.expectedGitUserName?.trim() || "—";
  const identityEmail =
    emailCheck?.actual?.trim() || guardrail?.expectedGitUserEmail?.trim() || "";
  const identityValue = identityEmail
    ? `${identityName} <${identityEmail}>`
    : identityName;

  const identityStatus: PreflightStatus =
    !nameCheck && !emailCheck
      ? "pending"
      : nameCheck?.status === "ok" && emailCheck?.status === "ok"
        ? "ok"
        : "warning";

  const sshValue = displayValue(
    sshCheck,
    guardrail?.expectedSshHostAlias?.trim() || "—",
  );
  const remoteValue = displayValue(
    remoteCheck,
    guardrail?.remoteUrl?.trim() || "—",
  );

  const branchValue =
    currentBranch?.trim() ||
    branchCheck?.actual?.trim() ||
    branchCheck?.expected?.trim() ||
    "—";
  const branchStatus: PreflightStatus =
    !currentBranch && !branchCheck
      ? "pending"
      : branchCheck
        ? checkStatus(branchCheck)
        : currentBranch
          ? "ok"
          : "warning";

  const guardrailStatus: PreflightStatus = hookStatus?.managedByApp
    ? "ok"
    : "warning";
  const guardrailValue = hookStatus?.managedByApp
    ? "Ativo"
    : hookStatus?.installed
      ? "Hook manual"
      : "Inativo";

  return [
    {
      id: "identity",
      label: "Git identity",
      value: identityValue,
      status: identityStatus,
    },
    {
      id: "ssh",
      label: "SSH",
      value: sshValue,
      status: checkStatus(sshCheck),
    },
    {
      id: "remote",
      label: "Remote",
      value: remoteValue,
      status: remoteCheck
        ? checkStatus(remoteCheck)
        : remoteValue !== "—"
          ? "ok"
          : "pending",
    },
    {
      id: "branch",
      label: "Branch",
      value: branchValue,
      status: branchStatus,
    },
    {
      id: "guardrail",
      label: "Guardrail",
      value: guardrailValue,
      status: guardrailStatus,
    },
  ];
}

export function summarizePreflight(rows: PreflightRow[]): {
  ok: boolean;
  divergenceCount: number;
  divergences: PreflightRow[];
} {
  const divergences = rows.filter((row) => row.status === "warning");
  return {
    ok: divergences.length === 0 && rows.every((row) => row.status === "ok"),
    divergenceCount: divergences.length,
    divergences,
  };
}
