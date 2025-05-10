<template>
    <a-card title="字符串生成配置" class="string-generator-card">
        <a-form :model="formState" :label-col="labelCol" :wrapper-col="wrapperCol" @finish="handleFinish">
            <!-- 字符串模板输入 -->
            <a-form-item label="字符串模板" name="template">
                <a-tooltip :title="validationErrors.template" :open="!!validationErrors.template">
                    <ScrollTextarea
                        v-model:modelValue="formState.template"
                        :height="120"
                        :status="validationErrors.template ? 'error' : ''"
                        @blur="e => validateField(e.target.value, 'template', validateTemplate)"
                    />
                </a-tooltip>
            </a-form-item>

            <!-- 参数配置行 -->
            <a-row>
                <a-col :span="8">
                    <a-form-item label="占位符" name="placeholder">
                        <a-tooltip :title="validationErrors.placeholder" :open="!!validationErrors.placeholder">
                            <a-input
                                v-model:value="formState.placeholder"
                                :status="validationErrors.placeholder ? 'error' : ''"
                                @blur="e => validateField(e.target.value, 'placeholder', validatePlaceholder)"
                            />
                        </a-tooltip>
                    </a-form-item>
                </a-col>
                <a-col :span="8">
                    <a-form-item label="开始" name="start">
                        <a-tooltip :title="validationErrors.start" :open="!!validationErrors.start">
                            <a-input
                                v-model:value="formState.start"
                                :status="validationErrors.start ? 'error' : ''"
                                @blur="e => validateField(e.target.value, 'start', validateStart)"
                            />
                        </a-tooltip>
                    </a-form-item>
                </a-col>
                <a-col :span="8">
                    <a-form-item label="结束" name="end">
                        <a-tooltip :title="validationErrors.end" :open="!!validationErrors.end">
                            <a-input
                                v-model:value="formState.end"
                                :status="validationErrors.end ? 'error' : ''"
                                @blur="e => validateField(e.target.value, 'end', validateEnd)"
                            />
                        </a-tooltip>
                    </a-form-item>
                </a-col>
            </a-row>

            <!-- 操作按钮 -->
            <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                <a-space>
                    <a-button type="primary" html-type="submit">立即生成</a-button>
                    <a-button type="default" @click="showGenerateHistory">生成历史</a-button>
                </a-space>
            </a-form-item>

            <!-- 结果显示 -->
            <a-form-item label="生成结果">
                <ScrollTextarea v-model:modelValue="result" :height="400" />
            </a-form-item>
        </a-form>
    </a-card>

    <!-- 生成历史弹窗 -->
    <a-modal
        v-model:open="generateHistoryModalVisible"
        title="生成历史"
        width="700px"
        :mask-closable="false"
        @cancel="closeHistoryModal"
    >
        <div class="history-modal-content">
            <a-table
                :columns="historyColumns"
                :data-source="generateHistory"
                :pagination="{ pageSize: 5, showSizeChanger: false, position: ['bottomCenter'] }"
                :scroll="{ y: 200 }"
                size="small"
            >
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'action'">
                        <a-button type="link" @click="loadHistoryItem(record)">使用</a-button>
                    </template>
                    <template v-else-if="column.key === 'template'">
                        <div class="history-packet-data">{{ truncateString(record.template, 40) }}</div>
                    </template>
                </template>
            </a-table>
        </div>
        <template #footer>
            <a-button type="primary" @click="closeHistoryModal">关闭</a-button>
            <a-button v-if="generateHistory.length > 0" type="danger" @click="clearHistory">清空历史</a-button>
        </template>
    </a-modal>
</template>

