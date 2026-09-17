use super::types::{ClickUpCredentials, JiraCredentials};
use keyring::Entry;
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

const SERVICE_NAME: &str = "wcp";
const VAULT_ACCOUNT: &str = "integrations-vault";

type VaultMap = HashMap<String, String>;

fn vault_cache() -> &'static Mutex<Option<VaultMap>> {
    static CACHE: OnceLock<Mutex<Option<VaultMap>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

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

fn vault_entry() -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, VAULT_ACCOUNT)
        .map_err(|error| format!("Falha ao acessar keychain: {error}"))
}

fn legacy_entry(credential_key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, keyring_account(credential_key))
        .map_err(|error| format!("Falha ao acessar keychain: {error}"))
}

fn serialize_vault(vault: &VaultMap) -> Result<String, String> {
    let mut map = Map::new();
    for (key, secret) in vault {
        map.insert(key.clone(), Value::String(secret.clone()));
    }
    serde_json::to_string(&Value::Object(map))
        .map_err(|error| format!("Falha ao serializar cofre de credenciais: {error}"))
}

fn deserialize_vault(raw: &str) -> Result<VaultMap, String> {
    let value: Value = serde_json::from_str(raw)
        .map_err(|error| format!("Cofre de credenciais invalido: {error}"))?;
    let object = value
        .as_object()
        .ok_or_else(|| "Cofre de credenciais invalido: esperado objeto JSON".to_string())?;

    let mut vault = VaultMap::new();
    for (key, secret) in object {
        let Some(secret) = secret.as_str() else {
            continue;
        };
        if !secret.trim().is_empty() {
            vault.insert(key.clone(), secret.to_string());
        }
    }
    Ok(vault)
}

fn read_vault_from_keychain() -> Result<VaultMap, String> {
    let entry = vault_entry()?;
    match entry.get_password() {
        Ok(raw) => deserialize_vault(&raw),
        Err(keyring::Error::NoEntry) => Ok(VaultMap::new()),
        Err(error) => Err(format!("Falha ao ler cofre de credenciais: {error}")),
    }
}

fn write_vault_to_keychain(vault: &VaultMap) -> Result<(), String> {
    let entry = vault_entry()?;
    let raw = serialize_vault(vault)?;
    entry
        .set_password(&raw)
        .map_err(|error| format!("Falha ao salvar cofre de credenciais: {error}"))
}

fn ensure_vault_loaded(guard: &mut Option<VaultMap>) -> Result<(), String> {
    if guard.is_some() {
        return Ok(());
    }
    *guard = Some(read_vault_from_keychain()?);
    Ok(())
}

fn migrate_legacy_credential(vault: &mut VaultMap, credential_key: &str) -> Result<bool, String> {
    if vault.contains_key(credential_key) {
        return Ok(false);
    }

    let entry = legacy_entry(credential_key)?;
    match entry.get_password() {
        Ok(secret) if !secret.trim().is_empty() => {
            vault.insert(credential_key.to_string(), secret);
            let _ = entry.delete_credential();
            Ok(true)
        }
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(format!("Credenciais nao encontradas: {error}")),
    }
}

pub fn store_credentials(credential_key: &str, secret_json: &str) -> Result<(), String> {
    let mut cache = vault_cache()
        .lock()
        .map_err(|_| "Falha ao travar cache de credenciais".to_string())?;
    ensure_vault_loaded(&mut cache)?;

    let vault = cache
        .as_mut()
        .expect("vault loaded");
    vault.insert(credential_key.to_string(), secret_json.to_string());
    write_vault_to_keychain(vault)?;

    // Limpa entrada legada se ainda existir (evita prompts extras no futuro).
    if let Ok(entry) = legacy_entry(credential_key) {
        let _ = entry.delete_credential();
    }

    Ok(())
}

pub fn load_credentials(credential_key: &str) -> Result<String, String> {
    let mut cache = vault_cache()
        .lock()
        .map_err(|_| "Falha ao travar cache de credenciais".to_string())?;
    ensure_vault_loaded(&mut cache)?;

    let vault = cache
        .as_mut()
        .expect("vault loaded");

    if let Some(secret) = vault.get(credential_key).cloned() {
        return Ok(secret);
    }

    let migrated = migrate_legacy_credential(vault, credential_key)?;
    if migrated {
        write_vault_to_keychain(vault)?;
        if let Some(secret) = vault.get(credential_key).cloned() {
            return Ok(secret);
        }
    }

    Err("Credenciais nao encontradas: NoEntry".to_string())
}

pub fn has_credentials(credential_key: &str) -> bool {
    load_credentials(credential_key).is_ok()
}

pub fn delete_credentials(credential_key: &str) -> Result<(), String> {
    let mut cache = vault_cache()
        .lock()
        .map_err(|_| "Falha ao travar cache de credenciais".to_string())?;
    ensure_vault_loaded(&mut cache)?;

    let vault = cache
        .as_mut()
        .expect("vault loaded");
    vault.remove(credential_key);
    write_vault_to_keychain(vault)?;

    if let Ok(entry) = legacy_entry(credential_key) {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(error) => {
                return Err(format!("Falha ao remover credenciais legadas: {error}"));
            }
        }
    }

    Ok(())
}

/// Prefetch do cofre no boot — concentra o unlock do Keychain em uma unica leitura.
pub fn prefetch_credentials_vault() {
    let Ok(mut cache) = vault_cache().lock() else {
        return;
    };
    let _ = ensure_vault_loaded(&mut cache);
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
