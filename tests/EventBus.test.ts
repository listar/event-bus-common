import { EventBus, EventPriority, EventFilter } from '../src';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('基础功能', () => {
    test('应该能够订阅和发布事件', () => {
      const results: number[] = [];
      
      eventBus.on('test', () => { void results.push(3); }, EventPriority.Low);
      eventBus.on('test', () => { void results.push(1); }, EventPriority.High);
      eventBus.on('test', () => { void results.push(2); }, EventPriority.Normal);
      eventBus.on('test', () => { void results.push(0); }, EventPriority.Critical);
      
      eventBus.emit('test');
      
      expect(results).toEqual([0, 1, 2, 3]);
    });

    test('应该能够传递事件数据', () => {
      const data = { id: 1, name: 'test' };
      let receivedData: any;
      
      eventBus.on('test', (d) => { receivedData = d; });
      eventBus.emit('test', data);
      
      expect(receivedData).toEqual(data);
    });

    test('应该支持异步事件处理', async () => {
      const results: number[] = [];
      
      eventBus.on('test', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        void results.push(1);
      });
      
      eventBus.on('test', () => { void results.push(2); });
      
      await eventBus.emit('test');
      
      expect(results).toEqual([2, 1]);
    });
  });

  describe('一次性订阅', () => {
    test('once 订阅应该只触发一次', () => {
      let count = 0;
      
      eventBus.once('test', () => { count++; });
      eventBus.emit('test');
      eventBus.emit('test');
      
      expect(count).toBe(1);
    });

    test('once 订阅应该支持优先级', () => {
      const results: number[] = [];
      
      eventBus.once('test', () => { void results.push(1); }, EventPriority.High);
      eventBus.on('test', () => { void results.push(2); }, EventPriority.Low);
      
      eventBus.emit('test');
      
      expect(results).toEqual([1, 2]);
    });
  });

  describe('通配符订阅', () => {
    test('应该能够捕获所有事件', () => {
      const events: string[] = [];
      
      eventBus.onAny(({ event }) => { events.push(event); });
      eventBus.emit('event1');
      eventBus.emit('event2');
      
      expect(events).toEqual(['event1', 'event2']);
    });

    test('通配符订阅应该支持优先级', () => {
      const results: number[] = [];
      
      eventBus.onAny(() => { void results.push(1); }, EventPriority.Low);
      eventBus.on('test', () => { void results.push(2); }, EventPriority.High);
      
      eventBus.emit('test');
      
      expect(results).toEqual([2, 1]);
    });
  });

  describe('取消订阅', () => {
    test('应该能够取消特定事件的所有订阅', () => {
      let count = 0;
      
      eventBus.on('test', () => { count++; });
      eventBus.on('test', () => { count++; });
      eventBus.off('test');
      eventBus.emit('test');
      
      expect(count).toBe(0);
    });

    test('应该能够取消特定处理函数的订阅', () => {
      let count1 = 0;
      let count2 = 0;
      
      const handler1 = () => { count1++; };
      const handler2 = () => { count2++; };
      
      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      eventBus.off('test', handler1);
      eventBus.emit('test');
      
      expect(count1).toBe(0);
      expect(count2).toBe(1);
    });
  });

  describe('错误处理', () => {
    test('应该捕获并处理事件处理中的错误', () => {
      const error = new Error('test error');
      let caughtError: Error | null = null;
      
      eventBus = new EventBus({
        catchErrors: true,
        onError: (err) => { caughtError = err; }
      });
      
      eventBus.on('test', () => { throw error; });
      eventBus.emit('test');
      
      expect(caughtError).toBe(error);
    });

    test('应该在没有错误处理时抛出错误', () => {
      const error = new Error('test error');
      
      eventBus = new EventBus({
        catchErrors: false
      });
      
      eventBus.on('test', () => { throw error; });
      
      expect(() => eventBus.emit('test')).toThrow(error);
    });
  });

  describe('事件过滤器', () => {
    test('应该能够根据事件名称过滤', () => {
      const events: string[] = [];
      
      eventBus.onAny(({ event }) => {
        events.push(event);
      }, {
        event: (eventName: string) => eventName.startsWith('test')
      });
      
      eventBus.emit('test1');
      eventBus.emit('other');
      eventBus.emit('test2');
      
      expect(events).toEqual(['test1', 'test2']);
    });

    test('应该能够根据数据过滤', () => {
      const eventBus = new EventBus();
      const events: string[] = [];
      
      eventBus.onAny(({ event, data }) => {
        events.push(`${event}:${data.id}`);
      }, {
        data: (_: string, data: { id: number }) => data.id > 1
      });
      
      eventBus.emit('test', { id: 1 });
      eventBus.emit('test', { id: 2 });
      eventBus.emit('test', { id: 3 });
      
      expect(events).toEqual(['test:2', 'test:3']);
    });

    test('事件过滤器', () => {
      const eventBus = new EventBus();
      const events: string[] = [];
      
      // 使用事件名称过滤器
      eventBus.onAny(({ event }) => {
        events.push(event);
      }, {
        event: (eventName: string) => eventName.startsWith('test')
      });
      
      // 使用数据过滤器
      eventBus.onAny(({ event, data }) => {
        events.push(`${event}:${data.id}`);
      }, {
        data: (_: string, data: { id: number }) => data.id > 1
      });
      
      eventBus.emit('test1', { id: 1 });
      eventBus.emit('test2', { id: 2 });
      eventBus.emit('other', { id: 3 });
      
      expect(events).toEqual(['test1', 'test2', 'test2:2', 'other:3']);
    });
  });

  describe('事件历史记录', () => {
    test('应该记录事件历史', () => {
      eventBus = new EventBus({
        maxHistorySize: 3
      });
      
      eventBus.emit('event1', { data: 1 });
      eventBus.emit('event2', { data: 2 });
      eventBus.emit('event3', { data: 3 });
      eventBus.emit('event4', { data: 4 });
      
      const history = eventBus.getHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].event).toBe('event2');
      expect(history[1].event).toBe('event3');
      expect(history[2].event).toBe('event4');
    });

    test('应该能够清除历史记录', () => {
      eventBus.emit('test', { data: 1 });
      eventBus.clearHistory();
      
      expect(eventBus.getHistory()).toHaveLength(0);
    });
  });

  describe('事件总线快照', () => {
    test('应该能够获取和恢复快照', () => {
      eventBus.on('test1', () => {});
      eventBus.on('test2', () => {});
      eventBus.emit('test1', { data: 1 });
      
      const snapshot = eventBus.getSnapshot();
      const newEventBus = new EventBus();
      newEventBus.restoreFromSnapshot(snapshot);
      
      expect(newEventBus.eventNames()).toEqual(['test1', 'test2']);
      expect(newEventBus.getHistory()).toHaveLength(1);
      expect(newEventBus.getHistory()[0].event).toBe('test1');
    });
  });

  describe('状态查询', () => {
    test('应该能够获取监听器数量', () => {
      eventBus.on('test1', () => {});
      eventBus.on('test1', () => {});
      eventBus.on('test2', () => {});
      
      expect(eventBus.listenerCount('test1')).toBe(2);
      expect(eventBus.listenerCount('test2')).toBe(1);
    });

    test('应该能够获取通配符监听器数量', () => {
      eventBus.onAny(() => {});
      eventBus.onAny(() => {});
      
      expect(eventBus.wildcardListenerCount()).toBe(2);
    });

    test('应该能够检查是否有监听器', () => {
      eventBus.on('test', () => {});
      
      expect(eventBus.hasListeners('test')).toBe(true);
      expect(eventBus.hasListeners('nonexistent')).toBe(false);
    });

    test('应该能够获取事件总线的当前状态', () => {
      eventBus.on('test1', () => {});
      eventBus.on('test2', () => {});
      eventBus.emit('test1', { data: 1 });
      
      const state = eventBus.getState();
      
      expect(state.eventCount).toBe(2);
      expect(state.totalListeners).toBe(2);
      expect(state.historySize).toBe(1);
      expect(state.options).toBeDefined();
    });
  });
});

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 