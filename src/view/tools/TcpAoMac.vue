<template>
    <div class="mt-container">
        <a-row :gutter="12" class="tcpao-row">
            <!-- 左：MAC 计算器 -->
            <a-col :span="12">
                <a-card title="TCP-AO MAC 计算器" class="tcpao-card">
                    <a-form
                        :model="formState"
                        :label-col="labelCol"
                        :wrapper-col="wrapperCol"
                        @finish="handleCalculate"
                    >
                        <a-form-item label="密钥 (Key)" name="key">
                            <a-tooltip :title="validationErrors.key" :open="!!validationErrors.key">
                                <a-input
                                    v-model:value="formState.key"
                                    placeholder="如: mypassword"
                                    :status="validationErrors.key ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>

                        <a-form-item label="SNE（可选）" name="sne">
                            <a-tooltip :title="validationErrors.sne" :open="!!validationErrors.sne">
                                <ScrollTextarea
                                    v-model:model-value="formState.sne"
                                    :height="52"
                                    placeholder="SNE（4字节hex），留空则不含"
                                    :status="validationErrors.sne ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>

                        <a-form-item label="IP 报文" name="ipPacket">
                            <a-tooltip :title="validationErrors.ipPacket" :open="!!validationErrors.ipPacket">
                                <ScrollTextarea
                                    v-model:model-value="formState.ipPacket"
                                    :height="100"
                                    placeholder="完整 IPv4 报文（hex）"
                                    :status="validationErrors.ipPacket ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>

                        <a-form-item label="MAC 算法">
                            <a-radio-group v-model:value="algorithm">
                                <a-space direction="vertical" :size="2">
                                    <a-radio value="hmac-md5">HMAC-MD5</a-radio>
                                    <a-radio value="hmac-sha1">HMAC-SHA1-12</a-radio>
                                    <a-radio value="hmac-sha1-20">HMAC-SHA1-20</a-radio>
                                    <a-radio value="hmac-sha256">HMAC-SHA-256</a-radio>
                                    <a-radio value="aes-cmac">AES-128-CMAC</a-radio>
                                    <a-radio value="md5">MD5</a-radio>
                                    <a-radio value="sha1">SHA-1</a-radio>
                                    <a-radio value="sha256">SHA-256</a-radio>
                                    <a-radio value="sm3">SM3</a-radio>
                                </a-space>
                            </a-radio-group>
                        </a-form-item>

                        <a-form-item v-if="isHmacAlgo" label=" " :colon="false">
                            <a-checkbox v-model:checked="skipKdf">跳过 KDF（直接用 master key）</a-checkbox>
                        </a-form-item>

                        <a-form-item label="TCP 选项">
                            <a-space direction="vertical" :size="2">
                                <a-checkbox v-model:checked="includeOtherOptions">包含其他 TCP 选项</a-checkbox>
                                <a-checkbox v-model:checked="zeroFullAoOption">TCP-AO option 整体清零</a-checkbox>
                                <a-checkbox v-model:checked="includePseudoHeader">包含 IP 伪头部</a-checkbox>
                            </a-space>
                        </a-form-item>

                        <a-form-item v-if="isPlainAlgo" label="key 位置">
                            <a-radio-group v-model:value="keyPos">
                                <a-space direction="vertical" :size="2">
                                    <a-radio value="end">hash(msg ‖ key)</a-radio>
                                    <a-radio value="start">hash(key ‖ msg)</a-radio>
                                    <a-radio value="both">hash(key ‖ msg ‖ key)</a-radio>
                                </a-space>
                            </a-radio-group>
                        </a-form-item>

                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-space>
                                <a-button type="primary" html-type="submit">计算 MAC</a-button>
                                <a-button @click="clearAll">清空</a-button>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>

            <!-- 右：反推 -->
            <a-col :span="12">
                <a-card title="反推消息构造" class="tcpao-card">
                    <a-form :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-form-item label="密钥 (Key)">
                            <a-tooltip :title="findValidationErrors.key" :open="!!findValidationErrors.key">
                                <a-input
                                    v-model:value="findState.key"
                                    placeholder="与计算器相同的密钥"
                                    :status="findValidationErrors.key ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                        <a-form-item label="IP 报文">
                            <a-tooltip :title="findValidationErrors.ipPacket" :open="!!findValidationErrors.ipPacket">
                                <ScrollTextarea
                                    v-model:model-value="findState.ipPacket"
                                    :height="100"
                                    placeholder="完整 IPv4 报文（hex）"
                                    :status="findValidationErrors.ipPacket ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                        <a-form-item label="已知 MAC-96">
                            <a-tooltip
                                :title="findValidationErrors.knownMac96"
                                :open="!!findValidationErrors.knownMac96"
                            >
                                <a-input
                                    v-model:value="findState.knownMac96"
                                    placeholder="如: 0a59bd1be2d330de4c7c584b"
                                    style="font-family: monospace"
                                    :status="findValidationErrors.knownMac96 ? 'error' : ''"
                                />
                            </a-tooltip>
                            <div class="field-hint">穷举全部算法 × 消息构造组合（含 SM3 视 OpenSSL 支持情况）</div>
                        </a-form-item>
                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-button type="primary" :loading="finding" @click="handleFind">开始反推</a-button>
                        </a-form-item>

                        <template v-if="findResult !== null">
                            <a-divider>反推结果</a-divider>
                            <a-alert v-if="findResult.length === 0" type="warning" message="未找到匹配组合" show-icon />
                            <template v-else>
                                <a-alert
                                    type="success"
                                    :message="`找到 ${findResult.length} 个匹配组合`"
                                    show-icon
                                    style="margin-bottom: 8px"
                                />
                                <a-collapse size="small">
                                    <a-collapse-panel
                                        v-for="(m, i) in findResult"
                                        :key="i"
                                        :header="`#${i + 1} ${m.algo} | ${m.sne} | ${m.pseudo} | ${m.checksum} | ${m.zero} | ${m.options}`"
                                    >
                                        <p>
                                            <b>消息体：</b>
                                            <span
                                                style="font-family: monospace; word-break: break-all; font-size: 11px"
                                            >
                                                {{ m.messageHex }}
                                            </span>
                                        </p>
                                        <p>
                                            <b>完整 MAC：</b>
                                            <span style="font-family: monospace">{{ m.mac }}</span>
                                        </p>
                                    </a-collapse-panel>
                                </a-collapse>
                            </template>
                        </template>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- 计算结果弹出框 -->
        <a-modal v-model:open="showResultModal" title="MAC 计算结果" :footer="null" width="680px">
            <template v-if="result">
                <a-descriptions :column="1" bordered size="small">
                    <a-descriptions-item label="IP 伪头部">
                        <div class="result-row">
                            <span style="font-family: monospace; word-break: break-all">
                                {{ result.pseudoHeaderHex }}
                            </span>
                            <a-button size="small" @click="copyToClipboard(result.pseudoHeaderHex)">复制</a-button>
                        </div>
                        <div class="field-hint">源IP(4) + 目的IP(4) + 00 + 协议(1) + TCP段长度(2)</div>
                    </a-descriptions-item>
                    <a-descriptions-item
                        v-if="result.trafficKeyHex !== undefined && result.trafficKeyHex !== null"
                        label="Traffic Key"
                    >
                        <div class="result-row">
                            <span style="font-family: monospace; word-break: break-all">
                                {{ result.trafficKeyHex }}
                            </span>
                            <a-button size="small" @click="copyToClipboard(result.trafficKeyHex)">复制</a-button>
                        </div>
                        <div class="field-hint">KDF 派生的 Traffic Key</div>
                    </a-descriptions-item>
                    <a-descriptions-item label="消息体">
                        <div class="result-row">
                            <span style="font-family: monospace; word-break: break-all">{{ result.messageHex }}</span>
                            <a-button size="small" @click="copyToClipboard(result.messageHex)">复制</a-button>
                        </div>
                        <div class="field-hint">SNE（可选） + 伪头部（可选） + TCP 段</div>
                    </a-descriptions-item>
                    <a-descriptions-item label="MAC（完整）">
                        <div class="result-row">
                            <span style="font-family: monospace">{{ result.mac }}</span>
                            <a-button size="small" @click="copyToClipboard(result.mac)">复制</a-button>
                        </div>
                    </a-descriptions-item>
                    <a-descriptions-item :label="`MAC（前${result.macLen}字节）`">
                        <div class="result-row">
                            <span style="font-family: monospace">{{ result.mac96 }}</span>
                            <a-button size="small" @click="copyToClipboard(result.mac96)">复制</a-button>
                        </div>
                        <div class="field-hint">TCP-AO 报文字段中实际填入的 MAC 值</div>
                    </a-descriptions-item>
                </a-descriptions>
            </template>
        </a-modal>
    </div>
