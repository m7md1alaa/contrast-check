import chalk from 'chalk';
import ora, { Ora } from 'ora';
import boxen from 'boxen';

let currentSpinner: Ora | null = null;

export const logger = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✖'), msg),
  
  startSpinner: (text: string): Ora => {
    currentSpinner = ora(text).start();
    return currentSpinner;
  },
  
  stopSpinner: (text?: string, success = true) => {
    if (currentSpinner) {
      if (success) {
        currentSpinner.succeed(text);
      } else {
        currentSpinner.fail(text);
      }
      currentSpinner = null;
    }
  },
  
  box: (title: string, content: string) => {
    console.log(
      boxen(content, {
        title,
        titleAlignment: 'left',
        padding: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      })
    );
  },
};
