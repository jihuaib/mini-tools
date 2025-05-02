<template>
    <div class="bmp-container">
        <!-- 已连接的BGP Peer -->
        <a-row>
            <a-col :span="24">
                <a-card title="已连接的BGP Peer" class="data-card">
                    <div>
                        <a-table
                            :columns="peerColumns"
                            :data-source="peerList"
                            :rowKey="record => record.peerIp"
                            :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                            :loading="peerLoading"
                            :scroll="{ y: 200 }"
                            size="small"
                        >
                            <template #bodyCell="{ column, record }">
                                <template v-if="column.key === 'action'">
                                    <a-button type="link" @click="viewPeerDetails(record)">详情</a-button>
                                </template>
                                <template v-if="column.key === 'status'">
                                    <a-tag :color="record.status === 'connected' ? 'green' : 'red'">
                                        {{ record.status === 'connected' ? '已连接' : '已断开' }}
                                    </a-tag>
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
        name: 'BmpPeer'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const bmpConfig = ref({
        port: DEFAULT_VALUES.DEFAULT_BMP_PORT
    });

    const serverLoading = ref(false);
    const serverRunning = ref(false);

    // Peer list
    const peerList = ref([]);
    const peerLoading = ref(false);
    const peerColumns = [
        {
            title: 'Peer IP',
            dataIndex: 'peerIp',
            key: 'peerIp',
            width: '150px',
            ellipsis: true
        },
        {
            title: 'AS',
            dataIndex: 'peerAs',
            key: 'peerAs',
            width: '100px',
            ellipsis: true
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: '100px',
            ellipsis: true
        },
        {
            title: '操作',
            key: 'action',
            width: '100px'
        }
    ];

    // Route lists
    const ipv4RouteList = ref([]);
    const ipv6RouteList = ref([]);
    const routeLoading = ref(false);
    const activeTabKey = ref('ipv4');
    const routeColumns = [
        {
            title: '网络前缀',
            dataIndex: 'prefix',
            key: 'prefix',
            width: '150px',
            ellipsis: true
        },
        {
            title: '掩码',
            dataIndex: 'mask',
            key: 'mask',
            width: '80px',
            ellipsis: true
        },
        {
            title: '下一跳',
            dataIndex: 'nextHop',
            key: 'nextHop',
            width: '150px',
            ellipsis: true
        },
        {
            title: '操作',
            key: 'action',
            width: '100px'
        }
    ];

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

    const saveConfig = {
        networkValue: '',
        port: ''
    };

    const saveDebounced = debounce(async data => {
        const result = await window.bmpApi.saveConfig(data);
        if (result.status === 'success') {
            if (result.msg !== '') {
                message.success(result.msg);
            }
        } else {
            message.error(result.msg || '配置文件保存失败');
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

    watch(
        [bmpConfig],
        async ([newBmpConfig]) => {
            // 转换为saveBgpConfig
            saveConfig.networkValue = networkValue.value;
            saveConfig.port = newBmpConfig.port;

            try {
                clearValidationErrors(validationErrors);
                validatePort(newBmpConfig.port, validationErrors);

                const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

                if (hasErrors) {
                    console.log('Validation failed, configuration not saved');
                    return;
                }

                const raw = toRaw(saveConfig);
                saveDebounced(raw);
            } catch (error) {
                console.error(error);
            }
        },
        { deep: true, immediate: true }
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

    // View peer details
    const viewPeerDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `Peer 详情: ${record.peerIp}`;
        detailsDrawerVisible.value = true;
    };

    // View route details
    const viewRouteDetails = record => {
        currentDetails.value = record;
        detailsDrawerTitle.value = `路由详情: ${record.prefix}/${record.mask}`;
        detailsDrawerVisible.value = true;
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

    // Listen for BMP updates
    onMounted(async () => {
        const result = await window.bmpApi.getNetworkInfo();
        if (result.status === 'success') {
            for (const [name, addresses] of Object.entries(result.data)) {
                addresses.forEach(addr => {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        networkList.push({
                            name: name,
                            ip: addr.address
                        });
                    }
                });
            }

            // 默认选中第一个
            if (networkList.length > 0) {
                for (let i = 0; i < networkList.length; i++) {
                    networkInfo.value.push({
                        value: networkList[i].name
                    });
                }
                networkValue.value = networkInfo.value[0].value;
                handleNetworkChange(networkValue.value);
            }
        } else {
            console.error(result.msg);
        }

        try {
            const result = await window.bmpApi.getServerStatus();
            if (result.status === 'success' && result.data) {
                serverRunning.value = result.data.running;
                if (serverRunning.value) {
                    bmpConfig.value.port = result.data.port;
                }
            }
        } catch (error) {
            console.error(error);
        }

        // Setup event listeners
        window.bmpApi.onPeerUpdate((event, data) => {
            console.log('收到Peer列表更新', data);
            peerList.value = data;
        });

        window.bmpApi.onRouteUpdate((event, data) => {
            if (data.type === 'ipv4') {
                ipv4RouteList.value = data.routes;
            } else if (data.type === 'ipv6') {
                ipv6RouteList.value = data.routes;
            }
        });

        window.bmpApi.onInitiationReceived((event, data) => {
            console.log('收到BMP初始化消息', data);
            // Add to the list, keeping the most recent first
            initiationList.value = [data, ...initiationList.value];
        });

        // Initial load of peers and routes
        loadPeersAndRoutes();

        // 加载保存的配置
        const savedConfig = await window.bmpApi.loadConfig();
        if (savedConfig.status === 'success' && savedConfig.data) {
            console.log('Loading saved config:', savedConfig.data);
            networkValue.value = savedConfig.data.networkValue;
            handleNetworkChange(networkValue.value);
            bmpConfig.value.port = savedConfig.data.port;
        } else {
            console.error('[BmpEmulator] 配置文件加载失败', savedConfig.msg);
        }
    });

    // Clean up event listeners
    onBeforeUnmount(() => {
        window.bmpApi.removeAllListeners();
    });

    // Load peers and routes
    const loadPeersAndRoutes = async () => {
        if (!serverRunning.value) return;

        peerLoading.value = true;
        routeLoading.value = true;

        try {
            const peerResult = await window.bmpApi.getPeers();
            if (peerResult.status === 'success') {
                peerList.value = peerResult.data || [];
            }

            const ipv4RoutesResult = await window.bmpApi.getRoutes('ipv4');
            if (ipv4RoutesResult.status === 'success') {
                ipv4RouteList.value = ipv4RoutesResult.data || [];
            }

            const ipv6RoutesResult = await window.bmpApi.getRoutes('ipv6');
            if (ipv6RoutesResult.status === 'success') {
                ipv6RouteList.value = ipv6RoutesResult.data || [];
            }
        } catch (error) {
            console.error(error);
            message.error('加载数据失败');
        } finally {
            peerLoading.value = false;
            routeLoading.value = false;
        }
    };
</script>

<style scoped>
    .bmp-container {
        padding: 10px;
    }

    .data-card {
        width: 100%;
        height: 100%;
    }

    /* Make form items more compact */
    :deep(.ant-form-item) {
        margin-bottom: 12px;
    }

    /* Fixed height table rows with ellipsis */
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
</style>
