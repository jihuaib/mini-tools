<template>
    <div class="bgp-emulator-container">
        <a-form :model="bgpData" @finish="startBgp" :label-col="labelCol" :wrapper-col="wrapperCol" class="bgp-form">
            <a-card title="BGP配置">
                <a-form-item label="请选择网卡">
                    <a-select
                        ref="select"
                        v-model:value="networkValue"
                        :options="networkInfo"
                        @select="handleNetworkChange"
                    ></a-select>
                </a-form-item>

                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Local IP" name="localIp">
                            <a-input v-model:value="bgpData.localIp" disabled />
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="Local AS" name="localAs">
                            <a-tooltip :title="validationErrors.localAs" :open="!!validationErrors.localAs">
                                <a-input
                                    v-model:value="bgpData.localAs"
                                    @blur="e => validateField(e.target.value, 'localAs', validateLocalAs)"
                                    :status="validationErrors.localAs ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Peer IP" name="peerIp">
                            <a-tooltip :title="validationErrors.peerIp" :open="!!validationErrors.peerIp">
                                <a-input
                                    v-model:value="bgpData.peerIp"
                                    @blur="e => validateField(e.target.value, 'peerIp', validatePeerIp)"
                                    :status="validationErrors.peerIp ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="Peer AS" name="peerAs">
                            <a-tooltip :title="validationErrors.peerAs" :open="!!validationErrors.peerAs">
                                <a-input
                                    v-model:value="bgpData.peerAs"
                                    @blur="e => validateField(e.target.value, 'peerAs', validatePeerAs)"
                                    :status="validationErrors.peerAs ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Router ID" name="routerId">
                            <a-tooltip :title="validationErrors.routerId" :open="!!validationErrors.routerId">
                                <a-input
                                    v-model:value="bgpData.routerId"
                                    @blur="e => validateField(e.target.value, 'routerId', validateRouterId)"
                                    :status="validationErrors.routerId ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="Hold Time" name="holdTime">
                            <a-tooltip :title="validationErrors.holdTime" :open="!!validationErrors.holdTime">
                                <a-input
                                    v-model:value="bgpData.holdTime"
                                    @blur="e => validateField(e.target.value, 'holdTime', validateHoldTime)"
                                    :status="validationErrors.holdTime ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-form-item label="Open Cap" name="openCap">
                    <a-space>
                        <a-checkbox-group v-model:value="bgpData.openCap" :options="openCapOptions" />
                        <a-button type="link" @click="showCustomOpenCap" class="custom-route-btn">
                            <template #icon><SettingOutlined /></template>
                            配置自定义能力
                        </a-button>
                    </a-space>
                </a-form-item>

                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Addr Family" name="addressFamily">
                            <a-select
                                v-model:value="bgpData.addressFamily"
                                mode="multiple"
                                style="width: 100%"
                                :options="addressFamilyOptions"
                            />
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="Role" name="role">
                            <a-select
                                v-model:value="bgpData.role"
                                style="width: 100%"
                                :options="roleOptions"
                                :disabled="!bgpData.openCap.includes(BGP_CAPABILITY.ROLE)"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row>
                    <a-col :span="12">
                        <a-form-item label="Peer state" name="peerState">
                            <a-input v-model:value="bgpData.peerState" disabled />
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                    <a-space size="middle">
                        <a-button type="primary" html-type="submit" :loading="bgpLoading">
                            {{ bgpRunning ? '重启BGP' : '启动BGP' }}
                        </a-button>
                        <a-button type="primary" danger @click="stopBgp" :disabled="!bgpRunning">停止BGP</a-button>
                    </a-space>
                </a-form-item>
            </a-card>

            <a-card title="路由配置" class="route-config-card">
                <a-form-item label="IP类型" name="ipType">
                    <a-radio-group v-model:value="bgpData.routeConfig.ipType">
                        <a-radio :value="IP_TYPE.IPV4">IPv4</a-radio>
                        <a-radio :value="IP_TYPE.IPV6">IPv6</a-radio>
                    </a-radio-group>
                </a-form-item>

                <!-- IPv4 Route Configuration -->
                <div v-show="bgpData.routeConfig.ipType === IP_TYPE.IPV4">
                    <a-row>
                        <a-col :span="8">
                            <a-form-item label="Prefix" name="ipv4RouteConfig.prefix">
                                <a-tooltip :title="validationErrors.ipv4Prefix" :open="!!validationErrors.ipv4Prefix">
                                    <a-input
                                        v-model:value="bgpData.ipv4RouteConfig.prefix"
                                        @blur="e => validateField(e.target.value, 'ipv4Prefix', validateIpv4Prefix)"
                                        :status="validationErrors.ipv4Prefix ? 'error' : ''"
                                    />
                                </a-tooltip>
                            </a-form-item>
                        </a-col>
                        <a-col :span="8">
                            <a-form-item label="Mask" name="ipv4RouteConfig.mask">
                                <a-tooltip :title="validationErrors.ipv4Mask" :open="!!validationErrors.ipv4Mask">
                                    <a-input
                                        v-model:value="bgpData.ipv4RouteConfig.mask"
                                        @blur="e => validateField(e.target.value, 'ipv4Mask', validateIpv4Mask)"
                                        :status="validationErrors.ipv4Mask ? 'error' : ''"
                                    />
                                </a-tooltip>
                            </a-form-item>
                        </a-col>
                        <a-col :span="8">
                            <a-form-item label="Count" name="ipv4RouteConfig.count">
                                <a-tooltip :title="validationErrors.ipv4Count" :open="!!validationErrors.ipv4Count">
                                    <a-input
                                        v-model:value="bgpData.ipv4RouteConfig.count"
                                        @blur="e => validateField(e.target.value, 'ipv4Count', validateIpv4Count)"
                                        :status="validationErrors.ipv4Count ? 'error' : ''"
                                    />
                                </a-tooltip>
                            </a-form-item>
                        </a-col>
                    </a-row>
                </div>

                <!-- IPv6 Route Configuration -->
                <div v-show="bgpData.routeConfig.ipType === IP_TYPE.IPV6">
                    <a-row>
                        <a-col :span="8">
                            <a-form-item label="Prefix" name="ipv6RouteConfig.prefix">
                                <a-tooltip :title="validationErrors.ipv6Prefix" :open="!!validationErrors.ipv6Prefix">
                                    <a-input
                                        v-model:value="bgpData.ipv6RouteConfig.prefix"
                                        @blur="e => validateField(e.target.value, 'ipv6Prefix', validateIpv6Prefix)"
                                        :status="validationErrors.ipv6Prefix ? 'error' : ''"
                                    />
                                </a-tooltip>
                            </a-form-item>
                        </a-col>
                        <a-col :span="8">
                            <a-form-item label="Mask" name="ipv6RouteConfig.mask">
                                <a-tooltip :title="validationErrors.ipv6Mask" :open="!!validationErrors.ipv6Mask">
                                    <a-input
                                        v-model:value="bgpData.ipv6RouteConfig.mask"
                                        @blur="e => validateField(e.target.value, 'ipv6Mask', validateIpv6Mask)"
                                        :status="validationErrors.ipv6Mask ? 'error' : ''"
                                    />
                                </a-tooltip>
                            </a-form-item>
                        </a-col>
                        <a-col :span="8">
                            <a-form-item label="Count" name="ipv6RouteConfig.count">
                                <a-tooltip :title="validationErrors.ipv6Count" :open="!!validationErrors.ipv6Count">
                                    <a-input
                                        v-model:value="bgpData.ipv6RouteConfig.count"
                                        @blur="e => validateField(e.target.value, 'ipv6Count', validateIpv6Count)"
                                        :status="validationErrors.ipv6Count ? 'error' : ''"
                                    />
                                </a-tooltip>
                            </a-form-item>
                        </a-col>
                    </a-row>
                </div>

                <a-form-item>
                    <a-button type="link" @click="showCustomRouteAttr" class="custom-route-btn">
                        <template #icon><SettingOutlined /></template>
                        配置自定义路由属性
                    </a-button>
                </a-form-item>
                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                    <a-space size="middle">
                        <a-button type="primary" @click="sendRoutes" :disabled="bgpData.peerState !== 'Established'">
                            发送路由
                        </a-button>
                        <a-button
                            type="primary"
                            danger
                            @click="withdrawRoutes"
                            :disabled="bgpData.peerState !== 'Established' || !routesSent"
                        >
                            撤销路由
                        </a-button>
                    </a-space>
                </a-form-item>
            </a-card>
        </a-form>

        <CustomPktDrawer
            v-model:visible="customOpenCapVisible"
            v-model:inputValue="bgpData.openCapCustom"
            @submit="handleCustomOpenCapSubmit"
        />

        <CustomPktDrawer
            v-model:visible="customIpv4RouteAttrVisible"
            v-model:inputValue="bgpData.ipv4RouteConfig.customAttr"
            @submit="handleCustomIpv4RouteAttrSubmit"
        />

        <CustomPktDrawer
            v-model:visible="customIpv6RouteAttrVisible"
            v-model:inputValue="bgpData.ipv6RouteConfig.customAttr"
            @submit="handleCustomIpv6RouteAttrSubmit"
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
        validateHoldTime,
        validateIpv4Prefix,
        validateIpv4Mask,
        validateIpv4Count,
        validateIpv6Prefix,
        validateIpv6Mask,
        validateIpv6Count
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

    const bgpData = ref({
        localIp: '',
        localAs: DEFAULT_VALUES.LOCAL_AS,
        peerIp: DEFAULT_VALUES.PEER_IP,
        peerAs: DEFAULT_VALUES.PEER_AS,
        routerId: '',
        holdTime: DEFAULT_VALUES.HOLD_TIME,
        openCap: DEFAULT_VALUES.DEFAULT_OPEN_CAP,
        addressFamily: DEFAULT_VALUES.DEFAULT_ADDRESS_FAMILY,
        peerState: '',
        role: '',
        openCapCustom: '',
        ipv4RouteConfig: {
            prefix: DEFAULT_VALUES.IPV4_PREFIX,
            mask: DEFAULT_VALUES.IPV4_MASK,
            count: DEFAULT_VALUES.IPV4_COUNT,
            customAttr: ''
        },
        ipv6RouteConfig: {
            prefix: DEFAULT_VALUES.IPV6_PREFIX,
            mask: DEFAULT_VALUES.IPV6_MASK,
            count: DEFAULT_VALUES.IPV6_COUNT,
            customAttr: ''
        },
        routeConfig: {
            ipType: IP_TYPE.IPV4
        }
    });

    const networkList = [];
    const networkInfo = ref([]);
    const networkValue = ref('');
    const handleNetworkChange = name => {
        bgpData.value.localIp = networkList.find(item => item.name === name).ip;
        bgpData.value.routerId = networkList.find(item => item.name === name).ip;
    };

    const saveConfig = {
        networkValue: '',
        localAs: '',
        peerIp: '',
        peerAs: '',
        routerId: '',
        holdTime: '',
        openCap: [],
        addressFamily: [],
        role: '',
        openCapCustom: '',
        ipv4RouteConfig: {
            prefix: '',
            mask: '',
            count: '',
            customAttr: ''
        },
        ipv6RouteConfig: {
            prefix: '',
            mask: '',
            count: '',
            customAttr: ''
        },
        routeConfig: {
            ipType: ''
        }
    };

    const saveDebounced = debounce(async data => {
        const result = await window.bgpEmulatorApi.saveConfig(data);
        if (result.status === 'success') {
            if (result.msg !== '') {
                message.success(result.msg);
            }
        } else {
            message.error(result.msg || '配置文件保存失败');
        }
    }, 300);

    const validationErrors = ref({
        localAs: '',
        peerIp: '',
        peerAs: '',
        routerId: '',
        holdTime: '',
        ipv4Prefix: '',
        ipv4Mask: '',
        ipv4Count: '',
        ipv6Prefix: '',
        ipv6Mask: '',
        ipv6Count: ''
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

    const bgpLoading = ref(false);
    const bgpRunning = ref(false);

    // Add a state variable to track if routes have been sent
    const routesSent = ref(false);

    watch(
        [bgpData],
        async ([newBgpValue]) => {
            // 转换为saveBgpConfig
            saveConfig.networkValue = networkValue.value;
            saveConfig.localAs = newBgpValue.localAs;
            saveConfig.peerIp = newBgpValue.peerIp;
            saveConfig.peerAs = newBgpValue.peerAs;
            saveConfig.routerId = newBgpValue.routerId;
            saveConfig.holdTime = newBgpValue.holdTime;
            saveConfig.openCap = [...newBgpValue.openCap];
            saveConfig.addressFamily = [...newBgpValue.addressFamily];
            saveConfig.role = newBgpValue.role;
            saveConfig.openCapCustom = newBgpValue.openCapCustom;
            saveConfig.ipv4RouteConfig = { ...newBgpValue.ipv4RouteConfig };
            saveConfig.ipv6RouteConfig = { ...newBgpValue.ipv6RouteConfig };
            saveConfig.routeConfig = { ...newBgpValue.routeConfig };

            try {
                clearValidationErrors(validationErrors);
                validateLocalAs(newBgpValue.localAs, validationErrors);
                validatePeerIp(newBgpValue.peerIp, validationErrors);
                validatePeerAs(newBgpValue.peerAs, validationErrors);
                validateRouterId(newBgpValue.routerId, validationErrors);
                validateHoldTime(newBgpValue.holdTime, validationErrors);

                validateIpv4Prefix(newBgpValue.ipv4RouteConfig.prefix, validationErrors);
                validateIpv4Mask(newBgpValue.ipv4RouteConfig.mask, validationErrors);
                validateIpv4Count(newBgpValue.ipv4RouteConfig.count, validationErrors);

                validateIpv6Prefix(newBgpValue.ipv6RouteConfig.prefix, validationErrors);
                validateIpv6Mask(newBgpValue.ipv6RouteConfig.mask, validationErrors);
                validateIpv6Count(newBgpValue.ipv6RouteConfig.count, validationErrors);

                // Check if there are any validation errors
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

    onMounted(async () => {
        const result = await window.bgpEmulatorApi.getNetworkInfo();
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

        window.bgpEmulatorApi.onUpdatePeerState(data => {
            if (data.status === 'success') {
                const response = data.data;
                bgpData.value.peerState = response.state;
            } else {
                message.error(data.msg);
            }
        });

        // 加载保存的配置
        const savedConfig = await window.bgpEmulatorApi.loadConfig();
        if (savedConfig.status === 'success' && savedConfig.data) {
            console.log('Loading saved config:', savedConfig.data);
            networkValue.value = savedConfig.data.networkValue;
            handleNetworkChange(networkValue.value);
            bgpData.value.localAs = savedConfig.data.localAs;
            bgpData.value.peerIp = savedConfig.data.peerIp;
            bgpData.value.peerAs = savedConfig.data.peerAs;
            if (savedConfig.data.routerId) {
                bgpData.value.routerId = savedConfig.data.routerId;
            }
            bgpData.value.holdTime = savedConfig.data.holdTime;
            bgpData.value.openCap = Array.isArray(savedConfig.data.openCap) ? [...savedConfig.data.openCap] : [];
            bgpData.value.addressFamily = Array.isArray(savedConfig.data.addressFamily)
                ? [...savedConfig.data.addressFamily]
                : [];
            bgpData.value.role = savedConfig.data.role || '';
            bgpData.value.openCapCustom = savedConfig.data.openCapCustom || '';

            // Load route configurations
            if (savedConfig.data.ipv4RouteConfig) {
                bgpData.value.ipv4RouteConfig = {
                    prefix: savedConfig.data.ipv4RouteConfig.prefix || '',
                    mask: savedConfig.data.ipv4RouteConfig.mask || '',
                    count: savedConfig.data.ipv4RouteConfig.count || '',
                    customAttr: savedConfig.data.ipv4RouteConfig.customAttr || ''
                };
            }

            if (savedConfig.data.ipv6RouteConfig) {
                bgpData.value.ipv6RouteConfig = {
                    prefix: savedConfig.data.ipv6RouteConfig.prefix || '',
                    mask: savedConfig.data.ipv6RouteConfig.mask || '',
                    count: savedConfig.data.ipv6RouteConfig.count || '',
                    customAttr: savedConfig.data.ipv6RouteConfig.customAttr || ''
                };
            }

            if (savedConfig.data.routeConfig) {
                bgpData.value.routeConfig.ipType = savedConfig.data.routeConfig.ipType || IP_TYPE.IPV4;
            }
        } else {
            console.error('[BgpEmulator] 配置文件加载失败', savedConfig.msg);
        }
    });

    const customOpenCapVisible = ref(false);
    const showCustomOpenCap = () => {
        customOpenCapVisible.value = true;
    };

    const handleCustomOpenCapSubmit = data => {
        console.log(data);
        bgpData.value.openCapCustom = data;
    };

    // Update watch for openCap changes
    watch(
        () => bgpData.value.openCap,
        newValue => {
            if (!newValue.includes(BGP_CAPABILITY.ROLE)) {
                bgpData.value.role = '';
            } else {
                if (bgpData.value.role === '') {
                    bgpData.value.role = BGP_ROLE.PROVIDER;
                }
            }
        },
        { deep: true }
    );

    const customIpv4RouteAttrVisible = ref(false);
    const customIpv6RouteAttrVisible = ref(false);

    const showCustomRouteAttr = () => {
        if (bgpData.value.routeConfig.ipType === IP_TYPE.IPV4) {
            customIpv4RouteAttrVisible.value = true;
        } else {
            customIpv6RouteAttrVisible.value = true;
        }
    };

    const handleCustomIpv4RouteAttrSubmit = data => {
        console.log(data);
        bgpData.value.ipv4RouteConfig.customAttr = data;
    };

    const handleCustomIpv6RouteAttrSubmit = data => {
        console.log(data);
        bgpData.value.ipv6RouteConfig.customAttr = data;
    };

    // Add watch for route type changes
    watch(
        () => bgpData.value.routeConfig.ipType,
        () => {
            clearValidationErrors(validationErrors);
        }
    );

    const startBgp = async () => {
        clearValidationErrors(validationErrors);
        validateLocalAs(bgpData.value.localAs, validationErrors);
        validatePeerIp(bgpData.value.peerIp, validationErrors);
        validatePeerAs(bgpData.value.peerAs, validationErrors);
        validateRouterId(bgpData.value.routerId, validationErrors);
        validateHoldTime(bgpData.value.holdTime, validationErrors);

        const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

        if (hasErrors) {
            message.error('请检查BGP配置信息是否正确');
            return;
        }

        bgpLoading.value = true;
        bgpRunning.value = false;

        try {
            const payload = JSON.parse(JSON.stringify(bgpData.value));
            const result = await window.bgpEmulatorApi.startBgp(payload);
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

    const stopBgp = async () => {
        const result = await window.bgpEmulatorApi.stopBgp();
        if (result.status === 'success') {
            if (result.msg !== '') {
                message.success(result.msg);
            }
            bgpRunning.value = false;
            bgpData.value.peerState = '';
            routesSent.value = false; // Reset when BGP stops
        } else {
            message.error(result.msg || 'BGP停止失败');
        }
    };

    const sendRoutes = async () => {
        try {
            const currentConfig =
                bgpData.value.routeConfig.ipType === IP_TYPE.IPV4
                    ? bgpData.value.ipv4RouteConfig
                    : bgpData.value.ipv6RouteConfig;

            clearValidationErrors(validationErrors);
            if (bgpData.value.routeConfig.ipType === IP_TYPE.IPV4) {
                validateIpv4Prefix(currentConfig.prefix, validationErrors);
                validateIpv4Mask(currentConfig.mask, validationErrors);
                validateIpv4Count(currentConfig.count, validationErrors);
            } else {
                validateIpv6Prefix(currentConfig.prefix, validationErrors);
                validateIpv6Mask(currentConfig.mask, validationErrors);
                validateIpv6Count(currentConfig.count, validationErrors);
            }

            const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

            if (hasErrors) {
                message.error('请检查路由配置信息是否正确');
                return;
            }

            currentConfig.mask = parseInt(currentConfig.mask);
            currentConfig.count = parseInt(currentConfig.count);
            const result = await window.bgpEmulatorApi.sendRoutes({
                ...currentConfig,
                ipType: bgpData.value.routeConfig.ipType
            });

            if (result.status === 'success') {
                if (result.msg !== '') {
                    message.success(result.msg);
                }
                routesSent.value = true;
            } else {
                message.error(result.msg || '路由发送失败');
            }
        } catch (e) {
            console.error(e);
            message.error('路由发送失败');
        }
    };

    const withdrawRoutes = async () => {
        try {
            const currentConfig =
                bgpData.value.routeConfig.ipType === IP_TYPE.IPV4
                    ? bgpData.value.ipv4RouteConfig
                    : bgpData.value.ipv6RouteConfig;

            if (bgpData.value.routeConfig.ipType === IP_TYPE.IPV4) {
                validateIpv4Prefix(currentConfig.prefix, validationErrors);
                validateIpv4Mask(currentConfig.mask, validationErrors);
                validateIpv4Count(currentConfig.count, validationErrors);
            } else {
                validateIpv6Prefix(currentConfig.prefix, validationErrors);
                validateIpv6Mask(currentConfig.mask, validationErrors);
                validateIpv6Count(currentConfig.count, validationErrors);
            }

            const hasErrors = Object.values(validationErrors.value).some(error => error !== '');

            if (hasErrors) {
                message.error('请检查路由配置信息是否正确');
                return;
            }

            currentConfig.mask = parseInt(currentConfig.mask);
            currentConfig.count = parseInt(currentConfig.count);
            const result = await window.bgpEmulatorApi.withdrawRoutes({
                ...currentConfig,
                ipType: bgpData.value.routeConfig.ipType
            });

            if (result.status === 'success') {
                if (result.msg !== '') {
                    message.success(result.msg);
                }
                routesSent.value = false;
            } else {
                message.error(result.msg || '路由撤销失败');
            }
        } catch (e) {
            console.error(e);
            message.error('路由撤销失败');
        }
    };
</script>

<style scoped>
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

    /* 调整路由配置部分的间距 */
    :deep(.ant-form-item) {
        margin-bottom: 10px;
    }

    :deep(.ant-radio-group) {
        margin-bottom: 8px;
    }

    /* 调整路由配置输入框的间距 */
    :deep(.ant-row) {
        margin-bottom: 8px;
    }

    :deep(.ant-col) {
        padding-right: 8px;
    }

    :deep(.ant-col:last-child) {
        padding-right: 0;
    }

    /* Remove error message styling since we're using tooltips now */
    .error-message {
        display: none;
    }

    /* Update error input styling */
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

    /* Add tooltip styling */
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
</style>
