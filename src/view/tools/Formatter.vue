<template>
    <div class="mt-container">
        <a-card title="格式化工具">
            <a-form :model="formState" :label-col="labelCol" :wrapper-col="wrapperCol" @finish="handleFinish">
                <!-- 格式选择 -->
                <a-form-item label="格式类型" name="type">
                    <a-radio-group v-model:value="formState.type" @change="clearErrors">
                        <a-radio value="json">JSON</a-radio>
                        <a-radio value="xml">XML</a-radio>
                    </a-radio-group>
                </a-form-item>

                <!-- 缩进设置 -->
                <a-form-item label="缩进空格" name="indent">
                    <a-input-number v-model:value="formState.indent" :min="1" :max="8" />
                </a-form-item>

                <!-- 内容输入 -->
                <a-form-item label="源内容" name="content">
                    <CodeEditor
                        v-model:modelValue="formState.content"
                        :height="200"
                        :status="lineErrors.length > 0 ? 'error' : ''"
                        :errors="lineErrors"
                        placeholder="请输入需要格式化的JSON或XML内容"
                        @change="clearErrors"
                    />
                </a-form-item>

                <!-- 操作按钮 -->
                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                    <a-space>
                        <a-button type="primary" html-type="submit" :loading="isFormatting">格式化</a-button>
                        <a-button type="default" @click="showFormatterHistory">历史记录</a-button>
                        <a-button type="default" @click="clearAll">清空</a-button>
                    </a-space>
                </a-form-item>

                <!-- 结果显示 -->
                <a-form-item label="格式化结果">
                    <div class="result-container">
                        <!-- 格式化结果显示 -->
                        <div v-if="result" class="format-result">
                            <div class="result-content">
                                <div class="line-numbers">
                                    <div v-for="(line, index) in resultLines" :key="index" class="line-number">
                                        {{ index + 1 }}
                                    </div>
                                </div>
                                <div class="code-content">
                                    <pre><code>{{ result }}</code></pre>
                                </div>
                            </div>
                        </div>
                        <!-- 默认空状态 -->
                        <div v-else class="empty-result">
                            <div class="empty-placeholder">格式化结果将显示在这里...</div>
                        </div>
                    </div>
                </a-form-item>
            </a-form>
        </a-card>
    </div>

    <!-- 历史记录弹窗 -->
    <a-modal
        v-model:open="formatterHistoryModalVisible"
        title="格式化历史"
        width="700px"
        :mask-closable="false"
        @cancel="closeHistoryModal"
    >
        <div class="history-modal-content">
            <a-table
                :columns="historyColumns"
                :data-source="formatterHistory"
                :pagination="{ pageSize: 5, showSizeChanger: false, position: ['bottomCenter'] }"
                :scroll="{ y: 200 }"
                size="small"
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'action'">
                        <a-button type="link" @click="loadHistoryItem(record)">使用</a-button>
                    </template>
                    <template v-else-if="column.key === 'content'">
                        <div class="history-content">{{ truncateString(record.content, 40) }}</div>
                    </template>
                    <template v-else-if="column.key === 'type'">
                        <div>{{ record.type === 'json' ? 'JSON' : 'XML' }}</div>
                    </template>
                </template>
            </a-table>
        </div>
        <template #footer>
            <a-button type="primary" @click="closeHistoryModal">关闭</a-button>
            <a-button v-if="formatterHistory.length > 0" type="danger" @click="clearHistory">清空历史</a-button>
        </template>
    </a-modal>
</template>

