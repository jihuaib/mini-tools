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
                                    :disabled="bgpRunning"
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
                                    :disabled="bgpRunning"
                                    v-model:value="bgpConfigData.routerId"
                                    @blur="e => validateBgpConfigField(e.target.value, 'routerId', validateRouterId)"
                                    :status="bgpConfigvalidationErrors.routerId ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>
                <a-row>
                    <a-col :span="12">
                        <a-form-item label="地址族" name="addressFamily">
                            <a-select
                                :disabled="bgpRunning"
                                v-model:value="bgpConfigData.addressFamily"
                                mode="multiple"
                                style="width: 100%"
                                :options="bgpAddressFamilyOptions"
                            />
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                    <a-space size="middle">
                        <a-button type="primary" html-type="submit" :loading="bgpLoading" :disabled="bgpRunning">
                            启动BGP
                        </a-button>
                        <a-button type="primary" danger @click="stopBgp" :disabled="!bgpRunning">停止BGP</a-button>
                    </a-space>
                </a-form-item>
            </a-card>
        </a-form>

        <a-card title="邻居配置" class="route-config-card">
            <a-tabs v-model:activeKey="activeTabKey">
                <a-tab-pane :key="IP_TYPE.IPV4" tab="IPv4邻居">
                    <a-form
                        :model="ipv4PeerConfigData"
                        @finish="configIpv4Peer"
                        :label-col="labelCol"
                        :wrapper-col="wrapperCol"
                    >
                        <a-row>
                            <a-col :span="12">
                                <a-form-item label="Peer IP" name="peerIp">
                                    <a-tooltip
                                        :title="ipv4PeerConfigvalidationErrors.peerIp"
                                        :open="!!ipv4PeerConfigvalidationErrors.peerIp"
                                    >
                                        <a-input
                                            v-model:value="ipv4PeerConfigData.peerIp"
                                            @blur="
                                                e =>
                                                    validateIpv4PeerConfigField(
                                                        e.target.value,
                                                        'peerIp',
                                                        validatePeerIp
                                                    )
                                            "
                                            :status="ipv4PeerConfigvalidationErrors.peerIp ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="12">
                                <a-form-item label="Peer AS" name="peerAs">
                                    <a-tooltip
                                        :title="ipv4PeerConfigvalidationErrors.peerAs"
                                        :open="!!ipv4PeerConfigvalidationErrors.peerAs"
                                    >
                                        <a-input
                                            v-model:value="ipv4PeerConfigData.peerAs"
                                            @blur="
                                                e =>
                                                    validateIpv4PeerConfigField(
                                                        e.target.value,
                                                        'peerAs',
                                                        validatePeerAs
                                                    )
                                            "
                                            :status="ipv4PeerConfigvalidationErrors.peerAs ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-row>
                            <a-col :span="12">
                                <a-form-item label="Hold Time" name="holdTime">
                                    <a-tooltip
                                        :title="ipv4PeerConfigvalidationErrors.holdTime"
                                        :open="!!ipv4PeerConfigvalidationErrors.holdTime"
                                    >
                                        <a-input
                                            v-model:value="ipv4PeerConfigData.holdTime"
                                            @blur="
                                                e =>
                                                    validateIpv4PeerConfigField(
                                                        e.target.value,
                                                        'holdTime',
                                                        validateHoldTime
                                                    )
                                            "
                                            :status="ipv4PeerConfigvalidationErrors.holdTime ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="Open Cap" name="openCap">
                                    <a-space>
                                        <a-checkbox-group
                                            v-model:value="ipv4PeerConfigData.openCap"
                                            :options="ipv4OpenCapOptions"
                                        />
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
                                        v-model:value="ipv4PeerConfigData.addressFamily"
                                        mode="multiple"
                                        style="width: 100%"
                                        :options="addressFamilyOptions"
                                    />
                                </a-form-item>
                            </a-col>
                            <a-col :span="12">
                                <a-form-item label="Role" name="role">
                                    <a-select
                                        v-model:value="ipv4PeerConfigData.role"
                                        style="width: 100%"
                                        :options="roleOptions"
                                        :disabled="!ipv4PeerConfigData.openCap.includes(BGP_CAPABILITY.ROLE)"
                                    />
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-row>
                            <a-col :span="24">
                                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                                    <a-space size="middle">
                                        <a-button type="primary" html-type="submit" :disabled="!bgpRunning">
                                            配置IPv4邻居
                                        </a-button>
                                    </a-space>
                                </a-form-item>
                            </a-col>
                        </a-row>
                    </a-form>
                </a-tab-pane>
                <a-tab-pane :key="IP_TYPE.IPV6" tab="IPv6邻居">
                    <a-form
                        :model="ipv6PeerConfigData"
                        @finish="configIpv6Peer"
                        :label-col="labelCol"
                        :wrapper-col="wrapperCol"
                    >
                        <a-row>
                            <a-col :span="12">
                                <a-form-item label="Peer IPv6" name="peerIpv6">
                                    <a-tooltip
                                        :title="ipv6PeerConfigvalidationErrors.peerIpv6"
                                        :open="!!ipv6PeerConfigvalidationErrors.peerIpv6"
                                    >
                                        <a-input
                                            v-model:value="ipv6PeerConfigData.peerIpv6"
                                            @blur="
                                                e =>
                                                    validateIpv6PeerConfigField(
                                                        e.target.value,
                                                        'peerIpv6',
                                                        validatePeerIpv6
                                                    )
                                            "
                                            :status="ipv6PeerConfigvalidationErrors.peerIpv6 ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="12">
                                <a-form-item label="Peer AS" name="peerIpv6As">
                                    <a-tooltip
                                        :title="ipv6PeerConfigvalidationErrors.peerIpv6As"
                                        :open="!!ipv6PeerConfigvalidationErrors.peerIpv6As"
                                    >
                                        <a-input
                                            v-model:value="ipv6PeerConfigData.peerIpv6As"
                                            @blur="
                                                e =>
                                                    validateIpv6PeerConfigField(
                                                        e.target.value,
                                                        'peerIpv6As',
                                                        validatePeerAs
                                                    )
                                            "
                                            :status="ipv6PeerConfigvalidationErrors.peerIpv6As ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-row>
                            <a-col :span="12">
                                <a-form-item label="Hold Time" name="holdTimeIpv6">
                                    <a-tooltip
                                        :title="ipv6PeerConfigvalidationErrors.holdTimeIpv6"
                                        :open="!!ipv6PeerConfigvalidationErrors.holdTimeIpv6"
                                    >
                                        <a-input
                                            v-model:value="ipv6PeerConfigData.holdTimeIpv6"
                                            @blur="
                                                e =>
                                                    validateIpv6PeerConfigField(
                                                        e.target.value,
                                                        'holdTimeIpv6',
                                                        validateHoldTime
                                                    )
                                            "
                                            :status="ipv6PeerConfigvalidationErrors.holdTimeIpv6 ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="Open Cap" name="openCapIpv6">
                                    <a-space>
                                        <a-checkbox-group
                                            v-model:value="ipv6PeerConfigData.openCapIpv6"
                                            :options="ipv6OpenCapOptions"
                                        />
                                        <a-button type="link" @click="showCustomOpenCapIpv6" class="custom-route-btn">
                                            <template #icon><SettingOutlined /></template>
                                            配置自定义能力
                                        </a-button>
                                    </a-space>
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-row>
                            <a-col :span="12">
                                <a-form-item label="Addr Family" name="addressFamilyIpv6">
                                    <a-select
                                        v-model:value="ipv6PeerConfigData.addressFamilyIpv6"
                                        mode="multiple"
                                        style="width: 100%"
                                        :options="addressFamilyOptionsIpv6"
                                    />
                                </a-form-item>
                            </a-col>
                            <a-col :span="12">
                                <a-form-item label="Role" name="roleIpv6">
                                    <a-select
                                        v-model:value="ipv6PeerConfigData.roleIpv6"
                                        style="width: 100%"
                                        :options="roleOptions"
                                        :disabled="!ipv6PeerConfigData.openCapIpv6.includes(BGP_CAPABILITY.ROLE)"
                                    />
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-row>
                            <a-col :span="24">
                                <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                                    <a-space size="middle">
                                        <a-button type="primary" html-type="submit" :disabled="!bgpRunning">
                                            配置IPv6邻居
                                        </a-button>
                                    </a-space>
                                </a-form-item>
                            </a-col>
                        </a-row>
                    </a-form>
                </a-tab-pane>
            </a-tabs>
        </a-card>

        <CustomPktDrawer
            v-model:visible="customOpenCapVisible"
            v-model:inputValue="ipv4PeerConfigData.openCapCustom"
            @submit="handleCustomOpenCapSubmit"
        />
        <CustomPktDrawer
            v-model:visible="customOpenCapIpv6Visible"
            v-model:inputValue="ipv6PeerConfigData.openCapCustomIpv6"
            @submit="handleCustomOpenCapIpv6Submit"
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
        validatePeerIpv6,
        validatePeerAs,
        validateRouterId,
        validateHoldTime
    } from '../../utils/bgpValidation';
    import { clearValidationErrors } from '../../utils/validationCommon';

    defineOptions({
        name: 'BgpConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const ipv4OpenCapOptions = [
        { label: 'Addr Family', value: BGP_CAPABILITY.ADDR_FAMILY, disabled: true },
        { label: 'Route-Refresh', value: BGP_CAPABILITY.ROUTE_REFRESH },
        { label: 'AS4', value: BGP_CAPABILITY.AS4 },
        { label: 'Role', value: BGP_CAPABILITY.ROLE }
    ];

    const ipv6OpenCapOptions = [
        { label: 'Addr Family', value: BGP_CAPABILITY.ADDR_FAMILY, disabled: true },
        { label: 'Route-Refresh', value: BGP_CAPABILITY.ROUTE_REFRESH },
        { label: 'AS4', value: BGP_CAPABILITY.AS4 },
        { label: 'Role', value: BGP_CAPABILITY.ROLE },
        { label: 'Extended Next Hop Encoding', value: BGP_CAPABILITY.EXTENDED_NEXT_HOP_ENCODING }
    ];

    const roleOptions = [
        { label: 'Provider', value: BGP_ROLE.PROVIDER },
        { label: 'RS', value: BGP_ROLE.RS },
        { label: 'RS-Client', value: BGP_ROLE.RS_CLIENT },
        { label: 'Customer', value: BGP_ROLE.CUSTOMER },
        { label: 'Lateral Peer', value: BGP_ROLE.LATERAL_PEER }
    ];

    const bgpAddressFamilyOptions = [
        { label: 'Ipv4-UNC', value: ADDRESS_FAMILY.IPV4_UNC, disabled: true },
        { label: 'Ipv6-UNC', value: ADDRESS_FAMILY.IPV6_UNC }
    ];

    const addressFamilyOptions = [
        { label: 'Ipv4-UNC', value: ADDRESS_FAMILY.IPV4_UNC, disabled: true },
        { label: 'Ipv6-UNC', value: ADDRESS_FAMILY.IPV6_UNC }
    ];

    const addressFamilyOptionsIpv6 = [
        { label: 'Ipv4-UNC', value: ADDRESS_FAMILY.IPV4_UNC },
        { label: 'Ipv6-UNC', value: ADDRESS_FAMILY.IPV6_UNC, disabled: true }
    ];

    const bgpConfigData = ref({
        localAs: DEFAULT_VALUES.LOCAL_AS,
        routerId: DEFAULT_VALUES.ROUTER_ID,
        addressFamily: [ADDRESS_FAMILY.IPV4_UNC]
    });

    const activeTabKey = ref(IP_TYPE.IPV4);

    const ipv4PeerConfigData = ref({
        peerIp: DEFAULT_VALUES.PEER_IP,
        peerAs: DEFAULT_VALUES.PEER_AS,
        holdTime: DEFAULT_VALUES.HOLD_TIME,
        openCap: DEFAULT_VALUES.DEFAULT_OPEN_CAP,
        addressFamily: DEFAULT_VALUES.DEFAULT_ADDRESS_FAMILY,
        role: '',
        openCapCustom: ''
    });

    const ipv6PeerConfigData = ref({
        peerIpv6: DEFAULT_VALUES.PEER_IPV6,
        peerIpv6As: DEFAULT_VALUES.PEER_IPV6_AS,
        holdTimeIpv6: DEFAULT_VALUES.HOLD_TIME_IPV6,
        openCapIpv6: DEFAULT_VALUES.DEFAULT_OPEN_CAP_IPV6,
        addressFamilyIpv6: DEFAULT_VALUES.DEFAULT_ADDRESS_FAMILY_IPV6,
        roleIpv6: '',
        openCapCustomIpv6: ''
    });

    const saveBgpConfig = debounce(async data => {
        const result = await window.bgpApi.saveBgpConfig(data);
        if (result.status === 'success') {
            console.info(result.msg);
        } else {
            console.error(result.msg);
        }
    }, 300);

    const saveIpv4PeerConfig = debounce(async data => {
        const result = await window.bgpApi.saveIpv4PeerConfig(data);
        if (result.status === 'success') {
            console.info(result.msg);
        } else {
            console.error(result.msg);
        }
    }, 300);

    const saveIpv6PeerConfig = debounce(async data => {
        const result = await window.bgpApi.saveIpv6PeerConfig(data);
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

    const ipv4PeerConfigvalidationErrors = ref({
        peerIp: '',
        peerAs: '',
        holdTime: ''
    });

    const ipv6PeerConfigvalidationErrors = ref({
        peerIpv6: '',
        peerIpv6As: '',
        holdTimeIpv6: ''
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            clearValidationErrors(bgpConfigvalidationErrors);
            clearValidationErrors(ipv4PeerConfigvalidationErrors);
            clearValidationErrors(ipv6PeerConfigvalidationErrors);
        }
    });

    const validateBgpConfigField = (value, fieldName, validationFn) => {
        validationFn(value, bgpConfigvalidationErrors);
    };

    const validateIpv4PeerConfigField = (value, fieldName, validationFn) => {
        validationFn(value, ipv4PeerConfigvalidationErrors);
    };

    const validateIpv6PeerConfigField = (value, fieldName, validationFn) => {
        validationFn(value, ipv6PeerConfigvalidationErrors);
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
        ipv4PeerConfigData,
        newValue => {
            clearValidationErrors(ipv4PeerConfigvalidationErrors);
            validatePeerIp(newValue.peerIp, ipv4PeerConfigvalidationErrors);
            validatePeerAs(newValue.peerAs, ipv4PeerConfigvalidationErrors);
            validateHoldTime(newValue.holdTime, ipv4PeerConfigvalidationErrors);

            const hasErrors = Object.values(ipv4PeerConfigvalidationErrors.value).some(error => error !== '');
            if (hasErrors) {
                console.log('IPv4 Validation failed, configuration not saved');
                return;
            }

            const raw = toRaw(newValue);
            saveIpv4PeerConfig(raw);
        },
        { deep: true, immediate: true }
    );

    watch(
        ipv6PeerConfigData,
        newValue => {
            clearValidationErrors(ipv6PeerConfigvalidationErrors);
            validatePeerIpv6(newValue.peerIpv6, ipv6PeerConfigvalidationErrors);
            validatePeerAs(newValue.peerIpv6As, ipv6PeerConfigvalidationErrors);
            validateHoldTime(newValue.holdTimeIpv6, ipv6PeerConfigvalidationErrors);

            const hasErrors = Object.values(ipv6PeerConfigvalidationErrors.value).some(error => error !== '');
            if (hasErrors) {
                console.log('IPv6 Validation failed, configuration not saved');
                return;
            }

            const raw = toRaw(newValue);
            saveIpv6PeerConfig(raw);
        },
        { deep: true, immediate: true }
    );

    onMounted(async () => {
        // 加载Bgp保存的配置
        const savedBgpConfig = await window.bgpApi.loadBgpConfig();
        if (savedBgpConfig.status === 'success' && savedBgpConfig.data) {
            console.log('Loading saved config:', savedBgpConfig.data);
            bgpConfigData.value.localAs = savedBgpConfig.data.localAs;
            bgpConfigData.value.routerId = savedBgpConfig.data.routerId;
            bgpConfigData.value.addressFamily = Array.isArray(savedBgpConfig.data.addressFamily)
                ? [...savedBgpConfig.data.addressFamily]
                : [ADDRESS_FAMILY.IPV4_UNC];
        } else {
            console.error('BGP 配置文件加载失败', savedBgpConfig.msg);
        }

        // 加载IPv4 Peer保存的配置
        const savedIpv4PeerConfig = await window.bgpApi.loadIpv4PeerConfig();
        if (savedIpv4PeerConfig.status === 'success' && savedIpv4PeerConfig.data) {
            console.log('Loading saved ipv4 peer config:', savedIpv4PeerConfig.data);

            // IPv4 settings
            ipv4PeerConfigData.value.peerIp = savedIpv4PeerConfig.data.peerIp;
            ipv4PeerConfigData.value.peerAs = savedIpv4PeerConfig.data.peerAs;
            ipv4PeerConfigData.value.holdTime = savedIpv4PeerConfig.data.holdTime;
            ipv4PeerConfigData.value.openCap = Array.isArray(savedIpv4PeerConfig.data.openCap)
                ? [...savedIpv4PeerConfig.data.openCap]
                : [];
            ipv4PeerConfigData.value.addressFamily = Array.isArray(savedIpv4PeerConfig.data.addressFamily)
                ? [...savedIpv4PeerConfig.data.addressFamily]
                : [];
            ipv4PeerConfigData.value.role = savedIpv4PeerConfig.data.role || '';
            ipv4PeerConfigData.value.openCapCustom = savedIpv4PeerConfig.data.openCapCustom || '';
        } else {
            console.error('IPv4 Peer 配置文件加载失败', savedIpv4PeerConfig.msg);
        }

        // 加载IPv6 Peer保存的配置
        const savedIpv6PeerConfig = await window.bgpApi.loadIpv6PeerConfig();
        if (savedIpv6PeerConfig.status === 'success' && savedIpv6PeerConfig.data) {
            console.log('Loading saved ipv6 peer config:', savedIpv6PeerConfig.data);

            // IPv6 settings
            ipv6PeerConfigData.value.peerIpv6 = savedIpv6PeerConfig.data.peerIpv6;
            ipv6PeerConfigData.value.peerIpv6As = savedIpv6PeerConfig.data.peerIpv6As;
            ipv6PeerConfigData.value.holdTimeIpv6 = savedIpv6PeerConfig.data.holdTimeIpv6;
            ipv6PeerConfigData.value.openCapIpv6 = Array.isArray(savedIpv6PeerConfig.data.openCapIpv6)
                ? [...savedIpv6PeerConfig.data.openCapIpv6]
                : [];
            ipv6PeerConfigData.value.addressFamilyIpv6 = Array.isArray(savedIpv6PeerConfig.data.addressFamilyIpv6)
                ? [...savedIpv6PeerConfig.data.addressFamilyIpv6]
                : [];
            ipv6PeerConfigData.value.roleIpv6 = savedIpv6PeerConfig.data.roleIpv6 || '';
            ipv6PeerConfigData.value.openCapCustomIpv6 = savedIpv6PeerConfig.data.openCapCustomIpv6 || '';
        } else {
            console.error('IPv6 Peer 配置文件加载失败', savedIpv6PeerConfig.msg);
        }
    });

    const customOpenCapVisible = ref(false);
    const showCustomOpenCap = () => {
        customOpenCapVisible.value = true;
    };

    const handleCustomOpenCapSubmit = data => {
        ipv4PeerConfigData.value.openCapCustom = data;
    };

    watch(
        () => ipv4PeerConfigData.value.openCap,
        newValue => {
            if (!newValue.includes(BGP_CAPABILITY.ROLE)) {
                ipv4PeerConfigData.value.role = '';
            } else {
                if (ipv4PeerConfigData.value.role === '') {
                    ipv4PeerConfigData.value.role = BGP_ROLE.PROVIDER;
                }
            }
        },
        { deep: true }
    );

    const customOpenCapIpv6Visible = ref(false);
    const showCustomOpenCapIpv6 = () => {
        customOpenCapIpv6Visible.value = true;
    };

    const handleCustomOpenCapIpv6Submit = data => {
        ipv6PeerConfigData.value.openCapCustomIpv6 = data;
    };

    watch(
        () => ipv6PeerConfigData.value.openCapIpv6,
        newValue => {
            if (!newValue.includes(BGP_CAPABILITY.ROLE)) {
                ipv6PeerConfigData.value.roleIpv6 = '';
            } else {
                if (ipv6PeerConfigData.value.roleIpv6 === '') {
                    ipv6PeerConfigData.value.roleIpv6 = BGP_ROLE.PROVIDER;
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

        if (!bgpConfigData.value.addressFamily || bgpConfigData.value.addressFamily.length === 0) {
            message.error('请至少选择一个地址族');
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

    const configIpv4Peer = async () => {
        clearValidationErrors(ipv4PeerConfigvalidationErrors);
        validatePeerIp(ipv4PeerConfigData.value.peerIp, ipv4PeerConfigvalidationErrors);
        validatePeerAs(ipv4PeerConfigData.value.peerAs, ipv4PeerConfigvalidationErrors);
        validateHoldTime(ipv4PeerConfigData.value.holdTime, ipv4PeerConfigvalidationErrors);

        const hasErrors = Object.values(ipv4PeerConfigvalidationErrors.value).some(error => error !== '');
        if (hasErrors) {
            message.error('请检查IPv4 Peer配置信息是否正确');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(ipv4PeerConfigData.value));
            const result = await window.bgpApi.configIpv4Peer(payload);
            if (result.status === 'success') {
                message.success(result.msg);
            } else {
                message.error(result.msg || 'IPv4 Peer配置失败');
            }
        } catch (e) {
            message.error(e);
            console.error(e);
        }
    };

    const configIpv6Peer = async () => {
        clearValidationErrors(ipv6PeerConfigvalidationErrors);
        validatePeerIpv6(ipv6PeerConfigData.value.peerIpv6, ipv6PeerConfigvalidationErrors);
        validatePeerAs(ipv6PeerConfigData.value.peerIpv6As, ipv6PeerConfigvalidationErrors);
        validateHoldTime(ipv6PeerConfigData.value.holdTimeIpv6, ipv6PeerConfigvalidationErrors);

        const hasErrors = Object.values(ipv6PeerConfigvalidationErrors.value).some(error => error !== '');
        if (hasErrors) {
            message.error('请检查IPv6 Peer配置信息是否正确');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(ipv6PeerConfigData.value));
            const result = await window.bgpApi.configIpv6Peer(payload);
            if (result.status === 'success') {
                message.success(result.msg);
            } else {
                message.error(result.msg || 'IPv6 Peer配置失败');
            }
        } catch (e) {
            message.error(e);
            console.error(e);
        }
    };

    const stopBgp = async () => {
        const result = await window.bgpApi.stopBgp();
        if (result.status === 'success') {
            message.success(result.msg);
            bgpRunning.value = false;
        } else {
            message.error(result.msg || 'BGP停止失败');
        }
    };

    const deletePeer = async record => {
        const payload = JSON.parse(JSON.stringify(record));
        const result = await window.bgpApi.deletePeer(payload);
        if (result.status === 'success') {
            message.success(result.msg);
        } else {
            message.error(result.msg || '删除Peer失败');
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
