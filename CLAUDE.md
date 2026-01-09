# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 项目概述

NetNexus 是一个基于 Vue 3、Ant Design Vue 和 Electron 构建的专业网络和开发工具集。它提供网络协议模拟器（BGP、BMP、RPKI、SNMP、FTP）和开发者实用工具（报文解析器、字符串生成器、格式化工具、报文捕获）。
本项目需要同时兼容 Windows 和 Linux。
开发环境可能运行在 WSL，但代码必须能在原生 Windows 上正常运行。
项目包含 Electron、Node.js 以及 native 模块。

## 跨平台兼容性（最高优先级）

所有代码修改 **必须同时兼容 Windows 和 Linux**。

### 通用规则
- 不允许只考虑 Linux 或只考虑 Windows。
- 不允许引入仅在某一平台可用的实现方式。
- 如必须使用平台相关逻辑，必须显式区分并说明原因。

### 路径与文件系统
- 必须使用 `path.join` / `path.resolve` 处理路径。
- 禁止硬编码 `/` 或 `\`。
- 假设文件系统可能大小写不敏感。
- 禁止依赖 `/proc`、`/sys` 等 Linux 特有路径。

### Node.js / Electron
- 仅使用跨平台的 Node.js API。
- 禁止使用 bash / GNU 专属命令。
- 子进程、脚本必须在 Windows 和 Linux 下都可运行。
- 不允许自动升级 Electron 或 Node 版本。

### Native 模块（C / C++）
- 代码必须可在 Windows（MSVC）和 Linux（GCC/Clang）编译。
- 禁止使用平台专属头文件（如 unistd.h）而不做条件判断。
- 平台差异必须使用宏区分（如 `_WIN32`）。


## 开发命令

### 安装配置
```bash
npm install                    # 安装依赖
```

### 开发调试
```bash
npm run dev                   # 启动开发环境（Vite + Electron）
npm start                     # 仅启动 Vite 开发服务器（端口 3000）
```

### 代码质量
```bash
npm run lint                  # 在 src 和 electron 目录运行 ESLint
npm run lint:fix              # 自动修复 ESLint 问题
npm run format                # 使用 Prettier 格式化代码
```

### 构建打包
```bash
npm run build                 # 使用 Vite 构建 Vue 应用（输出到 dist/）
npm run pack                  # 打包 Electron 应用（不含安装程序）
npm run dist                  # 构建并创建 Windows 安装程序
npm run release               # 构建并发布版本
```

## 架构设计

### Electron 进程架构

**主进程** (`electron/main.js`):
- 创建带启动画面的 BrowserWindow
- 加载 SystemApp 来协调所有应用模块
- 开发模式：从 `http://127.0.0.1:3000` 加载
- 生产模式：从 `dist/index.html` 加载

**预加载脚本** (`electron/preload.js`):
- 暴露渲染进程和主进程之间的 IPC 通信桥接
- 使用 contextBridge 实现安全的 API 暴露

**应用模块** (`electron/app/`):
- `systemApp.js`: 中央协调器，管理所有应用模块、设置存储（electron-store）和版本兼容性
- `bgpApp.js`: BGP 模拟器管理
- `bmpApp.js`: BMP 监控器管理（使用 KeychainManager）
- `rpkiApp.js`: RPKI 验证器管理（使用 KeychainManager）
- `ftpApp.js`: FTP 服务器管理
- `snmpApp.js`: SNMP 管理器
- `toolsApp.js`: 开发工具协调
- `updater.js`: 自动更新功能
- `keychainManager.js`: 管理 BMP/RPKI 的认证密钥链

**工作进程** (`electron/worker/`):
- 每个协议都有专用的 worker 文件来处理会话、实例和路由
- Workers 使用 `workerMessageHandler.js` 进行 IPC 通信
- 示例：`bgpSession.js`、`bmpSession.js`、`rpkiSession.js`、`ftpSession.js`、`snmpSession.js`

**报文解析器** (`electron/pktParser/`):
- 协议特定的解析器：`bgpPacketParser.js`、`tcpPacketParser.js`、`udpPacketParser.js`、`ipPacketParser.js`、`ethernetPacketParser.js`、`arpPacketParser.js`
- 通过 `parserRegistry.js` 和 `packetParserRegistry.js` 实现注册表模式

### Vue 前端架构

**路由** (`src/router/index.js`):
- 使用 Vue Router 4 和 hash 历史模式
- 每个模块（tools、bgp、bmp、rpki、ftp、snmp）都有嵌套路由
- 所有路由都设置 `keepAlive: true` 以保持状态

**状态管理** (`src/store/index.js`):
- Vuex 4 store 管理缓存视图以支持 keep-alive 功能
- Actions：`addCachedView`、`delCachedView`、`resetCachedViews`

**视图结构** (`src/view/`):
- 每个协议都有自己的目录，包含配置和数据视图
- `Main.vue`: 根布局组件
- `tools/`: 开发者工具（StringGenerator、PacketParser、Formatter、PacketCapture）
- `bgp/`: BGP 模拟器视图（配置、对等体信息、IPv4/IPv6/MVPN 路由）
- `bmp/`: BMP 监控器视图（配置、会话、loc-rib、统计）
- `rpki/`: RPKI 验证器视图（配置、ROA 管理）
- `ftp/`: FTP 服务器视图（配置、客户端管理）
- `snmp/`: SNMP 管理器视图（配置、trap 处理）
- `settings/`: 应用设置（密钥链、更新、部署、FTP、工具、通用）

**组件** (`src/components/`):
- `SettingsDialog.vue`: 全局设置对话框
- `UpdateNotification.vue`: 更新通知界面
- `PacketResultViewer.vue`: 报文分析显示
- `CodeEditor.vue`: 代码编辑组件
- `CustomPktDrawer.vue`: 自定义报文抽屉
- `ScrollTextarea.vue`: 可滚动文本区域组件

**常量** (`src/const/` 和 `electron/const/`):
- 前后端之间镜像的协议特定常量
- 文件：`bgpConst.js`、`bmpConst.js`、`rpkiConst.js`、`ftpConst.js`、`snmpConst.js`、`toolsConst.js`

### 数据存储

- **electron-store**: 用于持久化设置和程序数据
- 设置存储在：`Settings Data.json`
- 程序数据存储在：`Program Data.json`
- 位置：`app.getPath('userData')`

### IPC 通信模式

前端通过预加载脚本中暴露的 IPC API 与 Electron 主进程通信。每个应用模块在 SystemApp 构造函数中注册处理程序。Workers 通过 `workerMessageHandler.js` 进行通信。

## 代码风格

- ESLint 配置强制执行 Vue 3 推荐规则和 Prettier 格式化
- Electron 文件使用 CommonJS（`require`），src 文件使用 ES 模块（`import`）
- Vue 组件使用 Composition API
- 使用 `===` 进行相等性检查（ESLint 强制）
- 允许使用 `_` 前缀的未使用变量

## 环境要求

- Node.js 16.20.2+
- npm 8.19.4+
- Python 3.8（用于原生依赖）
- 支持：Windows 7+、macOS 11+、Linux

## 构建配置

- 使用 Vite 进行 Vue 应用打包
- 使用 electron-builder 进行打包（Windows NSIS 安装程序）
- 目标：x64 架构
- 禁用 ASAR 以便于调试
- 通过 GitHub releases 自动更新
