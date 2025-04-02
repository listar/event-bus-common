import { EventManager, EventUtils, EventPriority } from '../src';

// 创建一个记录历史的事件管理器
const eventManager = new EventManager({
  recordHistory: true,
  maxHistoryLength: 50
});

// 获取底层事件总线
const eventBus = eventManager.getEventBus();

// 1. 使用事件组
console.log('\n==== 事件组示例 ====');

// 创建事件组
eventManager.createGroup('userEvents', ['user:login', 'user:logout', 'user:update']);

// 订阅整个事件组
const userGroupSub = eventManager.onGroup('userEvents', (data) => {
  console.log('[用户事件组]:', data);
});

// 发出事件组中的事件
eventManager.emit('user:login', { id: 1, name: '张三' });
eventManager.emit('user:update', { id: 1, name: '张三', email: 'zhangsan@example.com' });
eventManager.emit('user:logout', { id: 1 });

// 取消事件组订阅
userGroupSub.unsubscribe();

// 2. 节流和防抖示例
console.log('\n==== 节流和防抖示例 ====');

// 原始处理函数
const originalHandler = (data: any) => {
  console.log('搜索查询:', data);
};

// 创建节流处理函数（最多每500毫秒执行一次）
const throttledHandler = EventUtils.throttle(originalHandler, 500);

// 创建防抖处理函数（停止输入500毫秒后执行）
const debouncedHandler = EventUtils.debounce(originalHandler, 500);

// 订阅事件，使用节流和防抖函数
eventBus.on('search:query:throttled', throttledHandler);
eventBus.on('search:query:debounced', debouncedHandler);

// 模拟快速连续的事件触发
console.log('模拟快速连续的搜索查询事件...');
const mockSearchQueries = ['a', 'ap', 'app', 'appl', 'apple'];

// 立即发出所有事件
mockSearchQueries.forEach((query, index) => {
  setTimeout(() => {
    eventBus.emit('search:query:throttled', query);
    eventBus.emit('search:query:debounced', query);
  }, index * 100);
});

// 3. Promise 和事件互相转换
console.log('\n==== Promise 与事件互相转换 ====');

// 模拟异步操作
async function fetchUserData(userId: number): Promise<any> {
  console.log(`开始获取用户数据 (ID: ${userId})...`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { id: userId, name: '李四', email: 'lisi@example.com' };
}

// 将 Promise 转换为事件
const userDataPromise = fetchUserData(2);
EventUtils.promiseToEvents(
  eventBus,
  userDataPromise,
  'user:data:loaded',
  'user:data:error'
);

// 监听 Promise 对应的事件
eventBus.once('user:data:loaded', (userData) => {
  console.log('用户数据加载完成:', userData);
});

eventBus.once('user:data:error', (error) => {
  console.error('用户数据加载失败:', error);
});

// 将事件转换为 Promise
async function waitForEvent() {
  console.log('等待应用就绪事件...');
  
  try {
    const data = await EventUtils.eventToPromise(eventBus, 'app:ready', undefined, 2000);
    console.log('应用已就绪:', data);
  } catch (error) {
    console.error('等待应用就绪超时');
  }
}

// 执行等待，并在1秒后触发事件
waitForEvent();
setTimeout(() => {
  eventBus.emit('app:ready', { version: '1.0.0' });
}, 1000);

// 4. 等待多个事件
console.log('\n==== 等待多个事件 ====');

// 等待所有指定的事件
async function waitForAllEvents() {
  console.log('等待所有系统组件就绪...');
  
  try {
    const results = await EventUtils.waitForAll(
      eventBus,
      ['database:connected', 'cache:ready', 'api:ready'],
      3000
    );
    
    console.log('所有组件就绪:', results);
  } catch (error: any) {
    console.error('等待组件就绪超时:', error.received);
    console.error('未就绪组件:', error.pending);
  }
}

// 执行等待，并逐个触发事件
waitForAllEvents();

setTimeout(() => eventBus.emit('database:connected', { host: 'localhost' }), 500);
setTimeout(() => eventBus.emit('cache:ready', { size: '1GB' }), 1000);
setTimeout(() => eventBus.emit('api:ready', { endpoints: 5 }), 1500);

// 5. 事件历史记录
setTimeout(() => {
  console.log('\n==== 事件历史记录 ====');
  
  // 获取所有历史记录
  const allHistory = eventManager.getHistory();
  console.log(`总共记录了 ${allHistory.length} 个事件`);
  
  // 获取用户相关的历史记录
  const userHistory = eventManager.getHistory({
    eventNames: ['user:login', 'user:logout', 'user:update', 'user:data:loaded']
  });
  
  console.log('用户相关事件历史:');
  userHistory.forEach(record => {
    console.log(`- ${record.eventName} (${new Date(record.timestamp).toISOString()})`);
  });
}, 3000);

// 6. 事件链
console.log('\n==== 事件链示例 ====');

// 创建事件链
const chainSubscriptions = EventUtils.createEventChain(eventBus, [
  { 
    trigger: 'form:submit', 
    emit: 'data:validate',
    transform: (formData) => ({ fields: formData, timestamp: Date.now() })
  },
  { 
    trigger: 'data:validate', 
    emit: 'data:process',
    transform: (data) => ({ ...data, valid: true })
  },
  { 
    trigger: 'data:process', 
    emit: 'notification:show',
    transform: () => ({ type: 'success', message: '表单提交成功！' })
  }
]);

// 监听通知事件
eventBus.once('notification:show', (notification) => {
  console.log(`[通知] ${notification.type}: ${notification.message}`);
});

// 触发链式事件的起点
console.log('提交表单，触发事件链...');
eventBus.emit('form:submit', { name: '王五', email: 'wangwu@example.com' });

// 清理链式事件订阅
setTimeout(() => {
  chainSubscriptions.forEach(sub => sub.unsubscribe());
  console.log('事件链已清理');
}, 2000); 