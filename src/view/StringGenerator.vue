<template>
  <div class="container">
      <a-form :model="formState" @finish="handleFinish" :label-col="labelCol"
              :wrapper-col="wrapperCol">
        <!-- 字符串模板输入 -->
        <a-form-item label="字符串模板" name="template" :rules="[{ required: true, message: '请输入模板内容' }]">
          <ScrollTextarea
              v-model:modelValue="formState.template"
              :height="120"
          />
        </a-form-item>

        <!-- 参数配置行 -->
        <a-row>
          <a-col :span="8">
            <a-form-item label="占位符" name="placeholder" :rules="[{ required: true, message: '请输入占位符' }]">
              <a-input v-model:value="formState.placeholder"/>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="开始" name="start"
                         :rules="[{ required: true, message: '请输入开始数值' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="formState.start"/>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="结束" name="end"
                         :rules="[{ required: true, message: '请输入结束数值' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="formState.end"/>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 结果显示 -->
        <a-form-item label="生成结果">
          <ScrollTextarea
              v-model:modelValue="result"
              :height="400"
          />
        </a-form-item>

        <!-- 操作按钮 -->
        <a-form-item :wrapper-col="{ offset: 12, span: 20 }">
            <a-button type="primary" html-type="submit">立即生成</a-button>
        </a-form-item>
      </a-form>
  </div>
</template>

<script setup>
import ScrollTextarea from "../components/ScrollTextarea.vue";
import {ref, toRaw} from 'vue';
import {message} from "ant-design-vue";

defineOptions({
  name: 'StringGenerator'
})

const labelCol = { style: { width: '120px' } };
const wrapperCol = { span: 21 };

const formState = ref({
  template: 'ip address 1.1.1.{A} 24',
  placeholder: '{A}',
  start: '1',
  end: '2'
});

const result = ref('');

const handleFinish = async () => {
  try {
    // 使用兼容性写法
    const payload = JSON.parse(JSON.stringify(toRaw(formState.value)))
    const resp = await window.stringGeneratorApi.generateTemplateString(payload)

    if (resp.status === 'success') {
      result.value = resp.data.join('\r\n')
    } else {
      message.error(resp.msg || '生成失败')
    }
  } catch (e) {
    message.error(e.message || String(e)) // 显示更友好的错误信息
    console.error('生成错误:', e)
  }
};

</script>

<style scoped>

</style>