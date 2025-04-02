import { EventPriority } from './types';
import type {
  EventHandler,
  EventSubscription,
  EventBusOptions,
  EventFilter,
  EventBusSnapshot
} from './types';

export { EventPriority };
export type { EventHandler, EventSubscription, EventBusOptions, EventFilter, EventBusSnapshot };

/**
 * 事件总线类，实现发布-订阅模式
 */
export class EventBus {
  private handlers: Map<string, Array<{ 
    handler: EventHandler; 
    priority: EventPriority;
    once: boolean;
  }>>;
  private wildcardHandlers: Array<{
    handler: EventHandler;
    priority: EventPriority;
    once: boolean;
    filter?: EventFilter;
  }>;
  private options: Required<EventBusOptions>;
  private errorHandler: (error: Error, event: string) => void;
  private eventHistory: Array<{ event: string; data: any; timestamp: number }> = [];
  private maxHistorySize: number;
  
  /**
   * 创建新的事件总线实例
   */
  constructor(options: EventBusOptions = {}) {
    this.handlers = new Map();
    this.wildcardHandlers = [];
    this.options = {
      asyncEventHandling: options.asyncEventHandling !== false,
      catchErrors: options.catchErrors !== false,
      onError: options.onError || this.defaultErrorHandler,
      allowEmptyEvents: options.allowEmptyEvents !== false,
      maxHistorySize: options.maxHistorySize || 1000
    };
    this.errorHandler = this.options.onError;
    this.maxHistorySize = this.options.maxHistorySize;
  }

  /**
   * 订阅指定事件
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @param priority 事件优先级
   * @returns 订阅对象，可用于取消订阅
   * @throws 如果eventName为空或handler不是函数
   */
  on<T = any>(
    eventName: string, 
    handler: EventHandler<T>, 
    priority: EventPriority = EventPriority.Normal
  ): EventSubscription {
    this.validateEventName(eventName);
    this.validateHandler(handler);
    
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    
    const handlers = this.handlers.get(eventName)!;
    handlers.push({ handler, priority, once: false });
    
    // 按优先级排序
    this.sortHandlersByPriority(handlers);
    
    return {
      unsubscribe: () => this.off(eventName, handler)
    };
  }

  /**
   * 订阅一次性事件，触发后自动取消订阅
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @param priority 事件优先级
   * @returns 订阅对象，可用于取消订阅
   * @throws 如果eventName为空或handler不是函数
   */
  once<T = any>(
    eventName: string, 
    handler: EventHandler<T>, 
    priority: EventPriority = EventPriority.Normal
  ): EventSubscription {
    this.validateEventName(eventName);
    this.validateHandler(handler);
    
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    
    const handlers = this.handlers.get(eventName)!;
    handlers.push({ handler, priority, once: true });
    
    // 按优先级排序
    this.sortHandlersByPriority(handlers);
    
    return {
      unsubscribe: () => this.off(eventName, handler)
    };
  }

