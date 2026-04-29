export interface ElementColorPair {
  text: string;
  tag: string;
  color: string; // raw computed color
  background: string; // raw computed background
  selector: string;
  xpath: string;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fontSize: string;
  fontWeight: string;
  isVisible: boolean;
}

export interface PageResult {
  url: string;
  title: string;
  pairs: ElementColorPair[];
  scannedAt: string;
}

export interface AnalyzedPair extends ElementColorPair {
  fgParsed: { r: number; g: number; b: number; a: number } | null;
  bgParsed: { r: number; g: number; b: number; a: number } | null;
  contrastRatio: number;
  aa: boolean;
  aaa: boolean;
  aaLarge: boolean;
  isLargeText: boolean;
  issueType: 'normal' | 'large';
  suggestedFix: {
    color: any;
    hex: string;
    ratio: number;
    property: 'color' | 'background-color';
    deltaE: number;
  } | null;
  screenshot?: string;
}

export interface AnalyzedPage {
  url: string;
  title: string;
  pairs: AnalyzedPair[];
  violations: AnalyzedPair[];
  passes: AnalyzedPair[];
  stats: {
    total: number;
    passAA: number;
    passAAA: number;
    failAA: number;
    failAAA: number;
  };
  scannedAt: string;
}
