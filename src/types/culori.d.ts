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

  export interface Oklch {
    mode: 'oklch';
    l: number;
    c: number;
    h?: number;
    alpha?: number;
  }

  export function parse(color: string): any;
  export function converter(mode: string): (color: any) => any;
  export function clampRgb(color: Rgb): Rgb;
  export function formatCss(color: any): string;
  export function formatHex(color: any): string | undefined;
  export function formatHex8(color: any): string | undefined;
  export function formatHsl(color: any): string;
  export function formatRgb(color: any): string;
}
