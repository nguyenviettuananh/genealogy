import { useEffect, useMemo, useState } from 'react'
import TreeView from './TreeView'
import type { TreeNode } from './types'

function setAllCollapsed(node: TreeNode, value: boolean): TreeNode {
  return {
    ...node,
    collapsed: value,
    children: node.children?.map(c => setAllCollapsed(c, value)) || [],
  }
}

export default function App() {
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [viewKey, setViewKey] = useState(1)
  const [initialDepth, setInitialDepth] = useState(99)

  useEffect(() => {
    fetch('/genealogy.json')
      .then(r => r.json())
      .then(obj => {
        console.log('Loaded genealogy.json', { nodes: 1 })
        setTree(obj as TreeNode)
      })
  }, [])

  const disabled = useMemo(() => !tree, [tree])

  function collectIds(node: TreeNode, acc: string[] = []): string[] {
    acc.push(node.id)
    for (const c of node.children) collectIds(c, acc)
    return acc
  }
  const onCollapseAll = () => {
    if (!tree) return
    console.log('Action: collapse_all')
    setInitialDepth(0)
    setViewKey(k => k + 1)
  }
  const onExpandAll = () => {
    if (!tree) return
    console.log('Action: expand_all')
    setInitialDepth(99)
    setViewKey(k => k + 1)
  }

  function toggleId(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      console.log('Toggle node', { id, nextCollapsed: next.has(id) })
      return next
    })
  }
  const onToggle = (id: string) => {
    toggleId(id)
  }

  function applyCollapsed(node: TreeNode): TreeNode {
    const isCollapsed = collapsed.has(node.id)
    return {
      ...node,
      children: isCollapsed ? [] : node.children.map(applyCollapsed),
    }
  }

  const viewData = useMemo(() => (tree ? applyCollapsed(tree) : null), [tree, collapsed])

  return (
    <div className="page">
      <header className="toolbar">
        <h1>Phả hệ họ Trần</h1>
        <div className="spacer" />
        <button onClick={onCollapseAll} disabled={disabled}>Thu gọn tất cả</button>
        <button onClick={onExpandAll} disabled={disabled}>Mở rộng tất cả</button>
      </header>
      <main className="content">
        {viewData ? <TreeView data={viewData} onToggle={onToggle} initialDepth={initialDepth} viewKey={viewKey} /> : <div className="loading">Đang tải dữ liệu…</div>}
      </main>
    </div>
  )
}
