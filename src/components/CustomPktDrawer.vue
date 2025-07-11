<template>
    <a-drawer :title="title" placement="right" :open="visible" width="500" @close="onClose">
        <a-form layout="vertical">
            <a-form-item :label="inputLabel" :validate-status="validateStatus" :help="validateMessage">
                <a-textarea v-model:value="localInputValue" :rows="rows" :placeholder="placeholder" />
            </a-form-item>
        </a-form>
        <template #footer>
            <a-space>
                <a-button @click="onClose">取消</a-button>
                <a-button type="primary" @click="onSubmit">确定</a-button>
            </a-space>
        </template>
    </a-drawer>
</template>

<script setup>
    import { ref, watch } from 'vue';
    import { validatePacketData } from '../utils/validationCommon';

    const props = defineProps({
        visible: {
            type: Boolean,
            default: false
        },
        inputValue: {
            type: String,
            default: ''
        },
        title: {
            type: String,
            default: '报文输入'
        },
        inputLabel: {
            type: String,
            default: '报文内容'
        },
        rows: {
            type: Number,
            default: 8
        },
        numbersPerLine: {
            type: Number,
            default: 16
        },
        placeholder: {
            type: String,
            default: '请输入16进制数字, 用空格分隔, 例如: 11 22 33 44 55 66 77'
        }
    });

    const emit = defineEmits(['update:visible', 'update:inputValue', 'submit']);

    const localInputValue = ref(props.inputValue);

    watch(
        () => props.inputValue,
        newValue => {
            localInputValue.value = newValue;
        }
    );

    const validateStatus = ref('');
    const validateMessage = ref('');

    const onClose = () => {
        emit('update:visible', false);
        validateStatus.value = '';
        validateMessage.value = '';
    };

    const onSubmit = () => {
        const result = validatePacketData(localInputValue.value);
        validateStatus.value = result.status;
        validateMessage.value = result.message;

        if (result.status === 'success') {
            emit('update:inputValue', localInputValue.value);
            emit('submit', localInputValue.value);
            onClose();
        }
    };
</script>
