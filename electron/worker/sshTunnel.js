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
     * Start TCP MD5 proxy on remote server
     */
    async startProxy(peerIp, md5Password, listenPort, forwardAddr) {
        logger.info(`Starting TCP MD5 proxy for peer ${peerIp} on port ${listenPort}`);

        // Start the proxy script with new parameters
        const command = `/opt/bmp-md5-proxy/bmp-md5-proxy.sh "${peerIp}" "${md5Password}" ${listenPort} "${forwardAddr}" start`;
        logger.info(`Executing: ${command}`);
        const result = await this.execCommand(command);

        logger.info(`Proxy started: ${result}`);
        return result;
    }

    /**
     * Stop TCP MD5 proxy on remote server
     */
    async stopProxy() {
        if (!this.conn) {
            return;
        }

        try {
            logger.info('Stopping TCP MD5 proxy...');
            await this.execCommand('/opt/bmp-md5-proxy/bmp-md5-proxy.sh "" "" "" "" stop');
            logger.info('Proxy stopped');
        } catch (error) {
            logger.warn(`Error stopping proxy: ${error.message}`);
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

            this.conn.forwardIn('127.0.0.1', remotePort, err => {
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
