<template>
    <div class="mt-container">
        <a-form :model="bgpConfigData" :label-col="labelCol" :wrapper-col="wrapperCol" @finish="startBgp">
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
                                    :disabled="bgpRunning"
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
                                    :disabled="bgpRunning"
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
                                v-model:value="bgpConfigData.addressFamily"
                                :disabled="bgpRunning"
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
                        <a-button type="primary" danger :disabled="!bgpRunning" @click="stopBgp">停止BGP</a-button>
                    </a-space>
                </a-form-item>
            </a-card>
        </a-form>

        <a-card title="邻居配置" class="mt-margin-top-10">
            <a-tabs v-model:active-key="activeTabKey">
                <a-tab-pane :key="IP_TYPE.IPV4" tab="IPv4邻居">
                    <a-form
                        :model="ipv4PeerConfigData"
                        :label-col="labelCol"
                        :wrapper-col="wrapperCol"
                        @finish="configIpv4Peer"
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
                                        <a-button type="link" @click="showCustomOpenCap">
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
                                        :disabled="!ipv4PeerConfigData.openCap.includes(BGP_OPEN_CAP_CODE.BGP_ROLE)"
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
                        :label-col="labelCol"
                        :wrapper-col="wrapperCol"
                        @finish="configIpv6Peer"
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
                                        <a-button type="link" @click="showCustomOpenCapIpv6">
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
                                        :disabled="!ipv6PeerConfigData.openCapIpv6.includes(BGP_OPEN_CAP_CODE.BGP_ROLE)"
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
            v-model:input-value="ipv4PeerConfigData.openCapCustom"
            @submit="handleCustomOpenCapSubmit"
        />
        <CustomPktDrawer
            v-model:visible="customOpenCapIpv6Visible"
            v-model:input-value="ipv6PeerConfigData.openCapCustomIpv6"
            @submit="handleCustomOpenCapIpv6Submit"
        />
    </div>
</template>

