/**
 * dsh-jyi-hackyapi 的浏览器半边：选区锚点与弹层工具。
 *
 * - 锚点生产：监听文档选区，把选区解析成语义锚点，以 `selection/anchor` 事件发布；
 * - 锚点消费：`useAnchor` 订阅事件、维护当前锚点、点外部关闭；
 * - 弹层定位：`positionOverlay` 按锚点与视口计算位置；
 * - slot 注册：`registerOverlay` 把叠加层组件注册进客户端 slot。
 *
 * 锚点覆盖四种界面：聊天消息、文件审阅 diff、文档预览、代码预览。
 */
window.__ModuleLoader__.load({
  id: 'dsh-jyi-hackyapi',
  factory: function (require) {
    const React = require('react')
    const h = React.createElement

    /** 选区锚点事件的名称。 */
    const ANCHOR_EVENT = 'selection/anchor'
    /** 引文最大字符数。 */
    const QUOTE_MAX_CHARS = 2000

    // ===== 锚点生产 =====

    function closestOf(node, selector) {
      const el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node
      return el && typeof el.closest === 'function' ? el.closest(selector) : null
    }

    /** 选区所在的聊天消息节点。 */
    function findSeat(anchorEl) {
      if (!anchorEl || typeof anchorEl.closest !== 'function') return null
      return anchorEl.closest('[data-chat-node-key]')
    }

    /** diff 行首列的行号。 */
    function lineOf(rowEl) {
      if (rowEl === null || rowEl === undefined) return null
      const number = rowEl.firstElementChild
      if (number === null) return null
      const text = String(number.textContent ?? '').trim()
      const value = Number(text)
      return text === '' || !Number.isInteger(value) ? null : value
    }

    /** 文档预览行携带的行号。 */
    function textLineOf(rowEl) {
      if (rowEl === null || rowEl === undefined) return null
      const value = Number(rowEl.getAttribute('data-textpreview-line'))
      return Number.isInteger(value) && value >= 0 ? value : null
    }

    /** 代码预览里的行号，按同类兄弟节点计数。 */
    function lineIndexOf(lineEl) {
      if (lineEl === null || lineEl.parentElement === null) return null
      let index = 1
      let sibling = lineEl.previousElementSibling
      while (sibling !== null) {
        if (sibling.classList && sibling.classList.contains('line')) index += 1
        sibling = sibling.previousElementSibling
      }
      return index
    }

    /** 从资源 URL 里取出文件名。 */
    function fileFromResourceUrl(url) {
      const prefix = 'dsh-resource://file/session/'
      if (typeof url !== 'string' || !url.startsWith(prefix)) return null
      const rest = url.slice(prefix.length)
      const slash = rest.indexOf('/')
      if (slash === -1) return null
      return rest.slice(slash + 1)
    }

    /** 逐行拼接同一父节点下的行元素文本；浏览器选中多行时会吃掉换行。 */
    function rowQuote(startEl, endEl) {
      if (startEl === null || endEl === null || startEl.parentElement === null) return null
      if (endEl.parentElement !== startEl.parentElement) return null
      if (startEl === endEl) return String(startEl.textContent ?? '').replace(/\n+$/u, '')
      // 反向拖拽时锚点在后、焦点在前；从靠前的行往前走，两个方向都覆盖。
      if (!(startEl.compareDocumentPosition(endEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        const swap = startEl
        startEl = endEl
        endEl = swap
      }
      const lines = []
      let current = startEl
      while (current !== null) {
        lines.push(String(current.textContent ?? '').replace(/\n+$/u, ''))
        if (current === endEl) break
        current = current.nextElementSibling
      }
      return lines.join('\n')
    }

    /** 修剪首尾空行与行尾空白，超长时截断。 */
    function clipQuote(text) {
      const lines = text.replace(/\r\n?/gu, '\n').split('\n')
      while (lines.length > 0 && lines[0].trim() === '') lines.shift()
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
      const trimmed = lines.map((line) => line.replace(/[ \t]+$/u, ''))
      let result = trimmed.join('\n')
      if (result.length > QUOTE_MAX_CHARS) {
        result = result.slice(0, QUOTE_MAX_CHARS - 1) + '…'
      }
      return result
    }

    /** 把一个 DOM 选区解析成语义锚点；折叠、空选区、可编辑区域与不可测量的选区返回 null。 */
    function resolve(sel) {
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
      const anchorNode = sel.anchorNode
      const focusNode = sel.focusNode
      const anchorEl = anchorNode && anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode
      const focusEl = focusNode && focusNode.nodeType === Node.TEXT_NODE ? focusNode.parentElement : focusNode
      if (
        anchorEl &&
        typeof anchorEl.closest === 'function' &&
        anchorEl.closest('input, textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')
      ) {
        return null
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return null

      let quote = null
      const docStart = closestOf(anchorNode, '[data-textpreview-line]')
      const docEnd = closestOf(focusNode, '[data-textpreview-line]')
      quote = rowQuote(docStart, docEnd)
      if (quote === null) {
        const codeStart = closestOf(anchorNode, 'span.line')
        const codeEnd = closestOf(focusNode, 'span.line')
        quote = rowQuote(codeStart, codeEnd)
      }
      if (quote === null) {
        const raw = sel.toString()
        if (typeof raw !== 'string' || raw.trim() === '') return null
        quote = raw
      }
      quote = clipQuote(quote)
      if (quote === '') return null

      const base = {
        quote,
        rect: { left: rect.left, top: rect.top, bottom: rect.bottom },
        anchorNode,
        // 拖拽方向：焦点在锚点之后为 forward，反之为 backward；消费方据此把弹层放在上边或下边。
        direction:
          anchorNode !== null && focusNode !== null && anchorNode !== focusNode
            ? (anchorNode.compareDocumentPosition(focusNode) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
              ? 'forward'
              : 'backward'
            : 'forward',
      }

      const seat = findSeat(anchorEl)
      if (seat !== null) {
        const turn = seat.getAttribute('data-chat-turn')
        const nodeKind = seat.getAttribute('data-chat-flow-kind') || undefined
        return {
          ...base,
          kind: 'chat',
          turn: turn === null || turn === '' ? undefined : Number(turn),
          nodeKind,
        }
      }

      const reviewRoot = closestOf(anchorNode, '[data-changes-review]')
      if (reviewRoot !== null) {
        const fileButton = reviewRoot.querySelector('[data-review-file]')
        const anchorRow = closestOf(anchorNode, '[data-diff-line]')
        const column = anchorRow ? anchorRow.closest('[data-diff-side]') : null
        const focusRow = closestOf(focusNode, '[data-diff-line]')
        return {
          ...base,
          kind: 'diff',
          file: fileButton ? fileButton.getAttribute('data-review-file') : undefined,
          side: column ? column.getAttribute('data-diff-side') === 'left' ? 'old' : 'new' : undefined,
          startLine: lineOf(anchorRow) ?? undefined,
          endLine: lineOf(focusRow) ?? lineOf(anchorRow) ?? undefined,
        }
      }

      const codePreview = closestOf(anchorNode, '[data-code-preview]')
      if (codePreview !== null) {
        const urlRoot = closestOf(anchorNode, '[data-textpreview-state]')
        const url = urlRoot === null ? '' : urlRoot.getAttribute('data-textpreview-url') ?? ''
        const anchorLineEl = closestOf(anchorNode, 'span.line')
        const focusLineEl = closestOf(focusNode, 'span.line')
        return {
          ...base,
          kind: 'document',
          file: fileFromResourceUrl(url) ?? undefined,
          startLine: lineIndexOf(anchorLineEl) ?? undefined,
          endLine: lineIndexOf(focusLineEl) ?? lineIndexOf(anchorLineEl) ?? undefined,
        }
      }

      const preview = closestOf(anchorNode, '[data-textpreview-state]')
      if (preview !== null) {
        const url = preview.getAttribute('data-textpreview-url') ?? ''
        const anchorLineEl = closestOf(anchorNode, '[data-textpreview-line]')
        const focusLineEl = closestOf(focusNode, '[data-textpreview-line]')
        const pageEl = closestOf(anchorNode, '[data-textpreview-page]')
        const page = pageEl === null ? null : Number(pageEl.getAttribute('data-textpreview-page'))
        return {
          ...base,
          kind: 'document',
          file: fileFromResourceUrl(url) ?? undefined,
          startLine: textLineOf(anchorLineEl) ?? undefined,
          endLine: textLineOf(focusLineEl) ?? textLineOf(anchorLineEl) ?? undefined,
          page: Number.isInteger(page) && page > 1 ? page : undefined,
        }
      }

      return { ...base, kind: 'unknown' }
    }

    /** 在给定 ctx 上安装选区监听，选区结束时发布锚点事件。 */
    function startAnchorProducer(ctx) {
      let pending = null
      const onSelectionChange = () => {
        pending = resolve(window.getSelection())
      }
      const publish = (event) => {
        if (pending === null) return
        const anchor = pending
        pending = null
        // 鼠标松开时带上落点，弹层贴着手指出现；键盘选择没有落点。
        const isMouse = event !== null && event !== undefined && typeof event.clientX === 'number'
        ctx.emit(
          ANCHOR_EVENT,
          isMouse ? { ...anchor, point: { x: event.clientX, y: event.clientY } } : anchor,
        )
      }
      document.addEventListener('selectionchange', onSelectionChange)
      document.addEventListener('mouseup', publish)
      document.addEventListener('keyup', publish)
      ctx.effect(() => () => {
        document.removeEventListener('selectionchange', onSelectionChange)
        document.removeEventListener('mouseup', publish)
        document.removeEventListener('keyup', publish)
      }, 'hackyapi: selection listeners')
    }

    // ===== 锚点消费与弹层 =====

    /** 订阅锚点事件并返回 [anchor, setAnchor]；点弹层外部时清空。 */
    function useAnchor(anchorCtx, boxRef) {
      const [anchor, setAnchor] = React.useState(null)
      React.useEffect(() => {
        const onAnchor = (next) => {
          if (boxRef.current && next.anchorNode && boxRef.current.contains(next.anchorNode)) return
          setAnchor(next)
        }
        return anchorCtx.on(ANCHOR_EVENT, onAnchor)
      }, [anchorCtx, boxRef])
      React.useEffect(() => {
        if (anchor === null) return undefined
        const onMouseDown = (event) => {
          if (boxRef.current && boxRef.current.contains(event.target)) return
          setAnchor(null)
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
      }, [anchor, boxRef])
      return [anchor, setAnchor]
    }

    /** 按锚点计算弹层位置。 */
    function positionOverlay(anchor, size, viewport) {
      const viewW = (viewport && viewport.width) || window.innerWidth
      const viewH = (viewport && viewport.height) || window.innerHeight
      const margin = size.margin === undefined ? 8 : size.margin
      const width = size.width
      if (anchor.point) {
        const left = Math.max(margin, Math.min(anchor.point.x, viewW - width - margin))
        if (anchor.direction === 'backward') {
          return { left, bottom: Math.max(margin, viewH - anchor.point.y + margin) }
        }
        return { left, top: anchor.point.y + margin }
      }
      const anchorBottom = anchor.rect.bottom + margin
      const anchorTop = anchor.rect.top - margin
      const left = Math.max(margin, Math.min(anchor.rect.left, viewW - width - margin))
      if (anchorTop > viewH / 2) return { left, bottom: viewH - anchorTop }
      return { left, top: anchorBottom }
    }

    /** 往客户端 slot 注册一个叠加层组件；组件会收到 slot props 与 `anchorCtx`。 */
    function registerOverlay(ctx, options) {
      const { slot, id, order = 50, component } = options
      ctx.slots.inject(slot, () => {
        return ctx.slots.register({ name: slot, id, order }, (props) => {
          return h(component, { ...props, anchorCtx: ctx })
        })
      })
    }

    return {
      name: 'dsh-jyi-hackyapi',
      inject: [],
      apply: function (ctx) {
        startAnchorProducer(ctx)
      },
      ANCHOR_EVENT,
      useAnchor,
      positionOverlay,
      registerOverlay,
      startAnchorProducer,
    }
  },
})
