<template>
    <a-drawer
        :title="title"
        placement="right"
        :visible="visible"
        @close="onClose"
        width="500"
    >
        <a-form layout="vertical">
            <a-form-item
                :label="inputLabel"
                :validate-status="validateStatus"
                :help="validateMessage"
            >
                <a-textarea
                    v-model:value="localInputValue"
                    :rows="rows"
                    :placeholder="placeholder"
                />
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
import { ref, defineProps, defineEmits, watch } from "vue";

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    inputValue: {
        type: String,
        default: "",
    },
    title: {
        type: String,
        default: "报文输入",
    },
    inputLabel: {
        type: String,
        default: "报文内容",
    },
    rows: {
        type: Number,
        default: 8,
    },
    numbersPerLine: {
        type: Number,
        default: 16,
    },
    placeholder: {
        type: String,
        default:
            "请输入16进制数字，每行16个数字，用空格分隔，需要携带0x前缀，例如：0x11 0x22 0x33 0x44 0x55 0x66 0x77",
    },
});

const emit = defineEmits(["update:visible", "update:inputValue", "submit"]);

const localInputValue = ref(props.inputValue);

watch(
    () => props.inputValue,
    (newValue) => {
        localInputValue.value = newValue;
    },
);

const validateStatus = ref("");
const validateMessage = ref("");

const validationRule = (value) => {
    const lines = value.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const numbers = line.split(/\s+/).filter((num) => num !== "");

        // 检查每行数字数量是否超过限制
        if (numbers.length > props.numbersPerLine) {
            return {
                status: "error",
                message: `第 ${i + 1} 行包含 ${numbers.length} 个数字，最多允许 ${props.numbersPerLine} 个数字`,
            };
        }

        // 检查每个数字的格式
        for (const num of numbers) {
            if (!/^(0x)[0-9A-Fa-f]{1,2}$/.test(num)) {
                return {
                    status: "error",
                    message: `第 ${i + 1} 行包含无效的16进制数字: "${num}"，请输入1-2位的16进制数字，需要携带0x前缀`,
                };
            }
        }
    }

    return {
        status: "success",
        message: "",
    };
};

const onClose = () => {
    emit("update:visible", false);
    validateStatus.value = "";
    validateMessage.value = "";
};

const onSubmit = () => {
    const result = validationRule(localInputValue.value);
    validateStatus.value = result.status;
    validateMessage.value = result.message;

    if (result.status === "success") {
        emit("update:inputValue", localInputValue.value);
        emit("submit", localInputValue.value);
        onClose();
    }
};
</script>
