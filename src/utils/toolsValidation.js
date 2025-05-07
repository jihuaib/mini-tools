// Template and placeholder validation functions
import { isNumber, validatePacketData } from './validationCommon';

export const validateTemplate = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.template = '请输入模板内容';
    } else {
        validationErrors.value.template = '';
    }
};

export const validatePlaceholder = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.placeholder = '请输入占位符';
    } else {
        validationErrors.value.placeholder = '';
    }
};

export const validateStart = (value, endValue, validationErrors) => {
    if (!value) {
        validationErrors.value.start = '请输入开始数值';
    } else if (!isNumber(value)) {
        validationErrors.value.start = '请输入数字';
    } else if (parseInt(value) > parseInt(endValue)) {
        validationErrors.value.start = '开始值必须小于或等于结束值';
    } else {
        validationErrors.value.start = '';
    }
};

export const validateEnd = (value, startValue, validationErrors) => {
    if (!value) {
        validationErrors.value.end = '请输入结束数值';
    } else if (!isNumber(value)) {
        validationErrors.value.end = '请输入数字';
    } else if (parseInt(value) < parseInt(startValue)) {
        validationErrors.value.end = '结束值必须大于或等于开始值';
    } else {
        validationErrors.value.end = '';
    }
};

// 报文数据验证
export const validateInputPacketData = (value, validationErrors) => {
    const {status, message} = validatePacketData(value);
    if (status === 'error') {
        validationErrors.value.packetData = message;
    } else {
        validationErrors.value.packetData = '';
    }
};
