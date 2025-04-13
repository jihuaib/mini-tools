const { parentPort } = require('worker_threads');

parentPort.on('message', (templateData) => {
    try {
        const { template, placeholder, start, end } = templateData;

        const startNum = parseInt(start);
        const endNum = parseInt(end);

        if (isNaN(startNum) || isNaN(endNum)) {
            throw new Error('start和end必须是数字');
        }

        const results = [];
        for (let i = startNum; i <= endNum; i++) {
            const line = template.replaceAll(placeholder, i);
            results.push(line);
        }

        parentPort.postMessage(results);
    } catch (err) {
        throw new Error(err.message);
    }
});
