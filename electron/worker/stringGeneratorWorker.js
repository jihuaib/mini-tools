const { parentPort } = require('worker_threads');
const { successResponse, errorResponse } = require('../utils/responseUtils');

parentPort.on('message', templateData => {
    try {
        const { template, placeholder, start, end } = templateData;

        const startNum = parseInt(start);
        const endNum = parseInt(end);

        const results = [];
        for (let i = startNum; i <= endNum; i++) {
            const line = template.replaceAll(placeholder, i);
            results.push(line);
        }

        parentPort.postMessage(successResponse(results));
    } catch (err) {
        parentPort.postMessage(errorResponse(err.message));
    }
});
