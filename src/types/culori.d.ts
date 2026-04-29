declare module 'culori' {
  export interface Rgb {
    mode: 'rgb';
    r: number;
    g: number;
    b: number;
    alpha?: number;
  }

  export interface Rgba extends Rgb {
    alpha: number;
  }

  export function parse(color: string): any;
  export function converter(mode: string): (color: any) => Rgb;
  export function clampRgb(color: Rgb): Rgb;
}
