<template>
    <div class="code-editor">
        <div class="editor-container" :style="{ height: height + 'px' }">
            <!-- 行号区域 -->
            <div ref="lineNumbersRef" class="line-numbers">
                <div
                    v-for="(line, index) in lines"
                    :key="index"
                    class="line-number"
                    :class="{
                        'error-line': hasErrorInLine(index + 1)
                    }"
                >
                    <span class="line-num">{{ index + 1 }}</span>
                    <a-tooltip v-if="hasErrorInLine(index + 1)" :title="getErrorMessage(index + 1)" placement="right">
                        <span class="error-icon">!</span>
                    </a-tooltip>
                </div>
            </div>

            <!-- 文本编辑区域 -->
            <div class="editor-content">
                <a-textarea
                    ref="textareaRef"
                    :value="modelValue"
                    :placeholder="placeholder"
                    :status="status"
                    :readonly="readonly"
                    class="editor-textarea"
                    :class="{ 'readonly-textarea': readonly }"
                    :style="{ height: height + 'px' }"
                    @input="updateValue"
                    @scroll="onScroll"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
    import { computed, ref, nextTick, watch, onMounted } from 'vue';

    // 定义 props
    const props = defineProps({
        modelValue: {
            type: String,
            default: ''
        },
        height: {
            type: Number,
            default: 200
        },
        placeholder: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            default: ''
        },
        errors: {
            type: Array,
            default: () => []
        },
        readonly: {
            type: Boolean,
            default: false
        },
        autoJumpToError: {
            type: Boolean,
            default: true
        }
    });

    // 定义 emit 事件
    const emit = defineEmits(['update:modelValue', 'change']);

    const textareaRef = ref(null);
    const lineNumbersRef = ref(null);

    // 计算行数组
    const lines = computed(() => {
        if (!props.modelValue) return [''];
        const textLines = props.modelValue.split('\n');
        // 确保至少有一行用于显示
        return textLines.length > 0 ? textLines : [''];
    });

    // 检查指定行是否有错误
    const hasErrorInLine = lineNumber => {
        return props.errors.some(error => error.line === lineNumber);
    };

    // 获取指定行的错误信息
    const getErrorMessage = lineNumber => {
        const error = props.errors.find(error => error.line === lineNumber);
        return error ? error.message : '';
    };

    // 同步行号区域和文本区域的高度
    const syncHeight = () => {
        nextTick(() => {
            const textarea = textareaRef.value?.$el || textareaRef.value;
            const lineNumbers = lineNumbersRef.value;

            if (textarea && lineNumbers) {
                // 获取文本区域的实际显示高度（不包括滚动条）
                const textareaHeight = textarea.clientHeight;
                const scrollbarHeight = textarea.offsetHeight - textarea.clientHeight;

                // 根据是否有横向滚动条来调整行号区域高度
                if (scrollbarHeight > 0) {
                    lineNumbers.style.height = `${textareaHeight}px`;
                    lineNumbers.style.maxHeight = `${textareaHeight}px`;
                } else {
                    lineNumbers.style.height = '100%';
                    lineNumbers.style.maxHeight = '100%';
                }
            }
        });
    };

    // 触发父组件更新值
    const updateValue = e => {
        emit('update:modelValue', e.target.value);
        emit('change', e.target.value);
        // 内容变化后同步高度
        syncHeight();
    };

    // 同步滚动
    const onScroll = event => {
        nextTick(() => {
            const textarea = event.target;
            const lineNumbers = lineNumbersRef.value;
            if (textarea && lineNumbers) {
                lineNumbers.scrollTop = textarea.scrollTop;
            }
        });
        // 滚动时也同步高度，以防滚动导致横向滚动条状态变化
        syncHeight();
    };

    // 监听内容变化，确保高度同步
    watch(
        () => props.modelValue,
        () => {
            syncHeight();
        }
    );

    // 监听高度属性变化
    watch(
        () => props.height,
        () => {
            syncHeight();
        }
    );

    // 监听错误变化，自动跳转到第一个错误行
    watch(
        () => props.errors,
        (newErrors, oldErrors) => {
            if (props.autoJumpToError && newErrors && newErrors.length > 0) {
                // 检查是否有新的错误
                const hasNewErrors =
                    !oldErrors ||
                    oldErrors.length === 0 ||
                    newErrors.some(
                        newError =>
                            !oldErrors.some(
                                oldError => oldError.line === newError.line && oldError.message === newError.message
                            )
                    );

                if (hasNewErrors) {
                    // 找到第一个错误行并跳转
                    const firstError = newErrors[0];
                    if (firstError && firstError.line) {
                        // 延迟执行，确保DOM已更新
                        nextTick(() => {
                            setTimeout(() => {
                                goToErrorLine(firstError.line);
                            }, 100);
                        });
                    }
                }
            }
        },
        { deep: true }
    );

    // 组件挂载后初始化高度同步
    onMounted(() => {
        syncHeight();
    });

    // 高亮指定行的方法
    const highlightLine = lineNumber => {
        // 这里可以添加临时高亮效果，比如改变行号背景色
        const lineNumberElement = lineNumbersRef.value?.children[lineNumber - 1];
        if (lineNumberElement) {
            lineNumberElement.classList.add('highlight-line');
            setTimeout(() => {
                lineNumberElement.classList.remove('highlight-line');
            }, 2000); // 2秒后移除高亮
        }
    };

    // 自动跳转到错误行的方法
    const goToErrorLine = lineNumber => {
        nextTick(() => {
            const textarea = textareaRef.value?.$el || textareaRef.value;
            if (textarea) {
                // 计算行高
                const lineHeight = 22; // 与CSS中的line-height保持一致
                const targetScrollTop = (lineNumber - 1) * lineHeight;

                // 滚动到目标行
                textarea.scrollTop = targetScrollTop;

                // 同步行号区域滚动
                const lineNumbers = lineNumbersRef.value;
                if (lineNumbers) {
                    lineNumbers.scrollTop = targetScrollTop;
                }

                // 计算光标位置并聚焦
                const lines = props.modelValue.split('\n');
                let cursorPosition = 0;
                for (let i = 0; i < lineNumber - 1; i++) {
                    cursorPosition += lines[i].length + 1; // +1 for newline character
                }

                // 设置光标位置并聚焦（仅在非只读模式下）
                if (!props.readonly) {
                    textarea.focus();
                    textarea.setSelectionRange(cursorPosition, cursorPosition + (lines[lineNumber - 1]?.length || 0));
                }

                // 临时高亮该行（添加高亮效果）
                highlightLine(lineNumber);
            }
        });
    };
