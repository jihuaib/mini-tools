// BGP and network validation functions
import { isASN, isValidIpv4, isValidIpv6, isNumber } from './validationCommon';

// BGP validation functions
export const validateLocalAs = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.localAs = '请输入Local AS';
    } else if (!isASN(value)) {
        validationErrors.value.localAs = '请输入有效的ASN';
    } else {
        validationErrors.value.localAs = '';
    }
};

export const validatePeerIp = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.peerIp = '请输入Peer IP';
    } else if (!isValidIpv4(value)) {
        validationErrors.value.peerIp = '请输入有效的IPv4地址';
    } else {
        validationErrors.value.peerIp = '';
    }
};

export const validatePeerAs = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.peerAs = '请输入Peer AS';
    } else if (!isASN(value)) {
        validationErrors.value.peerAs = '请输入有效的ASN';
    } else {
        validationErrors.value.peerAs = '';
    }
};

export const validateRouterId = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.routerId = '请输入Router ID';
    } else if (!isValidIpv4(value)) {
        validationErrors.value.routerId = '请输入有效的IPv4地址';
    } else {
        validationErrors.value.routerId = '';
    }
};

export const validateHoldTime = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.holdTime = '请输入Hold Time';
    } else if (!isNumber(value)) {
        validationErrors.value.holdTime = '请输入数字';
    } else {
        validationErrors.value.holdTime = '';
    }
};

export const validateIpv4Prefix = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv4Prefix = '请输入IPv4前缀';
    } else if (!isValidIpv4(value)) {
        validationErrors.value.ipv4Prefix = '请输入有效的IPv4地址';
    } else {
        validationErrors.value.ipv4Prefix = '';
    }
};

export const validateIpv4Mask = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv4Mask = '请输入IPv4掩码';
    } else if (!isNumber(value) || parseInt(value) < 0 || parseInt(value) > 32) {
        validationErrors.value.ipv4Mask = '请输入0-32之间的数字';
    } else {
        validationErrors.value.ipv4Mask = '';
    }
};

export const validateIpv4Count = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv4Count = '请输入IPv4路由数量';
    } else if (!isNumber(value) || parseInt(value) <= 0) {
        validationErrors.value.ipv4Count = '请输入大于0的数字';
    } else {
        validationErrors.value.ipv4Count = '';
    }
};

export const validateIpv6Prefix = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv6Prefix = '请输入IPv6前缀';
    } else if (!isValidIpv6(value)) {
        validationErrors.value.ipv6Prefix = '请输入有效的IPv6地址';
    } else {
        validationErrors.value.ipv6Prefix = '';
    }
};

export const validateIpv6Mask = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv6Mask = '请输入IPv6掩码';
    } else if (!isNumber(value) || parseInt(value) < 0 || parseInt(value) > 128) {
        validationErrors.value.ipv6Mask = '请输入0-128之间的数字';
    } else {
        validationErrors.value.ipv6Mask = '';
    }
};

export const validateIpv6Count = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ipv6Count = '请输入IPv6路由数量';
    } else if (!isNumber(value) || parseInt(value) <= 0) {
        validationErrors.value.ipv6Count = '请输入大于0的数字';
    } else {
        validationErrors.value.ipv6Count = '';
    }
};
