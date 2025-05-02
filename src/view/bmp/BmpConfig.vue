<template>
    <div class="bmp-config-container">
        <a-row>
            <a-col :span="24">
                <a-card title="BMP服务器配置">
                    <a-form :model="bmpConfig" @finish="startBmpServer" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="服务端端口" name="port">
                                    <a-tooltip :title="validationErrors.port" :open="!!validationErrors.port">
                                        <a-input
                                            v-model:value="bmpConfig.port"
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
                                <a-button type="primary" danger @click="stopBmpServer" :disabled="!serverRunning">
                                    停止服务器
                                </a-button>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- BMP初始化信息 -->
        <a-row style="margin-top: 10px">
            <a-col :span="24">
                <a-card title="BMP初始化信息">
                    <div>
                        <a-table
                            :columns="initiationColumns"
                            :data-source="initiationList"
                            :rowKey="record => record.clientAddress + record.receivedAt"
                            :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                            :loading="initiationLoading"
                            :scroll="{ y: 200 }"
                            size="small"
                        >
                            <template #bodyCell="{ column, record }">
                                <template v-if="column.key === 'action'">
                                    <a-button type="link" @click="viewInitiationDetails(record)">详情</a-button>
                                </template>
                            </template>
                        </a-table>
                    </div>
                </a-card>
            </a-col>
        </a-row>

        <a-drawer
            v-model:visible="detailsDrawerVisible"
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
    import { DEFAULT_VALUES } from '../../const/bgpConst';
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
    const initiationList = ref([]);
    const initiationLoading = ref(false);
    const initiationColumns = [
        {
            title: '客户端',
            dataIndex: 'clientAddress',
            key: 'clientAddress',
            width: '150px',
            ellipsis: true
        },
        {
            title: '系统名称',
            dataIndex: 'sysName',
            key: 'sysName',
            width: '120px',
            ellipsis: true
        },
        {
            title: '接收时间',
            dataIndex: 'receivedAt',
            key: 'receivedAt',
            width: '150px',
            ellipsis: true
        },
        {
            title: '操作',
            key: 'action',
            width: '80px'
        }
    ];

    const saveDebounced = debounce(async data => {
        const result = await window.bmpApi.saveBmpConfig(data);
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
        bmpConfig,
        newBmpConfig => {
            if (!mounted.value) return;

            try {
                clearValidationErrors(validationErrors);
                validatePort(newBmpConfig.port, validationErrors);

                const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

                if (hasErrors) {
                    console.log('Validation failed, configuration not saved');
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

    const startBmpServer = async () => {
        const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

        if (hasErrors) {
            message.error('请检查配置信息是否正确');
            return;
        }

        serverLoading.value = true;
        try {
            const payload = JSON.parse(JSON.stringify(bmpConfig.value));
            const result = await window.bmpApi.startServer(payload);
            if (result.status === 'success') {
                serverRunning.value = true;
                message.success('BMP服务器启动成功');
            } else {
                message.error(result.msg || 'BMP服务器启动失败');
            }
        } catch (error) {
            message.error('BMP服务器启动出错');
        } finally {
            serverLoading.value = false;
        }
    };

    // Stop BMP server
    const stopBmpServer = async () => {
        try {
            const result = await window.bmpApi.stopServer();
            if (result.status === 'success') {
                serverRunning.value = false;
                message.success('BMP服务器已停止');
            } else {
                message.error(result.msg || 'BMP服务器停止失败');
            }
        } catch (error) {
            message.error('BMP服务器停止出错');
        }
    };

    // View initiation details
    const viewInitiationDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `BMP初始化信息: ${record.sysName || record.clientAddress}`;
        detailsDrawerVisible.value = true;
    };

    // Close details drawer
    const closeDetailsDrawer = () => {
        detailsDrawerVisible.value = false;
        currentDetails.value = null;
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
    });

    onBeforeUnmount(() => {
        window.bmpApi.removeAllListeners();
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
