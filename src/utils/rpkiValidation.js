import { isNumber, isASN, isValidIpv4, isValidIpv6 } from './validationCommon';

export const validatePort = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.port = '请输入端口号';
    } else if (!isNumber(value)) {
        validationErrors.value.port = '端口号必须是数字';
    } else if (parseInt(value) < 1024 || parseInt(value) > 65535) {
        validationErrors.value.port = '端口号范围应为1024-65535';
    } else {
        validationErrors.value.port = '';
    }
};

export const validateAsn = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.asn = '请输入ASN';
    } else if (!isASN(value)) {
        validationErrors.value.asn = '请输入有效的ASN';
    } else {
        validationErrors.value.asn = '';
    }
};

export const validateIpv4Prefix = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ip = '请输入IPv4前缀';
    } else if (!isValidIpv4(value)) {
        validationErrors.value.ip = '请输入有效的IPv4地址';
    } else {
        validationErrors.value.ip = '';
    }
};

export const validateIpv4Mask = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.mask = '请输入IPv4掩码';
    } else if (!isNumber(value) || parseInt(value) < 0 || parseInt(value) > 32) {
        validationErrors.value.mask = '请输入0-32之间的数字';
    } else {
        validationErrors.value.mask = '';
    }
};

export const validateIpv4MaxLength = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.maxLength = '请输入IPv4最大前缀长度';
    } else if (!isNumber(value) || parseInt(value) < 0 || parseInt(value) > 32) {
        validationErrors.value.maxLength = '请输入0-32之间的数字';
    } else {
        validationErrors.value.maxLength = '';
    }
};

export const validateIpv6Prefix = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.ip = '请输入IPv6前缀';
    } else if (!isValidIpv6(value)) {
        validationErrors.value.ip = '请输入有效的IPv6地址';
    } else {
        validationErrors.value.ip = '';
    }
};

export const validateIpv6Mask = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.mask = '请输入IPv6掩码';
    } else if (!isNumber(value) || parseInt(value) < 0 || parseInt(value) > 128) {
        validationErrors.value.mask = '请输入0-128之间的数字';
    } else {
        validationErrors.value.mask = '';
    }
};

export const validateIpv6MaxLength = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.maxLength = '请输入IPv6最大前缀长度';
    } else if (!isNumber(value) || parseInt(value) < 0 || parseInt(value) > 128) {
        validationErrors.value.maxLength = '请输入0-128之间的数字';
    } else {
        validationErrors.value.maxLength = '';
    }
};
