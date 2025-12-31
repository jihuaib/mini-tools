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
        logger.info(`Executing command: ${command}`);
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
            // 使用临时目录上传文件，然后用 sudo 移动到 /opt
            const tempDir = '/tmp/tcp-md5-proxy';
            const proxyDir = '/opt/tcp-md5-proxy';

            // 创建临时目录
            await this.execCommand(`mkdir -p ${tempDir}`);
            logger.info(`Created temp directory: ${tempDir}`);

            // Upload C helper source to temp
            const helperSource = path.join(__dirname, '../../scripts/tcp-md5-helper.c');
            await this.uploadFile(helperSource, `${tempDir}/tcp-md5-helper.c`);
            logger.info('Uploaded tcp-md5-helper.c to temp');

            // Upload proxy script to temp
            const proxyScript = path.join(__dirname, '../../scripts/tcp-md5-proxy.sh');
            await this.uploadFile(proxyScript, `${tempDir}/tcp-md5-proxy.sh`);
            logger.info('Uploaded tcp-md5-proxy.sh to temp');

            // 创建目标目录并移动文件
            await this.execCommand(`sudo mkdir -p ${proxyDir}`);
            await this.execCommand(`sudo cp -r ${tempDir}/* ${proxyDir}/`);
            logger.info(`Moved files to ${proxyDir}`);

            // Make script executable
            await this.execCommand(`sudo chmod +x ${proxyDir}/tcp-md5-proxy.sh`);
            logger.info('Made proxy script executable');

            // Install gcc if not present
            logger.info('Checking for gcc...');
            try {
                await this.execCommand('which gcc');
                logger.info('gcc is already installed');
            } catch (error) {
                logger.info('Installing gcc...');
                await this.execCommand('sudo yum install -y gcc || sudo apt-get install -y gcc');
                logger.info('gcc installed successfully');
            }

            // Compile the helper
            logger.info('Compiling TCP MD5 helper...');
            await this.execCommand(`sudo gcc -g -o ${proxyDir}/tcp-md5-helper ${proxyDir}/tcp-md5-helper.c`);
            logger.info('Helper compiled successfully');

            // Disable firewall
            await this.disableFirewall();

            logger.info('TCP MD5 proxy deployment completed successfully');

            // Deploy TCP-AO files
            logger.info('Deploying TCP-AO proxy files...');

            const aoTempDir = '/tmp/tcp-ao-proxy';
            const aoProxyDir = '/opt/tcp-ao-proxy';

            // 创建临时目录
            await this.execCommand(`mkdir -p ${aoTempDir}`);
            logger.info(`Created temp directory: ${aoTempDir}`);

            // Upload TCP-AO C helper source to temp
            const aoHelperSource = path.join(__dirname, '../../scripts/tcp-ao-helper.c');
            await this.uploadFile(aoHelperSource, `${aoTempDir}/tcp-ao-helper.c`);
            logger.info('Uploaded tcp-ao-helper.c to temp');

            // Upload JSON parser source to temp
            const jsonParserSource = path.join(__dirname, '../../scripts/json-parser.c');
            await this.uploadFile(jsonParserSource, `${aoTempDir}/json-parser.c`);
            logger.info('Uploaded json-parser.c to temp');

            // Upload TCP-AO proxy script to temp
            const aoProxyScript = path.join(__dirname, '../../scripts/tcp-ao-proxy.sh');
            await this.uploadFile(aoProxyScript, `${aoTempDir}/tcp-ao-proxy.sh`);
            logger.info('Uploaded tcp-ao-proxy.sh to temp');

            // 创建目标目录并移动文件
            await this.execCommand(`sudo mkdir -p ${aoProxyDir}`);
            await this.execCommand(`sudo cp -r ${aoTempDir}/* ${aoProxyDir}/`);
            logger.info(`Moved files to ${aoProxyDir}`);

            // Make TCP-AO script executable
            await this.execCommand(`sudo chmod +x ${aoProxyDir}/tcp-ao-proxy.sh`);
            logger.info('Made TCP-AO proxy script executable');

            // Try to compile TCP-AO helper (will fail if kernel doesn't support TCP-AO)
            logger.info('Attempting to compile TCP-AO helper...');
            const aoCompileResult = await this.execCommand(
                `cd ${aoProxyDir} && sudo gcc -o tcp-ao-helper tcp-ao-helper.c json-parser.c -std=c99`
            );
            logger.info(`TCP-AO compile result: ${aoCompileResult}`);
            logger.info('TCP-AO helper compiled successfully');
            logger.info('✅ TCP-AO is available on this system');

            logger.info('All proxy files deployment completed successfully');

            return {
                proxyDir,
                helperPath: `${proxyDir}/tcp-md5-helper`,
                scriptPath: `${proxyDir}/tcp-md5-proxy.sh`,
                aoProxyDir,
                aoHelperPath: `${aoProxyDir}/tcp-ao-helper`,
                aoScriptPath: `${aoProxyDir}/tcp-ao-proxy.sh`
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
            logger.warn(`Could not disable firewall: ${error.message}`);
        }
    }

    /**
     * Disconnect from SSH server
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
