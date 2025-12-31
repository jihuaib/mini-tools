<template>
    <div class="mt-container">
        <a-row>
            <a-col :span="24">
                <a-card title="BMP服务器配置">
                    <a-form :model="bmpConfig" :label-col="labelCol" :wrapper-col="wrapperCol" @finish="startBmp">
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="服务端端口" name="port">
                                    <a-tooltip :title="validationErrors.port" :open="!!validationErrors.port">
                                        <a-input
                                            v-model:value="bmpConfig.port"
                                            :status="validationErrors.port ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="启用MD5认证" name="enableAuth">
                                    <a-checkbox v-model:checked="bmpConfig.enableAuth" />
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row v-if="bmpConfig.enableAuth">
                            <a-col :span="24">
                                <a-form-item label="本地监听端口" name="localPort">
                                    <a-tooltip :title="validationErrors.localPort" :open="!!validationErrors.localPort">
                                        <a-input
                                            v-model:value="bmpConfig.localPort"
                                            placeholder="Windows本地BMP服务器端口 (默认: 11019)"
                                            :status="validationErrors.localPort ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row v-if="bmpConfig.enableAuth">
                            <a-col :span="8">
                                <a-form-item label="Linux服务器地址" name="grpcServerAddress">
                                    <a-tooltip
                                        :title="validationErrors.grpcServerAddress"
                                        :open="!!validationErrors.grpcServerAddress"
                                    >
                                        <a-input
                                            v-model:value="bmpConfig.grpcServerAddress"
                                            placeholder="例如: 192.168.1.100:50051"
                                            :status="validationErrors.grpcServerAddress ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="SSH用户名" name="sshUsername">
                                    <a-tooltip
                                        :title="validationErrors.sshUsername"
                                        :open="!!validationErrors.sshUsername"
                                    >
                                        <a-input
                                            v-model:value="bmpConfig.sshUsername"
                                            placeholder="Linux服务器SSH用户名"
                                            :status="validationErrors.sshUsername ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="SSH密码" name="sshPassword">
                                    <a-tooltip
                                        :title="validationErrors.sshPassword"
                                        :open="!!validationErrors.sshPassword"
                                    >
                                        <a-input-password
                                            v-model:value="bmpConfig.sshPassword"
                                            placeholder="Linux服务器SSH密码"
                                            :status="validationErrors.sshPassword ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row v-if="bmpConfig.enableAuth">
                            <a-col :span="24">
                                <a-form-item label="目标BMP主机" name="targetHost">
                                    <a-tooltip
                                        :title="validationErrors.targetHost"
                                        :open="!!validationErrors.targetHost"
                                    >
                                        <a-input
                                            v-model:value="bmpConfig.targetHost"
                                            placeholder="BMP路由器IP地址"
                                            :status="validationErrors.targetHost ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row v-if="bmpConfig.enableAuth">
                            <a-col :span="24">
                                <a-form-item label="MD5密钥" name="md5Password">
                                    <a-tooltip
                                        :title="validationErrors.md5Password"
                                        :open="!!validationErrors.md5Password"
                                    >
                                        <a-input-password
                                            v-model:value="bmpConfig.md5Password"
                                            placeholder="MD5认证密钥"
                                            :status="validationErrors.md5Password ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row v-if="bmpConfig.enableAuth">
                            <a-col :span="12">
                                <a-form-item label="隧道端口" name="tunnelPort">
                                    <a-tooltip
                                        :title="validationErrors.tunnelPort"
                                        :open="!!validationErrors.tunnelPort"
                                    >
                                        <a-input
                                            v-model:value="bmpConfig.tunnelPort"
                                            placeholder="SSH反向隧道端口 (默认: 11020)"
                                            :status="validationErrors.tunnelPort ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row v-if="bmpConfig.enableAuth">
                            <a-col :span="24">
                                <a-form-item label="隧道端口" name="tunnelPort">
                                    <a-tooltip
                                        :title="validationErrors.tunnelPort"
                                        :open="!!validationErrors.tunnelPort"
                                    >
                                        <a-input
                                            v-model:value="bmpConfig.tunnelPort"
                                            placeholder="SSH反向隧道端口 (默认: 11020)"
                                            :status="validationErrors.tunnelPort ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row v-if="bmpConfig.enableAuth">
                            <a-col :span="24">
                                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                                    <a-button type="default" :loading="deployLoading" @click="deployToServer">
                                        部署到Linux服务器
                                    </a-button>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                            <a-space>
                                <a-button
                                    type="primary"
                                    html-type="submit"
                                    :loading="serverLoading"
                                    :disabled="serverRunning"
                                >
                                    启动服务器
                                </a-button>
                                <a-button type="primary" danger :disabled="!serverRunning" @click="stopBmp">
                                    停止服务器
                                </a-button>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- BMP客户端列表 -->
        <a-row class="mt-margin-top-10">
            <a-col :span="24">
                <a-card title="BMP客户端列表">
                    <div>
                        <a-table
                            :columns="clientColumns"
                            :data-source="clientList"
                            :row-key="
                                record =>
                                    `${record.localIp || ''}-${record.localPort || ''}-${record.remoteIp || ''}-${record.remotePort || ''}`
                            "
                            :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                            :scroll="{ y: 200 }"
                            size="small"
                        >
                            <template #bodyCell="{ column, record }">
                                <template v-if="column.key === 'action'">
                                    <a-button type="link" @click="viewClientDetails(record)">详情</a-button>
                                </template>
                            </template>
                        </a-table>
                    </div>
                </a-card>
            </a-col>
        </a-row>

        <a-drawer
            v-model:open="detailsDrawerVisible"
            :title="detailsDrawerTitle"
            placement="right"
            width="500px"
            @close="closeDetailsDrawer"
        >
            <pre v-if="currentDetails">{{ JSON.stringify(currentDetails, null, 2) }}</pre>
        </a-drawer>
    </div>
