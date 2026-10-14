export type Status = 'pending' | 'processing' | 'done' | 'error' | 'canceled';
export interface Item { id: string; file: File; dur: number; w: number; h: number; status: Status; progress: number; error?: string; out?: Blob }
export interface Eff { on: boolean; v: number }
export type EffKey = 'saturation' | 'brightness' | 'contrast' | 'zoom' | 'speed' | 'grain' | 'frame' | 'grid' | 'mirror' | 'shiftX' | 'shiftY';
export type Settings = Record<EffKey, Eff> & { crf: number; maxLong: number; ratio: string; maxMB: number };
