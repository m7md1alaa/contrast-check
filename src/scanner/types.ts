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
  colorVar?: string; // CSS custom property that produced the color, if any
  bgVar?: string; // CSS custom property that produced the background, if any
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
  severity: 'critical' | 'warning' | 'fine' | 'excellent';
  suggestedFix: {
    color: any;
    hex: string;
    ratio: number;
    property: 'color' | 'background-color';
    deltaE: number;
  } | null;
  screenshot?: string;
}

export interface VariableIssueInstance {
  selector: string;
  text: string;
  xpath: string;
}

export interface VariableIssue {
  variable: string;
  property: 'color' | 'background-color';
  currentValue: string;
  currentHex: string;
  againstVariable: string | null;
  againstValue: string;
  againstHex: string;
  contrastRatio: number;
  aa: boolean;
  aaa: boolean;
  severity: 'critical' | 'warning' | 'fine' | 'excellent';
  affectedCount: number;
  suggestedFix: {
    variable: string;
    newValue: string;
    newHex: string;
    contrastRatio: number;
    property: 'color' | 'background-color';
  } | null;
  instances: VariableIssueInstance[];
}

export interface AnalyzedPage {
  url: string;
  title: string;
  pairs: AnalyzedPair[];
  violations: AnalyzedPair[];
  passes: AnalyzedPair[];
  variableIssues: VariableIssue[];
  stats: {
    total: number;
    passAA: number;
    passAAA: number;
    failAA: number;
    failAAA: number;
  };
  variableStats: {
    uniqueIssues: number;
    affectedElements: number;
    oneOffIssues: number;
  };
  healthScore: number;
  scannedAt: string;
}
