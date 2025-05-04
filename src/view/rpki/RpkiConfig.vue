<template>
    <div class="rpki-config-container">
        <a-row>
            <a-col :span="24">
                <a-card title="RPKI服务器配置">
                    <a-form :model="rpkiConfig" @finish="startRpki" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="服务端端口" name="port">
                                    <a-tooltip :title="validationErrors.port" :open="!!validationErrors.port">
                                        <a-input
                                            v-model:value="rpkiConfig.port"
                                            @blur="e => validateField(e.target.value, 'port', validatePort)"
                                            :status="validationErrors.port ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                            <a-space>
                                <a-button type="primary" html-type="submit" :loading="serverLoading">
                                    {{ serverRunning ? '重启服务器' : '启动服务器' }}
                                </a-button>
                                <a-button type="primary" danger @click="stopRpki" :disabled="!serverRunning">
                                    停止服务器
                                </a-button>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- RPKI客户端列表 -->
        <a-row style="margin-top: 10px">
            <a-col :span="24">
                <a-card title="RPKI客户端列表">
                    <div>
                        <a-table
                            :columns="clientColumns"
                            :data-source="clientList"
                            :rowKey="
                                record =>
                                    `${record.remoteIp || ''}-${record.remotePort || ''}`
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
    import { ref, onMounted, onBeforeUnmount, toRaw, watch } from 'vue';
    import { message } from 'ant-design-vue';
    import { validatePort } from '../../utils/bmpValidation';
    import { clearValidationErrors } from '../../utils/validationCommon';
    import { debounce } from 'lodash-es';

    defineOptions({
        name: 'RpkiConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const rpkiConfig = ref({
        port: 8282 // RPKI默认端口
    });

    const serverLoading = ref(false);
    const serverRunning = ref(false);

    // 客户端列表
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
            title: '主机名',
            dataIndex: 'hostname',
            key: 'hostname',
            ellipsis: true
        },
        {
            title: '连接时间',
            dataIndex: 'connectedAt',
            key: 'connectedAt',
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

    const saveDebounced = debounce(async data => {
        const result = await window.rpkiApi.saveRpkiConfig(data);
        if (result.status === 'success') {
            console.log(result.msg);
        } else {
            console.error(result.msg || '配置文件保存失败');
        }
    }, 300);

    const validationErrors = ref({
        port: ''
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            clearValidationErrors(validationErrors);
        }
    });

    const validateField = (value, fieldName, validationFn) => {
        validationFn(value, validationErrors);
    };

    const mounted = ref(false);

    watch(
        rpkiConfig,
        newRpkiConfig => {
            if (!mounted.value) return;

            try {
                clearValidationErrors(validationErrors);
                validatePort(newRpkiConfig.port, validationErrors);

                const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

                if (hasErrors) {
                    console.log('Validation failed, configuration not saved');
                    return;
                }

                const raw = toRaw(newRpkiConfig);
                saveDebounced(raw);
            } catch (error) {
                console.error(error);
            }
        },
        { deep: true }
    );

    // Details drawer
    const detailsDrawerVisible = ref(false);
    const detailsDrawerTitle = ref('');
    const currentDetails = ref(null);

    const startRpki = async () => {
        clearValidationErrors(validationErrors);
        validatePort(rpkiConfig.value.port, validationErrors);
        const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

        if (hasErrors) {
            message.error('请检查配置信息是否正确');
            return;
        }

        serverLoading.value = true;
        try {
            const payload = JSON.parse(JSON.stringify(rpkiConfig.value));
            const result = await window.rpkiApi.startRpki(payload);
            if (result.status === 'success') {
                serverRunning.value = true;
                // 清空客户端列表
                clientList.value = [];
                message.success(`${result.msg}`);
            } else {
                message.error(result.msg || 'RPKI服务器启动失败');
            }
        } catch (error) {
            message.error(`RPKI服务器启动出错: ${error.message}`);
        } finally {
            serverLoading.value = false;
        }
    };

    const stopRpki = async () => {
        try {
            const result = await window.rpkiApi.stopRpki();
            if (result.status === 'success') {
                serverRunning.value = false;
                // 清空客户端列表
                clientList.value = [];
                message.success(`${result.msg}`);
            } else {
                message.error(result.msg || 'RPKI服务器停止失败');
            }
        } catch (error) {
            message.error(`RPKI服务器停止出错: ${error.message}`);
        }
    };

    const viewClientDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `RPKI客户端信息: ${record.remoteIp}:${record.remotePort}`;
        detailsDrawerVisible.value = true;
    };

    const closeDetailsDrawer = () => {
        detailsDrawerVisible.value = false;
        currentDetails.value = null;
    };

    // 定期获取客户端列表
    let clientListTimer = null;

    const fetchClientList = async () => {
        try {
            const result = await window.rpkiApi.getClientList();
            if (result.status === 'success') {
                clientList.value = result.data;
            }
        } catch (error) {
            console.error('获取客户端列表失败:', error);
        }
    };

    // 监听客户端连接事件
    const handleClientConnection = data => {
        if (data.status === 'success') {
            fetchClientList();
        }
    };

    onMounted(async () => {
        mounted.value = true;

        try {
            // 加载配置
            const result = await window.rpkiApi.loadRpkiConfig();
            if (result.status === 'success' && result.data) {
                rpkiConfig.value = result.data;
            }

            // 获取服务器状态
            const statusResult = await window.rpkiApi.getRpkiStatus();
            if (statusResult.status === 'success') {
                serverRunning.value = statusResult.data.running;
                if (serverRunning.value) {
                    fetchClientList();
                }
            }

            // 设置客户端列表定时器
            clientListTimer = setInterval(() => {
                if (serverRunning.value) {
                    fetchClientList();
                }
            }, 5000);

            // 注册客户端连接事件
            window.addEventListener('rpki:clientConnection', handleClientConnection);
        } catch (error) {
            console.error('初始化RPKI配置出错:', error);
        }
    });

    onBeforeUnmount(() => {
        if (clientListTimer) {
            clearInterval(clientListTimer);
        }
        window.removeEventListener('rpki:clientConnection', handleClientConnection);
    });
</script>

<style scoped>
    .rpki-config-container {
        padding: 16px;
    }
</style>