<script setup>
    import { onMounted, ref, watch } from 'vue';
    import CustomPktDrawer from '../../components/CustomPktDrawer.vue';
    import { message } from 'ant-design-vue';
    import { SettingOutlined } from '@ant-design/icons-vue';
    import { BGP_OPEN_CAP_CODE, BGP_ROLE_TYPE, BGP_ADDR_FAMILY, DEFAULT_VALUES, IP_TYPE } from '../../const/bgpConst';
    import {
        FormValidator,
        createBgpConfigValidationRules,
        createBgpPeerIpv4ConfigValidationRules,
        createBgpPeerIpv6ConfigValidationRules
    } from '../../utils/validationCommon';

    defineOptions({
        name: 'BgpConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const ipv4OpenCapOptions = [
        { label: 'Addr Family', value: BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS, disabled: true },
        { label: 'Route-Refresh', value: BGP_OPEN_CAP_CODE.ROUTE_REFRESH },
        { label: 'FOUR_OCTET_AS', value: BGP_OPEN_CAP_CODE.FOUR_OCTET_AS },
        { label: 'Role', value: BGP_OPEN_CAP_CODE.BGP_ROLE }
    ];

    const ipv6OpenCapOptions = [
        { label: 'Addr Family', value: BGP_OPEN_CAP_CODE.MULTIPROTOCOL_EXTENSIONS, disabled: true },
        { label: 'Route-Refresh', value: BGP_OPEN_CAP_CODE.ROUTE_REFRESH },
        { label: 'FOUR_OCTET_AS', value: BGP_OPEN_CAP_CODE.FOUR_OCTET_AS },
        { label: 'Role', value: BGP_OPEN_CAP_CODE.BGP_ROLE },
        { label: 'Extended Next Hop Encoding', value: BGP_OPEN_CAP_CODE.EXTENDED_NEXT_HOP_ENCODING }
    ];

    const roleOptions = [
        { label: 'Provider', value: BGP_ROLE_TYPE.ROLE_PROVIDER },
        { label: 'ROLE_RS', value: BGP_ROLE_TYPE.ROLE_RS },
        { label: 'ROLE_RS-Client', value: BGP_ROLE_TYPE.ROLE_RS_CLIENT },
        { label: 'Customer', value: BGP_ROLE_TYPE.ROLE_RS_CUSTOMER },
        { label: 'Lateral Peer', value: BGP_ROLE_TYPE.ROLE_PEER }
    ];

    const bgpAddressFamilyOptions = [
        { label: 'Ipv4-UNC', value: BGP_ADDR_FAMILY.IPV4_UNC, disabled: true },
        { label: 'Ipv6-UNC', value: BGP_ADDR_FAMILY.IPV6_UNC }
    ];

    const addressFamilyOptions = [
        { label: 'Ipv4-UNC', value: BGP_ADDR_FAMILY.IPV4_UNC, disabled: true },
        { label: 'Ipv6-UNC', value: BGP_ADDR_FAMILY.IPV6_UNC }
    ];

    const addressFamilyOptionsIpv6 = [
        { label: 'Ipv4-UNC', value: BGP_ADDR_FAMILY.IPV4_UNC },
        { label: 'Ipv6-UNC', value: BGP_ADDR_FAMILY.IPV6_UNC, disabled: true }
    ];

    const bgpConfigData = ref({
        localAs: DEFAULT_VALUES.LOCAL_AS,
        routerId: DEFAULT_VALUES.ROUTER_ID,
        addressFamily: [BGP_ADDR_FAMILY.IPV4_UNC]
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

    let bgpValidator = new FormValidator(bgpConfigvalidationErrors);
    bgpValidator.addRules(createBgpConfigValidationRules());

    let ipv4PeerValidator = new FormValidator(ipv4PeerConfigvalidationErrors);
    ipv4PeerValidator.addRules(createBgpPeerIpv4ConfigValidationRules());

    let ipv6PeerValidator = new FormValidator(ipv6PeerConfigvalidationErrors);
    ipv6PeerValidator.addRules(createBgpPeerIpv6ConfigValidationRules());

    watch(activeTabKey, () => {
        if (bgpValidator) {
            bgpValidator.clearErrors();
        }
        if (ipv4PeerValidator) {
            ipv4PeerValidator.clearErrors();
        }
        if (ipv6PeerValidator) {
            ipv6PeerValidator.clearErrors();
        }
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            if (bgpValidator) {
                bgpValidator.clearErrors();
            }
            if (ipv4PeerValidator) {
                ipv4PeerValidator.clearErrors();
            }
            if (ipv6PeerValidator) {
                ipv6PeerValidator.clearErrors();
            }
        }
    });

    const bgpLoading = ref(false);
    const bgpRunning = ref(false);

    onMounted(async () => {
        // 加载Bgp保存的配置
        const savedBgpConfig = await window.bgpApi.loadBgpConfig();
        if (savedBgpConfig.status === 'success' && savedBgpConfig.data) {
            bgpConfigData.value.localAs = savedBgpConfig.data.localAs;
            bgpConfigData.value.routerId = savedBgpConfig.data.routerId;
            bgpConfigData.value.addressFamily = Array.isArray(savedBgpConfig.data.addressFamily)
                ? [...savedBgpConfig.data.addressFamily]
                : [BGP_ADDR_FAMILY.IPV4_UNC];
        } else {
            console.error('BGP 配置文件加载失败', savedBgpConfig.msg);
        }

        // 加载IPv4 Peer保存的配置
        const savedIpv4PeerConfig = await window.bgpApi.loadIpv4PeerConfig();
        if (savedIpv4PeerConfig.status === 'success' && savedIpv4PeerConfig.data) {
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
            if (!newValue.includes(BGP_OPEN_CAP_CODE.BGP_ROLE)) {
                ipv4PeerConfigData.value.role = '';
            } else {
                if (ipv4PeerConfigData.value.role === '') {
                    ipv4PeerConfigData.value.role = BGP_ROLE_TYPE.ROLE_PROVIDER;
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
            if (!newValue.includes(BGP_OPEN_CAP_CODE.BGP_ROLE)) {
                ipv6PeerConfigData.value.roleIpv6 = '';
            } else {
                if (ipv6PeerConfigData.value.roleIpv6 === '') {
                    ipv6PeerConfigData.value.roleIpv6 = BGP_ROLE_TYPE.ROLE_PROVIDER;
                }
            }
        },
        { deep: true }
    );

    const startBgp = async () => {
        const hasErrors = bgpValidator.validate(bgpConfigData.value);
        if (hasErrors) {
            message.error('请检查BGP配置信息是否正确');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(bgpConfigData.value));
            const saveResult = await window.bgpApi.saveBgpConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            bgpLoading.value = true;
            bgpRunning.value = false;

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
        const hasErrors = ipv4PeerValidator.validate(ipv4PeerConfigData.value);
        if (hasErrors) {
            message.error('请检查IPv4 Peer配置信息是否正确');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(ipv4PeerConfigData.value));
            const saveResult = await window.bgpApi.saveIpv4PeerConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            const result = await window.bgpApi.configIpv4Peer(payload);
            if (result.status === 'success') {
                message.success(result.msg);
            } else {
                message.error(result.msg || 'IPv4 Peer配置失败');
            }
        } catch (e) {
            message.error(e);
        }
    };

    const configIpv6Peer = async () => {
        const hasErrors = ipv6PeerValidator.validate(ipv6PeerConfigData.value);
        if (hasErrors) {
            message.error('请检查IPv6 Peer配置信息是否正确');
            return;
        }

        try {
            const payload = JSON.parse(JSON.stringify(ipv6PeerConfigData.value));
            const saveResult = await window.bgpApi.saveIpv6PeerConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            const result = await window.bgpApi.configIpv6Peer(payload);
            if (result.status === 'success') {
                message.success(result.msg);
            } else {
                message.error(result.msg || 'IPv6 Peer配置失败');
            }
        } catch (e) {
            message.error(e);
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
</script>

<style scoped></style>
