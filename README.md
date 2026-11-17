# dsh-jyi-hackyapi

DSH 插件生态里有些做法拿不到公开接口，作者只能各写一遍。这个仓库把它们收成一组公开导出。

## 缺口

DSH 的 preset 由声明它的插件在启动时注册。插件作者想按程序生成一个变体，找不到公开入口；他只能复制 shipped preset 文件，再把它装成独立 bundle。DSH 每升级一次，这些副本就过期一次。

插件之间的私有约定也有同样的麻烦。选区锚点事件、弹层位置这类约定没有中立归属，发布方和消费方各自维护一份，哪一方改动都会悄悄漂移。

选区到语义锚点的映射也没有公开入口。聊天、文件审阅、文档预览、代码预览四类界面的位置信息藏在各自的 DOM 标记里，每个使用选区的插件都得逆向一遍。

运行时改另一个插件行的配置同样缺少落脚点。Loader 的 `update()` 按 id 找行，但 profile 的行挂在 include 子树下，根树的 `resolve()` 走不到它们；调用方还得自己拼出整份配置，才能只改一个 volatile 字段。

## 这个仓库提供

宿主侧提供 `presets`。调用方从已声明的 preset 派生变体，拿回一个句柄，变体随声明它的插件一起卸载。

宿主侧还提供 `volatile`。调用方按行 id 读取或合并配置，改动落在 volatile 字段上时，目标行不重挂，只收到 `loader/volatile-update`。`piAiProviders` 在此之上读写 pi-ai 适配器的 provider 字典，其它 provider 原样保留；存在 settings 服务时整表写进 profile 配置，重载后按文件恢复，没有 settings 服务时只改运行时。

前端侧提供一套 Web UI 工具，包含四类界面的选区解析与锚点事件发布、锚点订阅、弹层定位和客户端 slot 注册。Web UI 插件通过客户端模块表引用这些工具。

消费方只依赖导出。DSH 的接口变化时，改这里一处。

## 限制

本仓库只在 DSH `0.2.2-rc.1` 上验证，其它版本不保证。代码按现状提供，不作任何担保。宿主的 `@deepseek-ai/*` 包由 DSH 提供，不随本包分发。前端半边需要本包以 bundle 行安装进 profile，客户端才会扫描加载。

## 开发

仓库的日常操作收在 Makefile 里，`make help` 列出全部。

```sh
make install       # 安装依赖并链接宿主 DSH 的 @deepseek-ai 包
make check         # 类型检查 + 构建 + 测试
make dist-dry-run  # 演练发布：构建并准备单提交，不推送
make publish-dist  # 构建并强推单提交的发布分支
```

`publish-dist` 把构建产物与包元数据打成一条单提交，推到 `dist` 分支。默认远端是 `origin`，可以用 `--branch=` 或 `--remote=` 改。

本仓库公开。提交前请确认内容不含内部地址、凭据与内部模型 id。

## 许可

本仓库采用 AGPL-3.0 或更新版本。DSH 运行时依赖的 `@deepseek-ai/*` 包保持各自的 MIT 许可。
