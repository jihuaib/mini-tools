import { IP_TYPE } from '../const/bgpConst';

// 通用验证工具和常量

// 正则表达式
export const REGEX = {
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
    number: /^\d+$/
};

// 通用验证函数
export const isValidIpv4 = value => {
    return REGEX.ipv4.test(value);
};

export const isValidIpv6 = value => {
    return REGEX.ipv6.test(value);
};

export const isValidIpv4Mask = value => {
    if (!REGEX.number.test(value)) {
        return false;
    }
    const num = Number(value);
    return num >= 1 && num <= 32;
};

export const isValidIpv6Mask = value => {
    if (!REGEX.number.test(value)) {
        return false;
    }
    const num = Number(value);
    return num >= 1 && num <= 128;
};

export const isValidPort = value => {
    if (!REGEX.number.test(value)) {
        return false;
    }
    const num = Number(value);
    return num >= 1024 && num <= 65535;
};

export const isASN = value => {
    if (!REGEX.number.test(value)) {
        return false;
    }
    const num = Number(value);
    return num >= 1 && num <= 4294967295;
};

export const isNumber = value => {
    return REGEX.number.test(value);
};

export const validatePacketData = value => {
    const lines = value.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const numbers = line.split(/\s+/).filter(num => num !== '');

        // 检查每个数字的格式
        for (const num of numbers) {
            if (!/^[0-9A-Fa-f]{2}$/.test(num)) {
                return {
                    status: 'error',
                    message: `第 ${i + 1} 行包含无效的16进制数字: "${num}", 请输入2位的16进制数字`
                };
            }
        }
    }

    return {
        status: 'success',
        message: ''
    };
};

/**
 * 通用验证系统
 */
export class FormValidator {
    constructor(validationErrors) {
        this.validationErrors = validationErrors;
        this.rules = {};
    }

    /**
     * 添加验证规则
     * @param {string} field 字段名
     * @param {Array} rules 验证规则数组
     */
    addRule(field, rules) {
        this.rules[field] = rules;
        return this;
    }

    /**
     * 批量添加验证规则
     * @param {Object} rulesConfig 规则配置对象
     */
    addRules(rulesConfig) {
        Object.assign(this.rules, rulesConfig);
        return this;
    }

    /**
     * 执行验证
     * @param {Object} formData 表单数据
     * @returns {boolean} 是否有验证错误
     */
    validate(formData) {
        // 清空之前的验证错误
        this.clearErrors();

        for (const [field, rules] of Object.entries(this.rules)) {
            const value = formData[field];

            for (const rule of rules) {
                const result = this.executeRule(rule, value, formData, field);
                if (result.hasError) {
                    this.validationErrors.value[field] = result.message;
                    return true; // 遇到第一个错误就立即返回
                }
            }
        }

        return false; // 没有任何错误
    }

    /**
     * 执行单个验证规则
     * @param {Object|Function} rule 验证规则
     * @param {any} value 字段值
     * @param {Object} formData 完整表单数据
     * @param {string} field 字段名
     * @returns {Object} 验证结果
     */
    executeRule(rule, value, formData, field) {
        if (typeof rule === 'function') {
            // 简单函数验证
            const isValid = rule(value, formData);
            return {
                hasError: !isValid,
                message: `${field} 验证失败`
            };
        }

        if (typeof rule === 'object') {
            const { validator, message, required = false } = rule;

            // 必填验证
            if (required && (value === '' || value === null || value === undefined)) {
                return {
                    hasError: true,
                    message: message || `请输入${field}`
                };
            }

            // 如果不是必填且值为空，跳过验证
            if (!required && (value === '' || value === null || value === undefined)) {
                return { hasError: false };
            }

            // 执行自定义验证器
            if (validator) {
                const isValid = validator(value, formData);
                return {
                    hasError: !isValid,
                    message: message || `${field} 验证失败`
                };
            }
        }

        return { hasError: false };
    }

    /**
     * 清空验证错误
     */
    clearErrors() {
        Object.keys(this.validationErrors.value).forEach(key => {
            this.validationErrors.value[key] = '';
        });
    }

    /**
     * 验证单个字段
     * @param {string} field 字段名
     * @param {any} value 字段值
     * @param {Object} formData 完整表单数据
     * @returns {boolean} 是否有错误
     */
    validateField(field, value, formData) {
        if (!this.rules[field]) {
            return false;
        }

        // 清空该字段的错误
        this.validationErrors.value[field] = '';

        const rules = this.rules[field];
        for (const rule of rules) {
            const result = this.executeRule(rule, value, formData, field);
            if (result.hasError) {
                this.validationErrors.value[field] = result.message;
                return true;
            }
        }

        return false;
    }
}

