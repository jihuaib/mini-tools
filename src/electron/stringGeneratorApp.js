const { BrowserWindow } = require('electron');
const path = require('path');
const {runWorkerWithPromise} = require("./worker/runWorkerWithPromise");

async function handleGenerateTemplateString(event, templateData) {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    console.log('[Main] handleGenerateTemplateString', templateData);

    try {
        const result = await runWorkerWithPromise(
            path.join(__dirname, './worker/StringGeneratorWorker.js'),
            templateData
        );
        console.log('[Main] Worker处理结果:', result);
        return result;
    } catch (err) {
        console.log('[Main] Worker处理结果:', err);
        return err;
    }
}

module.exports = {
    handleGenerateTemplateString
};