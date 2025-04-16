// Validation error messages
export const VALIDATION_ERRORS = {
    localAs: '',
    peerIp: '',
    peerAs: '',
    routerId: '',
    holdTime: '',
    ipv4Prefix: '',
    ipv4Mask: '',
    ipv4Count: '',
    ipv6Prefix: '',
    ipv6Mask: '',
    ipv6Count: ''
};

// Regular expressions
export const REGEX = {
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
    number: /^\d+$/,
    ipv4Mask: /^(?:[0-9]|[1-2][0-9]|3[0-2])$/,
    ipv6Mask: /^(?:[0-9]|[1-9][0-9]|1[0-2][0-8])$/
};

// Clear all validation errors
export const clearValidationErrors = validationErrors => {
    Object.keys(validationErrors.value).forEach(key => {
        validationErrors.value[key] = '';
    });
};

// Validation functions
export const validateLocalAs = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.localAs = '请输入Local AS';
    } else if (!REGEX.number.test(value)) {
        validationErrors.value.localAs = '请输入数字';
    } else {
        validationErrors.value.localAs = '';
    }
};

export const validatePeerIp = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.peerIp = '请输入Peer IP';
    } else if (!REGEX.ipv4.test(value)) {
        validationErrors.value.peerIp = '请输入有效的IPv4地址';
    } else {
        validationErrors.value.peerIp = '';
    }
};

export const validatePeerAs = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.peerAs = '请输入Peer AS';
    } else if (!REGEX.number.test(value)) {
        validationErrors.value.peerAs = '请输入数字';
    } else {
        validationErrors.value.peerAs = '';
    }
};

export const validateRouterId = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.routerId = '请输入Router ID';
    } else if (!REGEX.ipv4.test(value)) {
        validationErrors.value.routerId = '请输入有效的IPv4地址';
    } else {
        validationErrors.value.routerId = '';
    }
};

export const validateHoldTime = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.holdTime = '请输入Hold Time';
    } else if (!REGEX.number.test(value)) {
        validationErrors.value.holdTime = '请输入数字';
    } else {
        validationErrors.value.holdTime = '';
    }
};

export const validateIpv4Prefix = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv4Prefix = '请输入IPv4前缀';
    } else if (!REGEX.ipv4.test(value)) {
        validationErrors.value.ipv4Prefix = '请输入有效的IPv4地址';
    } else {
        validationErrors.value.ipv4Prefix = '';
    }
};

export const validateIpv4Mask = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv4Mask = '请输入IPv4掩码';
    } else if (!REGEX.number.test(value) || parseInt(value) < 0 || parseInt(value) > 32) {
        validationErrors.value.ipv4Mask = '请输入0-32之间的数字';
    } else {
        validationErrors.value.ipv4Mask = '';
    }
};

export const validateIpv4Count = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv4Count = '请输入IPv4路由数量';
    } else if (!REGEX.number.test(value) || parseInt(value) <= 0) {
        validationErrors.value.ipv4Count = '请输入大于0的数字';
    } else {
        validationErrors.value.ipv4Count = '';
    }
};

export const validateIpv6Prefix = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv6Prefix = '请输入IPv6前缀';
    } else if (!REGEX.ipv6.test(value)) {
        validationErrors.value.ipv6Prefix = '请输入有效的IPv6地址';
    } else {
        validationErrors.value.ipv6Prefix = '';
    }
};

export const validateIpv6Mask = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv6Mask = '请输入IPv6掩码';
    } else if (!REGEX.number.test(value) || parseInt(value) < 0 || parseInt(value) > 128) {
        validationErrors.value.ipv6Mask = '请输入0-128之间的数字';
    } else {
        validationErrors.value.ipv6Mask = '';
    }
};

export const validateIpv6Count = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv6Count = '请输入IPv6路由数量';
    } else if (!REGEX.number.test(value) || parseInt(value) <= 0) {
        validationErrors.value.ipv6Count = '请输入大于0的数字';
    } else {
        validationErrors.value.ipv6Count = '';
    }
};
