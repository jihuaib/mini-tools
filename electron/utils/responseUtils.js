/**
 * 统一响应格式
 * @param {string} status - 响应状态: 'success' | 'error'
 * @param {string} msg - 响应消息
 * @param {any} data - 响应数据
 * @returns {Object} 统一格式的响应对象
 */
function createResponse(status, msg = '', data = null) {
    return {
        status,
        msg,
        data
    };
}

/**
 * 成功响应
 * @param {any} data - 响应数据
 * @param {string} msg - 响应消息
 * @returns {Object} 统一格式的成功响应对象
 */
function successResponse(data = null, msg = '') {
    return createResponse('success', msg, data);
}

/**
 * 错误响应
 * @param {string} msg - 错误消息
 * @param {any} data - 错误数据
 * @returns {Object} 统一格式的错误响应对象
 */
function errorResponse(msg = '', data = null) {
    return createResponse('error', msg, data);
}

module.exports = {
    createResponse,
    successResponse,
    errorResponse
};
