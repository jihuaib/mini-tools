<template>
    <div class="bgp-config-container">
        <a-form :model="bgpConfigData" @finish="startBgp" :label-col="labelCol" :wrapper-col="wrapperCol">
            <a-card title="BGP配置">
                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Local AS" name="localAs">
                            <a-tooltip
                                :title="bgpConfigvalidationErrors.localAs"
                                :open="!!bgpConfigvalidationErrors.localAs"
                            >
                                <a-input
                                    v-model:value="bgpConfigData.localAs"
                                    @blur="e => validateBgpConfigField(e.target.value, 'localAs', validateLocalAs)"
                                    :status="bgpConfigvalidationErrors.localAs ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="Router ID" name="routerId">
                            <a-tooltip
                                :title="bgpConfigvalidationErrors.routerId"
                                :open="!!bgpConfigvalidationErrors.routerId"
                            >
                                <a-input
                                    v-model:value="bgpConfigData.routerId"
                                    @blur="e => validateBgpConfigField(e.target.value, 'routerId', validateRouterId)"
                                    :status="bgpConfigvalidationErrors.routerId ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                    <a-space size="middle">
                        <a-button type="primary" html-type="submit" :loading="bgpLoading">启动BGP</a-button>
                        <a-button type="primary" danger @click="stopBgp" :disabled="!bgpRunning">停止BGP</a-button>
                    </a-space>
                </a-form-item>
            </a-card>
        </a-form>

        <a-form :model="peerConfigData" @finish="configPeer" :label-col="labelCol" :wrapper-col="wrapperCol">
            <a-card title="邻居配置" class="route-config-card">
                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Peer IP" name="peerIp">
                            <a-tooltip
                                :title="peerConfigvalidationErrors.peerIp"
                                :open="!!peerConfigvalidationErrors.peerIp"
                            >
                                <a-input
                                    v-model:value="peerConfigData.peerIp"
                                    @blur="e => validatePeerConfigField(e.target.value, 'peerIp', validatePeerIp)"
                                    :status="peerConfigvalidationErrors.peerIp ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="Peer AS" name="peerAs">
                            <a-tooltip
                                :title="peerConfigvalidationErrors.peerAs"
                                :open="!!peerConfigvalidationErrors.peerAs"
                            >
                                <a-input
                                    v-model:value="peerConfigData.peerAs"
                                    @blur="e => validatePeerConfigField(e.target.value, 'peerAs', validatePeerAs)"
                                    :status="peerConfigvalidationErrors.peerAs ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Hold Time" name="holdTime">
                            <a-tooltip
                                :title="peerConfigvalidationErrors.holdTime"
                                :open="!!peerConfigvalidationErrors.holdTime"
                            >
                                <a-input
                                    v-model:value="peerConfigData.holdTime"
                                    @blur="e => validatePeerConfigField(e.target.value, 'holdTime', validateHoldTime)"
                                    :status="peerConfigvalidationErrors.holdTime ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row>
                    <a-col :span="24">
                        <a-form-item label="Open Cap" name="openCap">
                            <a-space>
                                <a-checkbox-group v-model:value="peerConfigData.openCap" :options="openCapOptions" />
                                <a-button type="link" @click="showCustomOpenCap" class="custom-route-btn">
                                    <template #icon><SettingOutlined /></template>
                                    配置自定义能力
                                </a-button>
                            </a-space>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Addr Family" name="addressFamily">
                            <a-select
                                v-model:value="peerConfigData.addressFamily"
                                mode="multiple"
                                style="width: 100%"
                                :options="addressFamilyOptions"
                            />
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="Role" name="role">
                            <a-select
                                v-model:value="peerConfigData.role"
                                style="width: 100%"
                                :options="roleOptions"
                                :disabled="!peerConfigData.openCap.includes(BGP_CAPABILITY.ROLE)"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>
                <a-row>
                    <a-col :span="24">
                        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                            <a-space size="middle">
                                <a-button type="primary" html-type="submit" :disabled="!bgpRunning">配置邻居</a-button>
                            </a-space>
                        </a-form-item>
                    </a-col>
                </a-row>
            </a-card>
        </a-form>

        <a-row>
            <a-col :span="24">
                <a-card title="邻居信息" class="route-config-card">
                    <div>
                        <a-tabs v-model:activeKey="activePeerInfoTabKey">
                            <a-tab-pane key="ipv4-unc-peer" tab="IPv4-UNC邻居">
                                <a-table
                                    :columns="PeerInfoColumns"
                                    :data-source="ipv4UncPeerList"
                                    :rowKey="
                                        record =>
                                            `${record.vrfIndex || ''}-${record.peerIp || ''}-${record.addressFamily || ''}`
                                    "
                                    :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                    :scroll="{ y: 200 }"
                                    size="small"
                                >
                                    <template #bodyCell="{ column, record }">
                                        <template v-if="column.key === 'action'">
                                            <a-button type="link" @click="viewRouteDetails(record)">详情</a-button>
                                        </template>
                                    </template>
                                </a-table>
                            </a-tab-pane>
                            <a-tab-pane key="ipv6-unc-peer" tab="IPv6-UNC邻居">
                                <a-table
                                    :columns="PeerInfoColumns"
                                    :data-source="ipv6UncPeerList"
                                    :rowKey="
                                        record =>
                                            `${record.vrfIndex || ''}-${record.peerIp || ''}-${record.addressFamily || ''}`
                                    "
                                    :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                    :scroll="{ y: 200 }"
                                    size="small"
                                >
                                    <template #bodyCell="{ column, record }">
                                        <template v-if="column.key === 'action'">
                                            <a-button type="link" @click="viewRouteDetails(record)">详情</a-button>
                                        </template>
                                    </template>
                                </a-table>
                            </a-tab-pane>
                        </a-tabs>
                    </div>
                </a-card>
            </a-col>
        </a-row>

        <CustomPktDrawer
            v-model:visible="customOpenCapVisible"
            v-model:inputValue="peerConfigData.openCapCustom"
            @submit="handleCustomOpenCapSubmit"
        />
    </div>
