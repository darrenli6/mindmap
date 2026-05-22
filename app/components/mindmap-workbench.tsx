'use client'

import { useDeferredValue, useId, useRef, useState } from 'react'

type StyleKey = 'style1' | 'style2'

type OutlineNode = {
  id: string
  text: string
  children: OutlineNode[]
}

type MeasuredNode = {
  id: string
  text: string
  lines: string[]
  width: number
  height: number
  depth: number
  topLevelIndex: number
  hasChildren: boolean
  children: MeasuredNode[]
}

type PositionedNode = MeasuredNode & {
  x: number
  y: number
}

type Edge = {
  from: PositionedNode
  to: PositionedNode
}

type LayoutResult = {
  positioned: PositionedNode[]
  edges: Edge[]
  width: number
  height: number
}

const sampleMarkdown = `# 总体目标
- 核心定位：践行正确政绩观为引领
- 主线：服务客户、服务基层
- 实施周期：2025年5月—10月

## 核心框架
### 初心·优流程
- 强规范
- 提效率
- 流程再造

### 匠心·优服务
- 强风控
- 惠民生
- 业务协同

### 暖心·优环境
- 强保障
- 暖员工
- 场景升级

## 重点任务
### 初心·优流程
- 压降员工加班时长
- 高低频业务标准化落地
- 设备与供应商闭环管控

### 匠心·优服务
- 智能风控升级
- 外币预约服务模式优化
- 调拨服务效率提升

### 暖心·优环境
- 厅堂专项行动
- 工位提质优化
- 办公配套更新

## 保障措施
### 组织保障
- 明确专项工作小组
- 定期会商机制

### 清单闭环
- 建立调研、整改、提升闭环
- 诉求归集与反馈

### 长效机制
- 总结经验
- 固化制度
- 常态化推进`

const ROOT_TEXT_WIDTH = 406
const NODE_TEXT_WIDTH = 408
const LEAF_TEXT_WIDTH = 420
const COLUMN_GAP = 74
const ROOT_X = 30
const MARGIN_Y = 36
const ROOT_BRANCH_GAP = 34
const SECTION_BRANCH_GAP = 24
const DETAIL_BRANCH_GAP = 18
const BOX_PADDING_X = 18
const BOX_PADDING_Y = 12
const CHILD_FONT_SIZE = 40
const ROOT_FONT_SIZE = 40
const LEAF_TRAIL = 42
const STYLE_OPTIONS: Array<{
  key: StyleKey
  label: string
  description: string
  title: string
  subtitle: string
  background: string
  surface: string
  rootFill: string
  branchColors: string[]
  leafStyle: 'underline' | 'pill'
  connectorStyle: 'elbow' | 'curve'
}> = [
  {
    key: 'style1',
    label: '样式一',
    description: '正式汇报风',
    title: '更接近示例图的思维导图样式',
    subtitle: '背景固定为浅白色，分支按一级主题着色，适合正式汇报与导出。',
    background: '#FFFEFE',
    surface: '#fffefe',
    rootFill: '#4B5563',
    branchColors: ['#6DD4E5', '#A855F7', '#B7791F', '#FF5CB8', '#2563EB', '#14B8A6'],
    leafStyle: 'underline',
    connectorStyle: 'elbow',
  },
  {
    key: 'style2',
    label: '样式二',
    description: '清爽卡片风',
    title: '更清爽的卡片式思维导图样式',
    subtitle: '纯白背景，支持从一级到十级标题层级，适合用 Markdown 标题直接生成深层结构导图。',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    rootFill: '#17324D',
    branchColors: ['#0F766E', '#2563EB', '#DC6B2F', '#A21CAF', '#0EA5A4', '#B45309'],
    leafStyle: 'pill',
    connectorStyle: 'curve',
  },
]

const ROOT_BOX_WIDTH = ROOT_TEXT_WIDTH + BOX_PADDING_X * 2
const NODE_BOX_WIDTH = NODE_TEXT_WIDTH + BOX_PADDING_X * 2
const LEAF_LINE_HEIGHT = Math.ceil(CHILD_FONT_SIZE * 1.45)
const BOX_LINE_HEIGHT = Math.ceil(CHILD_FONT_SIZE * 1.45)
const ROOT_LINE_HEIGHT = Math.ceil(ROOT_FONT_SIZE * 1.1)
const MIN_BOX_HEIGHT = BOX_LINE_HEIGHT + BOX_PADDING_Y * 2
const MIN_ROOT_HEIGHT = ROOT_LINE_HEIGHT + BOX_PADDING_Y * 2

