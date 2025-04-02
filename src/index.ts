export * from './types';
export { EventBus, EventHandler, EventSubscription } from './EventBus';
export { EventManager } from './EventManager';
export { EventUtils } from './EventUtils';

// 创建默认实例
import { EventBus } from './EventBus';
import { EventManager } from './EventManager';

/**
 * 事件管理器特殊事件名称
 */
export const ManagerEvents = {
  /**
   * 状态变更事件
   */
  STATE_CHANGE: '@state:change',
  
  /**
   * 事件组创建事件
   */
  GROUP_CREATED: '@group:created',
  
  /**
   * 事件组更新事件
   */
  GROUP_UPDATED: '@group:updated',
  
  /**
   * 事件组删除事件
   */
  GROUP_DELETED: '@group:deleted',
  
  /**
   * 管理器重置事件
   */
  MANAGER_RESET: '@manager:reset'
};

export const defaultEventBus = new EventBus();
export const defaultEventManager = new EventManager({
  enableStateManagement: true
}); 