/**
 * 常用验证器函数
 */
export const validators = {
    required: value => value !== '' && value !== null && value !== undefined,
    number: value => isNumber(value),
    port: value => isValidPort(value),
    ipv4: value => isValidIpv4(value),
    ipv6: value => isValidIpv6(value),
    ipv4Mask: value => isValidIpv4Mask(value),
    ipv6Mask: value => isValidIpv6Mask(value),
    asn: value => isASN(value),
    range: (min, max) => value => {
        const num = parseInt(value);
        return num >= min && num <= max;
    },
    compareNumbers:
        (compareField, operator = '<=') =>
        (value, formData) => {
            const currentNum = parseInt(value);
            const compareNum = parseInt(formData[compareField]);

            if (isNaN(currentNum) || isNaN(compareNum)) {
                return false;
            }

            switch (operator) {
                case '<=':
                    return currentNum <= compareNum;
                case '>=':
                    return currentNum >= compareNum;
                case '<':
                    return currentNum < compareNum;
                case '>':
                    return currentNum > compareNum;
                case '==':
                    return currentNum === compareNum;
                default:
                    return true;
            }
        }
};

/**
 * 创建字符串生成器验证规则
 */
export const createStringGeneratorValidationRules = () => {
    return {
        template: [
            {
                required: true,
                message: '请输入字符串模板'
            }
        ],
        placeholder: [
            {
                required: true,
                message: '请输入占位符'
            }
        ],
        start: [
            {
                required: true,
                message: '请输入开始数值'
            },
            {
                validator: validators.number,
                message: '请输入数字'
            },
            {
                validator: validators.compareNumbers('end', '<='),
                message: '开始值必须小于或等于结束值'
            }
        ],
        end: [
            {
                required: true,
                message: '请输入结束数值'
            },
            {
                validator: validators.number,
                message: '请输入数字'
            },
            {
                validator: validators.compareNumbers('start', '>='),
                message: '结束值必须大于或等于开始值'
            }
        ]
    };
};

/**
 * 创建报文数据验证规则
 */
export const createPacketDataValidationRules = () => {
    return {
        packetData: [
            {
                required: true,
                message: '请输入报文数据'
            },
            {
                validator: value => {
                    const result = validatePacketData(value);
                    return result.status === 'success';
                },
                message: '请输入有效的16进制报文数据'
            }
        ],
        protocolPort: [
            {
                validator: value => value === '' || validators.port(value),
                message: '请输入1024-65535之间的数字'
            }
        ]
    };
};

/**
 * 创建FTP配置验证规则
 */
export const createFtpConfigValidationRules = () => {
    return {
        port: [
            {
                required: true,
                message: '请输入端口号'
            },
            {
                validator: validators.port,
                message: '请输入1024-65535之间的数字'
            }
        ]
    };
};

/**
 * 创建FTP用户验证规则
 */
export const createFtpUserValidationRules = () => {
    return {
        rootDir: [
            {
                required: true,
                message: '请输入根目录'
            }
        ],
        username: [
            {
                required: true,
                message: '请输入用户名'
            }
        ],
        password: [
            {
                required: true,
                message: '请输入密码'
            }
        ]
    };
};

/**
 * 创建BGP配置验证规则
 */
export const createBgpConfigValidationRules = () => {
    return {
        localAs: [
            {
                required: true,
                message: '请输入Peer AS'
            },
            {
                validator: validators.asn,
                message: '请输入有效的ASN'
            }
        ],
        routerId: [
            {
                required: true,
                message: '请输入Router ID'
            },
            {
                validator: validators.ipv4,
                message: '请输入有效的IPv4地址'
            }
        ]
    };
};

export const createBgpPeerIpv4ConfigValidationRules = () => {
    return {
        peerIp: [
            {
                required: true,
                message: '请输入Peer IP'
            },
            {
                validator: validators.ipv4,
                message: '请输入有效的IPv4地址'
            }
        ],
        peerAs: [
            {
                required: true,
                message: '请输入Peer AS'
            },
            {
                validator: validators.asn,
                message: '请输入有效的ASN'
            }
        ],
        holdTime: [
            {
                required: true,
                message: '请输入Hold Time'
            },
            {
                validator: validators.number,
                message: '请输入数字'
            }
        ]
    };
};

