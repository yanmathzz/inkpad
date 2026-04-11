use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Note {
    pub name: String,
    pub path: String,
    pub modified: u64,
}

/// Retorna a pasta padrão de notas: ~/Notas
#[tauri::command]
fn get_default_folder() -> String {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Notas")
        .to_string_lossy()
        .to_string()
}

/// Lista todos os arquivos .md em uma pasta, ordenados por data de modificação
#[tauri::command]
fn list_notes(folder: String) -> Result<Vec<Note>, String> {
    let path = PathBuf::from(&folder);

    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("Erro ao criar pasta: {e}"))?;
    }

    let mut notes: Vec<Note> = fs::read_dir(&path)
        .map_err(|e| format!("Erro ao ler pasta: {e}"))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .and_then(|s| s.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("md"))
                .unwrap_or(false)
        })
        .filter_map(|entry| {
            let p = entry.path();
            let name = p.file_stem()?.to_string_lossy().to_string();
            let path_str = p.to_string_lossy().to_string();
            let modified = entry
                .metadata()
                .ok()?
                .modified()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_secs();
            Some(Note {
                name,
                path: path_str,
                modified,
            })
        })
        .collect();

    notes.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(notes)
}

/// Lê o conteúdo de um arquivo .md
#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Erro ao ler nota: {e}"))
}

/// Salva conteúdo em um arquivo .md
#[tauri::command]
fn write_note(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Erro ao salvar nota: {e}"))
}

/// Cria um novo arquivo .md com conteúdo inicial
#[tauri::command]
fn create_note(folder: String, name: String) -> Result<String, String> {
    let base = PathBuf::from(&folder);

    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| format!("Erro ao criar pasta: {e}"))?;
    }

    // Garante nome único adicionando sufixo numérico se necessário
    let mut candidate = base.join(format!("{name}.md"));
    let mut counter = 2u32;
    while candidate.exists() {
        candidate = base.join(format!("{name}-{counter}.md"));
        counter += 1;
    }

    let title = candidate
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let initial_content = format!("# {title}\n\n");
    fs::write(&candidate, &initial_content)
        .map_err(|e| format!("Erro ao criar nota: {e}"))?;

    Ok(candidate.to_string_lossy().to_string())
}

/// Exclui um arquivo .md
#[tauri::command]
fn delete_note(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| format!("Erro ao excluir nota: {e}"))
}

/// Renomeia uma nota (move o arquivo)
#[tauri::command]
fn rename_note(old_path: String, folder: String, new_name: String) -> Result<String, String> {
    let new_path = PathBuf::from(&folder).join(format!("{new_name}.md"));
    if new_path.exists() {
        return Err("Já existe uma nota com esse nome".to_string());
    }
    fs::rename(&old_path, &new_path).map_err(|e| format!("Erro ao renomear: {e}"))?;
    Ok(new_path.to_string_lossy().to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_default_folder,
            list_notes,
            read_note,
            write_note,
            create_note,
            delete_note,
            rename_note,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o aplicativo");
}
