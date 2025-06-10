const { parentPort } = require('worker_threads');

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
        // 解析JSON字符串
        const obj = JSON.parse(jsonString);
        // 美化输出
        return {
            status: 'success',
            data: JSON.stringify(obj, null, indent || 2)
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
    // 先进行XML语法检查
    const validation = validateXMLSyntax(xmlString);
    if (validation.status !== 'success') {
        return validation;
    }

    try {
        xmlString = xmlString.trim().replace(/>\s+</g, '><'); // 去除标签间空白
        const space = ' '.repeat(indent);
        const tokens = xmlString.match(/<[^>]+>|[^<]+/g); // 拆分为标签/文本块

        if (!tokens) {
            return {
                status: 'error',
                msg: 'XML 解析失败: 无法识别有效的XML标签',
                errors: [
                    {
                        line: 1,
                        column: 1,
                        message: '无法识别有效的XML标签',
                        type: 'syntax'
                    }
                ]
            };
        }

        let formatted = '';
        let level = 0;
        let i = 0;
        const tagStack = []; // 用于跟踪标签匹配

        while (i < tokens.length) {
            const token = tokens[i];

            if (token.startsWith('<?') || token.startsWith('<!')) {
                // 声明或注释
                formatted += space.repeat(level) + token + '\n';
                i++;
            } else if (token.startsWith('</')) {
                // 结束标签
                const tagName = extractTagName(token);
                const expectedTag = tagStack.pop();

                if (expectedTag && expectedTag !== tagName) {
                    const errorLine = findTagLineInOriginal(xmlString, token);
                    return {
                        status: 'error',
                        msg: `XML 标签不匹配错误: 期望闭合标签 "</${expectedTag}>"，但找到 "</${tagName}>"\n请检查标签是否正确配对`,
                        errors: [
                            {
                                line: errorLine || 1,
                                column: 1,
                                message: `标签不匹配: 期望 "</${expectedTag}>" 但找到 "</${tagName}>"`,
                                type: 'mismatch'
                            }
                        ]
                    };
                }

                level--;
                formatted += space.repeat(level) + token + '\n';
                i++;
            } else if (token.startsWith('<') && token.endsWith('/>')) {
                // 自闭合标签
                formatted += space.repeat(level) + token + '\n';
                i++;
            } else if (token.startsWith('<')) {
                const startTag = token;
                const tagName = extractTagName(startTag);

                // 验证标签名是否有效
                if (!isValidXMLTagName(tagName)) {
                    const errorLine = findTagLineInOriginal(xmlString, token);
                    return {
                        status: 'error',
                        msg: `XML 语法错误: 无效的标签名 "${tagName}"\n标签名只能包含字母、数字、连字符、下划线和句点，且不能以数字开头`,
                        errors: [
                            {
                                line: errorLine || 1,
                                column: 1,
                                message: `无效的标签名 "${tagName}"`,
                                type: 'syntax'
                            }
                        ]
                    };
                }

                const next = tokens[i + 1];
                const endTag = tokens[i + 2];

                // 检查是否是简单文本内容包裹的结构 <tag>text</tag>
                if (next && !next.startsWith('<') && endTag && endTag.startsWith('</')) {
                    const endTagName = extractTagName(endTag);
                    if (tagName !== endTagName) {
                        const errorLine = findTagLineInOriginal(xmlString, endTag);
                        return {
                            status: 'error',
                            msg: `XML 标签不匹配错误: 开始标签 "<${tagName}>" 与结束标签 "</${endTagName}>" 不匹配\n请检查标签名是否一致`,
                            errors: [
                                {
                                    line: errorLine || 1,
                                    column: 1,
                                    message: `标签不匹配: "<${tagName}>" 与 "</${endTagName}>"`,
                                    type: 'mismatch'
                                }
                            ]
                        };
                    }

                    const inlineText = next.trim();
                    formatted += space.repeat(level) + startTag + inlineText + endTag + '\n';
                    i += 3; // 跳过这三个块
                } else {
                    // 正常标签块
                    tagStack.push(tagName);
                    formatted += space.repeat(level) + startTag + '\n';
                    level++;
                    i++;
                }
            } else {
                // 单独出现的文本节点
                const text = token.trim();
                if (text) {
                    formatted += space.repeat(level) + text + '\n';
                }
                i++;
            }
        }

        // 检查是否有未闭合的标签
        if (tagStack.length > 0) {
            const errors = tagStack.map(tag => {
                const errorLine = findTagLineInOriginal(xmlString, `<${tag}`);
                return {
                    line: errorLine || 1,
                    column: 1,
                    message: `未闭合的标签: <${tag}>`,
                    type: 'unclosed'
                };
            });

            return {
                status: 'error',
                msg: `XML 语法错误: 发现未闭合的标签\n未闭合的标签: ${tagStack.map(tag => `<${tag}>`).join(', ')}\n请为这些标签添加对应的闭合标签`,
                errors: errors
            };
        }

        return {
            status: 'success',
            data: formatted.trim()
        };
    } catch (e) {
        return {
            status: 'error',
            msg: 'XML 格式化失败: ' + e.message,
            errors: [
                {
                    line: 1,
                    column: 1,
                    message: e.message,
                    type: 'syntax'
                }
            ]
        };
    }
}

