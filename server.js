// 数形 · 数学题可视化 —— 启动本地服务
import os from 'node:os';
import { createApp } from './src/app.js';
import { config, endpoint, isLocalEndpoint } from './src/llm.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

createApp().listen(PORT, HOST, () => {
  console.log('\n  数形 · 数学题可视化 已启动');
  console.log(`  本机访问：http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
    if (lan) console.log(`  手机访问（同一 Wi-Fi）：http://${lan.address}:${PORT}`);
    console.log('  注意：局域网模式下同一网络里的设备都能使用本服务，请只在可信的网络中开启。');
  }
  console.log(`  本地模型：${config.provider} @ ${endpoint()}，默认模型 ${config.visionModel}`);
  if (!isLocalEndpoint()) console.log('  注意：模型服务地址不在本机，图片和题目会发送到该地址。');
  console.log('  按 Ctrl+C 停止。\n');
});
