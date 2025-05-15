// 服务器端口验证
export const validatePort = (value, errors) => {
    const port = parseInt(value);
    if (isNaN(port)) {
        errors.value.port = '端口必须是数字';
    } else if (port < 1 || port > 65535) {
        errors.value.port = '端口范围必须在1-65535之间';
    } else {
        errors.value.port = '';
    }
};

// 根目录验证
export const validateRootDir = (value, errors) => {
    if (!value) {
        errors.value.rootDir = '请指定根目录';
    } else {
        errors.value.rootDir = '';
    }
};

// 用户名验证
export const validateUsername = (value, errors) => {
    if (!value) {
        errors.value.username = '请输入用户名';
    } else {
        errors.value.username = '';
    }
};

// 密码验证
export const validatePassword = (value, errors) => {
    if (!value) {
        errors.value.password = '请输入密码';
    } else {
        errors.value.password = '';
    }
};
