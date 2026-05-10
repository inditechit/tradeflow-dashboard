import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "src");

const replacements = [
  [/shadow-cyan-900\/10/g, "shadow-neutral-900/12"],
  [/shadow-cyan-900\/5/g, "shadow-neutral-900/8"],
  [/shadow-cyan-600\/25/g, "shadow-black/25"],
  [/shadow-cyan-600\/20/g, "shadow-black/20"],
  [/shadow-cyan-500\/20/g, "shadow-yellow-500/15"],
  [/shadow-cyan-500\/10/g, "shadow-yellow-400/12"],
  [/hover:bg-cyan-700/g, "hover:bg-black"],
  [/hover:bg-cyan-600/g, "hover:bg-neutral-950"],
  [/bg-cyan-600 text-white/g, "bg-neutral-950 text-[#FFD700]"],
  [/text-cyan-900/g, "text-neutral-900"],
  [/text-cyan-800/g, "text-neutral-900"],
  [/text-cyan-700/g, "text-neutral-800"],
  [/text-cyan-600\/80/g, "text-neutral-700"],
  [/text-cyan-600/g, "text-neutral-900"],
  [/text-cyan-500/g, "text-yellow-800"],
  [/text-cyan-400/g, "text-yellow-600"],
  [/border-cyan-100/g, "border-yellow-200"],
  [/border-cyan-200/g, "border-yellow-300"],
  [/border-cyan-400/g, "border-yellow-400"],
  [/border-cyan-500/g, "border-neutral-900"],
  [/ring-cyan-200/g, "ring-yellow-200"],
  [/ring-cyan-500\/20/g, "ring-yellow-500/30"],
  [/ring-cyan-500/g, "ring-yellow-500"],
  [/focus-visible:ring-cyan-500\/20/g, "focus-visible:ring-yellow-500/30"],
  [/focus-visible:border-cyan-500/g, "focus-visible:border-yellow-500"],
  [/focus:ring-cyan-500\/20/g, "focus:ring-yellow-500/30"],
  [/focus:ring-cyan-500/g, "focus:ring-yellow-500"],
  [/focus:border-cyan-500/g, "focus:border-yellow-500"],
  [/bg-cyan-50\/80/g, "bg-yellow-50"],
  [/bg-cyan-50\/50/g, "bg-yellow-50/90"],
  [/bg-cyan-50\/30/g, "bg-yellow-50/50"],
  [/hover:bg-cyan-50\/30/g, "hover:bg-yellow-50/50"],
  [/bg-cyan-50/g, "bg-yellow-50"],
  [/bg-cyan-100/g, "bg-yellow-100"],
  [/bg-cyan-400/g, "bg-yellow-400"],
  [/hover:bg-cyan-50/g, "hover:bg-yellow-50"],
  [/hover:border-cyan-200/g, "hover:border-yellow-300"],
  [/hover:border-cyan-400/g, "hover:border-yellow-500"],
  [/from-cyan-500/g, "from-yellow-400"],
  [/to-blue-600/g, "to-neutral-900"],
  [/bg-cyan-600/g, "bg-[#FFD700]"],
];

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (/\.(tsx|ts|jsx|css)$/.test(name)) files.push(p);
  }
  return files;
}

const idx = path.join(__dirname, "..", "src", "index.css");
let files = walk(root);
if (fs.existsSync(idx)) files.push(idx);

for (const file of files) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [re, rep] of replacements) {
    s = s.replace(re, rep);
  }
  if (s !== orig) fs.writeFileSync(file, s);
}

console.log("Theme replacements applied.");
