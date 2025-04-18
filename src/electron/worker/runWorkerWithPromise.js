const { Worker } = require('worker_threads');
const log = require('electron-log');
// 封装 worker 异步操作
function runWorkerWithPromise(workerPath, workerData) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerPath);

        log.info(`[Worker ${worker.threadId}] 启动`);

        // 向 worker 发送数据
        worker.postMessage(workerData);

        // 成功结果
        worker.on('message', result => {
            log.info(`[Worker ${worker.threadId}] 处理成功`, result);
            resolve(result);
        });

        // 错误处理
        worker.on('error', err => {
            // reject会向上抛异常
            log.error(`[Worker ${worker.threadId}] 发生错误:`, err);
            reject(err.message);
        });

        // 提前退出也算失败
        worker.on('exit', code => {
            if (code !== 0) {
                log.error(`[Worker ${worker.threadId}] 退出异常，退出码:`, code);
                reject(`Worker stopped with exit code ${code}`);
            } else {
                log.info(`[Worker ${worker.threadId}] has completed successfully.`);
            }
        });
    });
}

module.exports = {
    runWorkerWithPromise
};
