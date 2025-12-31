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
     * Deploy BMP MD5 proxy
     */
    async deploy() {
        try {
            logger.info('Starting BMP MD5 proxy deployment...');

            // 1. Create directory
            logger.info('Creating proxy directory...');
            await this.execCommand('mkdir -p /opt/bmp-md5-proxy');

            // 2. Install dependencies (gcc for compiling helper)
            logger.info('Installing dependencies...');
            try {
                await this.execCommand('yum install -y gcc 2>/dev/null || apt-get update && apt-get install -y gcc');
            } catch (error) {
                logger.warn(`gcc installation warning: ${error.message}`);
            }

            // 3. Upload C helper source
            logger.info('Uploading TCP MD5 helper source...');
            const helperPath = path.join(__dirname, '../../scripts/tcp-md5-helper.c');
            await this.uploadFile(helperPath, '/opt/bmp-md5-proxy/tcp-md5-helper.c');

            // 4. Upload proxy script
            logger.info('Uploading proxy script...');
            const scriptPath = path.join(__dirname, '../../scripts/bmp-md5-proxy.sh');
            await this.uploadFile(scriptPath, '/opt/bmp-md5-proxy/bmp-md5-proxy.sh');

            // 5. Make script executable
            logger.info('Setting permissions...');
            await this.execCommand('chmod +x /opt/bmp-md5-proxy/bmp-md5-proxy.sh');

            // 6. Compile helper (will be done on first start, but we can try now)
            logger.info('Compiling TCP MD5 helper...');
            try {
                await this.execCommand(
                    'gcc -g -o /opt/bmp-md5-proxy/tcp-md5-helper /opt/bmp-md5-proxy/tcp-md5-helper.c'
                );
                logger.info('Helper compiled successfully');
            } catch (error) {
                logger.warn('Helper compilation will be done on first start');
            }

            // 7. Disable firewall
            logger.info('Disabling firewall...');
            await this.disableFirewall();

            // 8. Create log directory
            await this.execCommand('mkdir -p /var/log && touch /var/log/bmp-md5-proxy.log');

            logger.info('BMP MD5 proxy deployment completed successfully!');
            return { success: true, message: 'Deployment successful' };
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