</script>

<style scoped>
    .code-editor {
        border: 1px solid #d9d9d9;
        border-radius: 6px;
        overflow: hidden;
    }

    .editor-container {
        display: flex;
        position: relative;
        background: #fafafa;
        overflow: hidden;
    }

    .line-numbers {
        background: #f5f5f5;
        border-right: 1px solid #e8e8e8;
        padding: 8px 4px 8px 4px; /* 与textarea的垂直padding保持一致 */
        color: #999;
        user-select: none;
        min-width: 60px;
        text-align: right;
        flex-shrink: 0;
        font-family: 'Courier New', Courier, monospace;
        font-size: 14px; /* 调整字体大小与textarea保持一致 */
        line-height: 22px; /* 使用固定行高，确保与textarea一致 */
        overflow: hidden;
        position: relative;
        height: 100%;
        box-sizing: border-box; /* 确保padding计算正确 */
    }

    .line-number {
        height: 22px; /* 使用与line-height相同的高度 */
        line-height: 22px; /* 确保行高一致 */
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 8px;
        position: relative;
        margin: 0; /* 移除可能的默认margin */
    }

    .line-number.error-line {
        background: #fff2f0;
        border-right: 3px solid #ff4d4f;
    }

    .line-number.highlight-line {
        background-color: #52c41a !important;
        color: white !important;
        transition: background-color 0.3s ease;
    }

    .line-num {
        margin-right: 4px;
    }

    .error-icon {
        color: #ff4d4f;
        font-weight: bold;
        font-size: 12px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #ff4d4f;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        cursor: help;
    }

    .editor-content {
        flex: 1;
        position: relative;
    }

    .editor-textarea {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        font-family: 'Courier New', Courier, monospace !important;
        font-size: 14px !important; /* 调整字体大小与行号保持一致 */
        line-height: 22px !important; /* 使用固定行高，确保与行号一致 */
        padding: 8px 8px 8px 8px !important; /* 确保与行号区域的padding保持一致 */
        resize: none !important;
        background: transparent !important;
        width: 100% !important;
        overflow-y: auto !important;
        white-space: pre !important;
        overflow-x: auto !important;
        word-wrap: normal !important;
        margin: 0 !important; /* 移除默认margin */
        box-sizing: border-box !important; /* 确保padding计算正确 */
        vertical-align: top !important; /* 确保垂直对齐 */
    }

    .editor-textarea:focus {
        border: none !important;
        box-shadow: none !important;
    }

    .readonly-textarea {
        background: #f5f5f5 !important;
        cursor: default !important;
    }

    .readonly-textarea:focus {
        background: #f5f5f5 !important;
    }
</style>
