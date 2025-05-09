<template>
    <div class="bmp-config-container">
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
                                            @blur="e => validateField(e.target.value, 'port', validatePort)"
                                        />
                                    </a-tooltip>
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
        <a-row style="margin-top: 10px">
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
    import { ref, onMounted, onBeforeUnmount, toRaw, watch } from 'vue';
    import { message } from 'ant-design-vue';
    import { validatePort } from '../../utils/bmpValidation';
    import { clearValidationErrors } from '../../utils/validationCommon';
    import { debounce } from 'lodash-es';
    import { DEFAULT_VALUES } from '../../const/bmpConst';
    defineOptions({
        name: 'BmpConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const bmpConfig = ref({
        port: DEFAULT_VALUES.DEFAULT_BMP_PORT
    });

    const serverLoading = ref(false);
    const serverRunning = ref(false);

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

    const saveDebounced = debounce(async data => {
        const result = await window.bmpApi.saveBmpConfig(data);
        if (result.status !== 'success') {
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
        bmpConfig,
        newBmpConfig => {
            if (!mounted.value) return;

            try {
                clearValidationErrors(validationErrors);
                validatePort(newBmpConfig.port, validationErrors);

                const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

                if (hasErrors) {
                    return;
                }

                const raw = toRaw(newBmpConfig);
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

    const startBmp = async () => {
        clearValidationErrors(validationErrors);
        validatePort(bmpConfig.value.port, validationErrors);
        const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

        if (hasErrors) {
            message.error('请检查配置信息是否正确');
            return;
        }

        serverLoading.value = true;
        try {
            const payload = JSON.parse(JSON.stringify(bmpConfig.value));
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
        // 加载保存的配置
        const savedConfig = await window.bmpApi.loadBmpConfig();
        if (savedConfig.status === 'success' && savedConfig.data) {
            bmpConfig.value.port = savedConfig.data.port;
        } else {
            console.error('配置文件加载失败', savedConfig.msg);
        }

        // 所有数据加载完成后，标记mounted为true，允许watch保存数据
        mounted.value = true;

        // 注册事件监听
        window.bmpApi.onInitiation(onInitiationHandler);
        window.bmpApi.onTermination(onTerminationHandler);
    });

    onBeforeUnmount(() => {
        window.bmpApi.offInitiation(onInitiationHandler);
        window.bmpApi.offTermination(onTerminationHandler);
    });
</script>

<style scoped>
    .bmp-config-container {
        margin-top: 10px;
        margin-left: 8px;
    }

    :deep(.ant-form-item) {
        margin-bottom: 8px;
    }

    .error-message {
        display: none;
    }

    :deep(.ant-input-status-error) {
        border-color: #ff4d4f;
    }

    :deep(.ant-input-status-error:hover) {
        border-color: #ff4d4f;
    }

    :deep(.ant-input-status-error:focus) {
        border-color: #ff4d4f;
        box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2);
    }

    :deep(.ant-tooltip) {
        z-index: 1000;
    }

    :deep(.ant-tooltip-inner) {
        background-color: #ff4d4f;
        color: white;
        border-radius: 4px;
        padding: 8px 12px;
        font-size: 12px;
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
