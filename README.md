# ContrastCheck

Check color contrast accessibility on websites using real browser rendering.

## Install

```bash
npm install -g contrastcheck
# or
bun install -g contrastcheck
```

Or run directly with npx:

```bash
npx contrastcheck <url>
```

## Usage

### Quick check

```bash
contrastcheck https://example.com
```

The tool accepts URLs, local HTML files, or any file path:

```bash
contrastcheck ./index.html
contrastcheck https://localhost:3000
contrastcheck ../dist/index.html
```

### Commands

| Command | Description |
|---------|-------------|
| `check <url>` | Check a single URL for contrast issues |
| `wizard` | Interactive setup wizard |
| `help` | Show help |

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <path>` | `./contrast-report.html` | Output path for HTML report |
| `--no-headless` | headless | Show browser window during scan |
| `-w, --viewport <wxh>` | `1280x720` | Viewport size |
| `--dark-mode` | false | Force dark mode preference |
| `-f, --format <type>` | `html` | Output format: `html`, `json`, `compact` |
| `--json` | false | Output JSON to stdout instead of HTML report |
| `-q, --quiet` | false | Minimal output (no spinners, progress bars) |
| `--watch` | false | Watch for file changes and re-check automatically |

### Examples

```bash
# Generate an HTML report
contrastcheck https://example.com -o report.html

# Check in dark mode with mobile viewport
contrastcheck https://example.com --dark-mode -w 390x844

# Output JSON to stdout
contrastcheck https://example.com --json
# or
contrastcheck https://example.com -f json

# Watch a local file for changes
contrastcheck ./index.html --watch

# Run with visible browser window
contrastcheck https://example.com --no-headless

# Minimal output for CI
contrastcheck https://example.com -q -f compact
```

### Interactive wizard

```bash
contrastcheck wizard
```

Guides you through URL, viewport, dark mode, headless, and output options.

## How it works

1. **Launch a real browser** (Playwright Chromium) and load the target page
2. **Extract rendered colors** for every visible text element, accounting for CSS, inline styles, inheritance, transparency, and background images
3. **Calculate WCAG contrast ratios** using the standard relative luminance formula
4. **Flag violations** against AA and AAA thresholds:
   - Normal text: AA ≥ 4.5, AAA ≥ 7
   - Large text (18.66px+ bold or 24px+): AA ≥ 3, AAA ≥ 4.5
5. **Suggest fixes** by shifting foreground colors to meet the failing threshold
6. **Generate a report** with screenshots of each violation

## Output formats

- **HTML** (default): Full report with violation list, screenshots, and fix suggestions
- **JSON**: Machine-readable output with all analyzed pairs and metadata
- **Compact**: One-line summary for CI/logs

## Report

The HTML report includes:
- Summary of pass/fail counts (AA & AAA)
- List of violations with contrast ratios
- Suggested color fixes
- Screenshots of failing elements

## Requirements

- Node.js 18+ or Bun
- Playwright will download Chromium on first run

## License

ISC