</template>

<script setup>
    import ScrollTextarea from '../../components/ScrollTextarea.vue';
    import { ref, computed, onMounted } from 'vue';
    import { message } from 'ant-design-vue';
    import {
        FormValidator,
        createTcpAoMacValidationRules,
        createTcpAoMacFindValidationRules
    } from '../../utils/validationCommon';

    defineOptions({
        name: 'TcpAoMac'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 24 };

    const validationErrors = ref({ key: '', sne: '', ipPacket: '' });
    const validator = new FormValidator(validationErrors);
    validator.addRules(createTcpAoMacValidationRules());

    const findValidationErrors = ref({ key: '', ipPacket: '', knownMac96: '' });
    const findValidator = new FormValidator(findValidationErrors);
    findValidator.addRules(createTcpAoMacFindValidationRules());

    defineExpose({
        clearValidationErrors: () => {
            validator.clearErrors();
            findValidator.clearErrors();
        }
    });
    const result = ref(null);
    const showResultModal = ref(false);
    const formState = ref({ key: '', sne: '', ipPacket: '' });
    const findState = ref({ key: '', ipPacket: '', knownMac96: '' });
    const includeOtherOptions = ref(true);
    const algorithm = ref('hmac-sha1');
    const skipKdf = ref(false);
    const keyPos = ref('end');

    const PLAIN_ALGOS = ['md5', 'sha1', 'sha256', 'sm3'];
    const HMAC_ALGOS = ['hmac-sha1', 'hmac-sha1-20', 'hmac-md5', 'hmac-sha256', 'aes-cmac'];
    const isPlainAlgo = computed(() => PLAIN_ALGOS.includes(algorithm.value));
    const isHmacAlgo = computed(() => HMAC_ALGOS.includes(algorithm.value));
    const zeroFullAoOption = ref(false);
    const includePseudoHeader = ref(true);

    const saveState = () => {
        window.toolsApi.saveTcpAoMacState({
            formState: { ...formState.value },
            algorithm: algorithm.value,
            skipKdf: skipKdf.value,
            keyPos: keyPos.value,
            includeOtherOptions: includeOtherOptions.value,
            zeroFullAoOption: zeroFullAoOption.value,
            includePseudoHeader: includePseudoHeader.value,
            findState: { ...findState.value }
        });
    };

    onMounted(async () => {
        const resp = await window.toolsApi.getTcpAoMacState();
        if (resp.status === 'success' && resp.data) {
            const s = resp.data;
            if (s.formState) formState.value = s.formState;
            if (s.algorithm) algorithm.value = s.algorithm;
            if (s.skipKdf !== undefined) skipKdf.value = s.skipKdf;
            if (s.keyPos) keyPos.value = s.keyPos;
            if (s.includeOtherOptions !== undefined) includeOtherOptions.value = s.includeOtherOptions;
            if (s.zeroFullAoOption !== undefined) zeroFullAoOption.value = s.zeroFullAoOption;
            if (s.includePseudoHeader !== undefined) includePseudoHeader.value = s.includePseudoHeader;
            if (s.findState) findState.value = s.findState;
        }
    });

    const handleCalculate = async () => {
        if (validator.validate(formState.value)) {
            message.error('请检查输入是否正确');
            return;
        }

        try {
            const resp = await window.toolsApi.calculateTcpAoMac({
                key: formState.value.key,
                sne: formState.value.sne,
                ipPacket: formState.value.ipPacket,
                includeOtherOptions: includeOtherOptions.value,
                algorithm: algorithm.value,
                skipKdf: skipKdf.value,
                keyPos: keyPos.value,
                zeroFullAoOption: zeroFullAoOption.value,
                includePseudoHeader: includePseudoHeader.value
            });

            if (resp.status === 'success') {
                result.value = resp.data;
                showResultModal.value = true;
                saveState();
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
        validator.clearErrors();
        includeOtherOptions.value = true;
        algorithm.value = 'hmac-sha1';
        skipKdf.value = false;
        keyPos.value = 'end';
        zeroFullAoOption.value = false;
        includePseudoHeader.value = true;
        result.value = null;
        showResultModal.value = false;
    };

    const findResult = ref(null);
    const finding = ref(false);

    const handleFind = async () => {
        if (findValidator.validate(findState.value)) {
            message.error('请检查输入是否正确');
            return;
        }
        finding.value = true;
        findResult.value = null;
        try {
            const resp = await window.toolsApi.findTcpAoMacVariant({
                key: findState.value.key,
                ipPacket: findState.value.ipPacket,
                knownMac96: findState.value.knownMac96
            });
            if (resp.status === 'success') {
                findResult.value = resp.data.matches;
                if (resp.data.matches.length > 0) message.success(resp.msg);
                else message.warning('未找到匹配组合');
                saveState();
            } else {
                message.error(resp.msg || '反推失败');
            }
        } catch (e) {
            message.error(e.message || String(e));
        } finally {
            finding.value = false;
        }
    };

    const copyToClipboard = text => {
        try {
            const el = document.createElement('textarea');
            el.value = text;
            el.style.position = 'fixed';
            el.style.opacity = '0';
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            message.success('已复制到剪贴板');
        } catch (_e) {
            message.error('复制失败');
        }
    };
</script>

<style scoped>
    .tcpao-row {
        align-items: flex-start;
    }

    .tcpao-card {
        height: 100%;
    }

    .field-hint {
        font-size: 12px;
        color: #888;
        margin-top: 4px;
    }

    .result-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
    }

    .algo-group-label {
        font-size: 11px;
        color: #aaa;
        margin-top: 4px;
    }
</style>
