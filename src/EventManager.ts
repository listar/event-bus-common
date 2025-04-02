import { EventBus, EventPriority } from './EventBus';
import type { EventHandler, EventSubscription, EventGroup, EventManagerState, EventManagerSnapshot, EventFilter, EventBusOptions } from './types';

/**
 * 事件记录项
 */
interface EventRecord {
  /**
   * 事件名称
   */
  eventName: string;
  
  /**
   * 事件数据
   */
  data: any;
  
  /**
   * 事件触发时间
   */
  timestamp: number;
}

/**
 * 事件管理器选项
 */
export interface EventManagerOptions {
  /**
   * 是否启用状态管理
   * @default false
   */
  enableStateManagement?: boolean;
  
  /**
   * 事件组前缀
   * @default 'group:'
   */
  groupPrefix?: string;
  
  /**
   * 是否记录事件历史
   * @default true
   */
  recordHistory?: boolean;
  
  /**
   * 历史记录最大长度
   * @default 1000
   */
  maxHistoryLength?: number;
  
  /**
   * 事件总线选项
   */
  eventBusOptions?: EventBusOptions;
}

/**
 * 高级事件管理器，提供事件分组、历史记录等功能
 */
export class EventManager {
  private options: Required<EventManagerOptions>;
  private eventBus: EventBus;
  private groups: Map<string, EventGroup>;
  private stateValues: Map<string, any>;
  private stateListeners: Map<string, Set<(newValue: any, oldValue: any | undefined) => void>>;
  private eventHistory: Array<{
    eventName: string;
    data: any;
    timestamp: number;
  }>;
  private eventGroups: Map<string, Set<string>>;
  private groupSubscriptions: Map<string, EventSubscription[]>;
  
  // 内部特殊事件名称
  private static readonly EVENTS = {
    STATE_CHANGE: '@state:change',
    GROUP_CREATED: '@group:created',
    GROUP_UPDATED: '@group:updated',
    GROUP_DELETED: '@group:deleted',
    MANAGER_RESET: '@manager:reset'
  };
  
  /**
   * 创建事件管理器实例
   */
  constructor(options: EventManagerOptions = {}) {
    this.options = {
      enableStateManagement: false,
      groupPrefix: 'group:',
      recordHistory: true,
      maxHistoryLength: 1000,
      eventBusOptions: {},
      ...options
    };
    
    this.eventBus = new EventBus(this.options.eventBusOptions);
    this.groups = new Map();
    this.stateValues = new Map();
    this.stateListeners = new Map();
    this.eventHistory = [];
    this.eventGroups = new Map();
    this.groupSubscriptions = new Map();
  }
  
  /**
   * 创建事件组
   * @param groupName 组名称
   * @param eventNames 事件名称数组
   */
  createGroup(groupName: string, eventNames: string[]): void {
    if (this.eventGroups.has(groupName)) {
      throw new Error(`事件组 "${groupName}" 已存在`);
    }
    
    const eventSet = new Set(eventNames);
    this.eventGroups.set(groupName, eventSet);
    this.groupSubscriptions.set(groupName, []);
    
    // 发出事件组创建事件
    this.emit(EventManager.EVENTS.GROUP_CREATED, {
      groupName,
      eventNames: Array.from(eventSet)
    });
  }
  
  /**
   * 向已有事件组添加事件
   * @param groupName 组名称
   * @param eventNames 事件名称数组
   */
  addToGroup(groupName: string, eventNames: string[]): void {
    const group = this.eventGroups.get(groupName);
    
    if (!group) {
      throw new Error(`事件组 "${groupName}" 不存在`);
    }
    
    const originalCount = group.size;
    eventNames.forEach(name => group.add(name));
    
    // 如果组内事件数量有变化，发出更新事件
    if (group.size > originalCount) {
      this.emit(EventManager.EVENTS.GROUP_UPDATED, {
        groupName,
        eventNames: Array.from(group),
        action: 'add'
      });
    }
  }
  