</template>

<script setup>
    import { onMounted, ref, toRaw, watch } from 'vue';
    import CustomPktDrawer from '../../components/CustomPktDrawer.vue';
    import { message } from 'ant-design-vue';
    import { debounce } from 'lodash-es';
    import { SettingOutlined } from '@ant-design/icons-vue';
    import { BGP_CAPABILITY, BGP_ROLE, ADDRESS_FAMILY, DEFAULT_VALUES, IP_TYPE } from '../../const/bgpConst';
    import {
        validateLocalAs,
        validatePeerIp,
        validatePeerAs,
        validateRouterId,
        validateHoldTime
    } from '../../utils/bgpSimulatorValidation';
    import { clearValidationErrors } from '../../utils/validationCommon';

    defineOptions({
        name: 'BgpConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const openCapOptions = [
        { label: 'Addr Family', value: BGP_CAPABILITY.ADDR_FAMILY, disabled: true },
        { label: 'Route-Refresh', value: BGP_CAPABILITY.ROUTE_REFRESH },
        { label: 'AS4', value: BGP_CAPABILITY.AS4 },
        { label: 'Role', value: BGP_CAPABILITY.ROLE }
    ];

    const roleOptions = [
        { label: 'Provider', value: BGP_ROLE.PROVIDER },
        { label: 'RS', value: BGP_ROLE.RS },
        { label: 'RS-Client', value: BGP_ROLE.RS_CLIENT },
        { label: 'Customer', value: BGP_ROLE.CUSTOMER },
        { label: 'Lateral Peer', value: BGP_ROLE.LATERAL_PEER }
    ];

    const addressFamilyOptions = [
        { label: 'Ipv4-UNC', value: ADDRESS_FAMILY.IPV4_UNC, disabled: true },
        { label: 'Ipv6-UNC', value: ADDRESS_FAMILY.IPV6_UNC }
    ];

    const bgpConfigData = ref({
        localAs: DEFAULT_VALUES.LOCAL_AS,
        routerId: DEFAULT_VALUES.ROUTER_ID
    });

    const peerConfigData = ref({
        peerIp: DEFAULT_VALUES.PEER_IP,
        peerAs: DEFAULT_VALUES.PEER_AS,
        holdTime: DEFAULT_VALUES.HOLD_TIME,
        openCap: DEFAULT_VALUES.DEFAULT_OPEN_CAP,
        addressFamily: DEFAULT_VALUES.DEFAULT_ADDRESS_FAMILY,
        role: '',
        openCapCustom: ''
    });

    const ipv4UncPeerList = ref([]);
    const ipv6UncPeerList = ref([]);
    const activePeerInfoTabKey = ref('ipv4-unc-peer');
    const PeerInfoColumns = [
        {
            title: 'Local IP',
            dataIndex: 'localIp',
            ellipsis: true
        },
        {
            title: 'Local AS',
            dataIndex: 'localAs',
            ellipsis: true
        },
        {
            title: 'Peer IP',
            dataIndex: 'peerIp',
            key: 'peerIp',
            ellipsis: true
        },
        {
            title: 'Peer AS',
            dataIndex: 'peerAs',
            ellipsis: true
        },
        {
            title: 'Router ID',
            dataIndex: 'routerId',
            ellipsis: true
        },
        {
            title: 'Peer State',
            dataIndex: 'peerState',
            ellipsis: true
        },
        {
            title: '操作',
            key: 'action'
        }
    ];

    const saveBgpConfig = debounce(async data => {
        const result = await window.bgpApi.saveBgpConfig(data);
        if (result.status === 'success') {
            console.info(result.msg);
        } else {
            console.error(result.msg);
        }
    }, 300);

    const savePeerConfig = debounce(async data => {
        const result = await window.bgpApi.savePeerConfig(data);
        if (result.status === 'success') {
            console.info(result.msg);
        } else {
            console.error(result.msg);
        }
    }, 300);

    const bgpConfigvalidationErrors = ref({
        localAs: '',
        routerId: ''
    });

    const peerConfigvalidationErrors = ref({
        peerIp: '',
        peerAs: '',
        holdTime: ''
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            clearValidationErrors(bgpConfigvalidationErrors);
            clearValidationErrors(peerConfigvalidationErrors);
        }
    });

    const validateBgpConfigField = (value, fieldName, validationFn) => {
        validationFn(value, bgpConfigvalidationErrors);
    };

    const validatePeerConfigField = (value, fieldName, validationFn) => {
        validationFn(value, peerConfigvalidationErrors);
    };

    const bgpLoading = ref(false);
    const bgpRunning = ref(false);

    watch(
        bgpConfigData,
        newValue => {
            clearValidationErrors(bgpConfigvalidationErrors);
            validateLocalAs(newValue.localAs, bgpConfigvalidationErrors);
            validateRouterId(newValue.routerId, bgpConfigvalidationErrors);

            const hasErrors = Object.values(bgpConfigvalidationErrors.value).some(error => error !== '');
            if (hasErrors) {
                console.log('Validation failed, configuration not saved');
                return;
            }

            const raw = toRaw(newValue);
            saveBgpConfig(raw);
        },
        { deep: true, immediate: true }
    );

    watch(
        peerConfigData,
        newValue => {
            clearValidationErrors(peerConfigvalidationErrors);
            validatePeerIp(newValue.peerIp, peerConfigvalidationErrors);
            validatePeerAs(newValue.peerAs, peerConfigvalidationErrors);
            validateHoldTime(newValue.holdTime, peerConfigvalidationErrors);

            const hasErrors = Object.values(peerConfigvalidationErrors.value).some(error => error !== '');
            if (hasErrors) {
                console.log('Validation failed, configuration not saved');
                return;
            }

            const raw = toRaw(newValue);
            savePeerConfig(raw);
        },
        { deep: true, immediate: true }
    );

    onMounted(async () => {
        window.bgpApi.onPeerChange(data => {
            if (data.status === 'success') {
                const response = data.data;
                // 根据地址族类型更新对应的表格数据
                if (response.addressFamily === ADDRESS_FAMILY.IPV4_UNC) {
                    const index = ipv4UncPeerList.value.findIndex(
                        peer => `${peer.vrfIndex || ''}-${peer.peerIp || ''}-${peer.addressFamily || ''}` ===
                               `${response.vrfIndex || ''}-${response.peerIp || ''}-${response.addressFamily || ''}`
                    );
                    if (index !== -1) {
                        ipv4UncPeerList.value[index] = { ...ipv4UncPeerList.value[index], ...response };
                    }
                } else if (response.addressFamily === ADDRESS_FAMILY.IPV6_UNC) {
                    const index = ipv6UncPeerList.value.findIndex(
                        peer => `${peer.vrfIndex || ''}-${peer.peerIp || ''}-${peer.addressFamily || ''}` ===
                               `${response.vrfIndex || ''}-${response.peerIp || ''}-${response.addressFamily || ''}`
                    );
                    if (index !== -1) {
                        ipv6UncPeerList.value[index] = { ...ipv6UncPeerList.value[index], ...response };
                    }
                }
            } else {
                message.error(data.msg);
            }
        });

        // 加载Bgp保存的配置
        const savedBgpConfig = await window.bgpApi.loadBgpConfig();
        if (savedBgpConfig.status === 'success' && savedBgpConfig.data) {
            console.log('Loading saved config:', savedBgpConfig.data);
            bgpConfigData.value.localAs = savedBgpConfig.data.localAs;
            bgpConfigData.value.routerId = savedBgpConfig.data.routerId;
        } else {
            console.error('配置文件加载失败', savedBgpConfig.msg);
        }

        // 加载Peer保存的配置
        const savedPeerConfig = await window.bgpApi.loadPeerConfig();
        if (savedPeerConfig.status === 'success' && savedPeerConfig.data) {
            console.log('Loading saved config:', savedPeerConfig.data);
            peerConfigData.value.peerIp = savedPeerConfig.data.peerIp;
            peerConfigData.value.peerAs = savedPeerConfig.data.peerAs;
            peerConfigData.value.holdTime = savedPeerConfig.data.holdTime;
            peerConfigData.value.openCap = Array.isArray(savedPeerConfig.data.openCap)
                ? [...savedPeerConfig.data.openCap]
                : [];
            peerConfigData.value.addressFamily = Array.isArray(savedPeerConfig.data.addressFamily)
                ? [...savedPeerConfig.data.addressFamily]
                : [];
            peerConfigData.value.role = savedPeerConfig.data.role || '';
            peerConfigData.value.openCapCustom = savedPeerConfig.data.openCapCustom || '';
        } else {
            console.error('配置文件加载失败', savedPeerConfig.msg);
        }
    });

    const customOpenCapVisible = ref(false);
    const showCustomOpenCap = () => {
        customOpenCapVisible.value = true;
    };

    const handleCustomOpenCapSubmit = data => {
        console.log(data);
        peerConfigData.value.openCapCustom = data;
    };

    watch(
        () => peerConfigData.value.openCap,
        newValue => {
            if (!newValue.includes(BGP_CAPABILITY.ROLE)) {
                peerConfigData.value.role = '';
            } else {
                if (peerConfigData.value.role === '') {
                    peerConfigData.value.role = BGP_ROLE.PROVIDER;
                }
            }
        },
        { deep: true }
    );

    const startBgp = async () => {
        clearValidationErrors(bgpConfigvalidationErrors);
        validateLocalAs(bgpConfigData.value.localAs, bgpConfigvalidationErrors);
        validatePeerIp(bgpConfigData.value.routerId, bgpConfigvalidationErrors);

        const hasErrors = Object.values(bgpConfigvalidationErrors.value).some(error => error !== '');
        if (hasErrors) {
            message.error('请检查BGP配置信息是否正确');
            return;
        }

        bgpLoading.value = true;
        bgpRunning.value = false;

        try {
            const payload = JSON.parse(JSON.stringify(bgpConfigData.value));
            const result = await window.bgpApi.startBgp(payload);
            if (result.status === 'success') {
                if (result.msg !== '') {
                    message.success(result.msg);
                }
                bgpLoading.value = false;
                bgpRunning.value = true;
            } else {
                bgpLoading.value = false;
                message.error(result.msg || 'BGP启动失败');
            }
        } catch (e) {
            bgpLoading.value = false;
            message.error(e);
        }
    };

    const configPeer = async () => {
        clearValidationErrors(peerConfigvalidationErrors);
        validatePeerIp(peerConfigData.value.peerIp, peerConfigvalidationErrors);
        validatePeerAs(peerConfigData.value.peerAs, peerConfigvalidationErrors);
        validateHoldTime(peerConfigData.value.holdTime, peerConfigvalidationErrors);

        const hasErrors = Object.values(peerConfigvalidationErrors.value).some(error => error !== '');
        if (hasErrors) {
            message.error('请检查Peer配置信息是否正确');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(peerConfigData.value));
            const result = await window.bgpApi.configPeer(payload);
            if (result.status === 'success') {
                if (result.msg !== '') {
                    message.success(result.msg);
                }
                const peerInfo = await window.bgpApi.getPeerInfo();
                if (peerInfo.status === 'success') {
                    // 处理 IPv4-UNC 邻居信息 (addrFamilyType: 1)
                    ipv4UncPeerList.value = Array.isArray(peerInfo.data[ADDRESS_FAMILY.IPV4_UNC])
                        ? [...peerInfo.data[ADDRESS_FAMILY.IPV4_UNC]]
                        : [];

                    // 处理 IPv6-UNC 邻居信息 (addrFamilyType: 2)
                    ipv6UncPeerList.value = Array.isArray(peerInfo.data[ADDRESS_FAMILY.IPV6_UNC])
                        ? [...peerInfo.data[ADDRESS_FAMILY.IPV6_UNC]]
                        : [];
                } else {
                    console.error(peerInfo.msg || 'Peer信息查询失败');
                    ipv4UncPeerList.value = [];
                    ipv6UncPeerList.value = [];
                }
            } else {
                bgpLoading.value = false;
                message.error(result.msg || 'Peer配置失败');
            }
        } catch (e) {
            bgpLoading.value = false;
            message.error(e);
            console.error(e);
        }
    };

    const stopBgp = async () => {
        const result = await window.bgpApi.stopBgp();
        if (result.status === 'success') {
            if (result.msg !== '') {
                message.success(result.msg);
            }
            bgpRunning.value = false;
            peerConfigData.value.peerState = '';
        } else {
            message.error(result.msg || 'BGP停止失败');
        }
    };
</script>

<style scoped>
    .bgp-config-container {
        margin-top: 10px;
        margin-left: 8px;
    }

    :deep(.ant-input[disabled]) {
        background-color: #f5f5f5;
        color: rgba(0, 0, 0, 0.85);
    }

    :deep(.ant-select-disabled .ant-select-selector) {
        background-color: #f5f5f5;
        color: rgba(0, 0, 0, 0.85);
    }

    /* 增强禁用复选框的可见度 */
    :deep(.ant-checkbox-disabled + span) {
        color: rgba(0, 0, 0, 0.85) !important;
    }

    :deep(.ant-checkbox-disabled .ant-checkbox-inner) {
        background-color: #e6e6e6 !important;
        border-color: #d9d9d9 !important;
    }

    .route-config-card {
        margin-top: 10px;
    }

    .custom-route-btn {
        color: #1890ff;
        padding: 0;
        height: 32px;
        font-size: 14px;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
    }

    .custom-route-btn:hover {
        color: #40a9ff;
    }

    .custom-route-btn:active {
        color: #096dd9;
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
</style>
