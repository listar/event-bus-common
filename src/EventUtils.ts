import { EventBus, EventHandler, EventSubscription } from './EventBus';

/**
 * 事件工具类，提供一些扩展功能
 */
export class EventUtils {
  /**
   * 创建事件节流函数
   * @param handler 原始事件处理函数
   * @param delay 节流时间（毫秒）
   * @returns 节流后的事件处理函数
   */
  static throttle<T = any>(handler: EventHandler<T>, delay: number): EventHandler<T> {
    let lastCall = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: T | null = null;
    let lastResult: void | Promise<void>;
    
    return (data: T) => {
      const now = Date.now();
      const remaining = delay - (now - lastCall);
      
      if (remaining <= 0) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        
        lastCall = now;
        lastResult = handler(data);
        return lastResult;
      } else if (!timeout) {
        lastArgs = data;
        
        timeout = setTimeout(() => {
          lastCall = Date.now();
          timeout = null;
          if (lastArgs !== null) {
            lastResult = handler(lastArgs);
            lastArgs = null;
          }
        }, remaining);
        
        return lastResult;
      }
      
      // 如果在节流期间，返回最后的结果
      return lastResult;
    };
  }
  
  /**
   * 创建事件防抖函数
   * @param handler 原始事件处理函数
   * @param delay 防抖时间（毫秒）
   * @param immediate 是否在开始时立即执行
   * @returns 防抖后的事件处理函数
   */
  static debounce<T = any>(
    handler: EventHandler<T>,
    delay: number,
    immediate = false
  ): EventHandler<T> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastResult: void | Promise<void>;
    
    return (data: T) => {
      const callNow = immediate && !timeout;
      
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        timeout = null;
        if (!immediate) {
          lastResult = handler(data);
        }
      }, delay);
      
      if (callNow) {
        lastResult = handler(data);
      }
      
      return lastResult;
    };
  }
  
  /**
   * 一次性等待多个事件全部触发
   * @param eventBus 事件总线实例
   * @param eventNames 要等待的事件名称数组
   * @param timeout 可选的超时时间（毫秒）
   * @returns Promise，在所有事件触发后或超时后解析
   */
  static waitForAll(
    eventBus: EventBus,
    eventNames: string[],
    timeout?: number
  ): Promise<Record<string, any>> {
    if (eventNames.length === 0) {
      return Promise.resolve({});
    }
    
    return new Promise((resolve, reject) => {
      const results: Record<string, any> = {};
      const pendingEvents = new Set(eventNames);
      const subscriptions: EventSubscription[] = [];
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      
      // 设置可选的超时
      if (timeout !== undefined && timeout > 0) {
        timeoutId = setTimeout(() => {
          // 清理所有订阅
          subscriptions.forEach(sub => sub.unsubscribe());
          
          // 拒绝 Promise，并提供已收到的事件
          reject({
            error: '等待事件超时',
            received: results,
            pending: Array.from(pendingEvents)
          });
        }, timeout);
      }
      
      // 为每个事件创建一次性监听器
      eventNames.forEach(eventName => {
        const subscription = eventBus.once(eventName, (data) => {
          // 保存事件数据
          results[eventName] = data;
          pendingEvents.delete(eventName);
          
          // 如果所有事件都已收到，解析 Promise
          if (pendingEvents.size === 0) {
            if (timeoutId !== null) {
              clearTimeout(timeoutId);
            }
            
            resolve(results);
          }
        });
        
        subscriptions.push(subscription);
      });
    });
  }
  
  /**
   * 等待首个触发的事件
   * @param eventBus 事件总线实例
   * @param eventNames 要等待的事件名称数组
   * @param timeout 可选的超时时间（毫秒）
   * @returns Promise，在任一事件触发后或超时后解析
   */
  static waitForAny(
    eventBus: EventBus,
    eventNames: string[],
    timeout?: number
  ): Promise<{ eventName: string, data: any }> {
    if (eventNames.length === 0) {
      return Promise.reject(new Error('事件名称数组不能为空'));
    }
    
    return new Promise((resolve, reject) => {
      const subscriptions: EventSubscription[] = [];
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let isDone = false;
      
      // 设置可选的超时
      if (timeout !== undefined && timeout > 0) {
        timeoutId = setTimeout(() => {
          if (isDone) return;
          isDone = true;
          
          // 清理所有订阅
          subscriptions.forEach(sub => sub.unsubscribe());
          
          // 拒绝 Promise
          reject(new Error('等待事件超时'));
        }, timeout);
      }
      
      // 为每个事件创建一次性监听器
      eventNames.forEach(eventName => {
        const subscription = eventBus.once(eventName, (data) => {
          if (isDone) return;
          isDone = true;
          
          // 清理所有其他订阅
          subscriptions.forEach(sub => sub.unsubscribe());
          
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
          
          // 解析 Promise
          resolve({ eventName, data });
        });
        
        subscriptions.push(subscription);
      });
    });
  }
  
  /**
   * 将 Promise 转换为事件
   * @param eventBus 事件总线实例
   * @param promise 要转换的 Promise
   * @param successEvent 成功事件名称
   * @param errorEvent 错误事件名称
   * @param metadata 附加到事件数据的元数据
   * @returns 原始 Promise
   */
  static promiseToEvents<T>(
    eventBus: EventBus,
    promise: Promise<T>,
    successEvent: string,
    errorEvent: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    // 标记开始事件
    const startEvent = `${successEvent}:start`;
    const startData = metadata || {};
    eventBus.emit(startEvent, startData);
    
    // 链接 Promise，发出相应事件
    return promise.then(
      (result) => {
        const eventData = metadata 
          ? { ...metadata, result } 
          : result;
        
        eventBus.emit(successEvent, eventData);
        return result;
      },
      (error) => {
        const eventData = metadata 
          ? { ...metadata, error } 
          : error;
        
        eventBus.emit(errorEvent, eventData);
        throw error;
      }
    );
  }
  
  /**
   * 将事件转换为 Promise
   * @param eventBus 事件总线实例
   * @param successEvent 成功事件名称
   * @param errorEvent 可选的错误事件名称
   * @param timeout 可选的超时时间（毫秒）
   * @returns Promise
   */
  static eventToPromise<T = any>(
    eventBus: EventBus,
    successEvent: string,
    errorEvent?: string,
    timeout?: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const subscriptions: EventSubscription[] = [];
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      
      // 成功事件订阅
      const successSub = eventBus.once<T>(successEvent, (data) => {
        subscriptions.forEach(sub => sub.unsubscribe());
        
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        
        resolve(data);
      });
      
      subscriptions.push(successSub);
      
      // 错误事件订阅
      if (errorEvent) {
        const errorSub = eventBus.once(errorEvent, (error) => {
          subscriptions.forEach(sub => sub.unsubscribe());
          
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
          
          reject(error);
        });
        
        subscriptions.push(errorSub);
      }
      
      // 超时处理
      if (timeout !== undefined && timeout > 0) {
        timeoutId = setTimeout(() => {
          subscriptions.forEach(sub => sub.unsubscribe());
          reject(new Error(`等待事件 "${successEvent}" 超时`));
        }, timeout);
      }
    });
  }
  
  /**
   * 创建链式事件
   * @param eventBus 事件总线实例
   * @param eventChain 事件链定义
   * @returns 订阅对象数组
   */
  static createEventChain(
    eventBus: EventBus,
    eventChain: Array<{ trigger: string, emit: string, transform?: (data: any) => any }>
  ): EventSubscription[] {
    const subscriptions: EventSubscription[] = [];
    
    eventChain.forEach(({ trigger, emit, transform }) => {
      const sub = eventBus.on(trigger, (data) => {
        const outputData = transform ? transform(data) : data;
        eventBus.emit(emit, outputData);
      });
      
      subscriptions.push(sub);
    });
    
    return subscriptions;
  }
} 