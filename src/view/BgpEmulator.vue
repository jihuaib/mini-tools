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
                         :rules="[{ required: true, message: '请输入开始数值' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="bgpData.peerAs"/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="Open协商能力" name="openCap">
          <a-checkbox-group v-model:value="bgpData.openCap" :options="openCapOptions" />
        </a-form-item>

        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
          <a-space>
            <a-button type="primary" html-type="submit">启动</a-button>
          </a-space>
          <a-button type="primary" html-type="submit">停止</a-button>
        </a-form-item>
      </a-form>
    </a-col>

    <a-col :span="8">
      <ScrollTextarea
          v-model:modelValue="bgpLog"
          :height="700"
      />
    </a-col>
  </a-row>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import ScrollTextarea from "../components/ScrollTextarea.vue";
import {message} from "ant-design-vue";

const labelCol = { style: { width: '100px' } };
const wrapperCol = { span: 40 };

const openCapOptions = [
  { label: 'Apple', value: 'Apple' },
  { label: 'Pear', value: 'Pear' },
  { label: 'Orange', value: 'Orange' },
];

const bgpData = ref({
  localIp:'',
  localAs:'65535',
  peerIp:'192.168.56.11',
  peerAs:'100',
  openCap:['Apple']
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

const networkList = []
const networkInfo = ref([])
const networkValue = ref('')
const handleNetworkChange = (name) => {
  bgpData.value.localIp = networkList.find(item => item.name === name).ip;
}

onMounted(async () => {
  const result = await window.bgpEmulatorApi.getNetworkInfo()
  console.log(result)

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
      }
    } else {
      console.error(data.msg);
      message.error(data.msg);
    }

  })
})
</script>

<style scoped>

</style>