/**
 * Remove git merge conflict markers; keep the "Stashed changes" side ($2).
 * Run from repo root: node scripts/resolve-merge-conflicts.js
 */
const fs = require("fs")
const path = require("path")

const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"])

const pattern =
  /<<<<<<< Updated upstream\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> Stashed changes\r?\n/g

function walk(dir, files = []) {
  let names
  try {
    names = fs.readdirSync(dir)
  } catch {
    return files
  }
  for (const name of names) {
    if (SKIP.has(name)) continue
    const p = path.join(dir, name)
    let st
    try {
      st = fs.statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, files)
    else files.push(p)
  }
  return files
}

const root = path.join(__dirname, "..")
let fixed = 0
for (const file of walk(root)) {
  if (!/\.(js|jsx|mjs|cjs|ts|tsx|json|css|md)$/.test(file)) continue
  let c
  try {
    c = fs.readFileSync(file, "utf8")
  } catch {
    continue
  }
  if (!c.includes("<<<<<<<")) continue
  const n = c.replace(pattern, "$2")
  if (n !== c) {
    fs.writeFileSync(file, n)
    fixed++
    console.log("Resolved:", path.relative(root, file))
  }
}

console.log(`Done. Files updated: ${fixed}`)
