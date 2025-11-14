import type { TreeNode } from './types'

function cleanLabel(s: string): string {
  const t = s.replace(/^\s+|\s+$/g, '')
  return t.replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim()
}

export function parseMarkdownTree(md: string): TreeNode {
  const lines = md.split(/\r?\n/)
  const roots: TreeNode[] = []
  const stack: TreeNode[] = []
  let id = 0

  function makeNode(name: string): TreeNode {
    id += 1
    return { id: `n${id}`, name, children: [] }
  }

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
