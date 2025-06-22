const { app, dialog } = require('electron');
const { successResponse, errorResponse } = require('../utils/responseUtils');
const logger = require('../log/logger');
const Cap = require('cap').Cap;
const fs = require('fs');

class NativeApp {
    constructor(ipc) {
        this.isDev = !app.isPackaged;
        this.registerHandlers(ipc);

        // 抓包相关变量初始化 - 移到主进程
        this.capSession = null;
        this.isCapturing = false;
    }

    registerHandlers(ipc) {
        // 抓包工具
        ipc.handle('native:getNetworkInterfaces', async event => this.handleGetNetworkInterfaces(event));
        ipc.handle('native:startPacketCapture', async (event, config) => this.handleStartPacketCapture(event, config));
        ipc.handle('native:stopPacketCapture', async () => this.handleStopPacketCapture());
        ipc.handle('native:exportPacketsToPcap', async (event, packets) =>
            this.handleExportPacketsToPcap(event, packets)
        );
    }

    // 优雅的窗口关闭处理
    async handleWindowClose(win) {
        if (this.capSession != null) {
            const { response } = await dialog.showMessageBox(win, {
                type: 'warning',
                title: '确认关闭',
                message: '抓包正在运行，确定要关闭吗？',
                buttons: ['确定', '取消'],
                defaultId: 1,
                cancelId: 1
            });

            if (response === 0) {
                // 用户点击确定，先停止抓包然后关闭窗口
                await this.handleStopPacketCapture();
                return true;
            }
            return false;
        }
        return true;
    }

    // 抓包相关方法 - 重构为主进程实现
    async handleGetNetworkInterfaces(_event) {
        try {
            const interfaces = Cap.deviceList();
            console.log(interfaces);
            return successResponse(interfaces, '获取网卡列表成功');
        } catch (err) {
            logger.error('获取网卡列表错误:', err.message);
            return errorResponse(err.message);
        }
    }

    async handleStartPacketCapture(event, config) {
        if (this.isCapturing) {
            logger.error('抓包已在进行中');
            return errorResponse('抓包已在进行中');
        }

        const webContents = event.sender;

        try {
            const { deviceName, filter, _snaplen = 65535 } = config;

            this.capSession = new Cap();
            const device = deviceName || Cap.findDevice();

            if (!device) {
                throw new Error('未找到可用的网络接口');
            }

            const bufSize = 10 * 1024 * 1024;
            const buffer = Buffer.alloc(bufSize);

            const linkType = this.capSession.open(device, filter || '', bufSize, buffer);

            this.isCapturing = true;
            let packetCount = 0;

            // 响应抓包已开始
            webContents.send('native:packetEvent', {
                status: 'success',
                data: {
                    type: 'PACKET_CAPTURE_START',
                    device: device,
                    linkType: linkType
                }
            });

            this.capSession.setMinBytes && this.capSession.setMinBytes(0);

            this.capSession.on('packet', (nbytes, trunc) => {
                try {
                    const timestamp = new Date();
                    packetCount++;

                    logger.info(`Captured packet: ${nbytes} bytes`);

                    let packetInfo = {
                        id: packetCount,
                        timestamp: timestamp.toISOString(),
                        length: nbytes,
                        truncated: trunc,
                        raw: buffer.toString('hex', 0, nbytes)
                    };

                    webContents.send('native:packetEvent', {
                        status: 'success',
                        data: {
                            type: 'PACKET_CAPTURED',
                            packet: packetInfo
                        }
                    });
                } catch (err) {
                    webContents.send('native:packetEvent', {
                        status: 'error',
                        msg: err.message,
                        data: {
                            type: 'PACKET_ERROR'
                        }
                    });
                }
            });

            logger.info('启动抓包成功:', { device, linkType });
            return { verify: true, data: { device, linkType }, msg: '抓包启动成功' };
        } catch (err) {
            this.isCapturing = false;
            logger.error('启动抓包错误:', err.message);
            return { verify: false, msg: `启动抓包失败: ${err.message}` };
        }
    }

    async handleStopPacketCapture() {
        try {
            if (this.capSession) {
                this.capSession.close();
                this.capSession = null;
            }
            this.isCapturing = false;
            logger.info('抓包已停止');
            return { verify: true, msg: '抓包已停止' };
        } catch (err) {
            logger.error('停止抓包错误:', err.message);
            return { verify: false, msg: err.message };
        }
    }

    async handleExportPacketsToPcap(event, packets) {
        try {
            if (!packets || packets.length === 0) {
                return errorResponse('没有数据可以导出');
            }

            // 显示保存对话框
            const result = await dialog.showSaveDialog({
                title: '导出 PCAP 文件',
                defaultPath: `packets_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pcap`,
                filters: [
                    { name: 'PCAP Files', extensions: ['pcap'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (result.canceled) {
                return errorResponse('用户取消导出');
            }

            const filePath = result.filePath;

            // 创建 PCAP 文件
            await this.writePcapFile(filePath, packets);

            logger.info('PCAP 文件导出成功:', filePath);
            return successResponse({ filePath }, 'PCAP 文件导出成功');
        } catch (err) {
            logger.error('导出 PCAP 文件错误:', err.message);
            return errorResponse(`导出失败: ${err.message}`);
        }
    }

    async writePcapFile(filePath, packets) {
        return new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(filePath);

            writeStream.on('error', reject);
            writeStream.on('finish', resolve);

            // 写入 PCAP 全局头部 (24 bytes)
            const globalHeader = Buffer.alloc(24);
            globalHeader.writeUInt32LE(0xa1b2c3d4, 0); // magic number
            globalHeader.writeUInt16LE(2, 4); // version major
            globalHeader.writeUInt16LE(4, 6); // version minor
            globalHeader.writeInt32LE(0, 8); // thiszone
            globalHeader.writeUInt32LE(0, 12); // sigfigs
            globalHeader.writeUInt32LE(65535, 16); // snaplen
            globalHeader.writeUInt32LE(1, 20); // network (Ethernet)

            writeStream.write(globalHeader);

            // 写入每个数据包
            for (const packet of packets) {
                try {
                    const timestamp = new Date(packet.timestamp);
                    const packetData = Buffer.from(packet.raw, 'hex');

                    // 写入包记录头部 (16 bytes)
                    const recordHeader = Buffer.alloc(16);
                    recordHeader.writeUInt32LE(Math.floor(timestamp.getTime() / 1000), 0); // ts_sec
                    recordHeader.writeUInt32LE((timestamp.getTime() % 1000) * 1000, 4); // ts_usec
                    recordHeader.writeUInt32LE(packetData.length, 8); // incl_len
                    recordHeader.writeUInt32LE(packet.length || packetData.length, 12); // orig_len

                    writeStream.write(recordHeader);
                    writeStream.write(packetData);
                } catch (err) {
                    logger.warn(`跳过无效数据包 ${packet.id}:`, err.message);
                }
            }

            writeStream.end();
        });
    }
}

module.exports = NativeApp;
