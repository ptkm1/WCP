use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodaySummary {
    pub executable_count: usize,
    pub blocked_count: usize,
    pub doing_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayFocusDto {
    pub headline: String,
    pub next_step: String,
    pub focus_kind: String,
    pub task_id: Option<String>,
    pub task_title: Option<String>,
    pub primary_repository_id: Option<String>,
    pub primary_repository_name: Option<String>,
    pub session_goal: Option<String>,
    pub blocker_label: Option<String>,
    pub dependency_label: Option<String>,
    pub resume_hint: Option<String>,
    pub signals: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkItemDto {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: i64,
    pub organization_id: Option<String>,
    pub project_id: Option<String>,
    pub primary_repository_id: Option<String>,
    pub blocked_reason: Option<String>,
    pub resume_summary: Option<String>,
    pub source_type: String,
    pub updated_at: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListItemDto {
    pub id: String,
    pub name: String,
    pub organization_id: Option<String>,
    pub description: Option<String>,
    pub is_active: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkItemResultDto {
    pub task: WorkItemDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDependencyDto {
    pub id: String,
    pub related_work_item_id: String,
    pub title: String,
    pub status: String,
    pub relation: String,
    pub dependency_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItemDto {
    pub id: String,
    pub daily_plan_id: String,
    pub work_item_id: String,
    pub position: usize,
    pub is_committed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverableContextCandidateDto {
    pub work_item_id: String,
    pub score: i64,
    pub reasons: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationCheckDto {
    pub key: String,
    pub status: String,
    pub expected: Option<String>,
    pub actual: Option<String>,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityValidationDto {
    pub status: String,
    pub checks: Vec<ValidationCheckDto>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryGuardrailDto {
    pub repository_id: String,
    pub repository_name: String,
    pub organization_id: Option<String>,
    pub organization_name: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub environment_name: Option<String>,
    pub identity_source: Option<String>,
    pub provider_host: Option<String>,
    pub remote_url: Option<String>,
    pub local_path: Option<String>,
    pub expected_git_user_name: Option<String>,
    pub expected_git_user_email: Option<String>,
    pub expected_ssh_host_alias: Option<String>,
    pub expected_branch_pattern: Option<String>,
    pub provider_username: Option<String>,
    pub provider_account_label: Option<String>,
    pub validation: Option<IdentityValidationDto>,
    pub chain_label: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardDto {
    pub summary: TodaySummary,
    pub today_focus: TodayFocusDto,
    pub current_task: Option<WorkItemDto>,
    pub active_session: Option<SessionLogDto>,
    pub recent_task_sessions: Vec<SessionLogDto>,
    pub task_notes: Vec<KnowledgeNoteDto>,
    pub task_artifacts: Vec<ArtifactDto>,
    pub today_plan: Vec<PlanItemDto>,
    pub recoverable_context: Vec<RecoverableContextCandidateDto>,
    pub guardrail: Option<RepositoryGuardrailDto>,
    pub backlog: Vec<WorkItemDto>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskContextDto {
    pub task: Option<WorkItemDto>,
    pub recent_task_sessions: Vec<SessionLogDto>,
    pub task_notes: Vec<KnowledgeNoteDto>,
    pub task_artifacts: Vec<ArtifactDto>,
    pub recoverable_context: Vec<RecoverableContextCandidateDto>,
    pub dependencies: Vec<TaskDependencyDto>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationListItemDto {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub is_active: bool,
    pub logo_path: Option<String>,
    pub environment_profile_id: Option<String>,
    pub environment_name: Option<String>,
    pub provider_type: Option<String>,
    pub provider_host: Option<String>,
    pub ssh_host_alias: Option<String>,
    pub git_user_name: Option<String>,
    pub git_user_email: Option<String>,
    pub branch_pattern: Option<String>,
    pub pr_convention: Option<String>,
    pub commit_convention: Option<String>,
    pub notes_json: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrganizationResultDto {
    pub organization: OrganizationListItemDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrganizationResultDto {
    pub organization: OrganizationListItemDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrganizationEnvironmentResultDto {
    pub organization: OrganizationListItemDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectResultDto {
    pub project: ProjectListItemDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectResultDto {
    pub project: ProjectListItemDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRepositoryContextResultDto {
    pub repository: RepositoryListItemDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedWorkContextDto {
    pub organization_id: Option<String>,
    pub organization_name: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub repository_id: Option<String>,
    pub repository_name: Option<String>,
    pub environment_profile_id: Option<String>,
    pub environment_name: Option<String>,
    pub identity_source: Option<String>,
    pub expected_git_user_name: Option<String>,
    pub expected_git_user_email: Option<String>,
    pub provider_host: Option<String>,
    pub branch_pattern: Option<String>,
    pub chain_label: Option<String>,
    pub gaps: Vec<String>,
    pub inferred_organization_from: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryListItemDto {
    pub id: String,
    pub name: String,
    pub local_path: Option<String>,
    pub provider_host: Option<String>,
    pub remote_url: Option<String>,
    pub default_branch: Option<String>,
    pub is_active: bool,
    pub organization_id: Option<String>,
    pub organization_name: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub environment_profile_id: Option<String>,
    pub environment_name: Option<String>,
    pub expected_git_user_name: Option<String>,
    pub expected_git_user_email: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLogDto {
    pub id: String,
    pub work_item_id: Option<String>,
    pub repository_id: Option<String>,
    pub branch_name: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub goal: Option<String>,
    pub decisions: Option<String>,
    pub result: Option<String>,
    pub source_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNoteDto {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub note_type: String,
    pub title: String,
    pub content: String,
    pub source_type: String,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactDto {
    pub id: String,
    pub repository_id: Option<String>,
    pub artifact_type: String,
    pub title: Option<String>,
    pub url: Option<String>,
    pub created_at: String,
    pub source_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyIdentityResultDto {
    pub repository_id: String,
    pub applied_changes: Vec<String>,
    pub validation: Option<IdentityValidationDto>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPrePushHookResultDto {
    pub repository_id: String,
    pub hook_path: String,
    pub installed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovePrePushHookResultDto {
    pub repository_id: String,
    pub removed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryHookStatusDto {
    pub repository_id: String,
    pub hook_path: Option<String>,
    pub installed: bool,
    pub managed_by_app: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionResultDto {
    pub session: SessionLogDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EndSessionResultDto {
    pub session: SessionLogDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveNoteResultDto {
    pub note: KnowledgeNoteDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachArtifactResultDto {
    pub artifact: ArtifactDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryMemoryDto {
    pub repository_id: String,
    pub notes: Vec<KnowledgeNoteDto>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultDto {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub detail: String,
    pub created_at: Option<String>,
    pub work_item_id: Option<String>,
    pub repository_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextEventDto {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub detail: String,
    pub created_at: String,
    pub work_item_id: Option<String>,
    pub work_item_title: Option<String>,
    pub repository_id: Option<String>,
    pub repository_name: Option<String>,
    pub organization_id: Option<String>,
    pub organization_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRepositoryInspectionDto {
    pub local_path: String,
    pub path_exists: bool,
    pub is_git_repo: bool,
    pub suggested_name: Option<String>,
    pub remote_url: Option<String>,
    pub provider_host: Option<String>,
    pub default_branch: Option<String>,
    pub git_user_name: Option<String>,
    pub git_user_email: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRepositoryResultDto {
    pub repository: RepositoryListItemDto,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRepositoryResultDto {
    pub repository: RepositoryListItemDto,
}

pub struct GitSnapshot {
    pub provider_host: Option<String>,
    pub git_user_name: Option<String>,
    pub git_user_email: Option<String>,
    pub ssh_host_alias: Option<String>,
    pub branch_name: Option<String>,
}
