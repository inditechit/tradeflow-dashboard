import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "src");

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (/\.(tsx|ts|jsx)$/.test(name)) files.push(p);
  }
  return files;
}

const files = walk(root);

for (const file of files) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;

  s = s.replace(/bg-neutral-950 text-\[#FFD700\]/g, "bg-[#FFD700] text-black");
  s = s.replace(/hover:bg-black/g, "hover:bg-[#E6C200]");

  s = s.replace(/text-green-600/g, "text-yellow-700");
  s = s.replace(/text-green-500/g, "text-yellow-600");
  s = s.replace(/bg-green-50/g, "bg-[#FFF9E6]");
  s = s.replace(/border-green-200/g, "border-yellow-200");
  s = s.replace(/bg-green-100 text-yellow-800/g, "bg-[#FFF9E6] text-neutral-900");
  s = s.replace(/bg-green-100 text-green-700/g, "bg-[#FFF9E6] text-neutral-900");
  s = s.replace(/text-green-700/g, "text-yellow-800");
  s = s.replace(/bg-green-200/g, "bg-yellow-100");
  s = s.replace(/border-green-100/g, "border-yellow-100");
  s = s.replace(/shadow-green-100\/50/g, "shadow-yellow-100/40");
  s = s.replace(/bg-green-500/g, "bg-[#FFD700]");
  s = s.replace(/bg-green-100/g, "bg-[#FFF9E6]");

  s = s.replace(
    /border-emerald-200 bg-emerald-50 text-emerald-900/g,
    "border-yellow-200 bg-[#FFF9E6] text-neutral-900",
  );
  s = s.replace(/text-emerald-900/g, "text-neutral-900");
  s = s.replace(/text-emerald-800/g, "text-neutral-800");
  s = s.replace(/text-emerald-700/g, "text-yellow-800");
  s = s.replace(/text-emerald-600/g, "text-yellow-700");
  s = s.replace(/border-emerald-200 bg-emerald-50\/60/g, "border-yellow-200 bg-[#FFF9E6]/90");
  s = s.replace(/border-emerald-200 bg-emerald-50/g, "border-yellow-200 bg-[#FFF9E6]");
  s = s.replace(/hover:bg-emerald-100/g, "hover:bg-yellow-50");
  s = s.replace(
    /bg-emerald-600 text-white hover:bg-emerald-700/g,
    "bg-[#FFD700] text-black hover:bg-[#E6C200]",
  );

  // Decorative emerald candles → yellow (login/signup hero)
  s = s.replace(/bg-emerald-400/g, "bg-[#FFD700]");
  s = s.replace(/rgba\(52,211,153/g, "rgba(255,215,0");

  if (s !== orig) fs.writeFileSync(file, s);
}

console.log("exness-theme-pass done");