// 在原始XML中查找标签所在的行
function findTagLineInOriginal(xmlString, tag) {
    const lines = xmlString.split('\n');
    const tagName = extractTagName(tag);

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`<${tagName}`) || lines[i].includes(`</${tagName}`)) {
            return i + 1;
        }
    }
    return null;
}

// XML语法验证
function validateXMLSyntax(xmlString) {
    const trimmed = xmlString.trim();

    if (!trimmed) {
        return {
            status: 'error',
            msg: 'XML 内容为空',
            errors: [
                {
                    line: 1,
                    column: 1,
                    message: 'XML 内容为空',
                    type: 'empty'
                }
            ]
        };
    }

    // 检查是否包含基本的XML结构
    if (!trimmed.includes('<') || !trimmed.includes('>')) {
        return {
            status: 'error',
            msg: 'XML 语法错误: 缺少有效的XML标签\nXML文档必须包含至少一个标签',
            errors: [
                {
                    line: 1,
                    column: 1,
                    message: '缺少有效的XML标签',
                    type: 'syntax'
                }
            ]
        };
    }

    // 检查尖括号是否配对
    const openBrackets = (trimmed.match(/</g) || []).length;
    const closeBrackets = (trimmed.match(/>/g) || []).length;

    if (openBrackets !== closeBrackets) {
        return {
            status: 'error',
            msg: `XML 语法错误: 尖括号不匹配\n找到 ${openBrackets} 个 "<" 和 ${closeBrackets} 个 ">"\n请检查所有标签是否正确闭合`,
            errors: [
                {
                    line: 1,
                    column: 1,
                    message: `尖括号不匹配: ${openBrackets} 个 "<" 和 ${closeBrackets} 个 ">"`,
                    type: 'syntax'
                }
            ]
        };
    }

    // 检查是否有无效的字符序列
    if (trimmed.includes('<<') || trimmed.includes('>>')) {
        const errorLine = findErrorLineByContent(trimmed, '<<') || findErrorLineByContent(trimmed, '>>');
        return {
            status: 'error',
            msg: 'XML 语法错误: 发现连续的尖括号 "<<" 或 ">>"\n这通常表示标签语法错误',
            errors: [
                {
                    line: errorLine || 1,
                    column: 1,
                    message: '发现连续的尖括号，标签语法错误',
                    type: 'syntax'
                }
            ]
        };
    }

    // 检查是否有未闭合的标签
    const unclosedTags = trimmed.match(/<[^>]*$/);
    if (unclosedTags) {
        const lines = trimmed.split('\n');
        const errorLine = findLastNonEmptyLine(lines);
        return {
            status: 'error',
            msg: 'XML 语法错误: 发现未闭合的标签\n问题位置: "' + unclosedTags[0] + '..."',
            errors: [
                {
                    line: errorLine,
                    column: 1,
                    message: '发现未闭合的标签',
                    type: 'unclosed'
                }
            ]
        };
    }

    // 检查是否有空标签名（如 <> 或 </> ）
    const emptyTags = trimmed.match(/<\s*>|<\/\s*>/g);
    if (emptyTags) {
        const errorLine = findErrorLineByContent(trimmed, emptyTags[0]);
        return {
            status: 'error',
            msg: 'XML 语法错误: 发现空标签名\n问题标签: ' + emptyTags.join(', ') + '\nXML标签必须包含有效的标签名',
            errors: [
                {
                    line: errorLine || 1,
                    column: 1,
                    message: '发现空标签名',
                    type: 'syntax'
                }
            ]
        };
    }

    // 检查标签格式的基本有效性
    const allTags = trimmed.match(/<[^>]+>/g);
    if (allTags) {
        const _lines = trimmed.split('\n');
        for (const tag of allTags) {
            // 跳过XML声明和注释
            if (tag.startsWith('<?') || tag.startsWith('<!')) {
                continue;
            }

            // 提取标签名进行基本验证
            const tagName = extractTagName(tag);
            if (!tagName) {
                const errorLine = findErrorLineByContent(trimmed, tag);
                return {
                    status: 'error',
                    msg: `XML 语法错误: 无法识别标签名\n问题标签: "${tag}"\nXML标签必须包含有效的标签名`,
                    errors: [
                        {
                            line: errorLine || 1,
                            column: 1,
                            message: `无法识别标签名: "${tag}"`,
                            type: 'syntax'
                        }
                    ]
                };
            }

            // 检查标签名是否有效
            if (!isValidXMLTagName(tagName)) {
                const errorLine = findErrorLineByContent(trimmed, tag);
                return {
                    status: 'error',
                    msg: `XML 语法错误: 无效的标签名 "${tagName}"\n问题标签: "${tag}"\n标签名只能包含字母、数字、连字符、下划线和句点，且不能以数字开头`,
                    errors: [
                        {
                            line: errorLine || 1,
                            column: 1,
                            message: `无效的标签名 "${tagName}"`,
                            type: 'syntax'
                        }
                    ]
                };
            }
        }
    }

    return {
        status: 'success'
    };
}

// 提取标签名
function extractTagName(tag) {
    const match = tag.match(/<\/?([^>\s/]+)/);
    return match ? match[1] : '';
}

// 验证XML标签名是否有效
function isValidXMLTagName(tagName) {
    // XML标签名规则: 以字母或下划线开头，后面可以跟字母、数字、连字符、下划线、句点
    const xmlNameRegex = /^[a-zA-Z_][\w\-.]*$/;
    return xmlNameRegex.test(tagName);
}
