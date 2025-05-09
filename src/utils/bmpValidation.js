// 模板和占位符验证函数
import { isValidPort } from './validationCommon';

export const validatePort = (value, validationErrors) => {
    if (!value) {
        validationErrors.value.port = '请输入端口号';
    } else if (!isValidPort(value)) {
        validationErrors.value.port = '请输入1024-65535之间的数字';
    } else {
        validationErrors.value.port = '';
    }
};
