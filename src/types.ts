/**
 * 事件优先级枚举
 */
export enum EventPriority {
  /**
   * 低优先级，最后执行
   */
  Low = 3,

  /**
   * 普通优先级（默认）
   */
  Normal = 2,

  /**
   * 高优先级，较早执行
   */
  High = 1,

  /**
   * 最高优先级，最先执行
   */
  Critical = 0
}

/**
 * 事件过滤器接口
 */
export interface EventFilter {
  /**
   * 事件名称过滤器
   */
  event?: (eventName: string) => boolean;
  
  /**
   * 事件数据过滤器
   */
  data?: (eventName: string, data: any) => boolean;
  
  /**
   * 时间戳过滤器
   */
  timestamp?: (timestamp: number) => boolean;

  /**
   * 通用过滤器
   */
  filter?: (eventName: string, data: any) => boolean;
}

/**
 * 事件总线内部状态的快照
 */
export interface EventBusSnapshot {
  /**
   * 注册的事件名称
   */
  eventNames: string[];
  
  /**
   * 各事件的监听器数量
   */
  listenerCounts: Record<string, number>;
  
  /**
   * 通配符监听器数量
   */
  wildcardListenerCount: number;

  /**
   * 事件历史记录
   */
  history: Array<{
    event: string;
    data: any;
    timestamp: number;
  }>;

  /**
   * 事件总线选项
   */
  options: Required<EventBusOptions>;
}

export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe: () => void;
}

export interface EventBusOptions {
  /**
   * 是否允许异步处理事件
   * @default true
   */
  asyncEventHandling?: boolean;
  
  /**
   * 是否在处理事件时捕获错误
   * @default true
   */
  catchErrors?: boolean;
  
  /**
   * 事件处理错误时的回调
   */
  onError?: (error: Error, eventName: string) => void;
  
  /**
   * 是否允许触发没有订阅者的事件
   * @default true
   */
  allowEmptyEvents?: boolean;

  /**
   * 事件历史记录的最大长度
   * @default 1000
   */
  maxHistorySize?: number;
}

export interface EventManagerOptions extends EventBusOptions {
  enableStateManagement?: boolean;
  groupPrefix?: string;
}

export interface EventGroup {
  name: string;
  events: string[];
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EventManagerState {
  [key: string]: any;
}

export interface EventManagerSnapshot extends EventBusSnapshot {
  groups: EventGroup[];
  state: EventManagerState;
}

export interface EventUtils {
  throttle: <T extends (...args: any[]) => any>(
    fn: T,
    wait: number
  ) => (...args: Parameters<T>) => ReturnType<T>;
  
  debounce: <T extends (...args: any[]) => any>(
    fn: T,
    wait: number
  ) => (...args: Parameters<T>) => ReturnType<T>;
  
  promiseToEvent: <T>(
    promise: Promise<T>,
    eventName: string,
    metadata?: Record<string, any>
  ) => Promise<T>;
} 