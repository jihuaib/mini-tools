<template>
    <div class="mt-container">
        <a-card title="BGP路由配置">
            <a-tabs v-model:active-key="activeTabKey">
                <a-tab-pane :key="BGP_ADDR_FAMILY.IPV4_UNC" tab="IPv4-UNC路由">
                    <a-form :model="ipv4Data" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="Prefix" name="prefix">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.prefix"
                                        :open="!!ipv4UNCValidationErrors.prefix"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.prefix"
                                            :status="ipv4UNCValidationErrors.prefix ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Mask" name="mask">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.mask"
                                        :open="!!ipv4UNCValidationErrors.mask"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.mask"
                                            :status="ipv4UNCValidationErrors.mask ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Count" name="count">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.count"
                                        :open="!!ipv4UNCValidationErrors.count"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.count"
                                            :status="ipv4UNCValidationErrors.count ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item>
                            <a-button type="link" @click="showCustomRouteAttr(IP_TYPE.IPV4)">
                                <template #icon><SettingOutlined /></template>
                                配置自定义路由属性
                            </a-button>
                        </a-form-item>
                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-space size="middle">
                                <a-button type="primary" @click="generateIpv4Routes">生成IPv4路由</a-button>
                                <a-button type="primary" danger :disabled="!hasIpv4Routes" @click="deleteIpv4Routes">
                                    删除IPv4路由
                                </a-button>
                            </a-space>
                        </a-form-item>

                        <!-- IPv4路由列表 -->
                        <div class="route-list-section">
                            <div class="route-list-header">
                                <UnorderedListOutlined />
                                <span class="header-text">已生成IPv4路由列表</span>
                                <a-tag v-if="sentIpv4Routes.length > 0" color="blue">
                                    {{ sentIpv4Routes.length }}
                                </a-tag>
                            </div>
                            <a-table
                                :data-source="sentIpv4Routes"
                                :columns="routeColumns"
                                :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                size="small"
                                :row-key="record => `${record.prefix}-${record.addressFamily}`"
                                :scroll="{ y: 240 }"
                            >
                                <template #bodyCell="{ column, record }">
                                    <template v-if="column.key === 'action'">
                                        <a-button type="primary" danger size="small" @click="deleteSingleRoute(record)">
                                            <template #icon><DeleteOutlined /></template>
                                            删除
                                        </a-button>
                                    </template>
                                    <template v-else-if="column.key === 'prefix'">
                                        <div>{{ record.prefix }}/{{ record.mask }}</div>
                                    </template>
                                    <template v-else-if="column.key === 'addressFamily'">
                                        <div>{{ getAddressFamilyLabel(record.addressFamily) }}</div>
                                    </template>
                                </template>
                            </a-table>
                        </div>
                    </a-form>
                </a-tab-pane>

                <a-tab-pane :key="BGP_ADDR_FAMILY.IPV6_UNC" tab="IPv6-UNC路由">
                    <a-form :model="ipv6Data" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="Prefix" name="prefix">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.prefix"
                                        :open="!!ipv6UNCValidationErrors.prefix"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.prefix"
                                            :status="ipv6UNCValidationErrors.prefix ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Mask" name="mask">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.mask"
                                        :open="!!ipv6UNCValidationErrors.mask"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.mask"
                                            :status="ipv6UNCValidationErrors.mask ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Count" name="count">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.count"
                                        :open="!!ipv6UNCValidationErrors.count"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.count"
                                            :status="ipv6UNCValidationErrors.count ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item>
                            <a-button type="link" @click="showCustomRouteAttr(IP_TYPE.IPV6)">
                                <template #icon><SettingOutlined /></template>
                                配置自定义路由属性
                            </a-button>
                        </a-form-item>
                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-space size="middle">
                                <a-button type="primary" @click="generateIpv6Routes">生成IPv6路由</a-button>
                                <a-button type="primary" danger :disabled="!hasIpv6Routes" @click="deleteIpv6Routes">
                                    删除IPv6路由
                                </a-button>
                            </a-space>
                        </a-form-item>

                        <!-- IPv6路由列表 -->
                        <div class="route-list-section">
                            <div class="route-list-header">
                                <UnorderedListOutlined />
                                <span class="header-text">已生成IPv6路由列表</span>
                                <a-tag v-if="sentIpv6Routes.length > 0" color="blue">
                                    {{ sentIpv6Routes.length }}
                                </a-tag>
                            </div>
                            <a-table
                                :data-source="sentIpv6Routes"
                                :columns="routeColumns"
                                :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                size="small"
                                :row-key="record => `${record.ip}-${record.mask}`"
                                :scroll="{ y: 240 }"
                            >
                                <template #bodyCell="{ column, record }">
                                    <template v-if="column.key === 'action'">
                                        <a-button type="primary" danger size="small" @click="deleteSingleRoute(record)">
                                            <template #icon><DeleteOutlined /></template>
                                            删除
                                        </a-button>
                                    </template>
                                </template>
                            </a-table>
                        </div>
                    </a-form>
                </a-tab-pane>

                <a-tab-pane :key="BGP_ADDR_FAMILY.IPV4_MVPN" tab="IPv4-MVPN路由">
                    <a-form :model="ipv4MvpnData" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="6">
                                <a-form-item label="RD" name="rd">
                                    <a-input v-model:value="ipv4MvpnData.rd" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="6">
                                <a-form-item label="Route Type" name="routeType">
                                    <a-select v-model:value="ipv4MvpnData.routeType" :options="mvpnRouteTypeOptions" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="6">
                                <a-form-item label="RT" name="RT">
                                    <a-input v-model:value="ipv4MvpnData.RT" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="6">
                                <a-form-item label="Count" name="count">
                                    <a-input v-model:value="ipv4MvpnData.count" />
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <!-- Type 1: Intra-AS I-PMSI A-D - Only Originating Router -->
                        <a-row v-if="ipv4MvpnData.routeType === BGP_MVPN_ROUTE_TYPE.INTRA_AS_I_PMSI_AD">
                            <a-col :span="12">
                                <a-form-item label="Orig Router" name="originatingRouterIp">
                                    <a-input v-model:value="ipv4MvpnData.originatingRouterIp" />
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <!-- Type 2: Inter-AS I-PMSI A-D - Only Source AS -->
                        <a-row v-if="ipv4MvpnData.routeType === BGP_MVPN_ROUTE_TYPE.INTER_AS_I_PMSI_AD">
                            <a-col :span="12">
                                <a-form-item label="Source AS" name="sourceAs">
                                    <a-input v-model:value="ipv4MvpnData.sourceAs" />
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <!-- Type 3: S-PMSI A-D - Source, Group, Orig Router -->
                        <a-row v-if="ipv4MvpnData.routeType === BGP_MVPN_ROUTE_TYPE.S_PMSI_AD">
                            <a-col :span="8">
                                <a-form-item label="Source IP" name="sourceIp">
                                    <a-input v-model:value="ipv4MvpnData.sourceIp" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Group IP" name="groupIp">
                                    <a-input v-model:value="ipv4MvpnData.groupIp" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Orig Router" name="originatingRouterIp">
                                    <a-input v-model:value="ipv4MvpnData.originatingRouterIp" />
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <!-- Type 5: Source Active A-D - Source, Group -->
                        <a-row v-if="ipv4MvpnData.routeType === BGP_MVPN_ROUTE_TYPE.SOURCE_ACTIVE_AD">
                            <a-col :span="12">
                                <a-form-item label="Source IP" name="sourceIp">
                                    <a-input v-model:value="ipv4MvpnData.sourceIp" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="12">
                                <a-form-item label="Group IP" name="groupIp">
                                    <a-input v-model:value="ipv4MvpnData.groupIp" />
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <!-- Type 6/7: Join routes - Source AS, Group, Source -->
                        <a-row
                            v-if="
                                ipv4MvpnData.routeType === BGP_MVPN_ROUTE_TYPE.SHARED_TREE_JOIN ||
                                ipv4MvpnData.routeType === BGP_MVPN_ROUTE_TYPE.SOURCE_TREE_JOIN
                            "
                        >
                            <a-col :span="8">
                                <a-form-item label="Source AS" name="sourceAs">
                                    <a-input v-model:value="ipv4MvpnData.sourceAs" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Group IP" name="groupIp">
                                    <a-input v-model:value="ipv4MvpnData.groupIp" />
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Source IP" name="sourceIp">
                                    <a-input v-model:value="ipv4MvpnData.sourceIp" />
                                </a-form-item>
                            </a-col>
                        </a-row>

                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-space size="middle">
                                <a-button type="primary" @click="generateIpv4MvpnRoutes">生成MVPN路由</a-button>
                                <a-button
                                    type="primary"
                                    danger
                                    :disabled="!hasIpv4MvpnRoutes"
                                    @click="deleteIpv4MvpnRoutes"
                                >
                                    删除MVPN路由
                                </a-button>
                            </a-space>
                        </a-form-item>

                        <!-- MVPN路由列表 - 按路由类型分类显示 -->
                        <div class="route-list-section">
                            <div class="route-list-header">
                                <UnorderedListOutlined />
                                <span class="header-text">已生成MVPN路由列表</span>
                                <a-tag v-if="sentIpv4MvpnRoutes.length > 0" color="blue">
                                    总计: {{ sentIpv4MvpnRoutes.length }}
                                </a-tag>
                            </div>

                            <!-- 按路由类型分组显示 -->
                            <a-tabs v-model:active-key="activeMvpnTab" type="card" class="mvpn-route-tabs">
                                <a-tab-pane
                                    v-for="group in groupedMvpnRoutes"
                                    :key="group.type"
                                    :tab="`${group.typeName} (${group.routes.length})`"
                                >
                                    <a-table
                                        :data-source="group.routes"
                                        :columns="getMvpnRouteColumns(group.type)"
                                        :pagination="false"
                                        size="small"
                                        :row-key="
                                            record =>
                                                `${record.rd}-${record.routeType}-${record.sourceIp || ''}-${record.groupIp || ''}-${record.originatingRouterIp || ''}`
                                        "
                                        :scroll="{ y: 300 }"
                                    >
                                        <template #bodyCell="{ column, record }">
                                            <template v-if="column.key === 'action'">
                                                <a-button
                                                    type="primary"
                                                    danger
                                                    size="small"
                                                    @click="deleteSingleRoute(record)"
                                                >
                                                    <template #icon><DeleteOutlined /></template>
                                                    删除
                                                </a-button>
                                            </template>
                                            <template v-else-if="column.key === 'rd'">
                                                {{ record.rd }}
                                            </template>
                                            <template v-else-if="column.key === 'source'">
                                                {{ record.sourceIp }}
                                            </template>
                                            <template v-else-if="column.key === 'group'">
                                                {{ record.groupIp }}
                                            </template>
                                            <template v-else-if="column.key === 'sourceAs'">
                                                {{ record.sourceAs }}
                                            </template>
                                            <template v-else-if="column.key === 'originatingRouter'">
                                                {{ record.originatingRouterIp }}
                                            </template>
                                        </template>
                                    </a-table>
                                </a-tab-pane>
                            </a-tabs>
                        </div>
                    </a-form>
                </a-tab-pane>
            </a-tabs>
        </a-card>

        <CustomPktDrawer
            v-model:visible="customIpv4RouteAttrVisible"
            v-model:input-value="ipv4Data.customAttr"
            @submit="handleCustomIpv4RouteAttrSubmit"
        />

        <CustomPktDrawer
            v-model:visible="customIpv6RouteAttrVisible"
            v-model:input-value="ipv6Data.customAttr"
            @submit="handleCustomIpv6RouteAttrSubmit"
        />
    </div>
