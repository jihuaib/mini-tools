const { Client } = require('ssh2');
const logger = require('../log/logger');
const { EventEmitter } = require('events');

/**
 * SSH Tunnel for BMP MD5 Authentication
 * Creates SSH tunnel and manages remote TCP MD5 proxy
 */
class SshTunnel extends EventEmitter {
    constructor() {
        super();
        this.conn = null;
        this.tunnelActive = false;
        this.proxyPid = null;
    }

    /**
     * Connect to SSH server and create tunnel
     */
    async connect(sshConfig) {
        return new Promise((resolve, reject) => {
            this.conn = new Client();

            this.conn.on('ready', () => {
                logger.info(`SSH connection established to ${sshConfig.host}`);
                this.tunnelActive = true;
                resolve();
            });

            this.conn.on('error', err => {
                logger.error(`SSH connection error: ${err.message}`);
                this.tunnelActive = false;
                reject(err);
            });

            this.conn.on('close', () => {
                logger.info('SSH connection closed');
                this.tunnelActive = false;
                this.emit('close');
            });

            this.conn.connect({
                host: sshConfig.host,
                port: sshConfig.port || 22,
                username: sshConfig.username,
                password: sshConfig.password
            });
        });
    }

    /**
     * Execute command on remote server
     */
    async execCommand(command) {
        logger.info(`Executing command: ${command}`);
        return new Promise((resolve, reject) => {
            if (!this.conn) {
                reject(new Error('SSH not connected'));
                return;
            }

            this.conn.exec(command, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }

                let stdout = '';
                let stderr = '';

                stream.on('close', code => {
                    if (code !== 0) {
                        reject(new Error(`Command failed with code ${code}: ${stderr}`));
                    } else {
                        resolve(stdout);
                    }
                });

                stream.on('data', data => {
                    stdout += data.toString();
                });

                stream.stderr.on('data', data => {
                    stderr += data.toString();
                });
            });
        });
    }

    /**
     * Upload file to remote server
     */
    async uploadFile(localPath, remotePath) {
        return new Promise((resolve, reject) => {
            if (!this.conn) {
                reject(new Error('SSH not connected'));
                return;
            }

            this.conn.sftp((err, sftp) => {
                if (err) {
                    reject(err);
                    return;
                }

                sftp.fastPut(localPath, remotePath, err => {
                    if (err) {
                        reject(err);
                    } else {
                        logger.info(`Uploaded ${localPath} to ${remotePath}`);
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Start TCP proxy on remote server (MD5 or TCP-AO)
     */
    async startProxy(protocol, peerIp, config, listenPort, forwardAddr) {
        // config 可以是:
        // - 字符串: MD5 密码（TCP MD5 模式）
        // - 对象: { useTcpAo: true, tcpAoKeysJson: '[...]' } (TCP-AO 模式)

        const useTcpAo = typeof config === 'object' && config.useTcpAo;

        if (useTcpAo) {
            logger.info(`Starting ${protocol.toUpperCase()} TCP-AO proxy for peer ${peerIp} on port ${listenPort}`);

            // 使用 TCP-AO 代理
            const tcpAoKeysJson = config.tcpAoKeysJson;
            const startCmd = `/opt/tcp-ao-proxy/tcp-ao-proxy.sh ${protocol} "${peerIp}" '${tcpAoKeysJson}' ${listenPort} "${forwardAddr}" start`;

            const result = await this.execCommand(startCmd);
            logger.info(`TCP-AO proxy start result: ${result}`);

            // Wait a bit for proxy to start
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify proxy is running
            const statusCmd = `/opt/tcp-ao-proxy/tcp-ao-proxy.sh ${protocol} "${peerIp}" '${tcpAoKeysJson}' ${listenPort} "${forwardAddr}" status`;
            const status = await this.execCommand(statusCmd);

            if (!status.includes('running')) {
                throw new Error(`${protocol.toUpperCase()} TCP-AO proxy failed to start`);
            }

            logger.info(`${protocol.toUpperCase()} TCP-AO proxy started successfully`);
        } else {
            // 使用 TCP MD5 代理
            const md5Password = typeof config === 'string' ? config : config.md5Password;
            logger.info(`Starting ${protocol.toUpperCase()} TCP MD5 proxy for peer ${peerIp} on port ${listenPort}`);

            // Start the proxy script with protocol parameter
            const startCmd = `/opt/tcp-md5-proxy/tcp-md5-proxy.sh ${protocol} "${peerIp}" "${md5Password}" ${listenPort} "${forwardAddr}" start`;

            const result = await this.execCommand(startCmd);
            logger.info(`Proxy start result: ${result}`);

            // Wait a bit for proxy to start
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify proxy is running
            const statusCmd = `/opt/tcp-md5-proxy/tcp-md5-proxy.sh ${protocol} "${peerIp}" "${md5Password}" ${listenPort} "${forwardAddr}" status`;
            const status = await this.execCommand(statusCmd);

            if (!status.includes('running')) {
                throw new Error(`${protocol.toUpperCase()} proxy failed to start`);
            }

            logger.info(`${protocol.toUpperCase()} proxy started successfully`);
        }
    }
    /**
     * Stop TCP proxy on remote server (MD5 or TCP-AO)
     */
    async stopProxy(protocol, peerIp, config, listenPort, forwardAddr) {
        if (!this.conn) {
            return;
        }

        // Validate protocol parameter
        if (!protocol) {
            logger.warn('stopProxy called without protocol, skipping');
            return;
        }

        logger.info(`Stopping ${protocol.toUpperCase()} proxy...`);

        try {
            const useTcpAo = typeof config === 'object' && config.useTcpAo;

            if (useTcpAo) {
                // 停止 TCP-AO 代理
                const tcpAoKeysJson = config.tcpAoKeysJson;
                const stopCmd = `/opt/tcp-ao-proxy/tcp-ao-proxy.sh ${protocol} "${peerIp}" '${tcpAoKeysJson}' ${listenPort} "${forwardAddr}" stop`;
                const result = await this.execCommand(stopCmd);
                logger.info(`TCP-AO proxy stop result: ${result}`);
            } else {
                // 停止 TCP MD5 代理
                const md5Password = typeof config === 'string' ? config : config.md5Password;
                const stopCmd = `/opt/tcp-md5-proxy/tcp-md5-proxy.sh ${protocol} "${peerIp}" "${md5Password}" ${listenPort} "${forwardAddr}" stop`;
                const result = await this.execCommand(stopCmd);
                logger.info(`TCP MD5 proxy stop result: ${result}`);
            }
        } catch (error) {
            logger.error(`Error stopping proxy: ${error.message}`);
        }
    }

    /**
     * Setup SSH reverse port forwarding
     * Allows remote server to connect back to local Windows port
     */
    async setupReverseForward(remotePort, localPort) {
        return new Promise((resolve, reject) => {
            if (!this.conn) {
                reject(new Error('SSH not connected'));
                return;
            }

            logger.info(`Setting up reverse tunnel: remote:${remotePort} -> local:${localPort}`);

            // 使用 '0.0.0.0' 或空字符串允许远程绑定
            // 某些 SSH 配置不允许绑定到 127.0.0.1
            this.conn.forwardIn('0.0.0.0', remotePort, err => {
                if (err) {
                    logger.error(`Failed to setup reverse forward: ${err.message}`);
                    reject(err);
                    return;
                }

                logger.info(`Reverse tunnel established: remote:${remotePort} -> local:${localPort}`);
                resolve();
            });

            // Handle incoming connections on the reverse tunnel
            this.conn.on('tcp connection', (info, accept, _reject) => {
                logger.info(`Incoming connection on reverse tunnel from ${info.srcIP}:${info.srcPort}`);

                const stream = accept();
                const net = require('net');

                // Connect to local BMP server
                const localSocket = net.connect(localPort, '127.0.0.1', () => {
                    logger.info(`Connected to local BMP server on port ${localPort}`);
                });

                // Pipe data bidirectionally
                stream.pipe(localSocket);
                localSocket.pipe(stream);

                stream.on('close', () => {
                    logger.info('Reverse tunnel connection closed');
                    localSocket.end();
                });

                localSocket.on('close', () => {
                    stream.end();
                });

                stream.on('error', err => {
                    logger.error(`Reverse tunnel stream error: ${err.message}`);
                    localSocket.end();
                });

                localSocket.on('error', err => {
                    logger.error(`Local socket error: ${err.message}`);
                    stream.end();
                });
            });
        });
    }

    /**
     * Check if tunnel is active
     */
    isActive() {
        return this.tunnelActive && this.conn !== null;
    }

    /**
     * Disconnect SSH tunnel
     */
    async disconnect() {
        // Stop proxy first
        await this.stopProxy();

        // Close SSH connection
        if (this.conn) {
            this.conn.end();
            this.conn = null;
        }

        this.tunnelActive = false;
        logger.info('SSH tunnel disconnected');
    }
}

module.exports = SshTunnel;
