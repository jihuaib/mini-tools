# Mini-Tools 安装与配置指南

## 系统要求

Mini-Tools 可以在以下操作系统上运行：

- **Windows**：Windows 10、Windows 11（64位）
- **macOS**：macOS 11.0 (Big Sur) 或更高版本
- **Linux**：Ubuntu 20.04+、Debian 11+、Fedora 34+、CentOS 8+

## 硬件要求

最低配置：
- 处理器：双核 2.0 GHz 或更高
- 内存：4 GB RAM
- 存储空间：200 MB 可用磁盘空间
- 显示器：分辨率至少为 1280 x 720

推荐配置：
- 处理器：四核 2.5 GHz 或更高
- 内存：8 GB RAM 或更高
- 存储空间：500 MB 可用磁盘空间
- 显示器：分辨率 1920 x 1080 或更高

## 安装步骤

### Windows 安装

1. 从 [releases 页面](https://github.com/jihuaib/mini-tools/releases) 下载最新的 `.exe` 安装包
2. 双击安装包启动安装程序
3. 按照安装向导的指示完成安装
4. 安装完成后，在开始菜单或桌面找到 Mini-Tools 图标启动应用

### macOS 安装

1. 从 [releases 页面](https://github.com/jihuaib/mini-tools/releases) 下载最新的 `.dmg` 文件
2. 双击 `.dmg` 文件打开磁盘映像
3. 将 Mini-Tools 应用拖动到 Applications 文件夹
4. 从启动台或 Applications 文件夹启动 Mini-Tools

### Linux 安装

#### 使用 AppImage（推荐）

1. 从 [releases 页面](https://github.com/jihuaib/mini-tools/releases) 下载最新的 `.AppImage` 文件
2. 为 AppImage 文件添加执行权限：
   ```bash
   chmod +x Mini-Tools-x.x.x.AppImage
   ```
3. 直接运行 AppImage 文件：
   ```bash
   ./Mini-Tools-x.x.x.AppImage
   ```

#### 使用 Debian/Ubuntu 包

1. 从 [releases 页面](https://github.com/jihuaib/mini-tools/releases) 下载最新的 `.deb` 文件
2. 安装 `.deb` 包：
   ```bash
   sudo dpkg -i mini-tools_x.x.x_amd64.deb
   sudo apt-get install -f # 解决依赖问题（如果有）
   ```
3. 从应用菜单启动 Mini-Tools

#### 使用 RPM 包

1. 从 [releases 页面](https://github.com/jihuaib/mini-tools/releases) 下载最新的 `.rpm` 文件
2. 安装 `.rpm` 包：
   ```bash
   sudo rpm -i mini-tools-x.x.x.x86_64.rpm
   ```
3. 从应用菜单启动 Mini-Tools

## 从源码构建

如果您希望从源码构建 Mini-Tools，请按照以下步骤操作：

### 前置条件

- 安装 [Node.js](https://nodejs.org/)（版本 16.x 或更高版本）
- 安装 npm（通常随 Node.js 一起安装）
- 安装 Git

### 构建步骤

1. 克隆仓库：
   ```bash
   git clone https://github.com/jihuaib/mini-tools.git
   cd mini-tools
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 开发模式运行：
   ```bash
   npm run dev
   ```

4. 构建分发版本：
   ```bash
   npm run dist
   ```

   构建特定平台版本：
   ```bash
   # Windows
   npm run dist:win

   # macOS
   npm run dist:mac

   # Linux
   npm run dist:linux
   ```

5. 构建完成后，可在 `dist` 目录下找到打包好的应用

## 配置选项

Mini-Tools 提供了多种配置选项，可以根据个人偏好进行调整。

### 通用设置

1. 启动 Mini-Tools 后，点击左侧导航栏底部的"设置"图标
2. 在设置面板中，可以配置以下选项：
   - **主题**：选择浅色主题或深色主题
   - **语言**：选择界面语言（支持中文、英文）
   - **自动更新**：启用或禁用自动检查更新
   - **启动选项**：设置启动时的默认工具
   - **数据存储位置**：配置工具数据保存位置

### BGP 模拟器设置

1. 在 BGP 模拟器界面，点击右上角的设置图标
2. 配置以下选项：
   - **显示设置**：配置界面显示样式和元素
   - **模拟参数**：调整模拟速度和精度
   - **日志记录**：设置日志详细程度和保存位置

### 字符串生成器设置

1. 在字符串生成器界面，点击设置选项卡
2. 配置以下选项：
   - **默认生成数量**：设置默认的字符串生成数量
   - **结果显示格式**：配置结果显示的格式选项
   - **导出选项**：设置导出文件的默认格式和位置

## 故障排除

### 常见问题

#### 应用无法启动

- 检查系统要求是否满足
- 尝试以管理员/root 权限运行应用
- 检查是否有防病毒软件阻止了应用运行

#### 功能无法正常工作

- 确保使用的是最新版本的 Mini-Tools
- 尝试重新启动应用
- 检查是否有错误日志（在设置中可以查看日志位置）

#### 性能问题

- 关闭不需要的功能和工具
- 减少同时处理的数据量
- 在专业工具中使用分批处理模式

### 日志文件位置

Mini-Tools 的日志文件存储在以下位置：

- **Windows**：`%APPDATA%\mini-tools\logs`
- **macOS**：`~/Library/Logs/mini-tools`
- **Linux**：`~/.config/mini-tools/logs`

### 重置设置

如果您需要重置 Mini-Tools 的所有设置，可以删除配置文件：

- **Windows**：`%APPDATA%\mini-tools\config.json`
- **macOS**：`~/Library/Application Support/mini-tools/config.json`
- **Linux**：`~/.config/mini-tools/config.json`

## 联系与支持

- **GitHub Issues**：[https://github.com/jihuaib/mini-tools/issues](https://github.com/jihuaib/mini-tools/issues)
- **邮件支持**：[support@mini-tools.com](mailto:support@mini-tools.com)
- **文档网站**：[https://mini-tools.github.io/docs](https://mini-tools.github.io/docs)

## 更新与升级

Mini-Tools 会定期发布更新版本，包含新功能、性能改进和错误修复。

### 自动更新

默认情况下，Mini-Tools 会在启动时自动检查更新。当有新版本可用时，应用会通知用户并提供更新选项。

### 手动更新

1. 访问 [releases 页面](https://github.com/jihuaib/mini-tools/releases) 查看最新版本
2. 下载适合您系统的安装包
3. 安装新版本（无需卸载旧版本，新版本会自动替换旧版本）