<script setup>
    import ScrollTextarea from '../../components/ScrollTextarea.vue';
    import { ref, toRaw, onMounted } from 'vue';
    import { message } from 'ant-design-vue';
    import { validateTemplate, validatePlaceholder, validateStart, validateEnd } from '../../utils/toolsValidation';
    import { clearValidationErrors } from '../../utils/validationCommon';

    defineOptions({
        name: 'StringGenerator'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const validationErrors = ref({
        template: '',
        placeholder: '',
        start: '',
        end: ''
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            clearValidationErrors(validationErrors);
        }
    });

    const formState = ref({
        template: 'ip address 1.1.1.{A} 24',
        placeholder: '{A}',
        start: '1',
        end: '2'
    });

    const validateField = (value, field, validator) => {
        if (field === 'end') {
            return validator(value, formState.value.start, validationErrors);
        } else if (field === 'start') {
            return validator(value, formState.value.end, validationErrors);
        } else {
            return validator(value, validationErrors);
        }
    };

    const result = ref('');

    const handleFinish = async () => {
        try {
            // Validate all fields
            clearValidationErrors(validationErrors);
            validateField(formState.value.template, 'template', validateTemplate);
            validateField(formState.value.placeholder, 'placeholder', validatePlaceholder);
            validateField(formState.value.start, 'start', validateStart);
            validateField(formState.value.end, 'end', validateEnd);

            const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

            if (hasErrors) {
                message.error('请检查配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(toRaw(formState.value)));
            const resp = await window.toolsApi.generateString(payload);

            if (resp.status === 'success') {
                result.value = resp.data.join('\r\n');
            } else {
                message.error(resp.msg || '生成失败');
            }
        } catch (e) {
            message.error(e.message || String(e));
            console.error('生成错误:', e);
        }
    };

    onMounted(async () => {});

    // 历史记录相关状态
    const generateHistory = ref(false);
    const generateHistoryModalVisible = ref(false);
    const historyColumns = [
        {
            title: '字符串模板',
            dataIndex: 'template',
            key: 'template'
        },
        {
            title: '占位符',
            dataIndex: 'placeholder',
            key: 'placeholder'
        },
        {
            title: '开始',
            dataIndex: 'start',
            key: 'start'
        },
        {
            title: '结束',
            dataIndex: 'end',
            key: 'end'
        },
        {
            title: '操作',
            key: 'action'
        }
    ];

    const showGenerateHistory = async () => {
        try {
            const resp = await window.toolsApi.getGenerateStringHistory();
            if (resp.status === 'success') {
                generateHistory.value = resp.data || [];
                generateHistoryModalVisible.value = true;
            } else {
                message.error(resp.msg || '获取历史记录失败');
            }
        } catch (e) {
            message.error(e.message || String(e));
            console.error('获取历史记录错误:', e);
        }
    };

    // 关闭历史记录弹窗
    const closeHistoryModal = () => {
        generateHistoryModalVisible.value = false;
    };

    // 清空历史记录
    const clearHistory = async () => {
        const resp = await window.toolsApi.clearGenerateStringHistory();
        if (resp.status === 'success') {
            generateHistory.value = [];
        }
    };

    // 加载历史记录项
    const loadHistoryItem = record => {
        if (!record) return;

        // 更新表单数据
        formState.value = {
            template: record.template || '',
            placeholder: record.placeholder || '',
            start: record.start || '',
            end: record.end || ''
        };

        // 关闭弹窗
        closeHistoryModal();

        // 自动执行生成
        handleFinish();
    };

    // 截断显示内容
    const truncateString = (str, maxLength) => {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    };
</script>

<style scoped>
    .string-generator-card {
        margin-top: 10px;
        margin-left: 8px;
    }

    :deep(.ant-form-item) {
        margin-bottom: 10px;
    }

    :deep(.ant-card-body) {
        padding: 10px;
    }

    :deep(.ant-card-head) {
        padding: 0 10px;
        min-height: 40px;
    }

    :deep(.ant-card-head-title) {
        padding: 10px 0;
    }

    /* 历史记录样式 */
    .history-modal-content {
        max-height: 400px;
        overflow-y: auto;
    }

    .history-packet-data {
        font-family: monospace;
        word-break: break-all;
    }

    :deep(.ant-table-row) {
        cursor: pointer;
    }

    :deep(.ant-table-row:hover) {
        background-color: #f5f5f5;
    }

    :deep(.ant-table-tbody > tr > td) {
        height: 30px;
        padding-top: 8px;
        padding-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    :deep(.ant-table-body) {
        height: 200px !important;
        overflow-y: auto !important;
    }

    :deep(.ant-table-cell) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* 表格样式调整 */
    :deep(.ant-table-small) {
        font-size: 12px;
    }
</style>
