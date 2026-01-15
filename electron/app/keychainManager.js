const logger = require('../log/logger');

/**
 * KeychainManager - 管理 Keychain 和密钥解析
 * 提供统一的接口用于存储、查询和解析 Keychain 密钥
 */
class KeychainManager {
    constructor(store, keychainsKey = 'keychains') {
        this.store = store;
        this.keychainsKey = keychainsKey;
    }

    /**
     * 保存 Keychain
     */
    saveKeychain(keychain) {
        try {
            const keychains = this.store.get(this.keychainsKey) || [];

            // Update or add keychain
            const index = keychains.findIndex(kc => kc.id === keychain.id);
            if (index >= 0) {
                keychains[index] = keychain;
            } else {
                keychains.push(keychain);
            }

            this.store.set(this.keychainsKey, keychains);
            logger.info(`Keychain saved: ${keychain.name}`);
            return { success: true };
        } catch (error) {
            logger.error('Error saving keychain:', error.message);
            throw error;
        }
    }

    /**
     * 加载所有 Keychains
     */
    loadKeychains() {
        try {
            const keychains = this.store.get(this.keychainsKey) || [];
            return keychains;
        } catch (error) {
            logger.error('Error loading keychains:', error.message);
            throw error;
        }
    }

    /**
     * 删除 Keychain
     */
    deleteKeychain(id) {
        try {
            const keychains = this.store.get(this.keychainsKey) || [];
            const filtered = keychains.filter(kc => kc.id !== id);
            this.store.set(this.keychainsKey, filtered);
            logger.info(`Keychain deleted: ${id}`);
            return { success: true };
        } catch (error) {
            logger.error('Error deleting keychain:', error.message);
            throw error;
        }
    }

    /**
     * 根据 ID 获取 Keychain
     */
    getKeychainById(keychainId) {
        const keychains = this.loadKeychains();
        return keychains.find(kc => kc.id === keychainId);
    }

    /**
     * 获取指定时间的活动密钥
     * @param {string} keychainId - Keychain ID
     * @param {Date|string} time - 时间（可选，默认当前时间）
     * @returns {Object|null} 活动密钥对象，如果没有则返回 null
     */
    getActiveKey(keychainId, time = null) {
        try {
            const keychain = this.getKeychainById(keychainId);

            if (!keychain) {
                logger.error(`Keychain not found: ${keychainId}`);
                return null;
            }

            const now = time ? new Date(time) : new Date();

            // 查找当前有效的密钥
            const activeKey = keychain.keys.find(key => {
                const sendStart = key.sendLifetime.start === 'always' ? new Date(0) : new Date(key.sendLifetime.start);
                const sendEnd =
                    key.sendLifetime.end === 'forever' ? new Date('2099-12-31') : new Date(key.sendLifetime.end);
                const acceptStart =
                    key.acceptLifetime.start === 'always' ? new Date(0) : new Date(key.acceptLifetime.start);
                const acceptEnd =
                    key.acceptLifetime.end === 'forever' ? new Date('2099-12-31') : new Date(key.acceptLifetime.end);

                return now >= sendStart && now <= sendEnd && now >= acceptStart && now <= acceptEnd;
            });

            if (activeKey) {
                logger.info(
                    `Active key found for keychain ${keychainId}: keyId=${activeKey.keyId}, algorithm=${activeKey.algorithm}`
                );
            } else {
                logger.warn(`No active key found for keychain ${keychainId} at time ${now.toISOString()}`);
            }

            return activeKey || null;
        } catch (error) {
            logger.error(`Error getting active key: ${error.message}`);
            return null;
        }
    }

    /**
     * 解析 Keychain 密钥并返回密码
     * @param {string} keychainId - Keychain ID
     * @param {Date|string} time - 时间（可选）
     * @returns {string|null} 密钥密码，如果没有则返回 null
     */
    resolvePassword(keychainId, time = null) {
        const activeKey = this.getActiveKey(keychainId, time);
        return activeKey ? activeKey.password : null;
    }

    /**
     * 生成 TCP-AO 密钥 JSON 配置
     * 用于传递给 TCP-AO helper
     * @param {string} keychainId - Keychain ID
     * @param {Date|string} time - 时间（可选）
     * @returns {string|null} TCP-AO 密钥 JSON 字符串
     */
    generateTcpAoKeysJson(keychainId, _time = null) {
        try {
            const keychain = this.getKeychainById(keychainId);

            if (!keychain) {
                logger.error(`Keychain not found: ${keychainId}`);
                return null;
            }

            const tcpAoKeys = [];

            // 遍历所有密钥，生成 TCP-AO 配置（包含时间信息）
            for (const key of keychain.keys) {
                // 转换算法名称为 TCP-AO 格式
                let algorithm = 'hmac(sha256)'; // 默认
                if (key.algorithm === 'hmac-sha-1') {
                    algorithm = 'hmac(sha1)';
                } else if (key.algorithm === 'hmac-sha-256') {
                    algorithm = 'hmac(sha256)';
                } else if (key.algorithm === 'md5') {
                    // MD5 不能直接用于 TCP-AO，使用默认的 hmac(sha256)
                    algorithm = 'hmac(sha256)';
                }

                // 转换时间为 Unix 时间戳
                const sendStart =
                    key.sendLifetime.start === 'always'
                        ? 0
                        : Math.floor(new Date(key.sendLifetime.start).getTime() / 1000);
                const sendEnd =
                    key.sendLifetime.end === 'forever'
                        ? 0
                        : Math.floor(new Date(key.sendLifetime.end).getTime() / 1000);
                const acceptStart =
                    key.acceptLifetime.start === 'always'
                        ? 0
                        : Math.floor(new Date(key.acceptLifetime.start).getTime() / 1000);
                const acceptEnd =
                    key.acceptLifetime.end === 'forever'
                        ? 0
                        : Math.floor(new Date(key.acceptLifetime.end).getTime() / 1000);

                tcpAoKeys.push({
                    keyId: key.keyId,
                    algorithm: algorithm,
                    password: key.password,
                    sendStart: sendStart,
                    sendEnd: sendEnd,
                    acceptStart: acceptStart,
                    acceptEnd: acceptEnd
                });
            }

            if (tcpAoKeys.length === 0) {
                logger.warn(`No keys found for keychain ${keychainId}`);
                return null;
            }

            const jsonStr = JSON.stringify(tcpAoKeys);
            logger.info(
                `Generated TCP-AO keys JSON for keychain ${keychainId}: ${tcpAoKeys.length} keys with time ranges`
            );

            return jsonStr;
        } catch (error) {
            logger.error(`Error generating TCP-AO keys JSON: ${error.message}`);
            return null;
        }
    }
}

module.exports = KeychainManager;
