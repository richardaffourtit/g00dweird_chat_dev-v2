#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.cwd());
const script = path.join(root, "scripts", "extract_wall_glyphs.py");
const result = spawnSync("python3", [script], { stdio: "inherit" });

process.exit(result.status ?? 1);
