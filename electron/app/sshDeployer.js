const { Client } = require('ssh2');
const path = require('path');
const logger = require('../log/logger');

/**
 * Deploy BMP MD5 proxy to Linux via SSH
 * Uploads socat proxy script and configures the server
 */
class SshDeployer {
    constructor() {
        this.conn = null;
    }

    /**
     * Connect to SSH server
     */
    async connect(host, username, password) {
        return new Promise((resolve, reject) => {
            this.conn = new Client();

            this.conn.on('ready', () => {
                logger.info(`SSH connection established to ${host}`);
                resolve();
            });

            this.conn.on('error', err => {
                logger.error(`SSH connection error: ${err.message}`);
                reject(err);
            });

            this.conn.connect({
                host: host,
                port: 22,
                username: username,
                password: password
            });
        });
    }

    /**
     * Execute command on remote server
     */
    async execCommand(command) {
        return new Promise((resolve, reject) => {
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
     * Deploy BMP MD5 proxy to remote server
     */
    async deploy() {
        logger.info('Starting TCP MD5 proxy deployment...');

        try {
            // Create proxy directory
            const proxyDir = '/opt/tcp-md5-proxy';
            await this.execCommand(`mkdir -p ${proxyDir}`);
            logger.info(`Created directory: ${proxyDir}`);

            // Upload C helper source
            const helperSource = path.join(__dirname, '../../scripts/tcp-md5-helper.c');
            await this.uploadFile(helperSource, `${proxyDir}/tcp-md5-helper.c`);
            logger.info('Uploaded tcp-md5-helper.c');

            // Upload proxy script
            const proxyScript = path.join(__dirname, '../../scripts/tcp-md5-proxy.sh');
            await this.uploadFile(proxyScript, `${proxyDir}/tcp-md5-proxy.sh`);
            logger.info('Uploaded tcp-md5-proxy.sh');

            // Make script executable
            await this.execCommand(`chmod +x ${proxyDir}/tcp-md5-proxy.sh`);
            logger.info('Made proxy script executable');

            // Install gcc if not present
            logger.info('Checking for gcc...');
            try {
                await this.execCommand('which gcc');
                logger.info('gcc is already installed');
            } catch (error) {
                logger.info('Installing gcc...');
                await this.execCommand('yum install -y gcc || apt-get install -y gcc');
                logger.info('gcc installed successfully');
            }

            // Compile the helper
            logger.info('Compiling TCP MD5 helper...');
            await this.execCommand(`gcc -g -o ${proxyDir}/tcp-md5-helper ${proxyDir}/tcp-md5-helper.c`);
            logger.info('Helper compiled successfully');

            // Disable firewall
            await this.disableFirewall();

            logger.info('TCP MD5 proxy deployment completed successfully');
            return {
                proxyDir,
                helperPath: `${proxyDir}/tcp-md5-helper`,
                scriptPath: `${proxyDir}/tcp-md5-proxy.sh`
            };
        } catch (error) {
            logger.error(`Deployment failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Disable firewall on remote server
     */
    async disableFirewall() {
        try {
            // Try to stop and disable firewalld (CentOS 7/8)
            try {
                await this.execCommand('systemctl stop firewalld 2>/dev/null');
                await this.execCommand('systemctl disable firewalld 2>/dev/null');
                logger.info('Firewalld stopped and disabled');
            } catch (e) {
                // Firewalld not present, try iptables
            }

            // Try to stop and disable iptables (CentOS 6)
            try {
                await this.execCommand('service iptables stop 2>/dev/null');
                await this.execCommand('chkconfig iptables off 2>/dev/null');
                logger.info('iptables stopped and disabled');
            } catch (e) {
                // iptables not present
            }

            logger.info('Firewall disabled successfully');
        } catch (error) {
            logger.warn(`Firewall disable warning: ${error.message}`);
        }
    }

    /**
     * Disconnect SSH connection
     */
    disconnect() {
        if (this.conn) {
            this.conn.end();
            this.conn = null;
            logger.info('SSH connection closed');
        }
    }
}

module.exports = SshDeployer;
