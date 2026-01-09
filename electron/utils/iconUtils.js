const path = require('path');

/**
 * 获取平台适配的图标路径
 * Windows 使用 .ico 格式，Linux/Mac 使用 .png 格式
 */
function getIconPath() {
    const iconFile = process.platform === 'win32' ? 'icon.ico' : 'logo.png';
    return path.join(__dirname, '../assets', iconFile);
}

module.exports = {
    getIconPath
};