</template>

<script setup>
    import { ref, onMounted, onBeforeUnmount } from 'vue';
    import { message } from 'ant-design-vue';
    import { FormValidator, createBmpConfigValidationRules } from '../../utils/validationCommon';
    import { DEFAULT_VALUES, BMP_EVENT_PAGE_ID } from '../../const/bmpConst';
    import EventBus from '../../utils/eventBus';
    defineOptions({
        name: 'BmpConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const bmpConfig = ref({
        port: DEFAULT_VALUES.DEFAULT_BMP_PORT,
        localPort: '11019',
        enableAuth: false,
        grpcServerAddress: '',
        targetHost: '',
        md5Password: '',
        sshUsername: '',
        sshPassword: '',
        tunnelPort: '11020'
    });

    const serverLoading = ref(false);
    const serverRunning = ref(false);
    const deployLoading = ref(false);

    // Initiation messages list
    const clientList = ref([]);
    const clientColumns = [
        {
            title: '客户端IP',
            dataIndex: 'remoteIp',
            key: 'remoteIp',
            ellipsis: true
        },
        {
            title: '客户端端口',
            dataIndex: 'remotePort',
            key: 'remotePort',
            ellipsis: true
        },
        {
            title: '系统名称',
            dataIndex: 'sysName',
            key: 'sysName',
            ellipsis: true
        },
        {
            title: '系统描述',
            dataIndex: 'sysDesc',
            key: 'sysDesc',
            ellipsis: true
        },
        {
            title: '接收时间',
            dataIndex: 'receivedAt',
            key: 'receivedAt',
            ellipsis: true,
            customRender: ({ text }) => {
                if (!text) return '';
                const date = new Date(text);
                return date.toLocaleString();
            }
        },
        {
            title: '操作',
            key: 'action'
        }
    ];

    const validationErrors = ref({
        port: '',
        grpcServerAddress: '',
        targetHost: '',
        md5Password: '',
        sshUsername: '',
        sshPassword: ''
    });

    let validator = new FormValidator(validationErrors);
    validator.addRules(createBmpConfigValidationRules());

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            if (validator) {
                validator.clearErrors();
            }
        }
    });

    // Details drawer
    const detailsDrawerVisible = ref(false);
    const detailsDrawerTitle = ref('');
    const currentDetails = ref(null);

    const startBmp = async () => {
        const hasErrors = validator.validate(bmpConfig.value);
        if (hasErrors) {
            message.error('请检查配置信息是否正确');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(bmpConfig.value));
            const saveResult = await window.bmpApi.saveBmpConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            serverLoading.value = true;

            const result = await window.bmpApi.startBmp(payload);
            if (result.status === 'success') {
                serverRunning.value = true;
                // Clear the client list when starting the server
                clientList.value = [];
                message.success(`${result.msg}`);
            } else {
                message.error(result.msg || 'BMP服务器启动失败');
            }
        } catch (error) {
            message.error(`BMP服务器启动出错: ${error.message}`);
        } finally {
            serverLoading.value = false;
        }
    };

    const stopBmp = async () => {
        try {
            const result = await window.bmpApi.stopBmp();
            if (result.status === 'success') {
                serverRunning.value = false;
                clientList.value = [];
                message.success(`${result.msg}`);
            } else {
                message.error(result.msg || 'BMP服务器停止失败');
            }
        } catch (error) {
            message.error(`BMP服务器停止出错: ${error.message}`);
        }
    };

    const deployToServer = async () => {
        // 验证SSH凭据
        if (!bmpConfig.value.sshUsername || !bmpConfig.value.sshPassword) {
            message.error('请输入SSH用户名和密码');
            return;
        }

        if (!bmpConfig.value.grpcServerAddress) {
            message.error('请输入Linux服务器地址');
            return;
        }

        try {
            deployLoading.value = true;
            message.info('正在连接到Linux服务器...');

            const deployConfig = {
                serverAddress: bmpConfig.value.grpcServerAddress.split(':')[0], // 提取主机地址
                sshUsername: bmpConfig.value.sshUsername,
                sshPassword: bmpConfig.value.sshPassword
            };

            const result = await window.bmpApi.deployGrpcServer(deployConfig);

            if (result.status === 'success') {
                message.success('gRPC服务器部署成功！');
            } else {
                message.error(result.msg || 'gRPC服务器部署失败');
            }
        } catch (error) {
            message.error(`部署出错: ${error.message}`);
        } finally {
            deployLoading.value = false;
        }
    };

    const viewClientDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `BMP客户端信息: ${record.remoteIp}:${record.remotePort}`;
        detailsDrawerVisible.value = true;
    };

    const closeDetailsDrawer = () => {
        detailsDrawerVisible.value = false;
        currentDetails.value = null;
    };

    const onInitiationHandler = result => {
        const data = result.data;
        if (result.status === 'success') {
            // 存在则更新，否则添加
            const existingIndex = clientList.value.findIndex(
                client =>
                    `${client.localIp || ''}-${client.localPort || ''}-${client.remoteIp || ''}-${client.remotePort || ''}` ===
                    `${data.localIp || ''}-${data.localPort || ''}-${data.remoteIp || ''}-${data.remotePort || ''}`
            );
            if (existingIndex !== -1) {
                clientList.value[existingIndex] = data;
            } else {
                clientList.value.push(data);
            }
        } else {
            console.error('initiation handler error', data.msg);
        }
    };

    const onTerminationHandler = result => {
        if (result && result.data) {
            const data = result.data;
            if (result.status === 'success') {
                const existingIndex = clientList.value.findIndex(
                    client =>
                        `${client.localIp || ''}-${client.localPort || ''}-${client.remoteIp || ''}-${client.remotePort || ''}` ===
                        `${data.localIp || ''}-${data.localPort || ''}-${data.remoteIp || ''}-${data.remotePort || ''}`
                );
                if (existingIndex !== -1) {
                    clientList.value.splice(existingIndex, 1);
                }
            } else {
                console.error('termination handler error', data.msg);
            }
        } else {
            clientList.value = [];
        }
    };

    onMounted(async () => {
        // 注册事件监听 (必须同步注册以防 async 竞争导致泄露)
        EventBus.on('bmp:initiation', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_CONFIG, onInitiationHandler);
        EventBus.on('bmp:termination', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_CONFIG, onTerminationHandler);

        // 加载保存的配置
        const savedConfig = await window.bmpApi.loadBmpConfig();
        if (savedConfig.status === 'success' && savedConfig.data) {
            bmpConfig.value.port = savedConfig.data.port || DEFAULT_VALUES.DEFAULT_BMP_PORT;
            bmpConfig.value.enableAuth = savedConfig.data.enableAuth || false;
            bmpConfig.value.grpcServerAddress = savedConfig.data.grpcServerAddress || '';
            bmpConfig.value.targetHost = savedConfig.data.targetHost || '';
            bmpConfig.value.md5Password = savedConfig.data.md5Password || '';
            bmpConfig.value.sshUsername = savedConfig.data.sshUsername || '';
            bmpConfig.value.sshPassword = savedConfig.data.sshPassword || '';
        } else {
            console.error('配置文件加载失败', savedConfig.msg);
        }
    });

    onBeforeUnmount(() => {
        EventBus.off('bmp:initiation', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_CONFIG);
        EventBus.off('bmp:termination', BMP_EVENT_PAGE_ID.PAGE_ID_BMP_CONFIG);
    });
</script>

<style scoped>
    :deep(.ant-table-body) {
        height: 200px !important;
        overflow-y: auto !important;
    }
</style>
