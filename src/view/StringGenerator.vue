<template>
    <div class="container">
        <a-form :model="formState" @finish="handleFinish" :label-col="labelCol" :wrapper-col="wrapperCol">
            <a-divider>字符串生成配置</a-divider>
            <!-- 字符串模板输入 -->
            <a-form-item label="字符串模板" name="template">
                <a-tooltip :title="validationErrors.template" :open="!!validationErrors.template">
                    <ScrollTextarea
                        v-model:modelValue="formState.template"
                        :height="120"
                        @blur="e => validateField(e.target.value, 'template', validateTemplate)"
                        :status="validationErrors.template ? 'error' : ''"
                    />
                </a-tooltip>
            </a-form-item>

            <!-- 参数配置行 -->
            <a-row :gutter="20">
                <a-col :span="7">
                    <a-form-item label="占位符" name="placeholder">
                        <a-tooltip :title="validationErrors.placeholder" :open="!!validationErrors.placeholder">
                            <a-input
                                v-model:value="formState.placeholder"
                                @blur="e => validateField(e.target.value, 'placeholder', validatePlaceholder)"
                                :status="validationErrors.placeholder ? 'error' : ''"
                            />
                        </a-tooltip>
                    </a-form-item>
                </a-col>
                <a-col :span="7">
                    <a-form-item label="开始" name="start">
                        <a-tooltip :title="validationErrors.start" :open="!!validationErrors.start">
                            <a-input
                                v-model:value="formState.start"
                                @blur="e => validateField(e.target.value, 'start', validateStart)"
                                :status="validationErrors.start ? 'error' : ''"
                            />
                        </a-tooltip>
                    </a-form-item>
                </a-col>
                <a-col :span="7">
                    <a-form-item label="结束" name="end">
                        <a-tooltip :title="validationErrors.end" :open="!!validationErrors.end">
                            <a-input
                                v-model:value="formState.end"
                                @blur="e => validateField(e.target.value, 'end', validateEnd)"
                                :status="validationErrors.end ? 'error' : ''"
                            />
                        </a-tooltip>
                    </a-form-item>
                </a-col>
            </a-row>

            <!-- 操作按钮 -->
            <a-form-item :wrapper-col="{ offset: 12, span: 20 }">
                <a-button type="primary" html-type="submit">立即生成</a-button>
            </a-form-item>

            <!-- 结果显示 -->
            <a-form-item label="生成结果">
                <ScrollTextarea v-model:modelValue="result" :height="380" />
            </a-form-item>
        </a-form>
    </div>
</template>

<script setup>
    import ScrollTextarea from '../components/ScrollTextarea.vue';
    import { ref, toRaw, watch, onMounted } from 'vue';
    import { message } from 'ant-design-vue';
    import { debounce } from 'lodash-es';
    import {
        validateTemplate,
        validatePlaceholder,
        validateStart,
        validateEnd
    } from '../utils/stringGeneratorValidation';
    import { clearValidationErrors } from '../utils/validationCommon';

    defineOptions({
        name: 'StringGenerator'
    });

    const labelCol = { style: { width: '120px' } };
    const wrapperCol = { span: 21 };

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
        }
        return validator(value, validationErrors);
    };

    const saveDebounced = debounce(async data => {
        const resp = await window.stringGeneratorApi.saveStringGeneratorConfig(data);
        if (resp.status === 'success') {
            console.info('[StringGenerator] 配置文件保存成功');
        } else {
            console.error('[StringGenerator] 配置文件保存失败', resp.msg);
        }
    }, 300);

    watch(
        formState,
        newValue => {
            clearValidationErrors(validationErrors);
            validateField(newValue.template, 'template', validateTemplate);
            validateField(newValue.placeholder, 'placeholder', validatePlaceholder);
            validateField(newValue.start, 'start', validateStart);
            validateField(newValue.end, 'end', validateEnd);

            const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

            if (hasErrors) {
                console.log('Validation failed, configuration not saved');
                return;
            }
            const raw = toRaw(newValue);
            saveDebounced(raw);
        },
        { deep: true, immediate: true }
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
            const resp = await window.stringGeneratorApi.generateTemplateString(payload);

            console.log('[StringGenerator] handleFinish', resp);
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
        const savedConfig = await window.stringGeneratorApi.loadStringGeneratorConfig();
        if (savedConfig.status === 'success' && savedConfig.data) {
            console.log('Loading saved config:', savedConfig.data);
            formState.value = savedConfig.data;
        } else {
            console.error('[StringGenerator] 配置文件加载失败', savedConfig.msg);
        }
    });
</script>

<style scoped>
    :deep(.ant-divider) {
        margin: 10px 0;
        font-size: 16px;
        font-weight: 500;
        color: #1890ff;
    }
</style>
