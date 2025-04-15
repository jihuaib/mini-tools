<template>
  <a-row :gutter="[16,16]">
    <a-col :span="16">
      <a-form :model="bgpData" @finish="startBgp" :label-col="labelCol"
              :wrapper-col="wrapperCol">
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
              <a-input v-model:value="bgpData.localIp" disabled/>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Local AS" name="localAs"
                         :rules="[{ required: true, message: '请输入开始数值' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="bgpData.localAs"/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Peer IP" name="peerIp" :rules="[{ required: true, message: '请输入占位符' }]">
              <a-input v-model:value="bgpData.peerIp"/>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Peer AS" name="peerAs"
                         :rules="[{ required: true, message: '请输入Peer AS' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="bgpData.peerAs"/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Router ID" name="routerId" :rules="[{ required: true, message: '请输入Router ID' }]">
              <a-input v-model:value="bgpData.routerId"/>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Hold Time" name="holdTime"
                         :rules="[{ required: true, message: '请输入holdTime时间' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="bgpData.holdTime"/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="Open能力" name="openCap">
          <a-space>
            <a-checkbox-group v-model:value="bgpData.openCap" :options="openCapOptions" />
            <a-button type="primary" @click="showCustomOpenCap">自定义能力</a-button>
          </a-space>
        </a-form-item>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Address Family" name="addressFamily">
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
                :disabled="!bgpData.openCap.includes('Role')"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Peer state" name="peerState">
              <a-input v-model:value="bgpData.peerState" disabled/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
          <a-space size="middle">
            <a-button type="primary" html-type="submit">启动</a-button>
            <a-button type="primary" danger @click="stopBgp">停止</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-col>

    <a-col :span="8">
      <ScrollTextarea
          v-model:modelValue="bgpLog"
          :height="680"
      />
    </a-col>
  </a-row>

  <CustomPktDrawer
    v-model:visible="customOpenCapVisible"
    v-model:inputValue="bgpData.openCapCustom"
    @submit="handleCustomOpenCapSubmit"
  />
</template>

<script setup>
import {onMounted, ref, toRaw, watch } from 'vue'
import ScrollTextarea from "../components/ScrollTextarea.vue";
import CustomPktDrawer from "../components/CustomPktDrawer.vue";
import {message} from "ant-design-vue";
import { debounce } from 'lodash-es';

defineOptions({
  name: 'BgpEmulator'
})

const labelCol = { style: { width: '100px' } };
const wrapperCol = { span: 40 };

const openCapOptions = [
  { label: 'Address Family', value: 'Address Family', disabled: true },
  { label: 'Route-Refresh', value: 'Route-Refresh' },
  { label: 'AS4', value: 'AS4' },
  { label: 'Role', value: 'Role' },
];

const roleOptions = [
  { label: 'Provider', value: 'Provider' },
  { label: 'RS', value: 'RS' },
  { label: 'RS-Client', value: 'RS-Client' },
  { label: 'Customer', value: 'Customer' },
  { label: 'Lateral Peer', value: 'Lateral Peer' },
];

const addressFamilyOptions = [
  { label: 'Ipv4-UNC', value: 'Ipv4-UNC', disabled: true },
  { label: 'Ipv6-UNC', value: 'Ipv6-UNC' },
];

const bgpData = ref({
  localIp:'',
  localAs:'65535',
  peerIp:'192.168.56.11',
  peerAs:'100',
  routerId: '',
  holdTime: '180',
  openCap:['Address Family', 'Route-Refresh', 'AS4'],
  addressFamily: ['Ipv4-UNC'],
  peerState:'',
  role: '',
  openCapCustom: ''
});

const bgpLog = ref('')

const startBgp = () => {
  try {
    const payload = JSON.parse(JSON.stringify(bgpData.value));
    window.bgpEmulatorApi.startBgp(payload);
  } catch (e) {
    console.error(e);
    message.error(e);
  }
}

const stopBgp = async () => {
  const result = await window.bgpEmulatorApi.stopBgp();
  console.log(result);
};

const networkList = []
const networkInfo = ref([])
const networkValue = ref('')
const handleNetworkChange = (name) => {
  bgpData.value.localIp = networkList.find(item => item.name === name).ip;
  bgpData.value.routerId = networkList.find(item => item.name === name).ip;
}

const saveBgpConfig = {
  networkValue: '',
  localAs: '',
  peerIp: '',
  peerAs: '',
  routerId: '',
  holdTime: '',
  openCap: [],
  addressFamily: [],
  role: '',
  openCapCustom: ''
}

const saveDebounced = debounce((data) => {
  window.bgpEmulatorApi.saveBgpConfig(data);
}, 300)

watch(bgpData, (newValue) => {
  // 转换为saveBgpConfig
  saveBgpConfig.networkValue = networkValue.value;
  saveBgpConfig.localAs = newValue.localAs;
  saveBgpConfig.peerIp = newValue.peerIp;
  saveBgpConfig.peerAs = newValue.peerAs;
  saveBgpConfig.routerId = newValue.routerId;
  saveBgpConfig.holdTime = newValue.holdTime;
  saveBgpConfig.openCap = [...newValue.openCap];
  saveBgpConfig.addressFamily = [...newValue.addressFamily];
  saveBgpConfig.role = newValue.role;
  saveBgpConfig.openCapCustom = newValue.openCapCustom;
  const raw = toRaw(saveBgpConfig);
  saveDebounced(raw)
}, { deep: true, immediate: true })

onMounted(async () => {
  const result = await window.bgpEmulatorApi.getNetworkInfo()
  console.log(result);

  for (const [name, addresses] of Object.entries(result)) {
    addresses.forEach((addr) => {
      if (addr.family === 'IPv4' && !addr.internal) {
        networkList.push({
          name: name,
          ip: addr.address
        })
      }
    })
  }

  // 默认选中第一个
  if (networkList.length > 0) {
    for (let i = 0; i < networkList.length; i++) {
      networkInfo.value.push({
        value: networkList[i].name
      })
    }
    networkValue.value = networkInfo.value[0].value
    handleNetworkChange(networkValue.value)
  }

  window.bgpEmulatorApi.updateBgpData((data) => {
    console.log(data);
    if (data.status === 'success') {
      const response = data.data;
      if (response.op === 'log') {
        bgpLog.value += response.message + '\r\n';
      } else if (response.op === 'peer-state') {
        bgpData.value.peerState = response.message;
      }
    } else {
      console.error(data.msg);
      message.error(data.msg);
    }
  })

  // 加载保存的配置
  const savedConfig = await window.bgpEmulatorApi.loadBgpConfig();
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
    bgpData.value.addressFamily = Array.isArray(savedConfig.data.addressFamily) ? [...savedConfig.data.addressFamily] : [];
    bgpData.value.role = savedConfig.data.role || '';
    bgpData.value.openCapCustom = savedConfig.data.openCapCustom || '';
  }
})

const customOpenCapVisible = ref(false)
const showCustomOpenCap = () => {
  customOpenCapVisible.value = true
}

const handleCustomOpenCapSubmit = (data) => {
  console.log(data)
  bgpData.value.openCapCustom = data
}
</script>

<style scoped>

</style>