import { OrganizationAvatar } from "@/components/app-ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, FolderGit2, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type RepoPickerItem = {
  id: string;
  name: string;
  localPath?: string | null;
  providerHost?: string | null;
  projectName?: string | null;
  environmentName?: string | null;
  expectedGitUserName?: string | null;
  expectedGitUserEmail?: string | null;
};

export type RepoPickerGroup = {
  organizationId?: string | null;
  organizationName: string;
  organizationKind?: string | null;
  organizationLogoUrl?: string | null;
  repositories: RepoPickerItem[];
};

export function RepoPicker({
  groups,
  selectedRepoId,
  onSelect,
}: {
  groups: RepoPickerGroup[];
  selectedRepoId: string | null;
  onSelect: (repositoryId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        repositories: group.repositories.filter((repository) => {
          const haystack = [
            repository.name,
            repository.providerHost,
            repository.projectName,
            repository.localPath,
            group.organizationName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalized);
        }),
      }))
      .filter((group) => group.repositories.length > 0);
  }, [groups, query]);

  const totalCount = groups.reduce(
    (count, group) => count + group.repositories.length,
    0,
  );
  const selected = groups
    .flatMap((group) => group.repositories)
    .find((repository) => repository.id === selectedRepoId);
  const availabilityLabel =
    totalCount === 1
      ? "1 projeto disponivel"
      : `${totalCount} projetos disponiveis`;
  const headingDetail = selected
    ? `Selecionado: ${selected.name}`
    : availabilityLabel;

  return (
    <section className="repoPicker" aria-label="Escolher repositorio">
      <div className="repoPickerHeader">
        <div className="repoPickerHeading">
          <FolderGit2 className="h-4 w-4 text-primary" aria-hidden />
          <div>
            <h3>Escolher repositorio</h3>
            <p>{headingDetail}</p>
          </div>
        </div>
        <Badge variant="outline">{totalCount}</Badge>
      </div>

      {totalCount > 4 ? (
        <div className="repoPickerSearch">
          <Search className="repoPickerSearchIcon" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar por nome, host ou pasta..."
            className="repoPickerSearchInput"
            aria-label="Filtrar repositorios"
          />
        </div>
      ) : null}

      {filteredGroups.length === 0 ? (
        <p className="repoPickerEmpty">
          Nenhum repositorio encontrado com esse filtro.
        </p>
      ) : (
        <div className="repoPickerGroups">
          {filteredGroups.map((group) => (
            <div key={group.organizationName} className="repoPickerGroup">
              <div className="repoPickerGroupTitle">
                <OrganizationAvatar
                  name={group.organizationName}
                  kind={group.organizationKind}
                  logoUrl={group.organizationLogoUrl}
                  size="sm"
                />
                <span>{group.organizationName}</span>
                <Badge variant="secondary" className="repoPickerGroupCount">
                  {group.repositories.length}
                </Badge>
              </div>

              <div className="repoPickerGrid">
                {group.repositories.map((repository) => {
                  const active = selectedRepoId === repository.id;
                  return (
                    <button
                      key={repository.id}
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        "repoPickerCard",
                        active && "repoPickerCard-active",
                      )}
                      onClick={() => onSelect(repository.id)}
                    >
                      <span className="repoPickerCardTop">
                        <FolderGit2
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <span className="repoPickerCardName">
                          {repository.name}
                        </span>
                        {active ? (
                          <span className="repoPickerCheck" aria-hidden>
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </span>
                      <span className="repoPickerCardMeta">
                        {repository.providerHost?.trim() ||
                          "Host nao informado"}
                        {repository.projectName
                          ? ` · ${repository.projectName}`
                          : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected ? (
        <div className="repoPickerSelectedMeta">
          <article>
            <span>Pasta local</span>
            <strong>{selected.localPath?.trim() || "Nao configurada"}</strong>
          </article>
          {(selected.expectedGitUserName || selected.expectedGitUserEmail) && (
            <article>
              <span>Identidade esperada</span>
              <strong>
                {selected.expectedGitUserName ?? "—"}
                {selected.expectedGitUserEmail
                  ? ` <${selected.expectedGitUserEmail}>`
                  : ""}
              </strong>
            </article>
          )}
        </div>
      ) : null}
    </section>
  );
}
