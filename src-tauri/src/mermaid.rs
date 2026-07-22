use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FixEntry {
    pub description: String,
    pub line: usize,
    pub original_text: String,
    pub fixed_text: String,
}

#[derive(Debug, Serialize)]
pub struct MermaidFixResult {
    pub original: String,
    pub fixed: String,
    pub fixes_applied: Vec<FixEntry>,
    pub diagram_type: String,
}

pub fn fix_mermaid_diagram(code: &str) -> MermaidFixResult {
    let original = code.to_string();
    let mut fixes: Vec<FixEntry> = Vec::new();
    let diagram_type = detect_diagram_type(code);

    let mut cleaned = code.trim().to_string();
    cleaned = cleaned.replace("\r\n", "\n").replace('\r', "\n");

    // 1. Strip HTML comments
    let re = regex::Regex::new(r"<!--[\s\S]*?-->").unwrap();
    cleaned = re.replace_all(&cleaned, "").to_string();

    // 2. Unescape double-encoded HTML entities
    cleaned = cleaned.replace("&amp;", "&");
    cleaned = cleaned.replace("&lt;", "<");
    cleaned = cleaned.replace("&gt;", ">");

    let is_flowchart = diagram_type == "graph" || diagram_type == "flowchart";

    if is_flowchart {
        // 3. Normalize spaced arrow typos
        let arrow_fixes = [
            (r"-\s+->", "-->"),
            (r"--\s+>", "-->"),
            (r"==\s+>", "==>"),
            (r"=\s+=>", "==>"),
            (r"-\.\s+->", "-.->"),
            (r"-\.-\s+>", "-.->"),
        ];
        for (pattern, replacement) in &arrow_fixes {
            let re = regex::Regex::new(pattern).unwrap();
            if re.is_match(&cleaned) {
                let before = cleaned.clone();
                cleaned = re.replace_all(&cleaned, *replacement).to_string();
                if cleaned != before {
                    fixes.push(FixEntry {
                        description: format!("Normalized arrow typo: {} → {}", pattern, replacement),
                        line: 0,
                        original_text: before,
                        fixed_text: cleaned.clone(),
                    });
                }
            }
        }

        // 4. Single-dash arrow: A -> B → A --> B
        {
            let re = regex::Regex::new(r"(?m)^(\s*)([a-zA-Z0-9_]+)\s+->\s+([a-zA-Z0-9_]+)").unwrap();
            if re.is_match(&cleaned) {
                let before = cleaned.clone();
                cleaned = re.replace_all(&cleaned, "${1}${2} --> ${3}").to_string();
                if cleaned != before {
                    fixes.push(FixEntry {
                        description: "Fixed single-dash arrow: -> → -->".to_string(),
                        line: 0,
                        original_text: before,
                        fixed_text: cleaned.clone(),
                    });
                }
            }
        }

        // 5. Single-equals thick arrow: A => B → A ==> B
        {
            let re = regex::Regex::new(r"(?m)^(\s*)([a-zA-Z0-9_]+)\s+=>\s+([a-zA-Z0-9_]+)").unwrap();
            if re.is_match(&cleaned) {
                let before = cleaned.clone();
                cleaned = re.replace_all(&cleaned, "${1}${2} ==> ${3}").to_string();
                if cleaned != before {
                    fixes.push(FixEntry {
                        description: "Fixed single-equals thick arrow: => → ==>".to_string(),
                        line: 0,
                        original_text: before,
                        fixed_text: cleaned.clone(),
                    });
                }
            }
        }
    }

    // 6. Normalize direction casing in graph/flowchart declarations
    {
        let re = regex::Regex::new(r"(?i)^(\s*(?:graph|flowchart)\s+)(td|lr|rl|bt)\b").unwrap();
        if re.is_match(&cleaned) {
            let before = cleaned.clone();
            cleaned = re
                .replace_all(&cleaned, |caps: &regex::Captures| {
                    format!("{}{}", &caps[1], caps[2].to_uppercase())
                })
                .to_string();
            if cleaned != before {
                fixes.push(FixEntry {
                    description: "Normalized direction casing".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: cleaned.clone(),
                });
            }
        }
    }

    // 7. Auto-quote unquoted subgraph titles
    if is_flowchart {
        let re = regex::Regex::new(r#"(?i)^(\s*subgraph\s+)([^"\[\]]+)$"#).unwrap();
        if re.is_match(&cleaned) {
            let before = cleaned.clone();
            cleaned = re
                .replace_all(&cleaned, |caps: &regex::Captures| {
                    format!("{}\"{}\"", &caps[1], caps[2].trim())
                })
                .to_string();
            if cleaned != before {
                fixes.push(FixEntry {
                    description: "Auto-quoted subgraph title".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: cleaned.clone(),
                });
            }
        }
    }

    // 8. Auto-quote edge annotations with parens
    if is_flowchart {
        let re = regex::Regex::new(r#"--\s+([^"\n|]+?\([^\n|]+\)[^"\n|]*?)\s+-->"#).unwrap();
        let before = cleaned.clone();
        cleaned = re
            .replace_all(&cleaned, |caps: &regex::Captures| {
                format!("-- {} -->", quote_if_needed(&caps[1]))
            })
            .to_string();
        if cleaned != before {
            fixes.push(FixEntry {
                description: "Auto-quoted edge annotation".to_string(),
                line: 0,
                original_text: before,
                fixed_text: cleaned.clone(),
            });
        }
    }

    // 9. Auto-quote node labels in various shapes (Flowcharts only, lookaround-free regexes)
    if is_flowchart {
        let node_patterns = [
            (r"\b([a-zA-Z0-9_\-]+)\(\[\s*(.*?)\s*\]\)", "([", "]"),
            (r"\b([a-zA-Z0-9_\-]+)\[\[\s*(.*?)\s*\]\]", "[[", "]"),
            (r"\b([a-zA-Z0-9_\-]+)\[\(\s*(.*?)\s*\)\]", "[(", ")"),
            (r"\b([a-zA-Z0-9_\-]+)\(\(\s*(.*?)\s*\)\)", "((", ")"),
            (r"\b([a-zA-Z0-9_\-]+)\[\s*([^\]\(\[\n]+?)\s*\]", "[", "]"),
            (r"\b([a-zA-Z0-9_\-]+)\{\s*([^\}\n]+?)\s*\}", "{", "}"),
            (r"\b([a-zA-Z0-9_\-]+)>\s*([^\]\n]+?)\s*\]", ">[", "]"),
            (r"\b([a-zA-Z0-9_\-]+)\(\s*([^\)\(\[\n]+?)\s*\)", "(", ")"),
        ];
        for (pattern, open, close) in &node_patterns {
            let re = regex::Regex::new(pattern).unwrap();
            if re.is_match(&cleaned) {
                let before = cleaned.clone();
                cleaned = re
                    .replace_all(&cleaned, |caps: &regex::Captures| {
                        let id = &caps[1];
                        let label = &caps[2];
                        let quoted = quote_if_needed(label);
                        format!("{}{}{}{}", id, open, quoted, close)
                    })
                    .to_string();
                if cleaned != before {
                    fixes.push(FixEntry {
                        description: format!("Auto-quoted node label in {}...{}", open, close),
                        line: 0,
                        original_text: before,
                        fixed_text: cleaned.clone(),
                    });
                }
            }
        }
    }

    // 10. Fix // and # comments to %% comments
    {
        let re = regex::Regex::new(r"(?m)^(\s*)(//|#)(.*)$").unwrap();
        if re.is_match(&cleaned) {
            let before = cleaned.clone();
            cleaned = re.replace_all(&cleaned, "${1}%%${3}").to_string();
            if cleaned != before {
                fixes.push(FixEntry {
                    description: "Fixed comment syntax: // or # → %%".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: cleaned.clone(),
                });
            }
        }
    }

    // 11. Fix style/classDef missing commas between properties
    {
        let re = regex::Regex::new(r"(?i)((?:fill|stroke|color|font-size|stroke-width|opacity|text-anchor|font-family|font-weight)[^,;\s]+)\s+((?:fill|stroke|color|font-size|stroke-width|opacity|text-anchor|font-family|font-weight))").unwrap();
        if re.is_match(&cleaned) {
            let before = cleaned.clone();
            cleaned = re.replace_all(&cleaned, "$1,$2").to_string();
            if cleaned != before {
                fixes.push(FixEntry {
                    description: "Fixed style/classDef missing commas".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: cleaned.clone(),
                });
            }
        }
    }

    // 12. Fix `end` as node ID (lowercase)
    if is_flowchart {
        let re = regex::Regex::new(r"(?m)^(\s*)end\s*(\[|\(|\{|\()").unwrap();
        if re.is_match(&cleaned) {
            let before = cleaned.clone();
            cleaned = re.replace_all(&cleaned, "${1}End$2").to_string();
            if cleaned != before {
                fixes.push(FixEntry {
                    description: "Fixed 'end' as node ID → 'End'".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: cleaned.clone(),
                });
            }
        }
    }

    // 13. Fix wrong diagram type keywords: flow chart, flow-chart → flowchart
    {
        let re = regex::Regex::new(r"(?i)^(\s*)flow[- ]chart\b").unwrap();
        if re.is_match(&cleaned) {
            let before = cleaned.clone();
            cleaned = re.replace_all(&cleaned, "${1}flowchart").to_string();
            if cleaned != before {
                fixes.push(FixEntry {
                    description: "Fixed diagram type: flow chart → flowchart".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: cleaned.clone(),
                });
            }
        }
    }

    // 14. Fix missing diagram type: if no type detected, prepend graph TD
    if diagram_type == "unknown" && !cleaned.is_empty() {
        let has_diagram_content = regex::Regex::new(r"--[>-]|\b\w+\[|\b\w+\(|\b\w+\{").unwrap().is_match(&cleaned);
        if has_diagram_content {
            let before = cleaned.clone();
            cleaned = format!("graph TD\n{}", cleaned);
            if cleaned != before {
                fixes.push(FixEntry {
                    description: "Prepended missing diagram type: graph TD".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: cleaned.clone(),
                });
            }
        }
    }

    // 15. Type-specific fixes
    match diagram_type.as_str() {
        "sequenceDiagram" => fix_sequence_diagram(&mut cleaned, &mut fixes),
        "classDiagram" => fix_class_diagram(&mut cleaned, &mut fixes),
        "stateDiagram" | "stateDiagram-v2" => fix_state_diagram(&mut cleaned, &mut fixes),
        "gantt" => fix_gantt(&mut cleaned, &mut fixes),
        "erDiagram" => fix_er_diagram(&mut cleaned, &mut fixes),
        "gitGraph" => fix_git_graph(&mut cleaned, &mut fixes),
        "pie" => fix_pie(&mut cleaned, &mut fixes),
        "timeline" => fix_timeline(&mut cleaned, &mut fixes),
        "mindmap" => fix_mindmap(&mut cleaned, &mut fixes),
        _ => {}
    }

    MermaidFixResult {
        original,
        fixed: cleaned,
        fixes_applied: fixes,
        diagram_type,
    }
}

fn detect_diagram_type(code: &str) -> String {
    let re = regex::Regex::new(
        r"(?i)^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|gitGraph|mindmap|timeline|architecture|journey|sankey|requirementDiagram|quadrantChart|blockDiagram|networkDiagram|kanban|xychart|c4|radar|venn|packet|info|showAndTell)\b",
    )
    .unwrap();
    if let Some(caps) = re.captures(code) {
        let raw = caps[1].to_string();
        match raw.to_lowercase().as_str() {
            "graph" => "graph".to_string(),
            "flowchart" => "flowchart".to_string(),
            "sequencediagram" => "sequenceDiagram".to_string(),
            "classdiagram" => "classDiagram".to_string(),
            "statediagram" => "stateDiagram".to_string(),
            "statediagram-v2" => "stateDiagram-v2".to_string(),
            "erdiagram" => "erDiagram".to_string(),
            "gantt" => "gantt".to_string(),
            "pie" => "pie".to_string(),
            "gitgraph" => "gitGraph".to_string(),
            "mindmap" => "mindmap".to_string(),
            "timeline" => "timeline".to_string(),
            "architecture" => "architecture".to_string(),
            _ => raw,
        }
    } else {
        "unknown".to_string()
    }
}

fn quote_if_needed(text: &str) -> String {
    let t = text.trim();
    if t.is_empty() {
        return t.to_string();
    }
    if (t.starts_with('"') && t.ends_with('"')) || (t.starts_with('\'') && t.ends_with('\'')) {
        return t.to_string();
    }
    if t.contains('(') || t.contains(')') || t.contains('[') || t.contains(']')
        || t.contains('{') || t.contains('}') || t.contains('#') || t.contains(':')
        || t.contains(',')
    {
        let escaped = t.replace('"', "'");
        format!("\"{}\"", escaped)
    } else {
        t.to_string()
    }
}

fn fix_sequence_diagram(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Fix note syntax: ensure proper formatting
    {
        let re = regex::Regex::new(r"(?i)^(\s*note\s+(?:over|right\s+of|left\s+of)\s+)([A-Za-z]\w*)(:\s*.*)").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{}{}{}", &caps[1], &caps[2], &caps[3])
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed note syntax in sequenceDiagram".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix note missing "of": note right A → note right of A
    {
        let re = regex::Regex::new(r"(?i)^(\s*note\s+(?:right|left))\s+([A-Za-z]\w*)").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                if &caps[2] == "of" {
                    caps[0].to_string()
                } else {
                    format!("{} of {}", &caps[1], &caps[2])
                }
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed note missing 'of': note right A → note right of A".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix activate/deactivate wrong case
    {
        let re = regex::Regex::new(r"(?i)^(\s*)(Activate|Deactivate)\b").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{}{}", &caps[1], caps[2].to_lowercase())
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Normalized activate/deactivate case".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix missing colon before message text: A->>B Hello → A->>B: Hello
    {
        let re = regex::Regex::new(r"(?m)^(\s*)([A-Za-z]\w*)(-{1,2}>>?)([A-Za-z]\w*)\s+([^:\n]+)$").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1$2$3$4: $5").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed missing colon in sequence message".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix single-dash sequence arrow: A->B → A->>B
    {
        let re = regex::Regex::new(r"(?m)^(\s*)([A-Za-z]\w*)->([A-Za-z]\w*)").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1$2->>$3").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed single-dash sequence arrow: -> → ->>".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

fn fix_class_diagram(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Fix relationship markers: ensure proper spacing
    {
        let re = regex::Regex::new(
            r"(?i)([A-Za-z]\w*)\s*(<\|--|--\|>|\|--|\|--\||---|\|\|--|--\|\||\.\.\|>|<\|\.\.|\|\.\.<\|)\s*([A-Za-z]\w*)",
        )
        .unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{} {} {}", &caps[1], &caps[2], &caps[3])
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Normalized class relationship spacing".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix angle brackets to tildes for generics: List<int> → List~int~
    {
        let re = regex::Regex::new(r"<(\w+)>").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "~$1~").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed generic type syntax: <int> → ~int~".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

fn fix_state_diagram(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Fix state transitions: ensure proper arrow syntax
    {
        let re = regex::Regex::new(r"(?i)([A-Za-z]\w*)\s*:\s*([A-Za-z]\w*)\s*-->").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{} --> {}", &caps[1], &caps[2])
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed state transition syntax".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix single-dash state transition: Idle -> Processing → Idle --> Processing
    {
        let re = regex::Regex::new(r"(?i)([A-Za-z]\w*)\s+->\s+([A-Za-z]\w*)").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1 --> $2").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed single-dash state transition: -> → -->".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

fn fix_gantt(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Fix dateFormat normalization
    {
        let re = regex::Regex::new(r"(?i)^(\s*dateFormat\s+)([^\n]+)").unwrap();
        if let Some(caps) = re.captures(code) {
            let fmt = caps[2].trim();
            if fmt != "YYYY-MM-DD" && !fmt.starts_with('%') {
                let before = code.clone();
                *code = re.replace(code, "${1}YYYY-MM-DD").to_string();
                if *code != before {
                    fixes.push(FixEntry {
                        description: "Normalized gantt dateFormat".to_string(),
                        line: 0,
                        original_text: before,
                        fixed_text: code.clone(),
                    });
                }
            }
        }
    }

    // Fix task missing colon: task1, 2024-01-01, 3d → task1 : 2024-01-01, 3d
    {
        let re = regex::Regex::new(r"(?m)^(\s*)([A-Za-z][\w\s]*\w)\s*,\s*(\d{4})").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1$2 : $3").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed gantt task missing colon".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix task missing commas: task1 : crit 2024-01-01 3d → task1 : crit, 2024-01-01, 3d
    {
        let re = regex::Regex::new(r"(?m)^(\s*)([A-Za-z][\w\s]*\w)\s*:\s*(\w+)\s+(\d{4})").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1$2 : $3, $4").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed gantt task missing commas".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

fn fix_er_diagram(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Fix entity definition syntax
    {
        let re = regex::Regex::new(r"(?i)^(\s*)([A-Za-z]\w*)\s*\{").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{}{} {{", &caps[1], &caps[2])
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Normalized erDiagram entity syntax".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix entity name with spaces: My Entity { → "My Entity" {
    {
        let re = regex::Regex::new(r#"(?m)^(\s*)([A-Za-z][\w\s]+\w)\s*\{$"#).unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{}{} {{", &caps[1], quote_if_needed(&caps[2]))
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Quoted erDiagram entity name with spaces".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix relationship markers
    {
        let re = regex::Regex::new(
            r"(?i)([A-Za-z][\w-]*)\s*((?:\|\||\||o{1,2})\{?)\s*--\s*((?:\|\||\||o{1,2})\{?)\s*([A-Za-z][\w-]*)",
        )
        .unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{} {}--{} {}", &caps[1], &caps[2], &caps[3], &caps[4])
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Normalized erDiagram relationship spacing".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

fn fix_git_graph(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Fix missing colon after orientation: gitGraph LR → gitGraph LR:
    {
        let re = regex::Regex::new(r"(?i)^(\s*gitGraph\s+)(LR|TD|BT|RL)\b").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                let full = &caps[0];
                if full.ends_with(':') {
                    full.to_string()
                } else {
                    format!("{}:", full)
                }
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed gitGraph missing colon after orientation".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix branch/checkout syntax
    {
        let re = regex::Regex::new(r"(?i)^(\s*)branch\s+([A-Za-z]\w*)$").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{}branch {}", &caps[1], &caps[2])
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Normalized gitGraph branch syntax".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix branch name with spaces: branch my branch → branch "my branch"
    {
        let re = regex::Regex::new(r#"(?i)^(\s*)branch\s+(\w+\s+\w+)$"#).unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1branch \"$2\"").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Quoted gitGraph branch name with spaces".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix checkout syntax
    {
        let re = regex::Regex::new(r"(?i)^(\s*)checkout\s+([A-Za-z]\w*)$").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{}checkout {}", &caps[1], &caps[2])
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Normalized gitGraph checkout syntax".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

fn fix_pie(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Fix pie data entries: ensure proper format
    {
        let re = regex::Regex::new(r#"(?i)^(\s*)"([^"]+)"\s*:\s*(\d+)$"#).unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, |caps: &regex::Captures| {
                format!("{}\"{}\" : {}", &caps[1], &caps[2], &caps[3])
            }).to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Normalized pie data format".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }

    // Fix unquoted pie label: Label : 15 → "Label" : 15
    {
        let re = regex::Regex::new(r"(?m)^(\s*)([A-Za-z][\w\s]*\w)\s*:\s*(\d+)$").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1\"$2\" : $3").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Quoted unquoted pie label".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

fn fix_timeline(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Fix wrong separator: 2020 - Event → 2020 : Event
    {
        let re = regex::Regex::new(r"(?m)^(\s*)(\d{4})\s+-\s+(\w+)").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1$2 : $3").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed timeline separator: - → :".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

fn fix_mindmap(code: &mut String, fixes: &mut Vec<FixEntry>) {
    // Mindmap-specific fixes
    {
        let re = regex::Regex::new(r"^(\s*)(\w[\w\s]*\w)\(\((.+?)\)\)").unwrap();
        if re.is_match(code) {
            let before = code.clone();
            *code = re.replace_all(code, "$1$2[$3]").to_string();
            if *code != before {
                fixes.push(FixEntry {
                    description: "Fixed mindmap root node shape".to_string(),
                    line: 0,
                    original_text: before,
                    fixed_text: code.clone(),
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_example_diagrams() {
        let code1 = "graph TD\n  A[Start (v1)] --> B{Valid?}\n  B --> C[(Database (v2))]";
        let res1 = fix_mermaid_diagram(code1);
        assert!(!res1.fixed.is_empty());

        let code2 = "sequenceDiagram\n  Alice->>John: Hello (World)\n  John-->>Alice: OK (Thanks)";
        let res2 = fix_mermaid_diagram(code2);
        assert_eq!(res2.diagram_type, "sequenceDiagram");
    }
}