export const createBgpPeerIpv6ConfigValidationRules = () => {
    return {
        peerIpv6: [
            {
                required: true,
                message: '请输入Peer IP'
            },
            {
                validator: validators.ipv6,
                message: '请输入有效的IPv6地址'
            }
        ],
        peerIpv6As: [
            {
                required: true,
                message: '请输入Peer AS'
            },
            {
                validator: validators.asn,
                message: '请输入有效的ASN'
            }
        ],
        holdTimeIpv6: [
            {
                required: true,
                message: '请输入Hold Time'
            },
            {
                validator: validators.number,
                message: '请输入数字'
            }
        ]
    };
};

export const createBgpIpv4RouteConfigValidationRules = () => {
    return {
        prefix: [
            {
                required: true,
                message: '请输入前缀'
            },
            {
                validator: validators.ipv4,
                message: '请输入有效的IPv4地址'
            }
        ],
        mask: [
            {
                required: true,
                message: '请输入掩码'
            },
            {
                validator: validators.ipv4Mask,
                message: '请输入有效的IPv4掩码'
            }
        ],
        count: [
            {
                required: true,
                message: '请输入数量'
            }
        ]
    };
};

export const createBgpIpv6RouteConfigValidationRules = () => {
    return {
        prefix: [
            {
                required: true,
                message: '请输入前缀'
            },
            {
                validator: validators.ipv6,
                message: '请输入有效的IPv6地址'
            }
        ],
        mask: [
            {
                required: true,
                message: '请输入掩码'
            },
            {
                validator: validators.ipv6Mask,
                message: '请输入有效的IPv6掩码'
            }
        ],
        count: [
            {
                required: true,
                message: '请输入数量'
            }
        ]
    };
};

/**
 * 创建BMP工具验证规则
 */
export const createBmpConfigValidationRules = () => {
    return {
        port: [
            {
                required: true,
                message: '请输入端口号'
            },
            {
                validator: validators.port,
                message: '请输入1024-65535之间的数字'
            }
        ]
    };
};

/**
 * 创建RPKI配置验证规则
 */
export const createRpkiConfigValidationRules = () => {
    return {
        port: [
            {
                required: true,
                message: '请输入端口号'
            },
            {
                validator: validators.port,
                message: '请输入1024-65535之间的数字'
            }
        ]
    };
};

/**
 * 创建RPKI ROA配置验证规则
 */
export const createRpkiRoaConfigValidationRules = () => {
    return {
        ip: [
            {
                required: true,
                message: '请输入IP地址'
            },
            {
                validator: (value, formData) => {
                    if (formData.ipType === IP_TYPE.IPV4) {
                        return validators.ipv4(value);
                    } else {
                        return validators.ipv6(value);
                    }
                },
                message: '请输入有效的IP地址'
            }
        ],
        asn: [
            {
                required: true,
                message: '请输入ASN'
            },
            {
                validator: validators.asn,
                message: '请输入有效的ASN'
            }
        ],
        mask: [
            {
                required: true,
                message: '请输入掩码'
            },
            {
                validator: (value, formData) => {
                    const maxRange = formData.ipType === IP_TYPE.IPV4 ? 32 : 128;
                    return validators.range(0, maxRange)(value);
                },
                message: '请输入有效的掩码值'
            },
            {
                validator: (value, formData) => {
                    const maskNum = parseInt(value);
                    const maxLengthNum = parseInt(formData.maxLength);
                    if (isNaN(maskNum) || isNaN(maxLengthNum)) {
                        return true; // 让其他验证器处理数值验证
                    }
                    return maskNum <= maxLengthNum;
                },
                message: '掩码值不能大于最大前缀长度'
            }
        ],
        maxLength: [
            {
                required: true,
                message: '请输入最大前缀长度'
            },
            {
                validator: (value, formData) => {
                    const maxRange = formData.ipType === IP_TYPE.IPV4 ? 32 : 128;
                    return validators.range(0, maxRange)(value);
                },
                message: '请输入有效的最大前缀长度'
            },
            {
                validator: (value, formData) => {
                    const maskNum = parseInt(formData.mask);
                    const maxLengthNum = parseInt(value);
                    if (isNaN(maskNum) || isNaN(maxLengthNum)) {
                        return true; // 让其他验证器处理数值验证
                    }
                    return maxLengthNum >= maskNum;
                },
                message: '最大前缀长度不能小于掩码值'
            }
        ]
    };
};
