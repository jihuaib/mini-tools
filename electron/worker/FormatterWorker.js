const { parentPort } = require('worker_threads');
const libxmljs = require('libxmljs2');

// 处理来自主进程的消息
parentPort.on('message', data => {
    let result;
    if (data.type === 'json') {
        result = formatJSON(data.content, data.indent);
    } else if (data.type === 'xml') {
        result = formatXML(data.content, data.indent);
    } else {
        result = {
            status: 'error',
            msg: '不支持的格式化类型'
        };
    }

    if (result.status === 'success') {
        parentPort.postMessage({
            status: 'success',
            data: {
                verify: true,
                data: result.data
            }
        });
    } else {
        // 检验失败
        parentPort.postMessage({
            status: 'success',
            data: {
                verify: false,
                msg: result.msg,
                errors: result.errors || [] // 添加具体的错误信息数组
            }
        });
    }
});

// JSON格式化
function formatJSON(jsonString, indent) {
    try {
        // 确保indent是有效的正整数
        const validIndent = Math.max(1, Math.floor(Number(indent)) || 2);

        // 解析JSON字符串
        const obj = JSON.parse(jsonString);

        // 美化输出，使用指定的缩进空格数
        return {
            status: 'success',
            data: JSON.stringify(obj, null, validIndent)
        };
    } catch (error) {
        const errorInfo = getDetailedJSONError(jsonString, error);
        return {
            status: 'error',
            msg: errorInfo.message,
            errors: errorInfo.errors // 返回具体的错误位置信息
        };
    }
}

// 获取详细的JSON错误信息
function getDetailedJSONError(jsonString, originalError) {
    const errorMessage = originalError.message;
    const errors = [];

    // 尝试从错误信息中提取位置
    const positionMatch = errorMessage.match(/position (\d+)/i);
    if (positionMatch) {
        const position = parseInt(positionMatch[1]);
        const { line, column, context } = getLineColumnFromPosition(jsonString, position);

        errors.push({
            line: line,
            column: column,
            message: `JSON 语法错误: ${originalError.message}`,
            type: 'syntax'
        });

        return {
            message: `JSON 语法错误 (第 ${line} 行，第 ${column} 列): ${originalError.message}\n错误位置前后内容: ${context}`,
            errors: errors
        };
    }

    // 常见JSON错误的详细提示
    if (errorMessage.includes('Unexpected token')) {
        const tokenMatch = errorMessage.match(/Unexpected token (.+?) in JSON at position (\d+)/);
        if (tokenMatch) {
            const token = tokenMatch[1];
            const position = parseInt(tokenMatch[2]);
            const { line, column } = getLineColumnFromPosition(jsonString, position);

            errors.push({
                line: line,
                column: column,
                message: `遇到意外的字符 "${token}"`,
                type: 'syntax'
            });

            return {
                message:
                    `JSON 语法错误: 遇到意外的字符 "${token}" (第 ${line} 行，第 ${column} 列)\n` +
                    `可能的原因:\n` +
                    `- 字符串未用双引号包裹\n` +
                    `- 对象属性名未用双引号包裹\n` +
                    `- 多余的逗号\n` +
                    `- 缺少逗号分隔`,
                errors: errors
            };
        } else {
            // 如果没有position信息，尝试其他方式定位
            const simpleTokenMatch = errorMessage.match(/Unexpected token (.+?) in JSON/);
            if (simpleTokenMatch) {
                const token = simpleTokenMatch[1];
                const errorLine = findErrorLineByContent(jsonString, token);

                if (errorLine) {
                    errors.push({
                        line: errorLine,
                        column: 1,
                        message: `遇到意外的字符 "${token}"`,
                        type: 'syntax'
                    });
                }

                return {
                    message:
                        `JSON 语法错误: 遇到意外的字符 "${token}"\n` +
                        `可能的原因:\n` +
                        `- 字符串未用双引号包裹\n` +
                        `- 对象属性名未用双引号包裹\n` +
                        `- 多余的逗号\n` +
                        `- 缺少逗号分隔`,
                    errors: errors
                };
            }
        }
    }

    if (errorMessage.includes('Unexpected end of JSON input')) {
        // 找到最后一个有内容的行
        const lines = jsonString.split('\n');
        const lastNonEmptyLine = findLastNonEmptyLine(lines);

        if (lastNonEmptyLine > 0) {
            errors.push({
                line: lastNonEmptyLine,
                column: lines[lastNonEmptyLine - 1].length,
                message: 'JSON 内容不完整，可能缺少闭合符号',
                type: 'syntax'
            });
        }

        return {
            message:
                `JSON 语法错误: JSON 内容不完整\n` +
                `可能的原因:\n` +
                `- 缺少闭合的花括号 "}" 或方括号 "]"\n` +
                `- JSON 内容被意外截断`,
            errors: errors
        };
    }

    if (errorMessage.includes('Unexpected string')) {
        // 尝试通过逐行解析找到错误行
        const errorLineInfo = findJSONErrorLine(jsonString, originalError);
        if (errorLineInfo) {
            errors.push({
                line: errorLineInfo.line,
                column: errorLineInfo.column || 1,
                message: '字符串格式错误，可能缺少逗号分隔',
                type: 'syntax'
            });

            return {
                message: errorLineInfo.message,
                errors: errors
            };
        }

        return {
            message:
                `JSON 语法错误: 字符串格式错误\n` +
                `可能的原因:\n` +
                `- 缺少逗号分隔多个属性或数组元素\n` +
                `- 对象属性名或值的引号使用错误`,
            errors: errors
        };
    }

    // 尝试通过其他方式定位错误行
    const errorLineInfo = findJSONErrorLine(jsonString, originalError);
    if (errorLineInfo) {
        errors.push({
            line: errorLineInfo.line,
            column: errorLineInfo.column || 1,
            message: errorLineInfo.message,
            type: 'syntax'
        });

        return {
            message: errorLineInfo.message,
            errors: errors
        };
    }

    // 如果无法准确定位，返回通用错误
    errors.push({
        line: 1,
        column: 1,
        message: `JSON 格式错误: ${originalError.message}`,
        type: 'syntax'
    });

    return {
        message: `JSON 格式错误: ${originalError.message}`,
        errors: errors
    };
}

