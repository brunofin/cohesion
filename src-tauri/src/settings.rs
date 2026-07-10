// ponytail: electron-store parity — nested "section.key" over a single JSON file.
// Whole-file read/write on every set (config is tiny). Upgrade path: debounce writes
// if settings ever get hot.
use std::path::PathBuf;
use std::sync::Mutex;

use serde_json::Value;

pub struct Settings {
    path: PathBuf,
    data: Mutex<Value>,
}

impl Settings {
    pub fn load(path: PathBuf) -> Self {
        let data = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| Value::Object(Default::default()));
        Settings {
            path,
            data: Mutex::new(data),
        }
    }

    fn key(section: &str, key: &str) -> String {
        format!("{section}.{key}")
    }

    pub fn get(&self, section: &str, key: &str) -> Value {
        let g = self.data.lock().unwrap();
        g.get(Self::key(section, key)).cloned().unwrap_or(Value::Null)
    }

    pub fn get_bool(&self, section: &str, key: &str, default: bool) -> bool {
        self.get(section, key).as_bool().unwrap_or(default)
    }

    pub fn get_strings(&self, section: &str, key: &str) -> Vec<String> {
        match self.get(section, key) {
            Value::Array(a) => a
                .into_iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect(),
            _ => Vec::new(),
        }
    }

    pub fn set(&self, section: &str, key: &str, value: Value) {
        {
            let mut g = self.data.lock().unwrap();
            if !g.is_object() {
                *g = Value::Object(Default::default());
            }
            g.as_object_mut()
                .unwrap()
                .insert(Self::key(section, key), value);
        }
        self.persist();
    }

    fn persist(&self) {
        let g = self.data.lock().unwrap();
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(s) = serde_json::to_string_pretty(&*g) {
            let _ = std::fs::write(&self.path, s);
        }
    }
}
