const { app, BrowserWindow } = require("electron");
const path = require("path");
const { runWorkerWithPromise } = require("./worker/runWorkerWithPromise");
const fs = require("fs");

// 获取配置文件路径
function getConfigPath() {
    return path.join(app.getPath("userData"), "string-generator-config.json");
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
        await fs.promises.writeFile(
            configPath,
            JSON.stringify(config, null, 2),
        );
        return { status: "success" };
    } catch (error) {
        console.error("Error saving config:", error);
        return { status: "error", message: error.message };
    }
}

// 加载配置
async function handleLoadStringGeneratorConfig() {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return { status: "success", data: null };
        }
        const data = await fs.promises.readFile(configPath, "utf8");
        return { status: "success", data: JSON.parse(data) };
    } catch (error) {
        console.error("Error loading config:", error);
        return { status: "error", message: error.message };
    }
}

async function handleGenerateTemplateString(event, templateData) {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    console.log("[Main] handleGenerateTemplateString", templateData);

    try {
        const result = await runWorkerWithPromise(
            path.join(__dirname, "./worker/StringGeneratorWorker.js"),
            templateData,
        );
        console.log("[Main] Worker处理结果:", result);
        return result;
    } catch (err) {
        console.log("[Main] Worker处理结果:", err);
        return err;
    }
}

module.exports = {
    handleGenerateTemplateString,
    handleSaveStringGeneratorConfig,
    handleLoadStringGeneratorConfig,
};
