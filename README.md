# Mini-Tools

一个基于 Vue3 + Ant Design Vue + Electron 开发的桌面工具集。

## 功能特性

- BGP 模拟器：模拟 BGP 协议行为
  ![BGP 模拟器界面](doc/images/bgp_simulator.png)

- 字符串生成器：生成各种格式的字符串
  ![字符串生成器界面](doc/images/string_generator.png)

- 更多工具正在开发中...

## 技术栈

- Vue 3
- Ant Design Vue
- Electron
- Vite

## 开发环境要求

- Node.js
- npm

## 安装与运行

1. 克隆项目
```bash
git clone https://github.com/jihuaib/mini-tools.git
cd mini-tools
```

2. 安装依赖
```bash
npm install
```

3. 开发模式运行
```bash
npm run dev
```

4. 打包应用
```bash
npm run dist
```

## 项目结构

```
mini-tools/
├── src/               # 源代码目录
│   ├── view/          # 视图组件
│   ├── electron/      # Electron 相关代码
│   ├── components/    # 公共组件
│   ├── utils/         # 工具函数
│   ├── router/        # 路由配置
│   └── assets/        # 静态资源
├── dist/              # 构建输出目录
└── doc/               # 文档目录
```

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License


