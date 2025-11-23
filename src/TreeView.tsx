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
  const [positions, setPositions] = useState<Record<string, { dx: number; dy: number }>>({})
  const draggingRef = useRef(false)
  const nodeCoordsRef = useRef<Record<string, { x: number; y: number }>>({})
  const nodeSizeRef = useRef<Record<string, { w: number; h: number }>>({})
  const getBaseCoords = (id: string): { x: number; y: number } | null => {
    const container = containerRef.current
    if (!container) return null
    const safeId = String(id).replace(/"/g, '\"')
    const el = container.querySelector(`.node-html[data-node-id="${safeId}"]`)
    if (!el) return null
    const g = el.closest('g.rd3t-node, g.rd3t-leaf-node') as SVGGElement | null
    if (!g) return null
    const tf = g.getAttribute('transform') || ''
    const m = tf.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/)
    if (!m) return null
    return { x: parseFloat(m[1]), y: parseFloat(m[2]) }
  }
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
        const w = Math.max(160, Math.min(300, cr.width * 0.32))
        const gy = Math.max(96, Math.min(150, cr.width * 0.35))
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
  const links = useMemo(() => {
    const acc: Array<{ from: string; to: string }> = []
    const walk = (n: RawNode) => {
      if (n.children) {
        for (const c of n.children) {
          acc.push({ from: n.id, to: c.id })
          walk(c)
        }
      }
    }
    walk(raw)
    return acc
  }, [raw])


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

  function parseNameLines(text: string, maxChars: number): string[] {
    if (text.includes('|')) {
      return text.split('|').map(s => s.trim()).filter(s => s.length > 0)
    }
    return wrapWords(text, maxChars)
  }

  function sanitizeHtml(s: string): string {
    let out = s
    out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    out = out.replace(/href\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, 'href="#"')
    out = out.replace(/src\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
    out = out.replace(/\sstyle\s*=\s*(['"]).*?\1/gi, '')
    out = out.replace(/<p\b([^>]*)>/gi, '<span $1>')
    out = out.replace(/<\/p>/gi, '</span>')
    return out
  }

  const renderNode = ({ nodeDatum, toggleNode }: any) => {
    const maxChars = Math.max(16, Math.floor(nodeW / 9))
    const lines = parseNameLines(String(nodeDatum.name), maxChars)
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
    const pos = positions[nodeDatum.id] || { dx: 0, dy: 0 }
    const cx = (nodeDatum as any).__rd3t?.x ?? 0
    const cy = (nodeDatum as any).__rd3t?.y ?? 0
    nodeCoordsRef.current[nodeDatum.id] = { x: cx, y: cy }
    nodeSizeRef.current[nodeDatum.id] = { w, h }
    const onPointerDown = (e: any) => {
      const sx = e.clientX
      const sy = e.clientY
      const origin = positions[nodeDatum.id] || { dx: 0, dy: 0 }
      draggingRef.current = false
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - sx) / tfVals.s
        const dy = 0
        if (Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 3) {
          draggingRef.current = true
        }
        setPositions(prev => ({ ...prev, [nodeDatum.id]: { dx: origin.dx + dx, dy: origin.dy } }))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
    return (
      <g onClick={() => { if (draggingRef.current) return; if (hasChildren) { console.log('svgClick node', nodeDatum.id); toggleNode(); } }} transform={`translate(${pos.dx},${pos.dy})`}>
        {shouldRenderLevel ? (
          <>
            <line x1={-10000} x2={10000} y1={0} y2={0} stroke="#dc2626" strokeWidth={1.5} opacity={0.5} style={{ pointerEvents: 'none' }} data-level={depth} />
            <text x={-300} y={-h / 2 - 6} fill="#b91c1c" fontSize={12} fontWeight={700} textAnchor="end" data-level-label={depth} style={{ pointerEvents: 'none' }}>
              {`Đời ${depth + 1}`}
            </text>
          </>
        ) : null}
        <foreignObject x={-w / 2} y={-h / 2} width={w} height={h} style={{ pointerEvents: 'auto' }} onPointerDown={onPointerDown}>
          <div className={`node-html`} style={styleDiv} data-node-id={nodeDatum.id}>
            <div className="node-html-label">
              {lines.map((ln: string, i: number) => (
                <div key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(ln) }} />
              ))}
            </div>
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
        separation={{ siblings: 1.1, nonSiblings: 1.5 }}
        nodeSize={{ x: Math.max(260, nodeW + 60), y: gapY }}
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
