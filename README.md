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
| `--all` | false | Include passing elements in output (default shows failures only) |
| `--watch` | false | Watch for file changes and re-check automatically |

### Examples

```bash
# Generate an HTML report
contrastcheck https://example.com -o report.html

# Check in dark mode with mobile viewport
contrastcheck https://example.com --dark-mode -w 390x844

# Output JSON to stdout (failures only by default)
contrastcheck https://example.com --json
# or
contrastcheck https://example.com -f json

# Include all results (passes + failures)
contrastcheck https://example.com -f json --all

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

By default, all formats show **only failures** to keep output focused. Use `--all` to include passing elements.

- **HTML** (default): Report with violation list, screenshots, and fix suggestions
- **JSON**: Machine-readable output with analyzed pairs and metadata
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

## Contributing & Releasing

### CI
Every PR and push to `main` runs type-checking, tests, and a build via GitHub Actions.

### Releasing a new version

We use [**Nyron**](https://github.com/v0id-user/nyron) for automated changelogs and releases.

1. **Bump the version and generate changelog**
   ```bash
   bun run bump -- --type patch   # or minor / major
   ```

2. **Commit the generated changes**
   ```bash
   git add . && git commit -m "chore: release v$(node -p "require('./package.json').version")"
   ```

3. **Push the release boundary tag**
   ```bash
   bun run push-tag
   ```

4. **GitHub Actions takes over**
   - Publishes the package to npm automatically
   - Creates a GitHub Release with auto-generated changelog via Nyron

### Preview a release locally
```bash
bun run release:dry
```

### Required secrets
Add an **`NPM_TOKEN`** secret in your repo settings (Settings → Secrets and variables → Actions):
- Generate a [granular access token](https://www.npmjs.com/settings/tokens) on npm with **Publish** permission for `contrastcheck` and **Bypass 2FA** enabled.

## License

ISC
