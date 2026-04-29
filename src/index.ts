import { Command } from 'commander';
import { checkCommand } from './commands/check';
import { wizardCommand } from './commands/wizard';

const program = new Command();

program
  .name('contrastcheck')
  .description('Check color contrast accessibility on websites')
  .version('1.0.0');

program
  .command('check')
  .description('Check a single URL for contrast issues')
  .argument('<url>', 'URL to check (local or hosted)')
  .option('-o, --output <path>', 'Output path for HTML report', './contrast-report.html')
  .option('--no-headless', 'Show browser window during scan')
  .option('-w, --viewport <wxh>', 'Viewport size', '1280x720')
  .option('--dark-mode', 'Force dark mode preference')
  .option('--json', 'Output JSON to stdout instead of HTML report')
  .action(checkCommand);

program
  .command('wizard')
  .description('Interactive setup wizard')
  .action(wizardCommand);

// Smart fallback: if the first positional argument looks like a URL or file path
// but isn't a known command, automatically treat it as `check <arg>`
const knownCommands = ['check', 'wizard', 'help'];
const firstArg = process.argv[2];

if (firstArg && !firstArg.startsWith('-') && !knownCommands.includes(firstArg)) {
  const looksLikeTarget =
    firstArg.startsWith('http://') ||
    firstArg.startsWith('https://') ||
    firstArg.startsWith('file://') ||
    firstArg.startsWith('./') ||
    firstArg.startsWith('../') ||
    firstArg.startsWith('/') ||
    firstArg.includes('://') ||
    /\.(html?|php|asp|aspx|jsp|vue|jsx|tsx|svelte)$/i.test(firstArg);

  if (looksLikeTarget) {
    process.argv.splice(2, 0, 'check');
  }
}

// Friendly error for truly unknown commands
program.on('command:*', ([unknownCmd]: string[]) => {
  console.error(`error: unknown command '${unknownCmd}'`);
  console.error('');
  console.error("Did you mean to run one of these?");
  console.error(`  contrastcheck check ${unknownCmd}`);
  console.error(`  contrastcheck wizard`);
  console.error('');
  console.error("Run 'contrastcheck --help' for all available commands.");
  process.exit(1);
});

program.parse();
