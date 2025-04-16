const { Worker } = require("worker_threads");

// 封装 worker 异步操作
function runWorkerWithPromise(workerPath, workerData) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerPath);

        console.log(`[Worker ${worker.threadId}] 启动`);

        // 向 worker 发送数据
        worker.postMessage(workerData);

        // 成功结果
        worker.on("message", (result) => {
            console.log(`[Worker ${worker.threadId}] 处理成功`, result);
            resolve({ status: "success", msg: "", data: result });
        });

        // 错误处理
        worker.on("error", (err) => {
            // reject会向上抛异常
            console.error(`[Worker ${worker.threadId}] 发生错误:`, err);
            reject({ status: "error", msg: err.message });
        });

        // 提前退出也算失败
        worker.on("exit", (code) => {
            if (code !== 0) {
                console.error(
                    `[Worker ${worker.threadId}] 退出异常，退出码:`,
                    code,
                );
                reject({
                    status: "error",
                    msg: `Worker stopped with exit code ${code}`,
                });
            } else {
                console.log(
                    `[Worker ${worker.threadId}] has completed successfully.`,
                );
            }
        });
    });
}

module.exports = {
    runWorkerWithPromise,
};