  /**
   * 订阅所有事件
   * @param handler 事件处理函数
   * @param options 订阅选项（优先级或过滤器）
   * @returns 取消订阅函数
   */
  onAny(
    handler: EventHandler<{ event: string; data: any }>,
    options?: EventPriority | EventFilter
  ): EventSubscription {
    this.validateHandler(handler);
    
    const priority = typeof options === 'number' ? options : EventPriority.Normal;
    const filter = typeof options === 'object' && options !== null ? options : undefined;
    
    this.wildcardHandlers.push({
      handler,
      priority,
      once: false,
      filter
    });
    
    // 按优先级排序
    this.sortHandlersByPriority(this.wildcardHandlers);
    
    return {
      unsubscribe: () => {
        const index = this.wildcardHandlers.findIndex(h => h.handler === handler);
        if (index !== -1) {
          this.wildcardHandlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * 取消订阅指定事件
   * @param eventName 事件名称
   * @param handler 可选，指定要取消的处理函数，不指定则取消该事件的所有订阅
   * @throws 如果eventName为空
   */
  off<T = any>(eventName: string, handler?: EventHandler<T>): void {
    this.validateEventName(eventName);
    
    const handlers = this.handlers.get(eventName);
    
    if (!handlers) {
      return;
    }
    
    if (!handler) {
      // 取消所有订阅
      this.handlers.delete(eventName);
      return;
    }
    
    // 取消特定处理函数的订阅
    const index = handlers.findIndex(h => h.handler === handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
    
    // 如果没有处理程序了，删除事件键
    if (handlers.length === 0) {
      this.handlers.delete(eventName);
    }
  }

  /**
   * 发布事件
   * @param eventName 事件名称
   * @param data 事件数据
   * @returns 处理函数的执行结果（如果是异步的，则返回Promise）
   * @throws 如果eventName为空，或不允许空事件且没有订阅者
   */
  emit<T = any>(eventName: string, data?: T): void | Promise<void[]> {
    this.validateEventName(eventName);
    
    // 记录事件到历史
    this.recordEvent(eventName, data);
    
    const handlers = this.handlers.get(eventName) || [];
    
    // 如果不允许空事件且没有处理程序（包括通配符），则抛出错误
    if (!this.options.allowEmptyEvents && 
        handlers.length === 0 && 
        this.wildcardHandlers.length === 0) {
      throw new Error(`没有订阅者的事件: "${eventName}"`);
    }
    
    // 克隆处理函数数组，以便安全迭代
    const clonedHandlers = [...handlers];
    const clonedWildcardHandlers = [...this.wildcardHandlers];
    
    // 执行所有处理函数
    const handlerPromises: Promise<void>[] = [];
    
    // 需要移除的一次性处理函数索引
    const onceHandlerIndices: number[] = [];
    const onceWildcardIndices: number[] = [];
    
    // 执行特定事件处理函数
    for (let i = 0; i < clonedHandlers.length; i++) {
      const { handler, once } = clonedHandlers[i];
      
      if (once) {
        // 收集一次性处理函数的索引，稍后移除
        const originalIndex = handlers.findIndex(h => h.handler === handler);
        if (originalIndex !== -1) {
          onceHandlerIndices.push(originalIndex);
        }
      }
      
      try {
        const result = handler(data);
        if (this.options.asyncEventHandling && result instanceof Promise) {
          handlerPromises.push(result);
        }
      } catch (error) {
        if (this.options.catchErrors) {
          this.errorHandler(error as Error, eventName);
        } else {
          throw error;
        }
      }
    }
    
    // 执行通配符处理函数
    for (let i = 0; i < clonedWildcardHandlers.length; i++) {
      const { handler, once, filter } = clonedWildcardHandlers[i];
      
      // 应用过滤器
      if (filter) {
        if (filter.event && !filter.event(eventName)) {
          continue;
        }
        if (filter.data && !filter.data(eventName, data)) {
          continue;
        }
      }
      
      if (once) {
        // 收集一次性处理函数的索引，稍后移除
        const originalIndex = this.wildcardHandlers.findIndex(h => h.handler === handler);
        if (originalIndex !== -1) {
          onceWildcardIndices.push(originalIndex);
        }
      }
      
      try {
        const result = handler({ event: eventName, data });
        if (this.options.asyncEventHandling && result instanceof Promise) {
          handlerPromises.push(result);
        }
      } catch (error) {
        if (this.options.catchErrors) {
          this.errorHandler(error as Error, eventName);
        } else {
          throw error;
        }
      }
    }
    
    // 从后向前移除一次性处理函数（以避免索引偏移问题）
    onceHandlerIndices.sort((a, b) => b - a);
    for (const index of onceHandlerIndices) {
      handlers.splice(index, 1);
    }
    
    // 移除一次性通配符处理函数
    onceWildcardIndices.sort((a, b) => b - a);
    for (const index of onceWildcardIndices) {
      this.wildcardHandlers.splice(index, 1);
    }
    
    // 如果无处理程序，清理事件键
    if (handlers.length === 0 && this.handlers.has(eventName)) {
      this.handlers.delete(eventName);
    }
    
    if (this.options.asyncEventHandling && handlerPromises.length > 0) {
      return Promise.all(handlerPromises);
    }
  }

  /**
   * 获取指定事件的订阅数量
   * @param eventName 事件名称
   * @returns 订阅数量
   * @throws 如果eventName为空
   */
  listenerCount(eventName: string): number {
    this.validateEventName(eventName);
    
    const handlers = this.handlers.get(eventName);
    return handlers ? handlers.length : 0;
  }

  /**
   * 获取所有已注册的事件名称
   * @returns 事件名称数组
   */
  eventNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 获取通配符处理函数的数量
   * @returns 通配符处理函数数量
   */
  wildcardListenerCount(): number {
    return this.wildcardHandlers.length;
  }
  
  /**
   * 检查是否有指定事件的订阅者
   * @param eventName 事件名称
   * @returns 是否有订阅者
   */
  hasListeners(eventName: string): boolean {
    this.validateEventName(eventName);
    
    return (
      (this.handlers.has(eventName) && this.handlers.get(eventName)!.length > 0) ||
      this.wildcardHandlers.length > 0
    );
  }

  /**
   * 清除所有事件订阅
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers = [];
  }
  
  /**
   * 按优先级对处理函数进行排序
   */
  private sortHandlersByPriority<T>(
    handlers: Array<{ handler: EventHandler<T>, priority: EventPriority, once: boolean }>
  ): void {
    handlers.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * 验证事件名称
   * @throws 如果事件名称无效
   */
  private validateEventName(eventName: string): void {
    if (!eventName || typeof eventName !== 'string' || eventName.trim() === '') {
      throw new Error('事件名称必须是非空字符串');
    }
  }
  
  /**
   * 验证事件处理函数
   * @throws 如果处理函数无效
   */
  private validateHandler(handler: EventHandler): void {
    if (typeof handler !== 'function') {
      throw new Error('事件处理函数必须是函数');
    }
  }

  /**
   * 获取事件总线快照
   */
  getSnapshot(): EventBusSnapshot {
    return {
      eventNames: Array.from(this.handlers.keys()),
      listenerCounts: Object.fromEntries(
        Array.from(this.handlers.entries()).map(([event, handlers]) => [
          event,
          handlers.length
        ])
      ),
      wildcardListenerCount: this.wildcardHandlers.length,
      history: [...this.eventHistory],
      options: { ...this.options }
    };
  }

  /**
   * 从快照恢复事件总线状态
   */
  restoreFromSnapshot(snapshot: EventBusSnapshot): void {
    this.clear();
    this.options = { ...snapshot.options };
    this.eventHistory = [...snapshot.history];
    
    // 恢复事件监听器
    Object.entries(snapshot.listenerCounts).forEach(([eventName, count]) => {
      if (count > 0) {
        this.handlers.set(eventName, []);
      }
    });
  }

  /**
   * 获取事件历史记录
   */
  getHistory(): Array<{ event: string; data: any; timestamp: number }> {
    return [...this.eventHistory];
  }

  /**
   * 清除事件历史记录
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 获取事件监听器数量
   */
  getListenerCount(event: string): number {
    return this.listenerCount(event);
  }

  /**
   * 获取通配符监听器数量
   */
  getWildcardListenerCount(): number {
    return this.wildcardListenerCount();
  }

  /**
   * 检查是否有任何监听器
   */
  hasAnyListeners(): boolean {
    return this.handlers.size > 0 || this.wildcardHandlers.length > 0;
  }

  /**
   * 获取事件总线的当前状态
   */
  getState(): {
    eventCount: number;
    totalListeners: number;
    historySize: number;
    options: EventBusOptions;
  } {
    return {
      eventCount: this.handlers.size,
      totalListeners: Array.from(this.handlers.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0
      ),
      historySize: this.eventHistory.length,
      options: { ...this.options }
    };
  }

  /**
   * 记录事件到历史
   */
  private recordEvent(event: string, data: any): void {
    this.eventHistory.push({
      event,
      data,
      timestamp: Date.now()
    });
    
    // 如果超过最大长度，移除最旧的记录
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private defaultErrorHandler(error: Error, event: string): void {
    console.error(`[EventBus] Error in event handler for "${event}":`, error);
  }
}