# Event Bus

一个强大的 TypeScript 事件总线库，支持事件管理、状态管理和事件分组。

## 特性

- 基础事件发布/订阅
- 事件优先级
- 一次性事件订阅
- 通配符（全局）事件订阅
- 异步事件处理
- 错误捕获和处理
- 事件分组管理
- 事件历史记录
- 状态管理
- 事件过滤器
- 事件总线快照
- 实用工具函数（节流、防抖、Promise 转事件）

## 安装

```bash
npm install event-bus-common --save
```

## 使用

### 基础用法

```typescript
import { EventBus, EventPriority } from 'event-bus-common';

const eventBus = new EventBus();

// 订阅事件
eventBus.on('userCreated', (user) => {
  console.log('新用户创建:', user);
});

// 发布事件
eventBus.emit('userCreated', { id: 1, name: '张三' });
```

### 事件优先级

```typescript
const results: number[] = [];

eventBus.on('test', () => { void results.push(3); }, EventPriority.Low);
eventBus.on('test', () => { void results.push(1); }, EventPriority.High);
eventBus.on('test', () => { void results.push(2); }, EventPriority.Normal);
eventBus.on('test', () => { void results.push(0); }, EventPriority.Critical);

eventBus.emit('test');
// 结果: [0, 1, 2, 3]
```

### 一次性订阅

```typescript
eventBus.once('oneTime', (data) => {
  console.log('只触发一次:', data);
});
```

### 通配符订阅

```typescript
eventBus.onAny(({ event, data }) => {
  console.log(`收到事件 ${event}:`, data);
});
```

### 事件分组

```typescript
import { EventManager } from 'event-bus-common';

const manager = new EventManager();

// 创建事件组
manager.createGroup('userEvents', {
  events: ['userCreated', 'userUpdated', 'userDeleted'],
  description: '用户相关事件'
});

// 订阅组内所有事件
manager.onGroup('userEvents', (event, data) => {
  console.log(`用户事件 ${event}:`, data);
});
```

### 状态管理

```typescript
const manager = new EventManager({
  enableStateManagement: true
});

// 设置状态
manager.setState('user', { id: 1, name: '张三' });

// 监听状态变化
manager.onStateChange('user', (newState) => {
  console.log('用户状态更新:', newState);
});
```

### 事件历史记录

```typescript
const eventBus = new EventBus({
  maxHistorySize: 100
});

// 获取历史记录
const history = eventBus.getHistory();
```

### 事件过滤器

```typescript
const eventBus = new EventBus();

// 使用过滤器订阅事件
eventBus.on('userCreated', (user) => {
  console.log('新用户创建:', user);
}, {
  filter: (data) => data.age > 18
});
```

### 事件总线快照

```typescript
const eventBus = new EventBus();

// 获取快照
const snapshot = eventBus.getSnapshot();

// 从快照恢复
eventBus.restoreFromSnapshot(snapshot);
```

### 实用工具

```typescript
import { EventUtils } from 'event-bus-common';

// 节流
const throttledFn = EventUtils.throttle((data) => {
  console.log('节流函数:', data);
}, 1000);

// 防抖
const debouncedFn = EventUtils.debounce((data) => {
  console.log('防抖函数:', data);
}, 1000);

// Promise 转事件
const promise = fetch('/api/data');
EventUtils.promiseToEvent(promise, 'dataLoaded', { source: 'api' });
```

## API 文档

### EventBus

- `on(event: string, handler: EventHandler, priority?: EventPriority): EventSubscription`
- `once(event: string, handler: EventHandler, priority?: EventPriority): EventSubscription`
- `onAny(handler: EventHandler<{ event: string; data: any }>): EventSubscription`
- `off(event: string): void`
- `emit(event: string, data?: any): void | Promise<void>`
- `clear(): void`
- `getSnapshot(): EventBusSnapshot`
- `restoreFromSnapshot(snapshot: EventBusSnapshot): void`
- `getHistory(): Array<{ event: string; data: any; timestamp: number }>`
- `clearHistory(): void`
- `getListenerCount(event: string): number`
- `getWildcardListenerCount(): number`
- `hasAnyListeners(): boolean`
- `hasListeners(event: string): boolean`
- `eventNames(): string[]`
- `listenerCount(event: string): number`
- `getState(): { eventCount: number; totalListeners: number; historySize: number; options: EventBusOptions }`

### EventManager

- `createGroup(name: string, options: { events: string[]; description?: string }): EventGroup`
- `updateGroup(name: string, options: { events?: string[]; description?: string }): EventGroup`
- `deleteGroup(name: string): void`
- `onGroup(groupName: string, handler: (event: string, data: any) => void): EventSubscription`
- `setState(key: string, value: any): void`
- `getState(key: string): any`
- `onStateChange(key: string, handler: (value: any) => void): EventSubscription`
- `reset(): void`
- `getSnapshot(): EventManagerSnapshot`
- `restoreFromSnapshot(snapshot: EventManagerSnapshot): void`

### EventUtils

- `throttle<T extends (...args: any[]) => any>(fn: T, wait: number): (...args: Parameters<T>) => ReturnType<T>`
- `debounce<T extends (...args: any[]) => any>(fn: T, wait: number): (...args: Parameters<T>) => ReturnType<T>`
- `promiseToEvent<T>(promise: Promise<T>, eventName: string, metadata?: Record<string, any>): Promise<T>`

## 许可证

MIT 