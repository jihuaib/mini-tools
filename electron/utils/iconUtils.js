const path = require('path');

/**
 * 获取平台适配的窗口图标路径
 * Windows 使用 .ico 格式，macOS 使用 .icns 格式，Linux 使用 .png 格式
 */
function getIconPath() {
    let iconFile;
    switch (process.platform) {
        case 'win32':
            iconFile = 'icon.ico';
            break;
        case 'darwin':
            iconFile = 'icon.icns';
            break;
        default:
            iconFile = 'logo.png';
    }
    return path.join(__dirname, '../assets', iconFile);
}

/**
 * 获取 Tray 图标路径
 * Tray 在所有平台都使用 .png 格式（macOS 不支持 .icns）
 * Windows 也可以使用 .ico，但 .png 更通用
 */
function getTrayIconPath() {
    // macOS Tray 图标建议使用 16x16 或 22x22 的 png
    // Windows 可以使用 ico 或 png
    const iconFile = process.platform === 'win32' ? 'icon.ico' : 'logo.png';
    return path.join(__dirname, '../assets', iconFile);
}

module.exports = {
    getIconPath,
    getTrayIconPath
};
