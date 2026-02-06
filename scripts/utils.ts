import fs from "fs";
import path from "path";

const baseDir = process.cwd(); // project root
const deployDir = path.join(baseDir, "deployments");
const file = path.join(deployDir, "addresses.json");

// ensure folder + file exist
function ensureFile() {
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ vault: "", token: "", owner: "" }, null, 2));
  }
}

export function saveAddresses(data: { vault?: string; owner?:string; usdt?:string }) {
  ensureFile();

  const existing = JSON.parse(fs.readFileSync(file, "utf-8"));
  const updated = { ...existing, ...data };

  fs.writeFileSync(file, JSON.stringify(updated, null, 2));

  console.log("Saved addresses →", updated);
}

export function loadAddresses() {
  ensureFile();
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}