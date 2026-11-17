/**
 * dsh-jyi-hackyapi 的浏览器半边：Web UI 插件共用的锚点与弹层工具。
 *
 * - `ANCHOR_EVENT`：选区锚点事件的名称（selection-anchor 发布，其它插件订阅）；
 * - `useAnchor`：订阅锚点事件、维护当前锚点、点外部关闭；
 * - `positionOverlay`：按锚点计算弹层位置（鼠标方向、视口夹取）；
 * - `registerOverlay`：往客户端 slot 里注册一个叠加层组件。
 */
window.__ModuleLoader__.load({
  id: 'dsh-jyi-hackyapi',
  factory: function (require) {
    const React = require('react')
    const h = React.createElement

    /** 选区锚点事件的名称。 */
    const ANCHOR_EVENT = 'selection/anchor'

    /**
     * 订阅锚点事件并返回 [anchor, setAnchor]；点弹层外部时清空。
     * @param {object} anchorCtx - 发布事件的客户端 context（带 on 方法）。
     * @param {{current: HTMLElement|null}} boxRef - 弹层根节点，用于"点内部不关闭"。
     */
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

    /**
     * 按锚点计算弹层位置。
     * @param {object} anchor - 锚点（point 或 rect，含 direction）。
     * @param {{width: number, height?: number, margin?: number}} size - 弹层尺寸。
     * @param {{width: number, height: number}} [viewport] - 视口尺寸，默认窗口。
     * @returns {{left: number, top?: number, bottom?: number}}
     */
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

    /**
     * 往客户端 slot 注册一个叠加层组件；组件会收到 slot props 与 `anchorCtx`。
     * @param {object} ctx - 客户端插件 context（带 slots）。
     * @param {{slot: string, id: string, order?: number, component: Function}} options
     */
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
      apply: function () {},
      ANCHOR_EVENT,
      useAnchor,
      positionOverlay,
      registerOverlay,
    }
  },
})
