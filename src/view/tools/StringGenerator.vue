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
                <a-button type="primary" html-type="submit">立即生成</a-button>
            </a-form-item>

            <!-- 结果显示 -->
            <a-form-item label="生成结果">
                <ScrollTextarea v-model:modelValue="result" :height="400" />
            </a-form-item>
        </a-form>
    </a-card>
</template>

<script setup>
    import ScrollTextarea from '../../components/ScrollTextarea.vue';
    import { ref, toRaw, watch, onMounted } from 'vue';
    import { message } from 'ant-design-vue';
    import { debounce } from 'lodash-es';
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

    const mounted = ref(false);

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

    const saveDebounced = debounce(async data => {
        const resp = await window.toolsApi.saveGenerateStringConfig(data);
        if (resp.status !== 'success') {
            console.error(resp.msg);
        }
    }, 300);

    watch(
        formState,
        newValue => {
            // 只有在组件挂载后才保存数据
            if (!mounted.value) return;

            clearValidationErrors(validationErrors);
            validateField(newValue.template, 'template', validateTemplate);
            validateField(newValue.placeholder, 'placeholder', validatePlaceholder);
            validateField(newValue.start, 'start', validateStart);
            validateField(newValue.end, 'end', validateEnd);

            const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

            if (hasErrors) {
                return;
            }
            const raw = toRaw(newValue);
            saveDebounced(raw);
        },
        { deep: true }
    );

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

    onMounted(async () => {
        // 加载保存的配置
        const savedConfig = await window.toolsApi.loadGenerateStringConfig();
        if (savedConfig.status === 'success' && savedConfig.data) {
            formState.value = savedConfig.data;
        } else {
            console.error('配置文件加载失败', savedConfig.msg);
        }

        // 所有数据加载完成后，标记mounted为true，允许watch保存数据
        mounted.value = true;
    });
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
</style>
