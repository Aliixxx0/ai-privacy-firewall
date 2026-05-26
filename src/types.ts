export interface Detection {
  type: string;
  text: string;
  confidence: number;
  start: number;
  end: number;
}

export interface Message {
  type: string;
  payload: any;
}

export type RedactionStrategy = 'mask' | 'hash' | 'remove';

export interface Config {
  enabled: boolean;
  strategy: RedactionStrategy;
  threshold: number;
}