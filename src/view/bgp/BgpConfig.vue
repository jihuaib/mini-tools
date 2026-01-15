<template>
    <div class="mt-container">
        <!-- BGP 配置 Card -->
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

        <!-- BGP 状态信息 Card -->
        <a-card title="BGP 状态信息" class="status-card">
            <a-row :gutter="16">
                <a-col :span="6">
                    <div class="status-item">
                        <div class="status-label">运行状态</div>
                        <div class="status-value">
                            <a-tag :color="bgpRunning ? 'success' : 'default'">
                                {{ bgpRunning ? '运行中' : '已停止' }}
                            </a-tag>
                        </div>
                    </div>
                </a-col>
                <a-col :span="6">
                    <div class="status-item">
                        <div class="status-label">Local AS</div>
                        <div class="status-value">{{ bgpConfigData.localAs || '-' }}</div>
                    </div>
                </a-col>
                <a-col :span="6">
                    <div class="status-item">
                        <div class="status-label">Router ID</div>
                        <div class="status-value">{{ bgpConfigData.routerId || '-' }}</div>
                    </div>
                </a-col>
                <a-col :span="6">
                    <div class="status-item">
                        <div class="status-label">使能地址族</div>
                        <div class="status-value">
                            <a-space v-if="bgpConfigData.addressFamily.length > 0" :size="4" wrap>
                                <a-tag
                                    v-for="family in bgpConfigData.addressFamily"
                                    :key="family"
                                    color="blue"
                                    size="small"
                                >
                                    {{ getAddressFamilyLabel(family) }}
                                </a-tag>
                            </a-space>
                            <span v-else>-</span>
                        </div>
                    </div>
                </a-col>
            </a-row>
        </a-card>
    </div>
</template>

<script setup>
    import { onMounted, ref } from 'vue';
    import { message } from 'ant-design-vue';
    import { BGP_ADDR_FAMILY, DEFAULT_VALUES } from '../../const/bgpConst';
    import { FormValidator, createBgpConfigValidationRules } from '../../utils/validationCommon';

    defineOptions({
        name: 'BgpConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const bgpAddressFamilyOptions = [
        { label: 'Ipv4-UNC', value: BGP_ADDR_FAMILY.IPV4_UNC, disabled: true },
        { label: 'Ipv6-UNC', value: BGP_ADDR_FAMILY.IPV6_UNC },
        { label: 'IPv4-MVPN', value: BGP_ADDR_FAMILY.IPV4_MVPN },
        { label: 'IPv6-MVPN', value: BGP_ADDR_FAMILY.IPV6_MVPN }
    ];

    const bgpConfigData = ref({
        localAs: DEFAULT_VALUES.LOCAL_AS,
        routerId: DEFAULT_VALUES.ROUTER_ID,
        addressFamily: [BGP_ADDR_FAMILY.IPV4_UNC]
    });

    const bgpConfigvalidationErrors = ref({
        localAs: '',
        routerId: ''
    });

    let bgpValidator = new FormValidator(bgpConfigvalidationErrors);
    bgpValidator.addRules(createBgpConfigValidationRules());

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            if (bgpValidator) {
                bgpValidator.clearErrors();
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
    });

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

    const stopBgp = async () => {
        const result = await window.bgpApi.stopBgp();
        if (result.status === 'success') {
            message.success(result.msg);
            bgpRunning.value = false;
        } else {
            message.error(result.msg || 'BGP停止失败');
        }
    };

    // 获取地址族标签
    const getAddressFamilyLabel = family => {
        const option = bgpAddressFamilyOptions.find(opt => opt.value === family);
        return option ? option.label : family;
    };
</script>

<style scoped>
    .status-card {
        margin-top: 16px;
    }

    .status-item {
        text-align: center;
    }

    .status-label {
        font-size: 12px;
        color: #8c8c8c;
        margin-bottom: 8px;
    }

    .status-value {
        font-size: 14px;
        font-weight: 500;
        color: #262626;
        min-height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
