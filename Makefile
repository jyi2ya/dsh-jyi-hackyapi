SHELL := /bin/bash
.DEFAULT_GOAL := help

help:  ## 显示可用命令
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

install:  ## 安装依赖，并把宿主 DSH 的 @deepseek-ai 包链接进来
	npm install --no-audit --no-fund
	npm run link-host

link-host:  ## 重新链接宿主 DSH 的 @deepseek-ai 包
	npm run link-host

build:  ## 编译到 dist/
	npm run build

typecheck:  ## 只做类型检查
	npm run typecheck

test: build  ## 运行测试（测试导入 dist）
	npm test

check: typecheck test  ## 类型检查加测试

clean:  ## 删除构建产物
	rm -rf dist

publish-dist:  ## 构建并强推单提交的发布分支
	./scripts/publish-dist.sh

dist-dry-run:  ## 演练发布：构建并准备单提交，不推送
	./scripts/publish-dist.sh --dry-run

.PHONY: help install link-host build typecheck test check clean publish-dist dist-dry-run
