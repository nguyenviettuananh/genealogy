import { useEffect, useMemo, useRef, useState } from 'react'
import Tree from 'react-d3-tree'
import type { TreeNode } from './types'

type RawNode = {
  id: string
  name: string
  children?: RawNode[]
  collapsed?: boolean
}

function toRaw(node: TreeNode): RawNode {
  return {
    id: node.id,
    name: node.name,
    collapsed: node.collapsed,
    children: node.children?.map(toRaw),
  }
}

type Props = {
  data: TreeNode
  onToggle: (id: string) => void
  initialDepth: number
  viewKey: number
}

export default function TreeView({ data, onToggle, initialDepth, viewKey }: Props) {
  const TreeAny: any = Tree
  const containerRef = useRef<HTMLDivElement>(null)
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 300, y: 80 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTranslate({ x: r.width / 2, y: 80 })
  }, [])

  const raw = useMemo(() => toRaw(data), [data])

  function wrapWords(text: string, maxChars = 24): string[] {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let current = ''
    for (const w of words) {
      const tentative = current ? current + ' ' + w : w
      if (tentative.length > maxChars) {
        if (current) lines.push(current)
        current = w
      } else {
        current = tentative
      }
    }
    if (current) lines.push(current)
    return lines
  }

  const renderNode = ({ nodeDatum, toggleNode }: any) => {
    const lines = wrapWords(String(nodeDatum.name))
    const w = 240
    const lineH = 18
    const h = Math.max(44, lines.length * lineH + 18)
    console.log('Render node', { id: nodeDatum.id, name: nodeDatum.name, collapsed: nodeDatum.collapsed })
    const hasChildren = Array.isArray(nodeDatum.children) && nodeDatum.children.length > 0
    console.log('Node hasChildren', { id: nodeDatum.id, hasChildren, childrenLen: nodeDatum.children?.length })
    const styleDiv: any = { borderColor: hasChildren ? '#0ea5e9' : '#94a3b8', background: hasChildren ? '#f0f9ff' : '#ffffff', cursor: hasChildren ? 'pointer' : 'default' }
    return (
      <g onClick={() => { if (hasChildren) { console.log('svgClick node', nodeDatum.id); toggleNode(); } }}>
        <foreignObject x={-w / 2} y={-h / 2} width={w} height={h} style={{ pointerEvents: 'auto' }}>
          <div className={`node-html`} style={styleDiv}>
            <div className="node-html-label">{nodeDatum.name}</div>
            {hasChildren ? <div className="node-caret" aria-hidden>▸</div> : null}
          </div>
        </foreignObject>
      </g>
    )
  }

  return (
    <div ref={containerRef} className="tree-container">
      <TreeAny
        data={raw as any}
        orientation="vertical"
        translate={translate}
        zoomable
        enableLegacyTransitions
        separation={{ siblings: 1.2, nonSiblings: 1.6 }}
        nodeSize={{ x: 280, y: 160 }}
        renderCustomNodeElement={renderNode}
        collapsible={true}
        initialDepth={initialDepth}
        key={viewKey}
      />
    </div>
  )
}
