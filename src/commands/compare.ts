import Table from 'cli-table3';
import { parseColor, rgbToHex } from '../analyzer/color';
import { calculateContrast, ContrastResult } from '../analyzer/contrast';
import { suggestFix } from '../analyzer/suggest';
import { logger } from '../utils/logger';

export interface CompareOptions {
  json?: boolean;
  table?: boolean;
  hex?: boolean;
}

interface CompareOutput {
  foreground: {
    input: string;
    hex: string;
    rgb: { r: number; g: number; b: number; a: number };
  };
  background: {
    input: string;
    hex: string;
    rgb: { r: number; g: number; b: number; a: number };
  };
  contrast: ContrastResult;
  suggestion?: {
    property: 'color' | 'background-color';
    hex: string;
    ratio: number;
  };
}

function buildOutput(fgRaw: string, bgRaw: string, fgParsed: any, bgParsed: any, contrast: ContrastResult, options: CompareOptions): CompareOutput {
  const suggestion = !contrast.aa
    ? suggestFix(fgParsed, bgParsed, 4.5)
    : null;

  const out: CompareOutput = {
    foreground: {
      input: fgRaw,
      hex: rgbToHex(fgParsed),
      rgb: { r: fgParsed.r, g: fgParsed.g, b: fgParsed.b, a: fgParsed.a },
    },
    background: {
      input: bgRaw,
      hex: rgbToHex(bgParsed),
      rgb: { r: bgParsed.r, g: bgParsed.g, b: bgParsed.b, a: bgParsed.a },
    },
    contrast,
  };

  if (suggestion) {
    out.suggestion = {
      property: suggestion.property,
      hex: suggestion.hex,
      ratio: Math.round(suggestion.ratio * 100) / 100,
    };
  }

  return out;
}

function printText(out: CompareOutput, options: CompareOptions) {
  const lines: string[] = [
    `Ratio:         ${out.contrast.ratio}:1`,
    `AA Normal:     ${out.contrast.aa ? '✅ Pass' : '❌ Fail'}`,
    `AAA Normal:    ${out.contrast.aaa ? '✅ Pass' : '❌ Fail'}`,
    `AA Large:      ${out.contrast.aaLarge ? '✅ Pass' : '❌ Fail'}`,
    `AAA Large:     ${out.contrast.aaaLarge ? '✅ Pass' : '❌ Fail'}`,
  ];

  if (options.hex) {
    lines.push(
      ``,
      `Foreground:    ${out.foreground.hex}  (input: ${out.foreground.input})`,
      `Background:    ${out.background.hex}  (input: ${out.background.input})`
    );
  }

  if (out.suggestion) {
    lines.push(
      ``,
      `💡 Suggestion:  change ${out.suggestion.property} to ${out.suggestion.hex} (ratio: ${out.suggestion.ratio}:1)`
    );
  }

  logger.box('Contrast Result', lines.join('\n'));
}

function printTable(out: CompareOutput, options: CompareOptions) {
  const table = new Table({
    head: ['Metric', 'Value'],
    style: { head: ['cyan'] },
  });

  table.push(['Ratio', `${out.contrast.ratio}:1`]);
  table.push(['AA Normal', out.contrast.aa ? '✅ Pass' : '❌ Fail']);
  table.push(['AAA Normal', out.contrast.aaa ? '✅ Pass' : '❌ Fail']);
  table.push(['AA Large', out.contrast.aaLarge ? '✅ Pass' : '❌ Fail']);
  table.push(['AAA Large', out.contrast.aaaLarge ? '✅ Pass' : '❌ Fail']);

  if (options.hex) {
    table.push(['Foreground', `${out.foreground.hex}  (${out.foreground.input})`]);
    table.push(['Background', `${out.background.hex}  (${out.background.input})`]);
  }

  if (out.suggestion) {
    table.push([
      'Suggestion',
      `change ${out.suggestion.property} to ${out.suggestion.hex} (ratio: ${out.suggestion.ratio}:1)`,
    ]);
  }

  console.log(table.toString());
}

function printJson(out: CompareOutput) {
  console.log(JSON.stringify(out, null, 2));
}

export function compareCommand(fg: string, bg: string, options: CompareOptions) {
  const fgParsed = parseColor(fg);
  const bgParsed = parseColor(bg);

  if (!fgParsed) {
    logger.error(`Invalid foreground color: "${fg}"`);
    process.exit(1);
  }

  if (!bgParsed) {
    logger.error(`Invalid background color: "${bg}"`);
    process.exit(1);
  }

  const contrast = calculateContrast(fgParsed, bgParsed);
  const out = buildOutput(fg, bg, fgParsed, bgParsed, contrast, options);

  if (options.json) {
    printJson(out);
    return;
  }

  if (options.table) {
    printTable(out, options);
    return;
  }

  printText(out, options);
}
