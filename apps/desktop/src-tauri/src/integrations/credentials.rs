use super::types::{ClickUpCredentials, JiraCredentials};
use keyring::Entry;

const SERVICE_NAME: &str = "wcp";

pub fn credential_key_for_connection(connection_id: &str) -> String {
    format!("integration/{connection_id}")
}

pub fn load_connection_credentials(connection_id: &str) -> Result<String, String> {
    load_credentials(&credential_key_for_connection(connection_id))
}

pub fn has_connection_credentials(connection_id: &str) -> bool {
    load_connection_credentials(connection_id).is_ok()
}

fn keyring_account(credential_key: &str) -> &str {
    credential_key
        .strip_prefix("integration/")
        .unwrap_or(credential_key)
}

fn keyring_entry(credential_key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, keyring_account(credential_key))
        .map_err(|error| format!("Falha ao acessar keychain: {error}"))
}

pub fn store_credentials(credential_key: &str, secret_json: &str) -> Result<(), String> {
    let entry = keyring_entry(credential_key)?;
    entry
        .set_password(secret_json)
        .map_err(|error| format!("Falha ao salvar credenciais: {error}"))
}

pub fn load_credentials(credential_key: &str) -> Result<String, String> {
    let entry = keyring_entry(credential_key)?;
    entry
        .get_password()
        .map_err(|error| format!("Credenciais nao encontradas: {error}"))
}

pub fn has_credentials(credential_key: &str) -> bool {
    load_credentials(credential_key).is_ok()
}

pub fn delete_credentials(credential_key: &str) -> Result<(), String> {
    let entry = keyring_entry(credential_key)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Falha ao remover credenciais: {error}")),
    }
}

pub fn parse_jira_credentials(secret_json: &str) -> Result<JiraCredentials, String> {
    serde_json::from_str(secret_json)
        .map_err(|error| format!("Credenciais Jira invalidas: {error}"))
}

pub fn parse_clickup_credentials(secret_json: &str) -> Result<ClickUpCredentials, String> {
    serde_json::from_str(secret_json)
        .map_err(|error| format!("Credenciais ClickUp invalidas: {error}"))
}

pub fn build_jira_secret(email: &str, api_token: &str) -> Result<String, String> {
    serde_json::to_string(&JiraCredentials {
        email: email.trim().to_string(),
        api_token: api_token.trim().to_string(),
    })
    .map_err(|error| format!("Falha ao serializar credenciais Jira: {error}"))
}

pub fn build_clickup_secret(api_token: &str) -> Result<String, String> {
    serde_json::to_string(&ClickUpCredentials {
        api_token: api_token.trim().to_string(),
    })
    .map_err(|error| format!("Falha ao serializar credenciais ClickUp: {error}"))
}
