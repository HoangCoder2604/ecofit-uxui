export type LayoutStyle = Record<string, any>;
export type DesignNode = {
  tag: 'div' | 'p' | 'a' | 'button' | 'img';
  id?: string;
  name?: string;
  style: LayoutStyle;
  children: Array<DesignNode | string>;
  scroll?: boolean;
  gradient?: string;
  asset?: string;
  fit?: 'fill' | 'cover' | 'contain';
};
export type DesignScreen = {
  number: number;
  id: string;
  name: string;
  width: number;
  height: number;
  tree: DesignNode;
};
export type DesignAsset = {
  source: number;
  kind: 'svg' | 'image';
  width?: number;
  height?: number;
};