<script setup>
    import CodeEditor from '../../components/CodeEditor.vue';
    import { ref, onMounted, computed } from 'vue';
    import { message } from 'ant-design-vue';
    import { clearValidationErrors } from '../../utils/validationCommon';

    defineOptions({
        name: 'Formatter'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const validationErrors = ref({
        content: ''
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            clearValidationErrors(validationErrors);
            clearErrors();
        }
    });

    const formState = ref({
        type: 'json',
        indent: 2,
        content: ''
    });

    const result = ref('');
    const errorMessage = ref('');
    const lineErrors = ref([]); // 存储行错误信息
    const isFormatting = ref(false);

    // 计算结果的行数，用于显示行号
    const resultLines = computed(() => {
        if (!result.value) return [];
        return result.value.split('\n');
    });

    // 清空错误信息
    const clearErrors = () => {
        errorMessage.value = '';
        lineErrors.value = [];
        clearValidationErrors(validationErrors);
    };

    // 清空所有内容
    const clearAll = () => {
        formState.value.content = '';
        result.value = '';
        clearErrors();
    };

    const handleFinish = async () => {
        try {
            clearErrors();

            const content = formState.value.content.trim();
            if (!content) {
                errorMessage.value = '请输入需要格式化的内容';
                return;
            }

            isFormatting.value = true;

            const payload = {
                type: formState.value.type,
                indent: formState.value.indent,
                content: formState.value.content
            };

            const resp = await window.toolsApi.formatData(payload);
            if (resp.status === 'success') {
                result.value = resp.data;
                lineErrors.value = [];
                message.success('格式化成功');
            } else {
                // 处理错误信息，包括行错误
                errorMessage.value = resp.msg || '格式化失败';
                result.value = '';

                // 设置行错误信息
                if (resp.data && resp.data.length > 0) {
                    lineErrors.value = resp.data;
                } else {
                    lineErrors.value = [];
                }
            }
        } catch (e) {
            errorMessage.value = e.message || String(e);
            result.value = '';
            lineErrors.value = [];
            console.error('格式化错误:', e);
        } finally {
            isFormatting.value = false;
        }
    };

    // 历史记录相关状态和方法
    const formatterHistory = ref([]);
    const formatterHistoryModalVisible = ref(false);
    const historyColumns = [
        {
            title: '格式类型',
            dataIndex: 'type',
            key: 'type',
            width: 100
        },
        {
            title: '内容',
            dataIndex: 'content',
            key: 'content'
        },
        {
            title: '缩进',
            dataIndex: 'indent',
            key: 'indent',
            width: 80
        },
        {
            title: '操作',
            key: 'action',
            width: 80
        }
    ];

    const showFormatterHistory = async () => {
        try {
            const resp = await window.toolsApi.getFormatterHistory();
            if (resp.status === 'success') {
                formatterHistory.value = resp.data;
                formatterHistoryModalVisible.value = true;
            } else {
                message.error(resp.msg || '获取历史记录失败');
            }
        } catch (e) {
            message.error(e.message || String(e));
        }
    };

    const closeHistoryModal = () => {
        formatterHistoryModalVisible.value = false;
    };

    const clearHistory = async () => {
        try {
            const resp = await window.toolsApi.clearFormatterHistory();
            if (resp.status === 'success') {
                formatterHistory.value = [];
                message.success('历史记录已清空');
            } else {
                message.error(resp.msg || '清空历史记录失败');
            }
        } catch (e) {
            message.error(e.message || String(e));
        }
    };

    const loadHistoryItem = historyItem => {
        formState.value.type = historyItem.type;
        formState.value.indent = historyItem.indent;
        formState.value.content = historyItem.content;
        formatterHistoryModalVisible.value = false;
        clearErrors();
        result.value = '';
    };

    const truncateString = (str, maxLength) => {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    };

    onMounted(async () => {
        // 组件加载时的逻辑
    });
</script>

<style scoped>
    .history-content {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 400px;
    }

    .history-modal-content {
        max-height: 400px;
        overflow-y: auto;
    }

    .result-container {
        background: #f5f5f5;
        border: 1px solid #e8e8e8;
        border-radius: 4px;
        height: 300px;
        overflow: auto;
    }

    .format-result {
        height: 100%;
        overflow: auto;
    }

    .result-content {
        display: flex;
        height: 100%;
        font-family: 'Courier New', Courier, monospace;
        font-size: 13px;
        line-height: 1.4;
    }

    .line-numbers {
        background: #fafafa;
        border-right: 1px solid #e8e8e8;
        padding: 8px 8px 8px 12px;
        color: #999;
        user-select: none;
        min-width: 40px;
        text-align: right;
        flex-shrink: 0;
    }

    .line-number {
        height: 1.4em;
        line-height: 1.4;
    }

    .code-content {
        flex: 1;
        overflow: auto;
        padding: 8px;
    }

    .code-content pre {
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
    }

    .code-content code {
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        background: transparent;
        padding: 0;
        border: none;
    }

    .empty-result {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .empty-placeholder {
        color: #999;
        font-style: italic;
    }

    :deep(.ant-table-body) {
        height: 300px !important;
        overflow-y: auto !important;
    }

    /* 用户列表样式 */
    .user-list-modal-content {
        max-height: 400px;
        overflow-y: auto;
    }
</style>
