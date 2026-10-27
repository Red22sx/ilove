// Gera snack-ready/: apenas o que o Expo Snack precisa (sem testes, supabase/, docs/ e ferramentas de desenvolvimento).
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = "snack-ready";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync("App.tsx", join(out, "App.tsx"));
cpSync("app.json", join(out, "app.json"));
const walk = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    if (statSync(src).isDirectory()) walk(src, join(to, name));
    else if (!/\.test\.tsx?$/.test(name)) cpSync(src, join(to, name));
  }
};
walk("src", join(out, "src"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync(join(out, "package.json"), JSON.stringify({ name: pkg.name, version: pkg.version, main: "node_modules/expo/AppEntry.js", dependencies: pkg.dependencies }, null, 2) + "\n");
console.log("snack-ready/ gerada.");
