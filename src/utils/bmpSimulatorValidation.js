// Template and placeholder validation functions
import { isNumber } from './validationCommon';

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
