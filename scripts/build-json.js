import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function cleanLabel(s) {
  const t = s.replace(/^\s+|\s+$/g, '')
  return t.replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim()
}

function parseMarkdownTree(md) {
  const lines = md.split(/\r?\n/)
  const roots = []
  const stack = []
  let id = 0
  const makeNode = (name) => ({ id: `n${++id}`, name, children: [] })

  for (const line of lines) {
    const m = line.match(/^(\s*)-\s+(.*)$/)
    if (!m) continue
    const indent = m[1].length
    const depth = Math.floor(indent / 2)
    const raw = m[2]
    const label = cleanLabel(raw)
    const node = makeNode(label)
    if (depth === 0) {
      roots.push(node)
    } else {
      const parent = stack[depth - 1]
      if (parent) parent.children.push(node)
    }
    stack[depth] = node
    stack.length = depth + 1
  }
  if (roots.length === 1) return roots[0]
  return { id: 'root', name: 'Phả hệ', children: roots }
}

const mdPath = resolve(process.cwd(), 'public', 'genealogy.md')
const outPath = resolve(process.cwd(), 'public', 'genealogy.json')
const md = readFileSync(mdPath, 'utf8')
const tree = parseMarkdownTree(md)
writeFileSync(outPath, JSON.stringify(tree, null, 2), 'utf8')
console.log('Generated:', outPath)
