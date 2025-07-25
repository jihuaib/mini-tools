<template>
    <div class="mt-container">
        <a-row>
            <a-col :span="24">
                <a-card title="邻居信息">
                    <div>
                        <a-tabs v-model:active-key="activePeerInfoTabKey">
                            <a-tab-pane :key="BGP_ADDR_FAMILY.IPV4_UNC" tab="IPv4-UNC邻居">
                                <div class="bgp-peer-info-header">
                                    <UnorderedListOutlined />
                                    <span class="bgp-peer-info-header-text">IPv4-UNC邻居列表</span>
                                    <a-tag v-if="ipv4UncPeerList.length > 0" color="blue">
                                        {{ ipv4UncPeerList.length }}
                                    </a-tag>
                                </div>
                                <a-table
                                    :columns="PeerInfoColumns"
                                    :data-source="ipv4UncPeerList"
                                    :row-key="
                                        record =>
                                            `${record.vrfIndex || ''}-${record.peerIp || ''}-${record.addressFamily || ''}`
                                    "
                                    :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                    :scroll="{ y: 700 }"
                                    size="small"
                                >
                                    <template #bodyCell="{ column, record }">
                                        <template v-if="column.key === 'action'">
                                            <a-button type="primary" danger size="small" @click="deletePeer(record)">
                                                <template #icon><DeleteOutlined /></template>
                                                删除
                                            </a-button>
                                        </template>
                                    </template>
                                </a-table>
                            </a-tab-pane>
                            <a-tab-pane :key="BGP_ADDR_FAMILY.IPV6_UNC" tab="IPv6-UNC邻居">
                                <div class="bgp-peer-info-header">
                                    <UnorderedListOutlined />
                                    <span class="bgp-peer-info-header-text">IPv6-UNC邻居列表</span>
                                    <a-tag v-if="ipv6UncPeerList.length > 0" color="blue">
                                        {{ ipv6UncPeerList.length }}
                                    </a-tag>
                                </div>
                                <a-table
                                    :columns="PeerInfoColumns"
                                    :data-source="ipv6UncPeerList"
                                    :row-key="
                                        record =>
                                            `${record.vrfIndex || ''}-${record.peerIp || ''}-${record.addressFamily || ''}`
                                    "
                                    :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                    :scroll="{ y: 700 }"
                                    size="small"
                                >
                                    <template #bodyCell="{ column, record }">
                                        <template v-if="column.key === 'action'">
                                            <a-button type="primary" danger size="small" @click="deletePeer(record)">
                                                <template #icon><DeleteOutlined /></template>
                                                删除
                                            </a-button>
                                        </template>
                                    </template>
                                </a-table>
                            </a-tab-pane>
                        </a-tabs>
                    </div>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script setup>
    import { onMounted, onActivated, ref, onBeforeUnmount } from 'vue';
    import { message } from 'ant-design-vue';
    import { BGP_ADDR_FAMILY, BGP_PEER_TYPE } from '../../const/bgpConst';
    import { UnorderedListOutlined, DeleteOutlined } from '@ant-design/icons-vue';

    defineOptions({
        name: 'BgpPeerInfo'
    });

    const ipv4UncPeerList = ref([]);
    const ipv6UncPeerList = ref([]);
    const activePeerInfoTabKey = ref(BGP_ADDR_FAMILY.IPV4_UNC);
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
            title: 'Peer Type',
            dataIndex: 'peerType',
            ellipsis: true,
            customRender: ({ text }) => {
                if (text === BGP_PEER_TYPE.PEER_TYPE_IBGP) {
                    return 'IBGP';
                } else if (text === BGP_PEER_TYPE.PEER_TYPE_EBGP) {
                    return 'EBGP';
                } else {
                    return 'UNKNOWN';
                }
            }
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

    const onPeerChange = result => {
        const data = result.data;
        if (result.status === 'success') {
            // 根据地址族类型更新对应的表格数据
            if (data.addressFamily === BGP_ADDR_FAMILY.IPV4_UNC) {
                const index = ipv4UncPeerList.value.findIndex(
                    peer =>
                        `${peer.vrfIndex || ''}-${peer.peerIp || ''}-${peer.addressFamily || ''}` ===
                        `${data.vrfIndex || ''}-${data.peerIp || ''}-${data.addressFamily || ''}`
                );
                if (index !== -1) {
                    ipv4UncPeerList.value[index] = { ...ipv4UncPeerList.value[index], ...data };
                }
            } else if (data.addressFamily === BGP_ADDR_FAMILY.IPV6_UNC) {
                const index = ipv6UncPeerList.value.findIndex(
                    peer =>
                        `${peer.vrfIndex || ''}-${peer.peerIp || ''}-${peer.addressFamily || ''}` ===
                        `${data.vrfIndex || ''}-${data.peerIp || ''}-${data.addressFamily || ''}`
                );
                if (index !== -1) {
                    ipv6UncPeerList.value[index] = { ...ipv6UncPeerList.value[index], ...data };
                }
            }
        } else {
            message.error(data.msg);
        }
    };

    onMounted(async () => {
        window.bgpApi.onPeerChange(onPeerChange);
    });

    const refreshPeerInfo = async () => {
        const peerInfo = await window.bgpApi.getPeerInfo();
        if (peerInfo.status === 'success') {
            // 处理 IPv4-UNC 邻居信息
            ipv4UncPeerList.value = Array.isArray(peerInfo.data[BGP_ADDR_FAMILY.IPV4_UNC])
                ? [...peerInfo.data[BGP_ADDR_FAMILY.IPV4_UNC]]
                : [];

            // 处理 IPv6-UNC 邻居信息
            ipv6UncPeerList.value = Array.isArray(peerInfo.data[BGP_ADDR_FAMILY.IPV6_UNC])
                ? [...peerInfo.data[BGP_ADDR_FAMILY.IPV6_UNC]]
                : [];
        } else {
            console.error(peerInfo.msg || 'Peer信息查询失败');
            ipv4UncPeerList.value = [];
            ipv6UncPeerList.value = [];
        }
    };

    const deletePeer = async record => {
        const payload = JSON.parse(JSON.stringify(record));
        const result = await window.bgpApi.deletePeer(payload);
        if (result.status === 'success') {
            message.success(result.msg);
            await refreshPeerInfo();
        } else {
            message.error(result.msg || '删除Peer失败');
        }
    };

    onActivated(async () => {
        await refreshPeerInfo();
    });

    onBeforeUnmount(() => {
        window.bgpApi.offPeerChange(onPeerChange);
    });
</script>

<style scoped>
    :deep(.ant-table-body) {
        height: 400px !important;
        overflow-y: auto !important;
    }

    .bgp-peer-info-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding: 8px;
        background-color: #f5f5f5;
        border-radius: 4px;
    }

    .bgp-peer-info-header-text {
        margin-right: 8px;
        font-weight: 500;
    }
</style>
