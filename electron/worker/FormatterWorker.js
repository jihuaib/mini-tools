const { parentPort } = require('worker_threads');

// 处理来自主进程的消息
parentPort.on('message', data => {
    try {
        let result;
        if (data.type === 'json') {
            result = formatJSON(data.content, data.indent);
        } else if (data.type === 'xml') {
            result = formatXML(data.content, data.indent);
        } else {
            throw new Error('不支持的格式化类型');
        }

        parentPort.postMessage({
            status: 'success',
            data: result
        });
    } catch (error) {
        parentPort.postMessage({
            status: 'error',
            error: error.message
        });
    }
});

// JSON格式化
function formatJSON(jsonString, indent) {
    try {
        // 解析JSON字符串
        const obj = JSON.parse(jsonString);
        // 美化输出
        return JSON.stringify(obj, null, indent || 2);
    } catch (error) {
        throw new Error('无效的JSON格式: ' + error.message);
    }
}

// XML格式化
function formatXML(xmlString, indent = 2) {
    try {
        xmlString = xmlString.trim().replace(/>\s+</g, '><'); // 去除标签间空白
        const space = ' '.repeat(indent);
        const tokens = xmlString.match(/<[^>]+>|[^<]+/g); // 拆分为标签/文本块
        let formatted = '';
        let level = 0;
        let i = 0;

        while (i < tokens.length) {
            const token = tokens[i];

            if (token.startsWith('<?') || token.startsWith('<!')) {
                // 声明或注释
                formatted += space.repeat(level) + token + '\n';
                i++;
            } else if (token.startsWith('</')) {
                // 结束标签
                level--;
                formatted += space.repeat(level) + token + '\n';
                i++;
            } else if (token.startsWith('<') && token.endsWith('/>')) {
                // 自闭合标签
                formatted += space.repeat(level) + token + '\n';
                i++;
            } else if (token.startsWith('<')) {
                const startTag = token;
                const next = tokens[i + 1];
                const endTag = tokens[i + 2];

                // 检查是否是简单文本内容包裹的结构 <tag>text</tag>
                if (next && !next.startsWith('<') && endTag && endTag.startsWith('</')) {
                    const inlineText = next.trim();
                    formatted += space.repeat(level) + startTag + inlineText + endTag + '\n';
                    i += 3; // 跳过这三个块
                } else {
                    // 正常标签块
                    formatted += space.repeat(level) + startTag + '\n';
                    level++;
                    i++;
                }
            } else {
                // 单独出现的文本节点（正常不该出现）
                const text = token.trim();
                if (text) {
                    formatted += space.repeat(level) + text + '\n';
                }
                i++;
            }
        }

        return formatted.trim();
    } catch (e) {
        throw new Error('XML格式化失败: ' + e.message);
    }
}
