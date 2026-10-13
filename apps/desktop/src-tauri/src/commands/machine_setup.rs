use crate::machine_setup::{
    export_script, probe_environment, run_recipe, MachineSetupExportResultDto,
    MachineSetupProbeResultDto, MachineSetupRecipeDto, MachineSetupRunResultDto,
};

#[tauri::command]
pub fn machine_setup_probe() -> Result<MachineSetupProbeResultDto, String> {
    Ok(probe_environment())
}

#[tauri::command]
pub fn machine_setup_run(recipe: MachineSetupRecipeDto) -> Result<MachineSetupRunResultDto, String> {
    if recipe.selected_step_ids.is_empty() {
        return Err("Selecione ao menos um passo opcional no recipe.".into());
    }
    Ok(run_recipe(&recipe))
}

#[tauri::command]
pub fn machine_setup_export_script(
    recipe: MachineSetupRecipeDto,
) -> Result<MachineSetupExportResultDto, String> {
    if recipe.selected_step_ids.is_empty() {
        return Err("Selecione ao menos um passo opcional para exportar o script.".into());
    }
    Ok(export_script(&recipe))
}
