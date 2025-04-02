import { EventBus, EventPriority } from '../src';

// 创建一个事件总线实例
const eventBus = new EventBus();

// 订阅事件
const subscription = eventBus.on('user:login', (user) => {
  console.log('用户已登录:', user.name);
});

// 一次性订阅
eventBus.once('app:init', (data) => {
  console.log('应用已初始化, 配置:', data.config);
});

// 带优先级的订阅（将首先执行）
eventBus.on('user:login', (user) => {
  console.log('用户登录前置处理:', user.name);
}, EventPriority.High);

// 通配符订阅（监听所有事件）
eventBus.onAny((event) => {
  console.log(`事件触发: ${event.event}`, event.data);
});

// 发出事件
eventBus.emit('app:init', { config: { theme: 'dark' } });

// 发出带用户数据的事件
eventBus.emit('user:login', { id: 1, name: '张三' });

// 取消订阅
subscription.unsubscribe();

// 异步处理示例
async function asyncExample() {
  // 发出异步事件
  console.log('开始异步操作...');
  
  const promise = eventBus.emit('data:load', { source: 'api' });
  if (promise instanceof Promise) {
    await promise;
    console.log('所有异步处理器已完成');
  }
}

// 异步事件处理器
eventBus.on('data:load', async (data) => {
  console.log(`正在加载数据，来源: ${data.source}`);
  // 模拟异步操作
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('数据加载完成');
});

// 运行异步示例
asyncExample().catch(console.error); 