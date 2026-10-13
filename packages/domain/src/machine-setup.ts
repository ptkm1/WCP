/**
 * Machine Setup — catálogo genérico e comercializável.
 *
 * Cada passo é opcional: o usuário monta o próprio recipe
 * (o que checar / instalar / configurar / exportar como script).
 * Focado em bootstrap de ambiente de desenvolvimento, sem apps de chat/VPN.
 */

export type MachineSetupCategory =
  | "prerequisites"
  | "git"
  | "ssh"
  | "clone"
  | "clis";

export type MachineSetupStepId =
  | "prereq_homebrew"
  | "prereq_git"
  | "prereq_node"
  | "prereq_python"
  | "git_identity"
  | "ssh_key"
  | "clone_repos"
  | "cli_gh"
  | "cli_glab";

export type MachineSetupConfigKey =
  | "gitUserName"
  | "gitUserEmail"
  | "cloneUrls"
  | "cloneDir"
  | "ghToken"
  | "gitlabToken"
  | "gitlabHost"
  | "sshKeyComment";

export type MachineSetupStepDef = {
  id: MachineSetupStepId;
  category: MachineSetupCategory;
  label: string;
  description: string;
  /** Sempre true no produto — o cliente escolhe o que entra no recipe. */
  optional: true;
  configKeys?: MachineSetupConfigKey[];
};

export type MachineSetupCategoryMeta = {
  id: MachineSetupCategory;
  label: string;
  description: string;
};

export const MACHINE_SETUP_CATEGORIES: MachineSetupCategoryMeta[] = [
  {
    id: "prerequisites",
    label: "Pré-requisitos",
    description: "Ferramentas base detectadas ou instaladas via Homebrew (macOS).",
  },
  {
    id: "git",
    label: "Git",
    description: "Identidade global do autor de commits nesta máquina.",
  },
  {
    id: "ssh",
    label: "SSH",
    description: "Chave para autenticação em GitHub, GitLab e hosts SSH.",
  },
  {
    id: "clone",
    label: "Clone",
    description: "Clonar repositórios de trabalho para um diretório local.",
  },
  {
    id: "clis",
    label: "CLIs",
    description: "Clientes oficiais de SCM (GitHub CLI / GitLab CLI).",
  },
];

export const MACHINE_SETUP_CATALOG: MachineSetupStepDef[] = [
  {
    id: "prereq_homebrew",
    category: "prerequisites",
    label: "Homebrew",
    description: "Gerenciador de pacotes — base para instalar o restante no macOS.",
    optional: true,
  },
  {
    id: "prereq_git",
    category: "prerequisites",
    label: "Git",
    description: "Instalar o Git via Homebrew se ainda não estiver disponível.",
    optional: true,
  },
  {
    id: "prereq_node",
    category: "prerequisites",
    label: "Node.js + npm + Yarn",
    description: "Toolchain JavaScript/TypeScript via Homebrew.",
    optional: true,
  },
  {
    id: "prereq_python",
    category: "prerequisites",
    label: "Python 3",
    description: "Python 3 via Homebrew (`python@3`).",
    optional: true,
  },
  {
    id: "git_identity",
    category: "git",
    label: "Identidade Git global",
    description: "Configura `user.name` e `user.email` globais nesta máquina.",
    optional: true,
    configKeys: ["gitUserName", "gitUserEmail"],
  },
  {
    id: "ssh_key",
    category: "ssh",
    label: "Chave SSH",
    description:
      "Gera ed25519 se não existir e mostra a chave pública para colar no provedor.",
    optional: true,
    configKeys: ["sshKeyComment", "gitUserEmail"],
  },
  {
    id: "clone_repos",
    category: "clone",
    label: "Clonar repositórios",
    description: "Clona uma lista de URLs (git@ ou https) para um diretório.",
    optional: true,
    configKeys: ["cloneUrls", "cloneDir"],
  },
  {
    id: "cli_gh",
    category: "clis",
    label: "GitHub CLI (gh)",
    description: "Instala `gh`. Token opcional para `gh auth login --with-token`.",
    optional: true,
    configKeys: ["ghToken"],
  },
  {
    id: "cli_glab",
    category: "clis",
    label: "GitLab CLI (glab)",
    description: "Instala `glab`. Token e host opcionais para autenticação.",
    optional: true,
    configKeys: ["gitlabToken", "gitlabHost"],
  },
];

export type MachineSetupRecipeConfig = {
  gitUserName?: string;
  gitUserEmail?: string;
  cloneUrls?: string[];
  cloneDir?: string;
  ghToken?: string;
  gitlabToken?: string;
  gitlabHost?: string;
  sshKeyComment?: string;
  /** Se true, o script exportado inclui tokens (uso local / pendrive). Padrão: false. */
  includeSecretsInScript?: boolean;
};

export type MachineSetupRecipe = {
  selectedStepIds: MachineSetupStepId[];
  config: MachineSetupRecipeConfig;
};

export function stepsForCategory(
  category: MachineSetupCategory,
): MachineSetupStepDef[] {
  return MACHINE_SETUP_CATALOG.filter((step) => step.category === category);
}

export function getMachineSetupStep(
  id: MachineSetupStepId,
): MachineSetupStepDef | undefined {
  return MACHINE_SETUP_CATALOG.find((step) => step.id === id);
}

/** Recipe vazio — tudo desmarcado; o usuário monta o próprio setup. */
export function emptyMachineSetupRecipe(): MachineSetupRecipe {
  return {
    selectedStepIds: [],
    config: {
      cloneDir: "~/Projects",
      gitlabHost: "gitlab.com",
      includeSecretsInScript: false,
    },
  };
}
