
export enum ProductType {
  TSHIRT = 'TSHIRT',
  INVITATION = 'INVITATION',
}

export type ImageSize = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';

export interface GeneratedAsset {
  url: string;
  prompt: string;
}

export interface KitResult {
  markdown: string;
  assets: GeneratedAsset[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