function createNode(text: string, seed: string, index: number): OutlineNode {
  return {
    id: `${seed}-${index}`,
    text,
    children: [],
  }
}

function normalizeText(text: string) {
  return text.replace(/\[(.*?)\]\((.*?)\)/g, '$1').replace(/[*_`~]/g, '').trim()
}

function parseMarkdown(markdown: string): OutlineNode {
  const lines = markdown.split('\n')
  let counter = 0
  const nextId = () => ++counter
  const root = createNode('思维导图', 'root', nextId())
  const headingStack: Array<{ level: number; node: OutlineNode }> = []
  const listStack: Array<{ level: number; node: OutlineNode }> = []

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      continue
    }

    const headingMatch = rawLine.match(/^(#{1,10})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = normalizeText(headingMatch[2])
      const node = createNode(text || `标题 ${level}`, `h${level}`, nextId())

      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop()
      }

      const parent = headingStack.length ? headingStack[headingStack.length - 1].node : root
      parent.children.push(node)
      headingStack.push({ level, node })
      listStack.length = 0
      continue
    }

    const listMatch = rawLine.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
    if (listMatch) {
      const indent = listMatch[1].replace(/\t/g, '  ').length
      const level = Math.floor(indent / 2) + 1
      const text = normalizeText(listMatch[3])
      const node = createNode(text || '列表项', `l${level}`, nextId())

      while (listStack.length && listStack[listStack.length - 1].level >= level) {
        listStack.pop()
      }

      const parent =
        listStack.length
          ? listStack[listStack.length - 1].node
          : headingStack.length
            ? headingStack[headingStack.length - 1].node
            : root

      parent.children.push(node)
      listStack.push({ level, node })
      continue
    }

    const text = normalizeText(rawLine)
    if (!text) {
      continue
    }

    const node = createNode(text, 'p', nextId())
    const parent = headingStack.length ? headingStack[headingStack.length - 1].node : root
    parent.children.push(node)
    listStack.length = 0
  }

  if (root.children.length === 1) {
    return root.children[0]
  }

  return root
}

function charUnits(text: string) {
  let units = 0

  for (const char of text) {
    if (/\s/.test(char)) {
      units += 0.45
      continue
    }

    if (/[A-Z0-9]/.test(char)) {
      units += 0.84
      continue
    }

    if (/[a-z]/.test(char)) {
      units += 0.7
      continue
    }

    if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char)) {
      units += 1.08
      continue
    }

    units += 0.78
  }

  return units
}

function estimateTextWidth(text: string, fontSize: number) {
  return Math.ceil(charUnits(text) * fontSize * 0.92)
}

function unitsForWidth(width: number, fontSize: number) {
  return Math.max(1, width / (fontSize * 0.92))
}

function wrapText(text: string, maxUnits: number) {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return ['']
  }

  const lines: string[] = []
  let current = ''

  for (const char of compact) {
    const candidate = `${current}${char}`
    if (current && charUnits(candidate) > maxUnits) {
      lines.push(current.trim())
      current = char
      continue
    }
    current = candidate
  }

  if (current.trim()) {
    lines.push(current.trim())
  }

  return lines.length ? lines : [compact]
}

function measureTree(
  node: OutlineNode,
  style: (typeof STYLE_OPTIONS)[number],
  depth = 0,
  topLevelIndex = -1,
  ownIndex = 0,
): MeasuredNode {
  const nextTopLevel = depth === 1 ? ownIndex : topLevelIndex
  const hasChildren = node.children.length > 0
  const lines =
    depth === 0
      ? wrapText(node.text, unitsForWidth(ROOT_TEXT_WIDTH, ROOT_FONT_SIZE))
      : hasChildren
        ? wrapText(node.text, unitsForWidth(NODE_TEXT_WIDTH, CHILD_FONT_SIZE))
        : wrapText(node.text, unitsForWidth(LEAF_TEXT_WIDTH, CHILD_FONT_SIZE))

  const widestLine = lines.reduce(
    (max, line) =>
      Math.max(max, estimateTextWidth(line, depth === 0 ? ROOT_FONT_SIZE : CHILD_FONT_SIZE)),
    0,
  )
  const width =
    depth === 0
      ? Math.max(widestLine + BOX_PADDING_X * 2, ROOT_BOX_WIDTH)
      : hasChildren
        ? Math.max(widestLine + BOX_PADDING_X * 2, NODE_BOX_WIDTH)
        : style.leafStyle === 'pill'
          ? Math.max(widestLine + BOX_PADDING_X * 2, 220)
          : Math.max(widestLine, LEAF_TEXT_WIDTH)
  const lineHeight = depth === 0 ? ROOT_LINE_HEIGHT : hasChildren ? BOX_LINE_HEIGHT : LEAF_LINE_HEIGHT
  const minHeight =
    depth === 0
      ? MIN_ROOT_HEIGHT
      : hasChildren || style.leafStyle === 'pill'
        ? MIN_BOX_HEIGHT
        : lines.length * lineHeight
  const height =
    depth === 0 || hasChildren || style.leafStyle === 'pill'
      ? Math.max(minHeight, lines.length * lineHeight + BOX_PADDING_Y * 2)
      : Math.max(minHeight, lines.length * lineHeight)

  const children = node.children.map((child, index) =>
    measureTree(child, style, depth + 1, nextTopLevel, index),
  )

  return {
    id: node.id,
    text: node.text,
    lines,
    width,
    height,
    depth,
    topLevelIndex: nextTopLevel,
    hasChildren,
    children,
  }
}

function nodeFootprintHeight(node: MeasuredNode) {
  return Math.max(node.height, 30)
}

function siblingGap(parentDepth: number, previous: MeasuredNode, next: MeasuredNode) {
  const baseGap =
    parentDepth === 0 ? ROOT_BRANCH_GAP : parentDepth === 1 ? SECTION_BRANCH_GAP : DETAIL_BRANCH_GAP
  const heightPressure = Math.max(previous.height, next.height) - MIN_BOX_HEIGHT
  const linePressure = Math.max(previous.lines.length, next.lines.length) - 1
  const branchPressure = previous.hasChildren || next.hasChildren ? 8 : 0

  return (
    baseGap +
    Math.max(0, heightPressure) * 0.35 +
    Math.max(0, linePressure) * 4 +
    branchPressure
  )
}

function subtreeHeight(node: MeasuredNode): number {
  if (!node.children.length) {
    return nodeFootprintHeight(node)
  }

  const childrenHeight = node.children.reduce((sum, child) => sum + subtreeHeight(child), 0)
  const gapsHeight = node.children.slice(1).reduce((sum, child, index) => {
    return sum + siblingGap(node.depth, node.children[index], child)
  }, 0)

  return Math.max(node.height, childrenHeight + gapsHeight)
}

function collectDepthWidths(root: MeasuredNode, style: (typeof STYLE_OPTIONS)[number]) {
  const widths: number[] = []

  function walk(node: MeasuredNode) {
    const visualWidth =
      node.width +
      (node.hasChildren || node.depth === 0 || style.leafStyle === 'pill' ? 0 : LEAF_TRAIL)
    widths[node.depth] = Math.max(widths[node.depth] ?? 0, visualWidth)
    for (const child of node.children) {
      walk(child)
    }
  }

  walk(root)
  return widths
}

function layoutTree(root: MeasuredNode, style: (typeof STYLE_OPTIONS)[number]): LayoutResult {
  let maxDepth = 0
  const positioned: PositionedNode[] = []
  const edges: Edge[] = []
  const depthWidths = collectDepthWidths(root, style)
  const depthOffsets: number[] = [ROOT_X]

  for (let depth = 1; depth < depthWidths.length; depth += 1) {
    depthOffsets[depth] = depthOffsets[depth - 1] + (depthWidths[depth - 1] ?? 0) + COLUMN_GAP
  }

  function walk(
    node: MeasuredNode,
    depth: number,
    topY: number,
    parent?: PositionedNode,
  ): PositionedNode {
    maxDepth = Math.max(maxDepth, depth)
    const x = depthOffsets[depth] ?? ROOT_X
    const reservedHeight = subtreeHeight(node)

    if (!node.children.length) {
      const leaf = {
        ...node,
        x,
        y: topY + (reservedHeight - node.height) / 2,
      }
      positioned.push(leaf)
      if (parent) {
        edges.push({ from: parent, to: leaf })
      }
      return leaf
    }

    let childTopY = topY
    const children = node.children.map((child, index) => {
      const positionedChild = walk(child, depth + 1, childTopY)
      childTopY += subtreeHeight(child)

      if (index < node.children.length - 1) {
        childTopY += siblingGap(depth, child, node.children[index + 1])
      }

      return positionedChild
    })
    const firstCenter = children[0].y + children[0].height / 2
    const lastCenter = children[children.length - 1].y + children[children.length - 1].height / 2
    const centerY = (firstCenter + lastCenter) / 2
    const current = {
      ...node,
      x,
      y: centerY - node.height / 2,
    }

    positioned.push(current)

    for (const child of children) {
      edges.push({ from: current, to: child })
    }

    if (parent) {
      edges.push({ from: parent, to: current })
    }

    return current
  }

  walk(root, 0, MARGIN_Y)

  const width = (depthOffsets[maxDepth] ?? ROOT_X) + (depthWidths[maxDepth] ?? 0) + 120
  const contentBottom = positioned.reduce((max, node) => Math.max(max, node.y + node.height), MARGIN_Y)
  const height = Math.max(contentBottom + MARGIN_Y, subtreeHeight(root) + MARGIN_Y * 2)

  return { positioned, edges, width, height }
}

function colorForBranch(index: number, style: (typeof STYLE_OPTIONS)[number]) {
  return style.branchColors[((index % style.branchColors.length) + style.branchColors.length) % style.branchColors.length]
}

function tintColor(hex: string, amount: number) {
  const normalized = hex.replace('#', '')

  if (normalized.length !== 6) {
    return hex
  }

  const channel = (index: number) => Number.parseInt(normalized.slice(index, index + 2), 16)
  const mix = (value: number) => Math.round(value + (255 - value) * amount)
  const toHex = (value: number) => value.toString(16).padStart(2, '0')

  const red = mix(channel(0))
  const green = mix(channel(2))
  const blue = mix(channel(4))

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function renderPath(
  from: PositionedNode,
  to: PositionedNode,
  style: (typeof STYLE_OPTIONS)[number],
) {
  const startX = from.x + from.width
  const startY = from.y + from.height / 2
  const endX = to.x
  const endY = to.y + to.height / 2
  if (style.connectorStyle === 'curve') {
    const curve = Math.max(32, (endX - startX) * 0.42)
    return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`
  }

  const elbowX = startX + Math.max(24, (endX - startX) * 0.38)
  return `M ${startX} ${startY} L ${elbowX} ${startY} L ${elbowX} ${endY} L ${endX} ${endY}`
}

async function svgToCanvas(
  svg: SVGSVGElement,
  width: number,
  height: number,
  background: string,
  scale = 2,
) {
  const serializer = new XMLSerializer()
  const markup = serializer.serializeToString(svg)
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('导图渲染失败，无法导出图片。'))
      nextImage.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('浏览器不支持 Canvas 导出。')
    }

    context.scale(scale, scale)
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function buildPdfFromJpeg(jpegBytes: Uint8Array, imageWidth: number, imageHeight: number) {
  const pageWidth = 841.89
  const pageHeight = 595.28
  const margin = 20
  const fit = Math.min(
    (pageWidth - margin * 2) / imageWidth,
    (pageHeight - margin * 2) / imageHeight,
  )
  const drawWidth = imageWidth * fit
  const drawHeight = imageHeight * fit
  const offsetX = (pageWidth - drawWidth) / 2
  const offsetY = (pageHeight - drawHeight) / 2
  const contentStream = `q
${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm
/Im0 Do
Q`

  const encoder = new TextEncoder()
  const chunks: BlobPart[] = []
  const offsets: number[] = [0]
  let length = 0

  const pushText = (text: string) => {
    const bytes = encoder.encode(text)
    chunks.push(bytes)
    length += bytes.length
  }

  const pushBytes = (bytes: Uint8Array) => {
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    chunks.push(buffer)
    length += bytes.length
  }

  const startObject = (id: number) => {
    offsets[id] = length
    pushText(`${id} 0 obj\n`)
  }

  pushText('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n')
  startObject(1)
  pushText('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  startObject(2)
  pushText('<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n')

  startObject(3)
  pushText(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`,
  )

  startObject(4)
  pushText(
    `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  )
  pushBytes(jpegBytes)
  pushText('\nendstream\nendobj\n')

  const contentBytes = encoder.encode(contentStream)
  startObject(5)
  pushText(`<< /Length ${contentBytes.length} >>\nstream\n`)
  pushBytes(contentBytes)
  pushText('\nendstream\nendobj\n')

  const xrefOffset = length
  pushText('xref\n0 6\n0000000000 65535 f \n')

  for (let id = 1; id <= 5; id += 1) {
    pushText(`${offsets[id].toString().padStart(10, '0')} 00000 n \n`)
  }

  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  return new Blob(chunks, { type: 'application/pdf' })
}

export default function MindmapWorkbench() {
  const [markdown, setMarkdown] = useState(sampleMarkdown)
  const [styleKey, setStyleKey] = useState<StyleKey>('style1')
  const [isExporting, setIsExporting] = useState(false)
  const [isPasting, setIsPasting] = useState(false)
  const deferredMarkdown = useDeferredValue(markdown)
  const svgTitleId = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const selectedStyle = STYLE_OPTIONS.find((option) => option.key === styleKey) ?? STYLE_OPTIONS[0]

  const parsedTree = parseMarkdown(deferredMarkdown)
  const measuredTree = measureTree(parsedTree, selectedStyle)
  const { positioned, edges, width, height } = layoutTree(measuredTree, selectedStyle)

  const exportPng = async () => {
    if (!svgRef.current) {
      return
    }

    setIsExporting(true)
    try {
      const canvas = await svgToCanvas(svgRef.current, width, height, selectedStyle.background, 2)
      triggerDownload(canvas.toDataURL('image/png'), 'mindmap.png')
    } finally {
      setIsExporting(false)
    }
  }

  const exportPdf = async () => {
    if (!svgRef.current) {
      return
    }

    setIsExporting(true)
    try {
      const canvas = await svgToCanvas(svgRef.current, width, height, selectedStyle.background, 2)
      const pdfBlob = buildPdfFromJpeg(
        dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.96)),
        canvas.width,
        canvas.height,
      )
      const url = URL.createObjectURL(pdfBlob)
      triggerDownload(url, 'mindmap.pdf')
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setIsExporting(false)
    }
  }

  const clearMarkdown = () => {
    setMarkdown('')
  }

  const pasteMarkdown = async () => {
    if (!navigator.clipboard) {
      return
    }

    setIsPasting(true)
    try {
      const text = await navigator.clipboard.readText()
      setMarkdown(text)
    } finally {
      setIsPasting(false)
    }
  }

  return (
    <main className="min-h-screen text-slate-900" style={{ backgroundColor: selectedStyle.background }}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header
          className="rounded-[28px] border border-[#f0e9e9] px-6 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]"
          style={{ backgroundColor: selectedStyle.surface }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Markdown Mind Map
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {selectedStyle.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                {selectedStyle.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportPng}
                disabled={isExporting}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                导出 PNG
              </button>
              <button
                type="button"
                onClick={exportPdf}
                disabled={isExporting}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                导出 PDF
              </button>
              <button
                type="button"
                onClick={() => setMarkdown(sampleMarkdown)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                恢复示例
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {STYLE_OPTIONS.map((option) => {
              const active = option.key === selectedStyle.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStyleKey(option.key)}
                  className="inline-flex min-w-[148px] flex-col items-start rounded-2xl border px-4 py-3 text-left transition"
                  style={{
                    backgroundColor: active ? '#ffffff' : 'transparent',
                    borderColor: active ? '#0f172a' : '#ddd6d6',
                    boxShadow: active ? '0 10px 24px rgba(15,23,42,0.08)' : 'none',
                  }}
                >
                  <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                  <span className="mt-1 text-xs text-slate-500">{option.description}</span>
                </button>
              )
            })}
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-11rem)] grid-cols-1 gap-6 lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.6fr)]">
          <div className="flex min-h-[420px] flex-col overflow-hidden rounded-[30px] border border-[#f0e9e9] bg-white shadow-[0_18px_34px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f1eded] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Markdown</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedStyle.key === 'style2'
                    ? '样式二支持 `#` 到 `##########` 作为一到十级节点。'
                    : '左侧编辑内容，右侧生成近似示例图风格的导图。'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={pasteMarkdown}
                  disabled={isPasting}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPasting ? '粘贴中...' : '粘贴覆盖'}
                </button>
                <button
                  type="button"
                  onClick={clearMarkdown}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  清空
                </button>
              </div>
            </div>
            <textarea
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              className="min-h-[420px] flex-1 resize-none bg-transparent px-5 py-4 font-mono text-sm leading-7 text-slate-800 outline-none"
              placeholder="# 主题&#10;&#10;## 分支&#10;- 要点 1&#10;- 要点 2"
            />
          </div>

          <div
            className="flex min-h-[420px] flex-col overflow-hidden rounded-[30px] border border-[#f0e9e9] shadow-[0_18px_34px_rgba(15,23,42,0.04)]"
            style={{ backgroundColor: selectedStyle.surface }}
          >
            <div className="border-b border-[#f1eded] px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-950">思维导图</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedStyle.key === 'style1'
                  ? '主分支分色、折线连线、轻边框标签、纯净浅底导出。'
                  : '纯白背景、圆角卡片、柔和曲线连接，支持一级到十级标题节点。'}
              </p>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <svg
                ref={svgRef}
                className="min-h-full min-w-full"
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-labelledby={svgTitleId}
                xmlns="http://www.w3.org/2000/svg"
              >
                <title id={svgTitleId}>根据 Markdown 生成的思维导图</title>
                <rect width={width} height={height} fill={selectedStyle.background} />

                {edges.map(({ from, to }) => {
                  const branchColor = colorForBranch(to.topLevelIndex, selectedStyle)
                  const color = from.depth === 0 ? branchColor : tintColor(branchColor, 0.78)
                  return (
                    <path
                      key={`${from.id}-${to.id}`}
                      d={renderPath(from, to, selectedStyle)}
                      fill="none"
                      stroke={selectedStyle.connectorStyle === 'curve' ? tintColor(branchColor, 0.12) : color}
                      strokeWidth={
                        selectedStyle.connectorStyle === 'curve'
                          ? to.depth <= 1
                            ? 4
                            : to.hasChildren
                              ? 2.8
                              : 2
                          : to.depth <= 1
                            ? 3.5
                            : to.hasChildren
                              ? 2.4
                              : 1.8
                      }
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={to.depth === 1 ? 0.98 : 0.88}
                    />
                  )
                })}

                {positioned.map((node) => {
                  const color = colorForBranch(node.topLevelIndex, selectedStyle)
                  const isRoot = node.depth === 0
                  const lightLineColor = tintColor(color, 0.78)
                  const boxFill = isRoot ? selectedStyle.rootFill : tintColor(color, selectedStyle.key === 'style2' ? 0.84 : 0.72)
                  const boxStroke =
                    isRoot || selectedStyle.key === 'style1' ? boxFill : tintColor(color, 0.58)
                  const textColor = isRoot ? '#ffffff' : '#111111'

                  if (!node.hasChildren && node.depth > 0 && selectedStyle.leafStyle === 'underline') {
                    return (
                      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                        <text
                          fill="#222222"
                          fontSize={CHILD_FONT_SIZE}
                          fontWeight="500"
                          fontFamily="var(--font-sans)"
                        >
                          {node.lines.map((line, index) => (
                            <tspan
                              key={`${node.id}-${index}`}
                              x="0"
                              y={CHILD_FONT_SIZE + index * LEAF_LINE_HEIGHT}
                            >
                              {line}
                            </tspan>
                          ))}
                        </text>
                        <line
                          x1="0"
                          x2={node.width + LEAF_TRAIL}
                          y1={node.height + 4}
                          y2={node.height + 4}
                          stroke={lightLineColor}
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </g>
                    )
                  }

                  return (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                      <rect
                        width={node.width}
                        height={node.height}
                        rx={isRoot ? (selectedStyle.key === 'style2' ? 20 : 16) : selectedStyle.key === 'style2' ? 18 : 12}
                        fill={boxFill}
                        stroke={boxStroke}
                        strokeWidth={selectedStyle.key === 'style2' && !isRoot ? 1.4 : 0}
                      />

                      <text
                        fill={textColor}
                        fontSize={isRoot ? ROOT_FONT_SIZE : CHILD_FONT_SIZE}
                        fontWeight={isRoot ? '700' : '600'}
                        fontFamily="var(--font-sans)"
                      >
                        {node.lines.map((line, index) => (
                          <tspan
                            key={`${node.id}-${index}`}
                            x={BOX_PADDING_X}
                            y={
                              BOX_PADDING_Y +
                              (isRoot ? ROOT_FONT_SIZE : CHILD_FONT_SIZE) +
                              index * (isRoot ? ROOT_LINE_HEIGHT : BOX_LINE_HEIGHT)
                            }
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
