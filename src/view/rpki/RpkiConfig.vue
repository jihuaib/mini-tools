<template>
    <div class="mt-container">
        <a-row>
            <a-col :span="24">
                <a-card title="RPKI服务器配置">
                    <a-form :model="rpkiConfig" :label-col="labelCol" :wrapper-col="wrapperCol" @finish="startRpki">
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="服务端端口" name="port">
                                    <a-tooltip :title="validationErrors.port" :open="!!validationErrors.port">
                                        <a-input
                                            v-model:value="rpkiConfig.port"
                                            :status="validationErrors.port ? 'error' : ''"
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
                                <a-button type="primary" danger :disabled="!serverRunning" @click="stopRpki">
                                    停止服务器
                                </a-button>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- RPKI客户端列表 -->
        <a-row class="mt-margin-top-10">
            <a-col :span="24">
                <a-card title="RPKI客户端列表">
                    <div>
                        <a-table
                            :columns="clientColumns"
                            :data-source="clientList"
                            :row-key="
                                record =>
                                    `${record.localIp}|${record.localPort}|${record.remoteIp}|${record.remotePort}`
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
    import { FormValidator, createRpkiConfigValidationRules } from '../../utils/validationCommon';
    import { DEFAULT_VALUES } from '../../const/rpkiConst';

    defineOptions({
        name: 'RpkiConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const rpkiConfig = ref({
        port: DEFAULT_VALUES.DEFAULT_RPKI_PORT
    });

    const serverLoading = ref(false);
    const serverRunning = ref(false);

    // 客户端列表
    const clientList = ref([]);
    const clientColumns = [
        {
            title: '本地IP',
            dataIndex: 'localIp',
            key: 'localIp',
            ellipsis: true
        },
        {
            title: '本地端口',
            dataIndex: 'localPort',
            key: 'localPort',
            ellipsis: true
        },
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
            title: '操作',
            key: 'action'
        }
    ];

    const validationErrors = ref({
        port: ''
    });

    let validator = new FormValidator(validationErrors);
    validator.addRules(createRpkiConfigValidationRules());

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

    const startRpki = async () => {
        const hasErrors = validator.validate(rpkiConfig.value);
        if (hasErrors) {
            message.error('请检查配置信息是否正确');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(rpkiConfig.value));
            const saveResult = await window.rpkiApi.saveRpkiConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            serverLoading.value = true;

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

    const onClientConnection = result => {
        if (result.status === 'success') {
            const data = result.data;
            if (data.opType === 'add') {
                clientList.value.push(data.data);
            } else if (data.opType === 'delete') {
                const index = clientList.value.findIndex(
                    item =>
                        item.localIp === data.data.localIp &&
                        item.localPort === data.data.localPort &&
                        item.remoteIp === data.data.remoteIp &&
                        item.remotePort === data.data.remotePort
                );
                if (index !== -1) {
                    clientList.value.splice(index, 1);
                }
            }
        } else {
            message.error(result.msg || '获取客户端列表失败');
        }
    };

    onMounted(async () => {
        try {
            // 加载配置
            const result = await window.rpkiApi.loadRpkiConfig();
            if (result.status === 'success' && result.data) {
                rpkiConfig.value = result.data;
            }
        } catch (error) {
            console.error('初始化RPKI配置出错:', error);
        }

        window.rpkiApi.onClientConnection(onClientConnection);
    });

    onBeforeUnmount(() => {
        window.rpkiApi.offClientConnection(onClientConnection);
    });
</script>

<style scoped>
    :deep(.ant-table-body) {
        height: 200px !important;
        overflow-y: auto !important;
    }
</style>