  /**
   * 从事件组中移除事件
   * @param groupName 组名称
   * @param eventNames 事件名称数组
   */
  removeFromGroup(groupName: string, eventNames: string[]): void {
    const group = this.eventGroups.get(groupName);
    
    if (!group) {
      throw new Error(`事件组 "${groupName}" 不存在`);
    }
    
    const originalCount = group.size;
    eventNames.forEach(name => group.delete(name));
    
    // 如果组内事件数量有变化，发出更新事件
    if (group.size < originalCount) {
      this.emit(EventManager.EVENTS.GROUP_UPDATED, {
        groupName,
        eventNames: Array.from(group),
        action: 'remove'
      });
    }
  }
  
  /**
   * 删除事件组
   * @param groupName 组名称
   */
  deleteGroup(groupName: string): void {
    if (!this.eventGroups.has(groupName)) {
      return;
    }
    
    // 取消所有组订阅
    this.offGroup(groupName);
    
    // 删除组
    const eventNames = Array.from(this.eventGroups.get(groupName) || []);
    this.eventGroups.delete(groupName);
    this.groupSubscriptions.delete(groupName);
    
    // 发出事件组删除事件
    this.emit(EventManager.EVENTS.GROUP_DELETED, {
      groupName,
      eventNames
    });
  }
  
  /**
   * 获取所有事件组
   * @returns 事件组信息对象
   */
  getGroups(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    this.eventGroups.forEach((events, groupName) => {
      result[groupName] = Array.from(events);
    });
    
    return result;
  }
  
  /**
   * 订阅事件组
   * @param groupName 组名称
   * @param handler 事件处理函数
   * @param priority 事件优先级
   * @returns 订阅对象数组
   */
  onGroup<T = any>(
    groupName: string, 
    handler: EventHandler<T>, 
    priority: EventPriority = EventPriority.Normal
  ): EventSubscription {
    const group = this.eventGroups.get(groupName);
    
    if (!group) {
      throw new Error(`事件组 "${groupName}" 不存在`);
    }
    
    const groupSubs = this.groupSubscriptions.get(groupName)!;
    const subscriptions: EventSubscription[] = [];
    
    group.forEach(eventName => {
      const sub = this.eventBus.on(eventName, handler, priority);
      subscriptions.push(sub);
    });
    
    // 聚合所有订阅的取消方法
    const groupSubscription: EventSubscription = {
      unsubscribe: () => {
        subscriptions.forEach(sub => sub.unsubscribe());
        const index = groupSubs.indexOf(groupSubscription);
        if (index !== -1) {
          groupSubs.splice(index, 1);
        }
      }
    };
    
    groupSubs.push(groupSubscription);
    return groupSubscription;
  }
  
  /**
   * 订阅一次性事件组
   * @param groupName 组名称
   * @param handler 事件处理函数
   * @param priority 事件优先级
   * @returns 订阅对象
   */
  onceGroup<T = any>(
    groupName: string, 
    handler: EventHandler<T>, 
    priority: EventPriority = EventPriority.Normal
  ): EventSubscription {
    const group = this.eventGroups.get(groupName);
    
    if (!group) {
      throw new Error(`事件组 "${groupName}" 不存在`);
    }
    
    const groupSubs = this.groupSubscriptions.get(groupName)!;
    const subscriptions: EventSubscription[] = [];
    
    group.forEach(eventName => {
      const sub = this.eventBus.once(eventName, handler, priority);
      subscriptions.push(sub);
    });
    
    // 聚合所有订阅的取消方法
    const groupSubscription: EventSubscription = {
      unsubscribe: () => {
        subscriptions.forEach(sub => sub.unsubscribe());
        const index = groupSubs.indexOf(groupSubscription);
        if (index !== -1) {
          groupSubs.splice(index, 1);
        }
      }
    };
    
    groupSubs.push(groupSubscription);
    return groupSubscription;
  }
  
  /**
   * 取消事件组的所有订阅
   * @param groupName 组名称
   */
  offGroup(groupName: string): void {
    const groupSubs = this.groupSubscriptions.get(groupName);
    
    if (!groupSubs) {
      return;
    }
    
    // 取消每个订阅
    [...groupSubs].forEach(sub => sub.unsubscribe());
    
    // 清空订阅列表
    this.groupSubscriptions.set(groupName, []);
  }
  
