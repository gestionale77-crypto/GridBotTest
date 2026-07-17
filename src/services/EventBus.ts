import { EventEmitter } from 'events';

export type EventType =
  | 'TICKER_UPDATE'
  | 'ORDERBOOK_UPDATE'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELLED'
  | 'PORTFOLIO_DRIFT'
  | 'RISK_BREACH'
  | 'SYSTEM_OPTIMIZE';

export interface EventPayloads {
  TICKER_UPDATE: { symbol: string; price: number; timestamp: string };
  ORDERBOOK_UPDATE: { symbol: string; bids: [number, number][]; asks: [number, number][]; timestamp: string };
  ORDER_FILLED: { strategyId: string; orderId: string; price: number; amount: number; side: 'BUY' | 'SELL'; fee: number; txSignature: string };
  ORDER_CANCELLED: { strategyId: string; orderId: string };
  PORTFOLIO_DRIFT: { totalDelta: number; riskScore: number };
  RISK_BREACH: { policyCode: string; message: string };
  SYSTEM_OPTIMIZE: { recommendations: string };
}

export class EventBus {
  private static instance: EventBus;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // High-frequency scaling safety
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public publish<K extends EventType>(event: K, payload: EventPayloads[K]): void {
    this.emitter.emit(event, payload);
  }

  public subscribe<K extends EventType>(event: K, callback: (payload: EventPayloads[K]) => void): void {
    this.emitter.on(event, callback);
  }

  public unsubscribe<K extends EventType>(event: K, callback: (payload: EventPayloads[K]) => void): void {
    this.emitter.off(event, callback);
  }
}
export default EventBus;
