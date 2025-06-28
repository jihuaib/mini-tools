<template>
    <div class="mt-container">
        <a-card title="SNMP Trap 服务器配置">
            <a-form
                ref="formRef"
                :model="formData"
                :rules="rules"
                layout="vertical"
                @finish="handleSubmit"
                @finish-failed="handleFinishFailed"
            >
                <a-row :gutter="24">
                    <a-col :span="12">
                        <a-form-item label="监听端口" name="port">
                            <a-input-number
                                v-model:value="formData.port"
                                :min="1"
                                :max="65535"
                                style="width: 100%"
                                placeholder="请输入监听端口"
                            />
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="最大Trap历史记录" name="maxTrapHistory">
                            <a-input-number
                                v-model:value="formData.maxTrapHistory"
                                :min="100"
                                :max="10000"
                                style="width: 100%"
                                placeholder="请输入最大历史记录数"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row :gutter="24">
                    <a-col :span="12">
                        <a-form-item label="支持的SNMP版本" name="supportedVersions">
                            <a-checkbox-group v-model:value="formData.supportedVersions">
                                <a-checkbox value="v1">SNMPv1</a-checkbox>
                                <a-checkbox value="v2c">SNMPv2c</a-checkbox>
                                <a-checkbox value="v3">SNMPv3</a-checkbox>
                            </a-checkbox-group>
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="自动刷新间隔(秒)" name="refreshInterval">
                            <a-input-number
                                v-model:value="formData.refreshInterval"
                                :min="1"
                                :max="60"
                                style="width: 100%"
                                placeholder="请输入刷新间隔"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>

                <!-- SNMPv1/v2c 配置 -->
                <a-card
                    v-if="formData.supportedVersions.includes('v1') || formData.supportedVersions.includes('v2c')"
                    title="SNMPv1/v2c 配置"
                    size="small"
                    class="nested-card"
                >
                    <a-form-item label="Community 字符串" name="community">
                        <a-input v-model:value="formData.community" placeholder="请输入Community字符串" allow-clear />
                    </a-form-item>
                </a-card>

                <!-- SNMPv3 配置 -->
                <a-card
                    v-if="formData.supportedVersions.includes('v3')"
                    title="SNMPv3 配置"
                    size="small"
                    class="nested-card"
                >
                    <a-form-item label="用户名" name="v3Username">
                        <a-input v-model:value="formData.v3Username" placeholder="请输入SNMPv3用户名" allow-clear />
                    </a-form-item>

                    <a-form-item label="安全级别" name="securityLevel">
                        <a-radio-group v-model:value="formData.securityLevel">
                            <a-radio value="noAuthNoPriv">无认证无加密</a-radio>
                            <a-radio value="authNoPriv">认证无加密</a-radio>
                            <a-radio value="authPriv">认证加密</a-radio>
                        </a-radio-group>
                    </a-form-item>

                    <div v-if="formData.securityLevel !== 'noAuthNoPriv'">
                        <a-row :gutter="16">
                            <a-col :span="12">
                                <a-form-item label="认证协议" name="authProtocol">
                                    <a-select v-model:value="formData.authProtocol" placeholder="请选择认证协议">
                                        <a-select-option value="MD5">MD5</a-select-option>
                                        <a-select-option value="SHA">SHA</a-select-option>
                                        <a-select-option value="SHA224">SHA224</a-select-option>
                                        <a-select-option value="SHA256">SHA256</a-select-option>
                                        <a-select-option value="SHA384">SHA384</a-select-option>
                                        <a-select-option value="SHA512">SHA512</a-select-option>
                                    </a-select>
                                </a-form-item>
                            </a-col>
                            <a-col :span="12">
                                <a-form-item label="认证密码" name="authPassword">
                                    <a-input-password
                                        v-model:value="formData.authPassword"
                                        placeholder="请输入认证密码"
                                        allow-clear
                                    />
                                </a-form-item>
                            </a-col>
                        </a-row>
                    </div>

                    <div v-if="formData.securityLevel === 'authPriv'">
                        <a-row :gutter="16">
                            <a-col :span="12">
                                <a-form-item label="加密协议" name="privProtocol">
                                    <a-select v-model:value="formData.privProtocol" placeholder="请选择加密协议">
                                        <a-select-option value="DES">DES</a-select-option>
                                        <a-select-option value="AES">AES</a-select-option>
                                        <a-select-option value="AES192">AES192</a-select-option>
                                        <a-select-option value="AES256">AES256</a-select-option>
                                    </a-select>
                                </a-form-item>
                            </a-col>
                            <a-col :span="12">
                                <a-form-item label="加密密码" name="privPassword">
                                    <a-input-password
                                        v-model:value="formData.privPassword"
                                        placeholder="请输入加密密码"
                                        allow-clear
                                    />
                                </a-form-item>
                            </a-col>
                        </a-row>
                    </div>
                </a-card>

                <a-form-item>
                    <a-space>
                        <a-button type="primary" html-type="submit" :loading="saveLoading">保存配置</a-button>
                        <a-button @click="loadConfig">重新加载</a-button>
                        <a-button
                            :type="isServerRunning ? 'danger' : 'primary'"
                            :loading="serverLoading"
                            @click="toggleServer"
                        >
                            {{ isServerRunning ? '停止服务' : '启动服务' }}
                        </a-button>
                    </a-space>
                </a-form-item>
            </a-form>
        </a-card>

        <!-- 服务状态 -->
        <a-card title="服务状态" class="status-card">
            <a-descriptions :column="2" bordered>
                <a-descriptions-item label="服务状态">
                    <a-tag :color="isServerRunning ? 'green' : 'red'">
                        {{ isServerRunning ? '运行中' : '已停止' }}
                    </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="监听端口">
                    {{ formData.port }}
                </a-descriptions-item>
                <a-descriptions-item label="支持版本">
                    <a-space>
                        <a-tag v-for="version in formData.supportedVersions" :key="version" color="blue">
                            {{ version.toUpperCase() }}
                        </a-tag>
                    </a-space>
                </a-descriptions-item>
                <a-descriptions-item label="接收到的Trap数量">
                    {{ trapCount }}
                </a-descriptions-item>
            </a-descriptions>
        </a-card>
    </div>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { message } from 'ant-design-vue';
    import { DEFAULT_VALUES, SNMP_SECURITY_LEVEL } from '../../const/snmpConst';

    defineOptions({ name: 'SnmpConfig' });

    const formRef = ref();
    const saveLoading = ref(false);
    const serverLoading = ref(false);
    const isServerRunning = ref(false);
    const trapCount = ref(0);

    const formData = ref({
        port: DEFAULT_VALUES.DEFAULT_SNMP_PORT,
        maxTrapHistory: 1000,
        supportedVersions: ['v2c'],
        refreshInterval: 5,
        community: DEFAULT_VALUES.DEFAULT_COMMUNITY,
        v3Username: '',
        securityLevel: SNMP_SECURITY_LEVEL.NO_AUTH_NO_PRIV,
        authProtocol: 'SHA',
        authPassword: '',
        privProtocol: 'AES',
        privPassword: ''
    });

    const rules = {
        port: [
            { required: true, message: '请输入监听端口' },
            { type: 'number', min: 1, max: 65535, message: '端口范围1-65535' }
        ],
        maxTrapHistory: [
            { required: true, message: '请输入最大历史记录数' },
            { type: 'number', min: 100, max: 10000, message: '历史记录数范围100-10000' }
        ],
        supportedVersions: [{ required: true, message: '请至少选择一个SNMP版本' }],
        refreshInterval: [
            { required: true, message: '请输入刷新间隔' },
            { type: 'number', min: 1, max: 60, message: '刷新间隔范围1-60秒' }
        ],
        community: [
            {
                validator: (rule, value) => {
                    if (
                        (formData.value.supportedVersions.includes('v1') || formData.value.supportedVersions.includes('v2c')) &&
                        !value
                    ) {
                        return Promise.reject('请输入Community字符串');
                    }
                    return Promise.resolve();
                }
            }
        ],
        v3Username: [
            {
                validator: (rule, value) => {
                    if (formData.value.supportedVersions.includes('v3') && !value) {
                        return Promise.reject('请输入SNMPv3用户名');
                    }
                    return Promise.resolve();
                }
            }
        ],
        authPassword: [
            {
                validator: (rule, value) => {
                    if (formData.value.securityLevel !== 'noAuthNoPriv' && (!value || value.length < 8)) {
                        return Promise.reject('认证密码至少8位');
                    }
                    return Promise.resolve();
                }
            }
        ],
        privPassword: [
            {
                validator: (rule, value) => {
                    if (formData.value.securityLevel === 'authPriv' && (!value || value.length < 8)) {
                        return Promise.reject('加密密码至少8位');
                    }
                    return Promise.resolve();
                }
            }
        ]
    };

    const handleSubmit = async () => {
        try {
            saveLoading.value = true;
            const payload = JSON.parse(JSON.stringify(formData.value));
            const result = await window.snmpApi.saveSnmpConfig(payload);
            if (result.status === 'success') {
                message.success('配置保存成功');
            } else {
                message.error(result.msg || '配置保存失败');
            }
        } catch (error) {
            message.error('配置保存失败: ' + error.message);
        } finally {
            saveLoading.value = false;
        }
    };

    const handleFinishFailed = errors => {
        console.log('表单验证失败:', errors);
    };

    const loadConfig = async () => {
        try {
            const result = await window.snmpApi.getSnmpConfig();
            if (result.status === 'success' && result.data) {
                Object.assign(formData, result.data);
            }
        } catch (error) {
            message.error('加载配置失败: ' + error.message);
        }
    };

    const toggleServer = async () => {
        try {
            serverLoading.value = true;
            let result;
            const payload = JSON.parse(JSON.stringify(formData.value));
            if (isServerRunning.value) {
                result = await window.snmpApi.stopSnmp();
            } else {
                result = await window.snmpApi.startSnmp(payload);
            }

            if (result.status === 'success') {
                isServerRunning.value = !isServerRunning.value;
                message.success(result.msg);
            } else {
                message.error(result.msg || '操作失败');
            }
        } catch (error) {
            message.error('操作失败: ' + error.message);
        } finally {
            serverLoading.value = false;
        }
    };

    const checkServerStatus = async () => {
        try {
            const result = await window.snmpApi.getServerStatus();
            if (result.status === 'success') {
                isServerRunning.value = result.data.running;
                trapCount.value = result.data.trapCount || 0;
            }
        } catch (error) {
            console.error('获取服务状态失败:', error);
        }
    };

    defineExpose({
        clearValidationErrors: () => {
            formRef.value?.clearValidate();
        }
    });

    onMounted(() => {
        loadConfig();
        checkServerStatus();
    });
</script>

<style scoped></style>