// 尝试通过解析找到JSON错误行
function findJSONErrorLine(jsonString, error) {
    const lines = jsonString.split('\n');

    // 逐行尝试解析，找到出错的行
    for (let i = 0; i < lines.length; i++) {
        try {
            const partialJson = lines.slice(0, i + 1).join('\n');
            JSON.parse(partialJson);
        } catch (e) {
            // 如果在这一行出错，且错误类型相似，则认为是这一行的问题
            if (e.message.includes(error.message.split(' ')[0])) {
                return {
                    line: i + 1,
                    column: 1,
                    message: `第 ${i + 1} 行存在语法错误: ${error.message}`
                };
            }
        }
    }

    return null;
}

// 根据内容查找错误行
function findErrorLineByContent(jsonString, token) {
    const lines = jsonString.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(token)) {
            return i + 1;
        }
    }
    return null;
}

// 找到最后一个非空行
function findLastNonEmptyLine(lines) {
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim()) {
            return i + 1;
        }
    }
    return 1;
}

// 根据字符位置计算行号和列号
function getLineColumnFromPosition(text, position) {
    const lines = text.substring(0, position).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    // 获取错误位置前后的上下文
    const allLines = text.split('\n');
    const contextStart = Math.max(0, line - 2);
    const contextEnd = Math.min(allLines.length, line + 1);
    const context = allLines.slice(contextStart, contextEnd).join('\n');

    return { line, column, context };
}

// XML格式化
function formatXML(xmlString, indent = 2) {
    try {
        // 使用libxmljs2解析和验证XML
        const xmlDoc = libxmljs.parseXml(xmlString);

        // 获取原始XML字符串并进行格式化
        const rawXml = xmlDoc.toString();
        console.log('rawXml', rawXml);
        const formattedXml = formatXMLString(rawXml, indent);
        console.log('formattedXml', formattedXml);

        return {
            status: 'success',
            data: formattedXml
        };
    } catch (error) {
        // 解析XML时的错误处理
        console.log('error', error);
        const errorInfo = getDetailedXMLError(xmlString, error);
        return {
            status: 'error',
            msg: errorInfo.message,
            errors: errorInfo.errors
        };
    }
}

