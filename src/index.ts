import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { wizardCommand } from './commands/wizard.js';

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

program.parse();
