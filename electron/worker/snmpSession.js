const logger = require('../log/logger');

class SnmpSession {
    constructor(messageHandler, worker) {
        this.messageHandler = messageHandler;
        this.worker = worker;

        // 会话基本信息
        this.sessionId = null;
        this.agentIp = null;
        this.agentPort = null;
        this.localIp = null;
        this.localPort = null;

        // SNMP特定信息
        this.version = null;
        this.community = null;
        this.securityLevel = null;
        this.username = null;
        this.authProtocol = null;
        this.privProtocol = null;

        // 会话状态
        this.status = 'active';
        this.createTime = new Date();
        this.lastActivity = new Date();
        this.trapCount = 0;

        // 统计信息
        this.stats = {
            totalTraps: 0,
            trapsByType: {},
            trapsByVersion: {},
            errors: 0
        };
    }

    /**
     * 生成会话键
     */
    static makeKey(localIp, localPort, remoteIp, remotePort) {
        return `${localIp}:${localPort}-${remoteIp}:${remotePort}`;
    }

    /**
     * 初始化会话
     */
    init(agentInfo) {
        this.agentIp = agentInfo.ip;
        this.agentPort = agentInfo.port || 161;
        this.sessionId = `session_${this.agentIp}_${Date.now()}`;
        this.lastActivity = new Date();

        logger.info(`SNMP会话初始化: ${this.sessionId} 代理: ${this.agentIp}:${this.agentPort}`);
    }

    /**
     * 处理接收到的Trap
     */
    handleTrap(trapData) {
        try {
            this.lastActivity = new Date();
            this.trapCount++;

            // 更新统计信息
            this.updateStats(trapData);

            // 更新会话信息
            if (trapData.version) {
                this.version = trapData.version;
            }
            if (trapData.community) {
                this.community = trapData.community;
            }

            logger.info(`会话 ${this.sessionId} 处理Trap: ${trapData.id}`);

            return true;
        } catch (error) {
            logger.error(`会话 ${this.sessionId} 处理Trap失败:`, error);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * 更新统计信息
     */
    updateStats(trapData) {
        try {
            this.stats.totalTraps++;

            // 按类型统计
            const trapType = trapData.trapType || 'unknown';
            this.stats.trapsByType[trapType] = (this.stats.trapsByType[trapType] || 0) + 1;

            // 按版本统计
            const version = trapData.version || 'unknown';
            this.stats.trapsByVersion[version] = (this.stats.trapsByVersion[version] || 0) + 1;
        } catch (error) {
            logger.error('更新统计信息失败:', error);
        }
    }

    /**
     * 检查会话是否过期
     */
    isExpired(timeoutMs = 300000) {
        // 默认5分钟超时
        const now = new Date();
        return now - this.lastActivity > timeoutMs;
    }

    /**
     * 设置SNMP认证信息
     */
    setAuthInfo(authInfo) {
        try {
            this.version = authInfo.version;
            this.community = authInfo.community;
            this.securityLevel = authInfo.securityLevel;
            this.username = authInfo.username;
            this.authProtocol = authInfo.authProtocol;
            this.privProtocol = authInfo.privProtocol;

            logger.info(`会话 ${this.sessionId} 设置认证信息: 版本=${this.version}, 安全级别=${this.securityLevel}`);
        } catch (error) {
            logger.error('设置认证信息失败:', error);
        }
    }

    /**
     * 验证Trap是否来自此会话的代理
     */
    validateTrap(trapData) {
        try {
            // 检查IP地址
            if (trapData.sourceIp !== this.agentIp) {
                return false;
            }

            // 检查SNMP版本匹配
            if (this.version && trapData.version !== this.version) {
                logger.warn(`会话 ${this.sessionId} SNMP版本不匹配: 期望=${this.version}, 实际=${trapData.version}`);
            }

            // 检查Community（对于v1/v2c）
            if (this.community && trapData.community && trapData.community !== this.community) {
                logger.warn(
                    `会话 ${this.sessionId} Community不匹配: 期望=${this.community}, 实际=${trapData.community}`
                );
            }

            return true;
        } catch (error) {
            logger.error('验证Trap失败:', error);
            return false;
        }
    }

    /**
     * 获取会话信息
     */
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            agentIp: this.agentIp,
            agentPort: this.agentPort,
            localIp: this.localIp,
            localPort: this.localPort,
            version: this.version,
            community: this.community,
            securityLevel: this.securityLevel,
            username: this.username,
            status: this.status,
            createTime: this.createTime.toISOString(),
            lastActivity: this.lastActivity.toISOString(),
            trapCount: this.trapCount,
            stats: this.stats
        };
    }

    /**
     * 获取代理信息
     */
    getAgentInfo() {
        return {
            ip: this.agentIp,
            port: this.agentPort,
            version: this.version,
            community: this.community,
            status: this.status,
            trapCount: this.trapCount,
            lastActivity: this.lastActivity.toISOString()
        };
    }

    /**
     * 关闭会话
     */
    closeSession() {
        try {
            this.status = 'closed';
            logger.info(`SNMP会话关闭: ${this.sessionId}`);

            // 发送会话关闭事件
            if (this.messageHandler) {
                this.messageHandler.sendEvent('SNMP_SESSION_CLOSED', {
                    sessionId: this.sessionId,
                    agentIp: this.agentIp,
                    stats: this.stats
                });
            }
        } catch (error) {
            logger.error('关闭会话失败:', error);
        }
    }

    /**
     * 更新活动时间
     */
    updateActivity() {
        this.lastActivity = new Date();
    }

    /**
     * 获取会话运行时间
     */
    getUptime() {
        const now = new Date();
        return now - this.createTime;
    }

    /**
     * 获取空闲时间
     */
    getIdleTime() {
        const now = new Date();
        return now - this.lastActivity;
    }
}

module.exports = SnmpSession;
