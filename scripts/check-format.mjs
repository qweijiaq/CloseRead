import fs from 'node:fs/promises'
import path from 'node:path'

const ROOTS = ['src', 'tests', 'e2e', 'scripts', 'desktop']
const EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs'])
const SKIP = new Set(['node_modules', '.git', 'data', 'packs', 'docs', 'desktop-dist', 'demo', 'assets'])

async function* walk(dir) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (EXTENSIONS.has(path.extname(entry.name))) yield full
  }
}

const problems = []
for (const root of ROOTS) {
  for await (const file of walk(root)) {
    const text = await fs.readFile(file, 'utf8')
    const lines = text.split('\n')
    if (text.includes('\r')) problems.push(`${file}: contains CRLF`)
    if (!text.endsWith('\n')) problems.push(`${file}: missing final newline`)
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (/[ \t]+$/.test(line)) problems.push(`${file}:${index + 1}: trailing whitespace`)
      if (line.includes('\t')) problems.push(`${file}:${index + 1}: tab character`)
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} formatting problem(s).`)
  process.exitCode = 1
} else {
  console.log('Format check passed.')
}
