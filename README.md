# dsh-jyi-hackyapi

DSH 插件里那些依赖未公开行为的写法，到这里领一个稳定的接口。

## 缺口

DSH 的扩展面按插件设计，但有些能力没有公开入口：

- **运行时派生 preset**：preset 只在声明它的插件启动时注册。想按程序生成变体（比如给压缩引擎做一个 preset），作者只能复制 shipped preset 文件、再把它装成 bundle；DSH 升级后副本过期，得重新生成。
- **运行时注册模型提供方**：pi-ai 的 provider 只能来自配置，程序管理的模型目录无处安放。
- **UI 锚点与宿主路由**：没有公开的选区、弹层、路由注册接口，作者只能读 DOM、自己拼路径。

每个作者各写一遍，各坏一遍；升级 DSH 时没人知道哪一处依赖了哪个内部细节。

## 这个仓库补什么

一组 capability：每项能力一个稳定契约，配一个适应当前 DSH 的后端。消费者只依赖契约；DSH 变了，改这里一处，配一组跑在真实 DSH 上的契约测试来暴露漂移。

现在可用：

- `presets`：从已声明的 preset 派生变体，运行时生效、随插件卸载消失，不产生配置文件。

## 限制

- 只针对 DSH `0.2.2-rc.1` 验证，其它版本不保证。
- `as-is`，无任何保证。
- 宿主的 `@deepseek-ai/*` 包由 DSH 提供，不随本包分发。
- 目前只有 `presets` 一项能力落地。

## 开发

仓库的日常操作都收在 Makefile 里，`make help` 列出全部：

```sh
make install       # 安装依赖并链接宿主 DSH 的 @deepseek-ai 包
make check         # 类型检查 + 构建 + 测试
make dist-dry-run  # 演练发布：构建并准备单提交，不推送
make publish-dist  # 构建并强推单提交的发布分支
```

`publish-dist` 把 `dist/`、`package.json`、`LICENSE` 打成一条单提交推到 `dist` 分支（默认远端 `origin`，可用 `--branch=` / `--remote=` 覆盖），旧提交随 force-push 变成不可达，远端 gc 后清掉。

本仓库公开。不要提交内部地址、凭据、内部模型 id。

## 许可

AGPL-3.0 或更新版本（AGPL-3.0-or-later）。DSH 运行时依赖的 `@deepseek-ai/*` 包保持各自的 MIT 许可。
