use std::sync::Mutex;
use fs2::FileExt;
use tauri::{Emitter, Manager};

struct PendingFiles(Mutex<Vec<String>>);

#[tauri::command]
fn get_pending_files(state: tauri::State<PendingFiles>) -> Vec<String> {
    state.0.lock().unwrap().drain(..).collect::<Vec<_>>()
}

#[tauri::command]
fn read_file_raw(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

fn percent_decode(s: &str) -> String {
    let mut bytes = Vec::new();
    let mut chars = s.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            if let (Some(h1), Some(h2)) = (chars.next(), chars.next()) {
                let hex = [h1, h2];
                if let Ok(hex_str) = std::str::from_utf8(&hex) {
                    if let Ok(decoded) = u8::from_str_radix(hex_str, 16) {
                        bytes.push(decoded);
                        continue;
                    }
                }
                bytes.push(b'%');
                bytes.push(h1);
                bytes.push(h2);
            } else {
                bytes.push(b'%');
            }
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

fn strip_file_url(raw: &str) -> String {
    let decoded = percent_decode(raw);
    if let Some(rest) = decoded.strip_prefix("file://localhost") {
        rest.to_string()
    } else if let Some(rest) = decoded.strip_prefix("file://") {
        if rest.starts_with('/') {
            rest.to_string()
        } else {
            format!("/{rest}")
        }
    } else {
        decoded
    }
}

const MD_EXTENSIONS: [&str; 7] = [".md", ".markdown", ".mdown", ".mkdn", ".mdwn", ".mdtxt", ".mdtext"];

fn filter_md_args(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1)
        .map(|a| strip_file_url(a))
        .filter(|a| {
            let lower = a.to_lowercase();
            MD_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
        })
        .collect()
}

fn lockfile_path() -> std::path::PathBuf {
    #[cfg(unix)]
    {
        let base = std::env::var_os("XDG_RUNTIME_DIR")
            .or_else(|| std::env::var_os("TMPDIR"))
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::PathBuf::from("/tmp"));
        base.join(format!("artymd-{}.lock", unsafe { libc::getuid() }))
    }
    #[cfg(not(unix))]
    {
        std::env::temp_dir().join("artymd.lock")
    }
}

fn argsfile_path() -> std::path::PathBuf {
    #[cfg(unix)]
    {
        let base = std::env::var_os("XDG_RUNTIME_DIR")
            .or_else(|| std::env::var_os("TMPDIR"))
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::PathBuf::from("/tmp"));
        base.join(format!("artymd-{}.args", unsafe { libc::getuid() }))
    }
    #[cfg(not(unix))]
    {
        std::env::temp_dir().join("artymd.args")
    }
}

#[tauri::command]
fn set_default_markdown_handler() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("xdg-mime")
            .args(["default", "ArtyMD.desktop", "text/markdown"])
            .output()
            .map_err(|e| format!("Failed to execute xdg-mime: {}", e))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("xdg-mime failed: {}", stderr));
        }
        Ok("ArtyMD set as default markdown handler".to_string())
    }
    #[cfg(target_os = "macos")]
    {
        match std::process::Command::new("duti")
            .args(["-s", "com.artymd.app", "net.daringfireball.markdown", "all"])
            .output()
        {
            Ok(out) if out.status.success() => {
                Ok("ArtyMD set as default markdown handler".to_string())
            }
            _ => Err("Could not set default handler automatically. Please set manually in System Settings > General > Default Apps.".to_string())
        }
    }
    #[cfg(target_os = "windows")]
    {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        let exe_str = exe_path.to_string_lossy().to_string();
        let _ = std::process::Command::new("cmd")
            .args(["/C", "assoc", ".md=ArtyMD.md"])
            .output();
        match std::process::Command::new("cmd")
            .args(["/C", "ftype", "ArtyMD.md", &format!("\"{}\" \"%1\"", exe_str)])
            .output()
        {
            Ok(out) if out.status.success() => {
                Ok("ArtyMD set as default markdown handler".to_string())
            }
            _ => Err("Could not set default handler automatically. Please set manually in Settings > Default Apps.".to_string())
        }
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err("Platform not supported for setting default handler".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let md_files = filter_md_args(&std::env::args().collect::<Vec<_>>());

    let lock_path = lockfile_path();
    let lock_file = match std::fs::OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .truncate(false)
        .open(&lock_path)
    {
        Ok(f) => f,
        Err(e) => {
            eprintln!("Failed to open lockfile {}: {}", lock_path.display(), e);
            std::process::exit(1);
        }
    };

    if lock_file.try_lock_exclusive().is_ok() {
        let app = tauri::Builder::default()
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_dialog::init())
            .manage(PendingFiles(Mutex::new(md_files.clone())))
            .invoke_handler(tauri::generate_handler![get_pending_files, set_default_markdown_handler, read_file_raw])
            .setup(|app| {
                if cfg!(debug_assertions) {
                    app.handle().plugin(
                        tauri_plugin_log::Builder::default()
                            .level(log::LevelFilter::Info)
                            .build(),
                    )?;
                }

                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    let args_path = argsfile_path();
                    let mut last_mtime = std::fs::metadata(&args_path)
                        .ok()
                        .and_then(|m| m.modified().ok());
                    loop {
                        std::thread::sleep(std::time::Duration::from_millis(400));
                        let mtime = match std::fs::metadata(&args_path)
                            .ok()
                            .and_then(|m| m.modified().ok())
                        {
                            Some(t) => t,
                            None => continue,
                        };
                        if Some(mtime) == last_mtime {
                            continue;
                        }
                        last_mtime = Some(mtime);
                        let contents = match std::fs::read_to_string(&args_path) {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        if contents.is_empty() {
                            continue;
                        }
                        let _ = std::fs::write(&args_path, "");
                        let files: Vec<String> = contents.lines().map(|s| s.to_string()).collect();
                        if !files.is_empty() {
                            let _ = app_handle.emit("open-files", files);
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

                Ok(())
            })
            .run(tauri::generate_context!())
            .expect("error while running tauri application");

        let _ = app;
    } else {
        let args_path = argsfile_path();
        if !md_files.is_empty() {
            let mut contents = String::new();
            for f in &md_files {
                contents.push_str(f);
                contents.push('\n');
            }
            let _ = std::fs::write(&args_path, contents);
        }
        eprintln!("Another instance of ArtyMD is already running. Forwarding files and exiting.");
        std::process::exit(0);
    }
}