  /**
   * 发出事件
   * @param eventName 事件名称
   * @param data 事件数据
   * @returns 处理函数的执行结果
   */
  emit<T = any>(eventName: string, data?: T): void | Promise<void[]> {
    // 如果开启了历史记录，记录此事件
    if (this.options.recordHistory) {
      this.recordEvent(eventName, data);
    }
    
    // 转发到底层事件总线
    return this.eventBus.emit(eventName, data);
  }
  
  /**
   * 获取事件历史记录
   * @param filter 过滤器
   * @returns 过滤后的事件历史记录
   */
  getHistory(filter?: EventFilter): Array<{
    eventName: string;
    data: any;
    timestamp: number;
  }> {
    if (!this.options.recordHistory) {
      return [];
    }

    if (!filter) {
      return this.eventHistory.map(record => ({
        eventName: record.eventName,
        data: record.data,
        timestamp: record.timestamp
      }));
    }

    return this.eventHistory.filter(record => {
      if (filter.event && !filter.event(record.eventName)) {
        return false;
      }
      if (filter.data && !filter.data(record.eventName, record.data)) {
        return false;
      }
      if (filter.timestamp && !filter.timestamp(record.timestamp)) {
        return false;
      }
      return true;
    }).map(record => ({
      eventName: record.eventName,
      data: record.data,
      timestamp: record.timestamp
    }));
  }
  
  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
  
  /**
   * 获取底层事件总线实例
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }
  
  /**
   * 设置状态值
   * @param key 状态键
   * @param value 状态值
   */
  setState<T>(key: string, value: T): void {
    if (!this.options.enableStateManagement) {
      throw new Error('状态管理功能未启用');
    }
    
    const oldValue = this.stateValues.get(key);
    
    // 如果值相同，不触发更新
    if (oldValue === value) {
      return;
    }
    
    this.stateValues.set(key, value);
    
    // 通知监听器
    const listeners = this.stateListeners.get(key);
    if (listeners) {
      listeners.forEach(listener => listener(value, oldValue));
    }
    
    // 发出状态变更事件
    this.emit(EventManager.EVENTS.STATE_CHANGE, {
      key,
      value,
      oldValue
    });
  }
  
  /**
   * 获取状态值
   * @param key 状态键
   * @returns 状态值
   */
  getState<T>(key: string): T | undefined {
    if (!this.options.enableStateManagement) {
      throw new Error('状态管理功能未启用');
    }
    
    return this.stateValues.get(key);
  }
  
  /**
   * 监听状态变化
   * @param key 状态键
   * @param listener 状态变更监听器
   * @returns 取消监听的函数
   */
  onStateChange<T>(key: string, listener: (newValue: T, oldValue: T | undefined) => void): () => void {
    if (!this.options.enableStateManagement) {
      throw new Error('状态管理功能未启用');
    }
    
    if (!this.stateListeners.has(key)) {
      this.stateListeners.set(key, new Set());
    }
    
    const listeners = this.stateListeners.get(key)!;
    listeners.add(listener);
    
    // 返回用于取消监听的函数
    return () => {
      listeners.delete(listener);
    };
  }
  
  /**
   * 重置管理器
   * 清空所有事件组、历史记录和状态
   */
  reset(): void {
    // 取消所有组订阅
    this.eventGroups.forEach((_, groupName) => {
      this.offGroup(groupName);
    });
    
    // 清空事件组
    this.eventGroups.clear();
    this.groupSubscriptions.clear();
    
    // 清空历史记录
    this.clearHistory();
    
    // 清空状态
    if (this.options.enableStateManagement) {
      this.stateValues.clear();
      this.stateListeners.clear();
    }
    
    // 发出重置事件
    this.emit(EventManager.EVENTS.MANAGER_RESET);
  }
  
  /**
   * 记录事件到历史
   */
  private recordEvent(eventName: string, data: any): void {
    this.eventHistory.push({
      eventName,
      data,
      timestamp: Date.now()
    });
    
    // 如果超过最大长度，移除最旧的记录
    if (this.eventHistory.length > this.options.maxHistoryLength) {
      this.eventHistory.shift();
    }
  }
} 