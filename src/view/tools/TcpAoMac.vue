<template>
    <div class="mt-container">
        <a-card title="TCP-AO MAC 计算器 (MD5)">
            <a-form :model="formState" :label-col="labelCol" :wrapper-col="wrapperCol" @finish="handleCalculate">
                <!-- Key -->
                <a-form-item label="密钥 (Key)" name="key">
                    <a-tooltip :title="validationErrors.key" :open="!!validationErrors.key">
                        <a-input
                            v-model:value="formState.key"
                            placeholder="请输入字符串密钥, 如: mypassword"
                            :status="validationErrors.key ? 'error' : ''"
                        />
                    </a-tooltip>
                </a-form-item>

                <!-- SNE -->
                <a-form-item label="SNE" name="sne">
                    <a-tooltip :title="validationErrors.sne" :open="!!validationErrors.sne">
                        <ScrollTextarea
                            v-model:model-value="formState.sne"
                            :height="60"
                            placeholder="请输入16进制格式的 SNE（4 字节）, 如: 00 00 00 00"
                            :status="validationErrors.sne ? 'error' : ''"
                        />
                    </a-tooltip>
                </a-form-item>

                <!-- 完整 IP 报文 -->
                <a-form-item label="IP 报文" name="ipPacket">
                    <a-tooltip :title="validationErrors.ipPacket" :open="!!validationErrors.ipPacket">
                        <ScrollTextarea
                            v-model:model-value="formState.ipPacket"
                            :height="120"
                            placeholder="请输入16进制格式的完整 IPv4 报文, 如: 45 00 00 3C 00 00 40 00 40 06 00 00 C0 A8 00 01 C0 A8 00 02 ..."
                            :status="validationErrors.ipPacket ? 'error' : ''"
                        />
                    </a-tooltip>
                    <div class="field-hint">
                        程序自动提取 IP 伪头部，并将 TCP 校验和字段清零（RFC 5925 §5.1），TCP-AO MAC 字段请手动填 0
                    </div>
                </a-form-item>

                <!-- 操作按钮 -->
                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                    <a-space>
                        <a-button type="primary" html-type="submit">计算 MAC</a-button>
                        <a-button type="default" @click="clearAll">清空</a-button>
                    </a-space>
                </a-form-item>

                <!-- 计算结果 -->
                <template v-if="result">
                    <a-divider>计算结果</a-divider>

                    <a-form-item label="IP 伪头部">
                        <a-input-group compact>
                            <a-input
                                :value="result.pseudoHeaderHex"
                                readonly
                                style="width: calc(100% - 80px); font-family: monospace"
                            />
                            <a-button @click="copyToClipboard(result.pseudoHeaderHex)">复制</a-button>
                        </a-input-group>
                        <div class="field-hint">源IP(4) + 目的IP(4) + 00 + 协议(1) + TCP段长度(2)</div>
                    </a-form-item>

                    <a-form-item label="MD5 消息">
                        <a-input-group compact>
                            <a-input
                                :value="result.messageHex"
                                readonly
                                style="width: calc(100% - 80px); font-family: monospace"
                            />
                            <a-button @click="copyToClipboard(result.messageHex)">复制</a-button>
                        </a-input-group>
                        <div class="field-hint">SNE + 伪头部 + TCP 段（参与 MD5 的完整消息）</div>
                    </a-form-item>

                    <a-form-item label="MD5 (128 bit)">
                        <a-input-group compact>
                            <a-input
                                :value="result.mac"
                                readonly
                                style="width: calc(100% - 80px); font-family: monospace"
                            />
                            <a-button @click="copyToClipboard(result.mac)">复制</a-button>
                        </a-input-group>
                    </a-form-item>

                    <a-form-item label="MAC-96 (96 bit)">
                        <a-input-group compact>
                            <a-input
                                :value="result.mac96"
                                readonly
                                style="width: calc(100% - 80px); font-family: monospace"
                            />
                            <a-button @click="copyToClipboard(result.mac96)">复制</a-button>
                        </a-input-group>
                        <div class="field-hint">TCP-AO 使用的 MAC 值（前 12 字节）</div>
                    </a-form-item>
                </template>
            </a-form>
        </a-card>
    </div>
</template>

<script setup>
    import ScrollTextarea from '../../components/ScrollTextarea.vue';
    import { ref } from 'vue';
    import { message } from 'ant-design-vue';

    defineOptions({
        name: 'TcpAoMac'
    });

    defineExpose({
        clearValidationErrors: () => {
            validationErrors.value = { key: '', sne: '', ipPacket: '' };
        }
    });

    const labelCol = { style: { width: '120px' } };
    const wrapperCol = { span: 40 };

    const validationErrors = ref({ key: '', sne: '', ipPacket: '' });
    const result = ref(null);

    const formState = ref({ key: '', sne: '', ipPacket: '' });

    const isValidHex = str => {
        const cleaned = str.replace(/\s+/g, '').replace(/:/g, '');
        return cleaned.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(cleaned);
    };

    const validate = () => {
        let hasError = false;
        validationErrors.value = { key: '', sne: '', ipPacket: '' };

        if (!formState.value.key.trim()) {
            validationErrors.value.key = '密钥不能为空';
            hasError = true;
        }

        if (!formState.value.sne.trim()) {
            validationErrors.value.sne = 'SNE 不能为空';
            hasError = true;
        } else if (!isValidHex(formState.value.sne)) {
            validationErrors.value.sne = '必须为合法的十六进制字符串';
            hasError = true;
        }

        if (!formState.value.ipPacket.trim()) {
            validationErrors.value.ipPacket = 'IP 报文不能为空';
            hasError = true;
        } else if (!isValidHex(formState.value.ipPacket)) {
            validationErrors.value.ipPacket = '必须为合法的十六进制字符串';
            hasError = true;
        }

        return hasError;
    };

    const handleCalculate = async () => {
        if (validate()) {
            message.error('请检查输入是否正确');
            return;
        }

        try {
            const resp = await window.toolsApi.calculateTcpAoMac({
                key: formState.value.key,
                sne: formState.value.sne,
                ipPacket: formState.value.ipPacket
            });

            if (resp.status === 'success') {
                result.value = resp.data;
                message.success('MAC 计算成功');
            } else {
                message.error(resp.msg || '计算失败');
                result.value = null;
            }
        } catch (e) {
            message.error(e.message || String(e));
            result.value = null;
        }
    };

    const clearAll = () => {
        formState.value = { key: '', sne: '', ipPacket: '' };
        validationErrors.value = { key: '', sne: '', ipPacket: '' };
        result.value = null;
    };

    const copyToClipboard = async text => {
        try {
            await navigator.clipboard.writeText(text);
            message.success('已复制到剪贴板');
        } catch (_e) {
            message.error('复制失败');
        }
    };
</script>

<style scoped>
    .field-hint {
        font-size: 12px;
        color: #888;
        margin-top: 4px;
    }
</style>
