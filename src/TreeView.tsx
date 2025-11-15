import { useEffect, useMemo, useRef, useState } from 'react'
import Tree from 'react-d3-tree'
import type { TreeNode } from './types'

type RawNode = {
  id: string
  name: string
  depth: number
  children?: RawNode[]
  collapsed?: boolean
}

function toRaw(node: TreeNode, depth = 0): RawNode {
  return {
    id: node.id,
    name: node.name,
    depth,
    collapsed: node.collapsed,
    children: node.children?.map(c => toRaw(c, depth + 1)),
  }
}

type Props = {
  data: TreeNode
  onToggle: (id: string) => void
  initialDepth: number
  viewKey: number
  showLevels?: boolean
}

export default function TreeView({ data, onToggle, initialDepth, viewKey, showLevels = true }: Props) {
  const TreeAny: any = Tree
  const containerRef = useRef<HTMLDivElement>(null)
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 300, y: 80 })
  const renderedLevelsRef = useRef<Set<number>>(new Set())
  const [groupTransform, setGroupTransform] = useState<string>('translate(0,0) scale(1)')
  const [gapY, setGapY] = useState(160)
  const [nodeW, setNodeW] = useState(240)
  const [tfVals, setTfVals] = useState<{ tx: number; ty: number; s: number }>({ tx: 0, ty: 0, s: 1 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTranslate({ x: r.width / 2, y: 80 })
  }, [])
  useEffect(() => { renderedLevelsRef.current.clear() }, [viewKey, data])
  useEffect(() => {
    const el = containerRef.current?.querySelector('.rd3t-g') as SVGGElement | null
    if (!el) return
    const update = () => {
      const tf = el.getAttribute('transform') || 'translate(0,0) scale(1)'
      setGroupTransform(tf)
      const m = tf.match(/translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+)\)/)
      if (m) {
        setTfVals({ tx: parseFloat(m[1]), ty: parseFloat(m[2]), s: parseFloat(m[3]) })
      }
    }
    update()
    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ['transform'] })
    return () => obs.disconnect()
  }, [viewKey, data])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect
        setTranslate({ x: cr.width / 2, y: 80 })
        const w = Math.max(160, Math.min(300, cr.width * 0.28))
        const gy = Math.max(110, Math.min(180, cr.height * 0.18))
        setNodeW(w)
        setGapY(gy)
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const raw = useMemo(() => toRaw(data), [data])
  function maxDepth(node: RawNode): number {
    if (!node.children || node.children.length === 0) return node.depth
    let m = node.depth
    for (const c of node.children) m = Math.max(m, maxDepth(c))
    return m
  }
  const maxLvl = useMemo(() => maxDepth(raw), [raw])


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
    const maxChars = Math.max(16, Math.floor(nodeW / 9))
    const lines = wrapWords(String(nodeDatum.name), maxChars)
    const w = nodeW
    const lineH = 18
    const h = Math.max(44, lines.length * lineH + 18)
    console.log('Render node', { id: nodeDatum.id, name: nodeDatum.name, collapsed: nodeDatum.collapsed })
    const hasChildren = Array.isArray(nodeDatum.children) && nodeDatum.children.length > 0
    console.log('Node hasChildren', { id: nodeDatum.id, hasChildren, childrenLen: nodeDatum.children?.length })
    const depth: number = (nodeDatum as any).depth ?? (nodeDatum as any).__rd3t?.depth ?? 0
    const shouldRenderLevel = showLevels && !renderedLevelsRef.current.has(depth)
    if (shouldRenderLevel) renderedLevelsRef.current.add(depth)
    const styleDiv: any = { borderColor: hasChildren ? '#0ea5e9' : '#94a3b8', background: hasChildren ? '#f0f9ff' : '#ffffff', cursor: hasChildren ? 'pointer' : 'default' }
    return (
      <g onClick={() => { if (hasChildren) { console.log('svgClick node', nodeDatum.id); toggleNode(); } }}>
        {shouldRenderLevel ? (
          <>
            <line x1={-10000} x2={10000} y1={0} y2={0} stroke="#dc2626" strokeWidth={1.5} opacity={0.5} style={{ pointerEvents: 'none' }} data-level={depth} />
            <text x={-300} y={-h / 2 - 6} fill="#b91c1c" fontSize={12} fontWeight={700} textAnchor="end" data-level-label={depth} style={{ pointerEvents: 'none' }}>
              {`Đời ${depth + 1}`}
            </text>
          </>
        ) : null}
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
        nodeSize={{ x: 280, y: gapY }}
        renderCustomNodeElement={renderNode}
        collapsible={true}
        initialDepth={initialDepth}
        key={viewKey}
      />
      {showLevels ? (
        <>
          <svg className="levels-svg" width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <g transform={groupTransform}>
              {Array.from({ length: maxLvl }).map((_, lvl) => (
                <line key={lvl} x1={-10000} x2={10000} y1={(lvl + 0.5) * gapY} y2={(lvl + 0.5) * gapY} stroke="#dc2626" strokeWidth={1.2} opacity={0.4} />
              ))}
            </g>
          </svg>
          <div className="level-fixed-labels" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {Array.from({ length: maxLvl }).map((_, lvl) => (
              <div
                key={lvl}
                className="label"
                style={{ position: 'absolute', left: 8, top: tfVals.ty + (lvl + 0.5) * gapY * tfVals.s - 10 }}
              >
                {`Đời ${lvl + 1}`}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
