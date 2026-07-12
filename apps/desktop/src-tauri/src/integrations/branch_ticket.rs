pub fn extract_ticket_keys_from_branch(branch: &str) -> Vec<String> {
    let upper = branch.to_uppercase();
    let mut keys = Vec::new();
    let bytes = upper.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if !bytes[index].is_ascii_uppercase() {
            index += 1;
            continue;
        }

        let start = index;
        index += 1;
        while index < bytes.len() && (bytes[index].is_ascii_uppercase() || bytes[index].is_ascii_digit()) {
            index += 1;
        }

        if index < bytes.len() && bytes[index] == b'-' {
            let dash = index;
            index += 1;
            let number_start = index;
            while index < bytes.len() && bytes[index].is_ascii_digit() {
                index += 1;
            }
            if index > number_start {
                keys.push(upper[start..index].to_string());
            } else {
                index = dash + 1;
            }
        } else {
            index = start + 1;
        }
    }

    keys.sort();
    keys.dedup();
    keys
}

#[cfg(test)]
mod tests {
    use super::extract_ticket_keys_from_branch;

    #[test]
    fn extracts_jira_key_from_branch() {
        assert_eq!(
            extract_ticket_keys_from_branch("feat/WCP-99-login"),
            vec!["WCP-99".to_string()]
        );
    }
}
