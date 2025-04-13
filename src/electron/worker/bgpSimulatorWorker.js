const { parentPort } = require('worker_threads');
const net = require('net');
const { BGP_DEFAULT_PORT } = require('../../const/bgpConst');

function startTcpServer(localIp, localAs) {
    const server = net.createServer((socket) => {
        console.log('Client connected');

        // 当接收到数据时处理数据
        socket.on('data', (data) => {
            console.log(data);
        });

        socket.on('end', () => {
            console.log('Client disconnected');
        });

        socket.on('error', (err) => {
            console.error('TCP Server Error:', err.message);
        });
    });

    // 启动服务器并监听端口
    server.listen(BGP_DEFAULT_PORT, localIp, () => {
        console.log(`TCP Server listening on port ${BGP_DEFAULT_PORT} at ${localIp}`);
        parentPort.postMessage({
            op: 'log',
            message: `TCP Server listening on port ${BGP_DEFAULT_PORT} at ${localIp}`
        });
    });
}

parentPort.on('message', (bgpData) => {
    try {
        const { localIp, localAs, PeerIp, PeerAs } = bgpData;

        startTcpServer(localIp, localAs);

        parentPort.postMessage({
            op: 'log',
            message: `bgp server start`
        });
    } catch (err) {
        throw new Error(err.message);
    }
});