// 自定义XML格式化函数
function formatXMLString(xmlString, indent = 2) {
    // 确保indent是有效的非负整数
    const validIndent = Math.max(0, Math.floor(Number(indent)) || 2);
    const space = ' '.repeat(validIndent);

    // 移除多余的空白字符并分割成tokens
    const tokens = xmlString
        .replace(/>\s+</g, '><')
        .trim()
        .split(/(<[^>]*>)/);
    let formatted = '';
    let level = 0;
    let needsIndent = false;

    for (const token of tokens) {
        if (!token) continue;

        if (token.startsWith('<')) {
            // 处理XML标签
            if (token.startsWith('</')) {
                // 结束标签：减少缩进
                level = Math.max(0, level - 1);
                if (needsIndent) {
                    formatted += '\n' + space.repeat(level);
                }
                formatted += token;
                needsIndent = true;
            } else if (token.endsWith('/>')) {
                // 自闭合标签：不改变缩进级别
                if (needsIndent) {
                    formatted += '\n' + space.repeat(level);
                }
                formatted += token;
                needsIndent = true;
            } else if (token.startsWith('<?') || token.startsWith('<!--')) {
                // XML声明或注释：不改变缩进级别
                if (needsIndent && formatted) {
                    formatted += '\n' + space.repeat(level);
                }
                formatted += token;
                needsIndent = true;
            } else {
                // 开始标签：增加缩进
                if (needsIndent) {
                    formatted += '\n' + space.repeat(level);
                }
                formatted += token;
                level++;
                needsIndent = true;
            }
        } else {
            // 文本内容
            const trimmedToken = token.trim();
            if (trimmedToken) {
                // 如果有实际内容，直接添加（不换行）
                formatted += trimmedToken;
                needsIndent = true;
            }
        }
    }

    return formatted.trim();
}

// 获取详细的XML错误信息
function getDetailedXMLError(xmlString, error) {
    const errors = [];
    const errorMessage = error.toString();
    console.log('errorMessage', errorMessage);
    console.log('line', error.line);

    // 尝试从libxmljs2错误信息中提取行号和列号

    let line = 1;
    let column = 1;

    if (error.line) {
        line = parseInt(error.line);
    }
    if (error.column) {
        column = parseInt(error.column);
    }

    // 分析不同类型的XML错误
    if (errorMessage.includes('StartTag: invalid element name') || errorMessage.includes('xmlParseStartTag')) {
        errors.push({
            line: line,
            column: column,
            message: '无效的XML标签名',
            type: 'syntax'
        });

        return {
            message:
                `XML 语法错误 (第 ${line} 行，第 ${column} 列): 无效的标签名\n` +
                `可能的原因:\n` +
                `- 标签名包含非法字符\n` +
                `- 标签名以数字开头\n` +
                `- 标签名为空`,
            errors: errors
        };
    }

    if (errorMessage.includes('Opening and ending tag mismatch') || errorMessage.includes('expected')) {
        const tagMatch = errorMessage.match(/Opening and ending tag mismatch: (\w+) line \d+ and (\w+)/);
        if (tagMatch) {
            const openTag = tagMatch[1];
            const closeTag = tagMatch[2];

            errors.push({
                line: line,
                column: column,
                message: `标签不匹配: 开始标签 <${openTag}> 与结束标签 </${closeTag}> 不匹配`,
                type: 'mismatch'
            });

            return {
                message:
                    `XML 标签不匹配错误 (第 ${line} 行): 开始标签 <${openTag}> 与结束标签 </${closeTag}> 不匹配\n` +
                    `请检查标签名是否一致`,
                errors: errors
            };
        }

        errors.push({
            line: line,
            column: column,
            message: '标签不匹配',
            type: 'mismatch'
        });

        return {
            message: `XML 标签不匹配错误 (第 ${line} 行，第 ${column} 列)\n` + `请检查开始标签和结束标签是否正确配对`,
            errors: errors
        };
    }

    if (errorMessage.includes('Premature end of data') || errorMessage.includes("EndTag: '<' not found")) {
        errors.push({
            line: line,
            column: column,
            message: 'XML内容不完整，可能缺少闭合标签',
            type: 'unclosed'
        });

        return {
            message:
                `XML 语法错误 (第 ${line} 行): XML内容不完整\n` +
                `可能的原因:\n` +
                `- 缺少闭合标签\n` +
                `- XML文档被意外截断`,
            errors: errors
        };
    }

    if (errorMessage.includes('not well-formed') || errorMessage.includes('xmlParseCharData')) {
        errors.push({
            line: line,
            column: column,
            message: 'XML格式不正确',
            type: 'syntax'
        });

        return {
            message:
                `XML 语法错误 (第 ${line} 行，第 ${column} 列): XML格式不正确\n` +
                `可能的原因:\n` +
                `- 包含非法字符\n` +
                `- 属性值未用引号包裹\n` +
                `- 标签语法错误`,
            errors: errors
        };
    }

    if (errorMessage.includes('Empty content') || xmlString.trim() === '') {
        errors.push({
            line: 1,
            column: 1,
            message: 'XML内容为空',
            type: 'empty'
        });

        return {
            message: 'XML 内容为空\n请输入有效的XML内容',
            errors: errors
        };
    }

    // 处理其他类型的错误
    errors.push({
        line: line,
        column: column,
        message: errorMessage,
        type: 'syntax'
    });

    return {
        message: `XML 解析错误 (第 ${line} 行，第 ${column} 列): ${errorMessage}`,
        errors: errors
    };
}
