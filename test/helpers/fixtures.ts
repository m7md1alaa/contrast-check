import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(process.cwd(), 'test', 'fixtures');

export interface FixturePage {
  filename: string;
  title: string;
  body: string;
  links?: string[];
  styles?: string;
}

export function buildFixturePage(page: FixturePage): string {
  const linksHtml =
    page.links
      ?.map((href) => `<a href="${href}">${href}</a>`)
      .join('\n') || '';

  const styleTag = page.styles ? `<style>${page.styles}</style>` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <title>${page.title}</title>
  ${styleTag}
</head>
<body>
  ${page.body}
  ${linksHtml ? `<div class="links">${linksHtml}</div>` : ''}
</body>
</html>`;
}

export function writeFixture(pages: FixturePage[]) {
  // Clean and recreate fixtures dir
  try {
    rmSync(FIXTURES_DIR, { recursive: true });
  } catch {}
  mkdirSync(FIXTURES_DIR, { recursive: true });

  for (const page of pages) {
    writeFileSync(join(FIXTURES_DIR, page.filename), buildFixturePage(page));
  }
}

export function fixturePath(filename: string): string {
  return join(FIXTURES_DIR, filename);
}

export function cleanFixtures() {
  try {
    rmSync(FIXTURES_DIR, { recursive: true });
  } catch {}
}