</template>

<script setup>
    import { onMounted, ref, computed, onActivated, watch } from 'vue';
    import CustomPktDrawer from '../../components/CustomPktDrawer.vue';
    import { message } from 'ant-design-vue';
    import { SettingOutlined, UnorderedListOutlined, DeleteOutlined } from '@ant-design/icons-vue';
    import { BGP_ADDR_FAMILY, DEFAULT_VALUES, IP_TYPE, BGP_MVPN_ROUTE_TYPE } from '../../const/bgpConst';
    import {
        FormValidator,
        createBgpIpv4RouteConfigValidationRules,
        createBgpIpv6RouteConfigValidationRules
    } from '../../utils/validationCommon';

    defineOptions({
        name: 'RouteConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    // 分别为IPv4和IPv6定义独立的数据对象
    const ipv4Data = ref({
        prefix: DEFAULT_VALUES.IPV4_PREFIX,
        mask: DEFAULT_VALUES.IPV4_MASK,
        count: DEFAULT_VALUES.IPV4_COUNT,
        customAttr: '',
        addressFamily: BGP_ADDR_FAMILY.IPV4_UNC
    });

    const ipv6Data = ref({
        prefix: DEFAULT_VALUES.IPV6_PREFIX,
        mask: DEFAULT_VALUES.IPV6_MASK,
        count: DEFAULT_VALUES.IPV6_COUNT,
        customAttr: '',
        addressFamily: BGP_ADDR_FAMILY.IPV6_UNC
    });

    const ipv4MvpnData = ref({
        rd: '100:1',
        routeType: BGP_MVPN_ROUTE_TYPE.INTRA_AS_I_PMSI_AD,
        RT: '1:1',
        sourceIp: '1.1.1.1',
        groupIp: '239.1.1.1',
        originatingRouterIp: DEFAULT_VALUES.ROUTER_ID,
        sourceAs: DEFAULT_VALUES.LOCAL_AS,
        count: '1',
        addressFamily: BGP_ADDR_FAMILY.IPV4_MVPN
    });

    const mvpnRouteTypeOptions = [
        { label: 'Intra-AS I-PMSI A-D (Type 1)', value: BGP_MVPN_ROUTE_TYPE.INTRA_AS_I_PMSI_AD },
        { label: 'Inter-AS I-PMSI A-D (Type 2)', value: BGP_MVPN_ROUTE_TYPE.INTER_AS_I_PMSI_AD },
        { label: 'S-PMSI A-D (Type 3)', value: BGP_MVPN_ROUTE_TYPE.S_PMSI_AD },
        { label: 'Leaf A-D (Type 4)', value: BGP_MVPN_ROUTE_TYPE.LEAF_AD },
        { label: 'Source Active A-D (Type 5)', value: BGP_MVPN_ROUTE_TYPE.SOURCE_ACTIVE_AD },
        { label: 'Shared Tree Join (Type 6)', value: BGP_MVPN_ROUTE_TYPE.SHARED_TREE_JOIN },
        { label: 'Source Tree Join (Type 7)', value: BGP_MVPN_ROUTE_TYPE.SOURCE_TREE_JOIN }
    ];

    const ipv4UNCValidationErrors = ref({
        prefix: '',
        mask: '',
        count: ''
    });

    const ipv6UNCValidationErrors = ref({
        prefix: '',
        mask: '',
        count: ''
    });

    const ipv4UNCValidator = new FormValidator(ipv4UNCValidationErrors);
    ipv4UNCValidator.addRules(createBgpIpv4RouteConfigValidationRules());

    const ipv6UNCValidator = new FormValidator(ipv6UNCValidationErrors);
    ipv6UNCValidator.addRules(createBgpIpv6RouteConfigValidationRules());

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            if (ipv4UNCValidator) {
                ipv4UNCValidator.clearErrors();
            }
            if (ipv6UNCValidator) {
                ipv6UNCValidator.clearErrors();
            }
        }
    });

    const activeTabKey = ref(BGP_ADDR_FAMILY.IPV4_UNC);

    const hasIpv4Routes = computed(() => sentIpv4Routes.value.length > 0);
    const hasIpv6Routes = computed(() => sentIpv6Routes.value.length > 0);
    const hasIpv4MvpnRoutes = computed(() => sentIpv4MvpnRoutes.value.length > 0);

    watch(activeTabKey, () => {
        if (ipv4UNCValidator) {
            ipv4UNCValidator.clearErrors();
        }
        if (ipv6UNCValidator) {
            ipv6UNCValidator.clearErrors();
        }
    });

    onMounted(async () => {
        // 加载保存的IPv4-UNC路由配置
        const savedIpv4UNCRouteConfig = await window.bgpApi.loadIpv4UNCRouteConfig();
        if (savedIpv4UNCRouteConfig.status === 'success' && savedIpv4UNCRouteConfig.data) {
            // 加载IPv4路由配置
            ipv4Data.value = {
                prefix: savedIpv4UNCRouteConfig.data.prefix,
                mask: savedIpv4UNCRouteConfig.data.mask,
                count: savedIpv4UNCRouteConfig.data.count,
                customAttr: savedIpv4UNCRouteConfig.data.customAttr,
                addressFamily: savedIpv4UNCRouteConfig.data.addressFamily
            };
        } else {
            console.error('IPv4-UNC路由配置文件加载失败', savedIpv4UNCRouteConfig.msg);
        }

        // 加载保存的IPv6-UNC路由配置
        const savedIpv6UNCRouteConfig = await window.bgpApi.loadIpv6UNCRouteConfig();
        if (savedIpv6UNCRouteConfig.status === 'success' && savedIpv6UNCRouteConfig.data) {
            // 加载IPv6路由配置
            ipv6Data.value = {
                prefix: savedIpv6UNCRouteConfig.data.prefix,
                mask: savedIpv6UNCRouteConfig.data.mask,
                count: savedIpv6UNCRouteConfig.data.count,
                customAttr: savedIpv6UNCRouteConfig.data.customAttr,
                addressFamily: savedIpv6UNCRouteConfig.data.addressFamily
            };
        } else {
            console.error('IPv6-UNC路由配置文件加载失败', savedIpv6UNCRouteConfig.msg);
        }

        // Load MVPN Config
        const savedIpv4MvpnRouteConfig = await window.bgpApi.loadIpv4MvpnRouteConfig();
        if (savedIpv4MvpnRouteConfig.status === 'success' && savedIpv4MvpnRouteConfig.data) {
            Object.assign(ipv4MvpnData.value, savedIpv4MvpnRouteConfig.data);
        }
    });

    const customIpv4RouteAttrVisible = ref(false);
    const customIpv6RouteAttrVisible = ref(false);

    const showCustomRouteAttr = ipType => {
        if (ipType === IP_TYPE.IPV4) {
            customIpv4RouteAttrVisible.value = true;
        } else {
            customIpv6RouteAttrVisible.value = true;
        }
    };

    const handleCustomIpv4RouteAttrSubmit = data => {
        ipv4Data.value.customAttr = data;
    };

    const handleCustomIpv6RouteAttrSubmit = data => {
        ipv6Data.value.customAttr = data;
    };

    // 添加显示已发送路由相关数据
    const sentIpv4Routes = ref([]);
    const sentIpv6Routes = ref([]);
    const sentIpv4MvpnRoutes = ref([]);
    const activeMvpnTab = ref(null);

    // 路由表列配置
    const routeColumns = [
        {
            title: '前缀',
            dataIndex: 'ip',
            key: 'ip'
        },
        {
            title: '掩码',
            dataIndex: 'mask',
            key: 'mask',
            width: 80
        },
        {
            title: 'MED',
            dataIndex: 'med',
            key: 'med',
            width: 80
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            align: 'center'
        }
    ];

    const getMvpnRouteColumns = type => {
        const commonColumns = [
            { title: 'RD', key: 'rd', width: 100 },
            { title: '操作', key: 'action', width: 80, align: 'center' }
        ];

        let specificColumns = [];
        switch (type) {
            case BGP_MVPN_ROUTE_TYPE.INTRA_AS_I_PMSI_AD: // Type 1
                specificColumns = [{ title: 'Orig Router', key: 'originatingRouter', width: 150 }];
                break;
            case BGP_MVPN_ROUTE_TYPE.INTER_AS_I_PMSI_AD: // Type 2
                specificColumns = [{ title: 'Source AS', key: 'sourceAs', width: 100 }];
                break;
            case BGP_MVPN_ROUTE_TYPE.S_PMSI_AD: // Type 3
                specificColumns = [
                    { title: 'Source IP', key: 'source', width: 150 },
                    { title: 'Group IP', key: 'group', width: 150 },
                    { title: 'Orig Router', key: 'originatingRouter', width: 150 }
                ];
                break;
            case BGP_MVPN_ROUTE_TYPE.LEAF_AD: // Type 4
                // Type 4 usually has Route Key (S, G) or similar
                specificColumns = [
                    { title: 'Key', key: 'key', width: 200 }, // Placeholder if needed
                    { title: 'Orig Router', key: 'originatingRouter', width: 150 }
                ];
                break;
            case BGP_MVPN_ROUTE_TYPE.SOURCE_ACTIVE_AD: // Type 5
                specificColumns = [
                    { title: 'Source IP', key: 'source', width: 150 },
                    { title: 'Group IP', key: 'group', width: 150 }
                ];
                break;
            case BGP_MVPN_ROUTE_TYPE.SHARED_TREE_JOIN: // Type 6
            case BGP_MVPN_ROUTE_TYPE.SOURCE_TREE_JOIN: // Type 7
                specificColumns = [
                    { title: 'Source AS', key: 'sourceAs', width: 100 },
                    { title: 'Source IP', key: 'source', width: 150 },
                    { title: 'Group IP', key: 'group', width: 150 }
                ];
                break;
            default:
                specificColumns = [
                    { title: 'Source IP', key: 'source', width: 150 },
                    { title: 'Group IP', key: 'group', width: 150 }
                ];
        }

        // Insert specific columns before the 'action' column
        const columns = [...commonColumns];
        columns.splice(columns.length - 1, 0, ...specificColumns);
        return columns;
    };

    // 计算属性：按路由类型分组MVPN路由
    const groupedMvpnRoutes = computed(() => {
        // 遍历所有定义的路由类型选项
        return mvpnRouteTypeOptions.map(option => {
            const routes = sentIpv4MvpnRoutes.value.filter(route => route.routeType === option.value);
            return {
                type: option.value,
                typeName: option.label,
                routes: routes || []
            };
        });
    });

    // 默认选中第一个Tab
    watch(
        activeMvpnTab,
        newVal => {
            if (!newVal && mvpnRouteTypeOptions.length > 0) {
                activeMvpnTab.value = mvpnRouteTypeOptions[0].value;
            }
        },
        { immediate: true }
    );

    // 撤销单个路由
    const deleteSingleRoute = async route => {
        try {
            let config = {
                prefix: route.ip,
                mask: parseInt(route.mask),
                count: 1,
                customAttr: route.customAttr || '',
                addressFamily: route.addressFamily
            };

            if (route.addressFamily === BGP_ADDR_FAMILY.IPV4_MVPN) {
                config = {
                    addressFamily: route.addressFamily,
                    routeType: route.routeType,
                    rd: route.rd,
                    count: 1,
                    originatingRouterIp: route.originatingRouterIp,
                    sourceIp: route.sourceIp,
                    groupIp: route.groupIp,
                    sourceAs: route.sourceAs
                };
            }

            let result;
            if (route.addressFamily === BGP_ADDR_FAMILY.IPV4_UNC) {
                result = await window.bgpApi.deleteIpv4Routes(config);
            } else if (route.addressFamily === BGP_ADDR_FAMILY.IPV6_UNC) {
                result = await window.bgpApi.deleteIpv6Routes(config);
            } else if (route.addressFamily === BGP_ADDR_FAMILY.IPV4_MVPN) {
                result = await window.bgpApi.deleteIpv4MvpnRoutes(config);
            }

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                if (route.addressFamily === BGP_ADDR_FAMILY.IPV4_UNC) {
                    await getRoutes(BGP_ADDR_FAMILY.IPV4_UNC);
                } else if (route.addressFamily === BGP_ADDR_FAMILY.IPV6_UNC) {
                    await getRoutes(BGP_ADDR_FAMILY.IPV6_UNC);
                }
                if (route.addressFamily === BGP_ADDR_FAMILY.IPV4_MVPN) {
                    await getRoutes(BGP_ADDR_FAMILY.IPV4_MVPN);
                }
            } else {
                message.error(`路由删除失败: ${result.msg}`);
            }
        } catch (e) {
            message.error(`路由删除失败: ${e.message}`);
        }
    };

    const getRoutes = async addressFamily => {
        const result = await window.bgpApi.getRoutes(addressFamily);
        if (result.status === 'success') {
            // 将结果转换为表格数据
            const routes = result.data;
            if (addressFamily === BGP_ADDR_FAMILY.IPV4_UNC) {
                sentIpv4Routes.value = Array.isArray(routes) ? [...routes] : [];
            } else if (addressFamily === BGP_ADDR_FAMILY.IPV6_UNC) {
                sentIpv6Routes.value = Array.isArray(routes) ? [...routes] : [];
            } else if (addressFamily === BGP_ADDR_FAMILY.IPV4_MVPN) {
                sentIpv4MvpnRoutes.value = Array.isArray(routes) ? [...routes] : [];
            }
        } else {
            console.error(result.msg);
        }
    };

    // IPv4路由处理
    const generateIpv4Routes = async () => {
        try {
            const hasErrors = ipv4UNCValidator.validate(ipv4Data.value);
            if (hasErrors) {
                message.error('请检查IPv4路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(ipv4Data.value));
            const saveResult = await window.bgpApi.saveIpv4UNCRouteConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            const result = await window.bgpApi.generateIpv4Routes(payload);
            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(BGP_ADDR_FAMILY.IPV4_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv4路由生成失败: ${e.message}`);
        }
    };

    const deleteIpv4Routes = async () => {
        try {
            const hasErrors = ipv4UNCValidator.validate(ipv4Data.value);
            if (hasErrors) {
                message.error('请检查IPv4路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(ipv4Data.value));
            const saveResult = await window.bgpApi.saveIpv4UNCRouteConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            // 从选中的地址族移除路由
            const result = await window.bgpApi.deleteIpv4Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(BGP_ADDR_FAMILY.IPV4_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv4路由删除失败: ${e.message}`);
        }
    };

    // IPv6路由处理
    const generateIpv6Routes = async () => {
        try {
            const hasErrors = ipv6UNCValidator.validate(ipv6Data.value);
            if (hasErrors) {
                message.error('请检查IPv6路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(ipv6Data.value));
            const saveResult = await window.bgpApi.saveIpv6UNCRouteConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            const result = await window.bgpApi.generateIpv6Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(BGP_ADDR_FAMILY.IPV6_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv6路由生成失败: ${e.message}`);
        }
    };

    const deleteIpv6Routes = async () => {
        try {
            const hasErrors = ipv6UNCValidator.validate(ipv6Data.value);
            if (hasErrors) {
                message.error('请检查IPv6路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(ipv6Data.value));
            const saveResult = await window.bgpApi.saveIpv6UNCRouteConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            const result = await window.bgpApi.deleteIpv6Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(BGP_ADDR_FAMILY.IPV6_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv6路由删除失败: ${e.message}`);
        }
    };

    const generateIpv4MvpnRoutes = async () => {
        try {
            let config;

            if (ipv4MvpnData.value.routeType === BGP_MVPN_ROUTE_TYPE.INTRA_AS_I_PMSI_AD) {
                config = {
                    rd: ipv4MvpnData.value.rd,
                    routeType: ipv4MvpnData.value.routeType,
                    originatingRouterIp: ipv4MvpnData.value.originatingRouterIp,
                    addressFamily: BGP_ADDR_FAMILY.IPV4_MVPN,
                    count: ipv4MvpnData.value.count
                };
            } else if (ipv4MvpnData.value.routeType === BGP_MVPN_ROUTE_TYPE.INTER_AS_I_PMSI_AD) {
                config = {
                    rd: ipv4MvpnData.value.rd,
                    routeType: ipv4MvpnData.value.routeType,
                    sourceAs: ipv4MvpnData.value.sourceAs,
                    addressFamily: BGP_ADDR_FAMILY.IPV4_MVPN,
                    count: ipv4MvpnData.value.count
                };
            } else {
                config = ipv4MvpnData.value;
            }
            const payload = JSON.parse(JSON.stringify(config));
            // Save config
            await window.bgpApi.saveIpv4MvpnRouteConfig(payload);

            const result = await window.bgpApi.generateIpv4MvpnRoutes(payload);
            if (result.status === 'success') {
                message.success(result.msg);
                await getRoutes(BGP_ADDR_FAMILY.IPV4_MVPN);
            } else {
                message.error(result.msg);
            }
        } catch (e) {
            message.error(`MVPN路由生成失败: ${e.message}`);
        }
    };

    const deleteIpv4MvpnRoutes = async () => {
        try {
            let config;

            if (ipv4MvpnData.value.routeType === BGP_MVPN_ROUTE_TYPE.INTRA_AS_I_PMSI_AD) {
                config = {
                    rd: ipv4MvpnData.value.rd,
                    routeType: ipv4MvpnData.value.routeType,
                    originatingRouterIp: ipv4MvpnData.value.originatingRouterIp,
                    addressFamily: BGP_ADDR_FAMILY.IPV4_MVPN,
                    count: ipv4MvpnData.value.count
                };
            } else if (ipv4MvpnData.value.routeType === BGP_MVPN_ROUTE_TYPE.INTER_AS_I_PMSI_AD) {
                config = {
                    rd: ipv4MvpnData.value.rd,
                    routeType: ipv4MvpnData.value.routeType,
                    sourceAs: ipv4MvpnData.value.sourceAs,
                    addressFamily: BGP_ADDR_FAMILY.IPV4_MVPN,
                    count: ipv4MvpnData.value.count
                };
            } else {
                config = ipv4MvpnData.value;
            }
            const payload = JSON.parse(JSON.stringify(config));
            const result = await window.bgpApi.deleteIpv4MvpnRoutes(payload);
            if (result.status === 'success') {
                message.success(result.msg);
                await getRoutes(BGP_ADDR_FAMILY.IPV4_MVPN);
            } else {
                message.error(result.msg);
            }
        } catch (e) {
            message.error(`MVPN路由删除失败: ${e.message}`);
        }
    };

    onActivated(async () => {
        await getRoutes(BGP_ADDR_FAMILY.IPV4_UNC);
        await getRoutes(BGP_ADDR_FAMILY.IPV6_UNC);
        await getRoutes(BGP_ADDR_FAMILY.IPV4_MVPN);
    });
</script>

<style scoped>
    /* 路由列表样式 */
    .route-list-section {
        margin-top: 16px;
    }

    .route-list-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding: 8px;
        background-color: #f5f5f5;
        border-radius: 4px;
    }

    .header-text {
        margin-right: 8px;
        font-weight: 500;
    }

    /* Tab样式调整 */
    .mvpn-route-tabs {
        margin-top: 8px;
    }
</style>
