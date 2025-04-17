const { app, BrowserWindow } = require('electron');
const path = require('path');
const { runWorkerWithPromise } = require('./worker/runWorkerWithPromise');
const fs = require('fs');
const log = require('electron-log');
const { successResponse, errorResponse } = require('./utils/responseUtils');

const isDev = !app.isPackaged;

// 获取配置文件路径
function getConfigPath() {
    return path.join(app.getPath('userData'), 'string-generator-config.json');
}

// 保存配置
async function handleSaveStringGeneratorConfig(event, config) {
    try {
        const configPath = getConfigPath();
        const configDir = path.dirname(configPath);
        // 确保目录存在
        if (!fs.existsSync(configDir)) {
            await fs.promises.mkdir(configDir, { recursive: true });
        }
        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
        return successResponse(null, '配置文件保存成功');
    } catch (error) {
        log.error('Error saving config:', error);
        return errorResponse(error.message);
    }
}

// 加载配置
async function handleLoadStringGeneratorConfig() {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return successResponse(null, '配置文件不存在');
        }
        const data = await fs.promises.readFile(configPath, 'utf8');
        return successResponse(JSON.parse(data), '配置文件加载成功');
    } catch (error) {
        log.error('Error loading config:', error);
        return errorResponse(error.message);
    }
}

async function handleGenerateTemplateString(event, templateData) {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    log.info('[Main] handleGenerateTemplateString', templateData);

    try {
        const workerPath = isDev
            ? path.join(__dirname, './worker/StringGeneratorWorker.js')
            : path.join(process.resourcesPath, 'app.asar.unpacked', 'src/electron/worker/StringGeneratorWorker.js');
        const result = await runWorkerWithPromise(path.join(workerPath), templateData);
        log.info('[Main] Worker处理结果:', result);
        return result;
    } catch (err) {
        log.error('[Main] Worker处理结果:', err);
        return errorResponse(err.message);
    }
}

module.exports = {
    handleGenerateTemplateString,
    handleSaveStringGeneratorConfig,
    handleLoadStringGeneratorConfig
};
