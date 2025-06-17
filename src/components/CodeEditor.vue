<template>
    <div class="code-editor">
        <div class="editor-container" :style="{ height: height + 'px' }">
            <!-- 行号区域 -->
            <div ref="lineNumbersRef" class="line-numbers">
                <div
                    v-for="(line, index) in lines"
                    :key="index"
                    class="line-number"
                    :class="{ 'error-line': hasErrorInLine(index + 1) }"
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
                    class="editor-textarea"
                    :style="{ height: height + 'px' }"
                    @input="updateValue"
                    @scroll="onScroll"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
    import { computed, ref, nextTick } from 'vue';

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
        }
    });

    // 定义 emit 事件
    const emit = defineEmits(['update:modelValue', 'change']);

    const textareaRef = ref(null);
    const lineNumbersRef = ref(null);

    // 计算行数组
    const lines = computed(() => {
        if (!props.modelValue) return [''];
        return props.modelValue.split('\n');
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

    // 触发父组件更新值
    const updateValue = e => {
        emit('update:modelValue', e.target.value);
        emit('change', e.target.value);
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
    }

    .line-numbers {
        background: #f5f5f5;
        border-right: 1px solid #e8e8e8;
        padding: 8px 4px;
        color: #999;
        user-select: none;
        min-width: 60px;
        text-align: right;
        flex-shrink: 0;
        font-family: 'Courier New', Courier, monospace;
        font-size: 13px;
        line-height: 1.5;
        overflow-y: auto;
        position: relative;
        height: 100%;
        /* 隐藏滚动条但保持滚动功能 */
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .line-numbers::-webkit-scrollbar {
        display: none;
    }

    .line-number {
        height: 22px;
        line-height: 22px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 8px;
        position: relative;
    }

    .line-number.error-line {
        background: #fff2f0;
        border-right: 3px solid #ff4d4f;
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
        font-size: 13px !important;
        line-height: 1.5 !important;
        padding: 8px !important;
        resize: none !important;
        background: transparent !important;
        width: 100% !important;
        overflow-y: auto !important;
    }

    .editor-textarea:focus {
        border: none !important;
        box-shadow: none !important;
    }
</style>
