const { app, BrowserWindow, ipcMain, dialog, Tray } = require("electron");
const path = require("path");
const {
    handleStartBgp,
    handleGetNetworkInfo,
    handleSaveBgpConfig,
    handleLoadBgpConfig,
    handleStopBgp,
    getBgpState,
    handleSendRoute,
    handleWithdrawRoute,
} = require("./bgpSimulatorApp");
const {
    handleGenerateTemplateString,
    handleSaveStringGeneratorConfig,
    handleLoadStringGeneratorConfig,
} = require("./stringGeneratorApp");
const log = require("electron-log");

const isDev = !app.isPackaged;
let mainWindow = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 800,
        resizable: false, // 固定大小，不允许调整
        autoHideMenuBar: true, // 隐藏菜单栏
        frame: true, // 保持原生边框
        center: true, // 窗口居中显示
        backgroundColor: "#ffffff", // 设置背景色，避免加载时闪烁
        icon: path.join(__dirname, "./assets/icon.ico"),
        webPreferences: {
            nodeIntegration: false, // 禁用 nodeIntegration 提高安全性
            contextIsolation: true, // 启用 contextIsolation 更好地隔离上下文
            preload: path.join(__dirname, "preload.js"),
        },
    });

    log.info(`Dev ${isDev} __dirname ${__dirname}`);
    const urlLocation = isDev
        ? "http://127.0.0.1:3000"
        : `file://${path.join(__dirname, "../../dist/index.html")}`;
    win.loadURL(urlLocation);

    // 打开调试工具
    win.webContents.openDevTools();

    // 监听窗口关闭事件
    win.on("close", async (event) => {
        if (getBgpState()) {
            event.preventDefault();
            const { response } = await dialog.showMessageBox(win, {
                type: "warning",
                title: "确认关闭",
                message: "BGP 模拟器正在运行，确定要关闭吗？",
                buttons: ["确定", "取消"],
                defaultId: 1,
                cancelId: 1,
            });

            if (response === 0) {
                // 用户点击确定，先停止 BGP 然后关闭窗口
                await handleStopBgp();
                win.destroy();
            }
        }
    });

    const tray = new Tray(path.join(__dirname, "./assets/icon.ico"));

    mainWindow = win;
}

app.whenReady().then(() => {
    ipcMain.handle("generate-template-string", handleGenerateTemplateString);
    ipcMain.on("start-bgp", handleStartBgp);
    ipcMain.handle("get-network-info", handleGetNetworkInfo);
    ipcMain.handle("save-bgp-config", handleSaveBgpConfig);
    ipcMain.handle("load-bgp-config", handleLoadBgpConfig);
    ipcMain.handle(
        "save-string-generator-config",
        handleSaveStringGeneratorConfig,
    );
    ipcMain.handle(
        "load-string-generator-config",
        handleLoadStringGeneratorConfig,
    );
    ipcMain.handle("stop-bgp", handleStopBgp);
    ipcMain.handle("send-route", handleSendRoute);
    ipcMain.handle("withdraw-route", handleWithdrawRoute);
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
