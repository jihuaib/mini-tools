// Common validation utilities and constants

// Regular expressions
export const REGEX = {
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
    number: /^\d+$/
};

// Clear all validation errors
export const clearValidationErrors = validationErrors => {
    Object.keys(validationErrors.value).forEach(key => {
        validationErrors.value[key] = '';
    });
};

// Common validation functions
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
