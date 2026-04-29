import inquirer from 'inquirer';
import { checkCommand } from './check.js';
import { logger } from '../utils/logger.js';

export async function wizardCommand() {
  logger.box('ContrastCheck Wizard', 'Answer a few questions to configure your scan.');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter the URL to check:',
      validate: (input: string) => input.length > 0 || 'URL is required',
    },
    {
      type: 'list',
      name: 'viewport',
      message: 'Choose a viewport:',
      choices: [
        { name: 'Desktop (1280x720)', value: '1280x720' },
        { name: 'Laptop (1440x900)', value: '1440x900' },
        { name: 'Mobile (390x844)', value: '390x844' },
        { name: 'Tablet (768x1024)', value: '768x1024' },
      ],
      default: '1280x720',
    },
    {
      type: 'confirm',
      name: 'darkMode',
      message: 'Force dark mode?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'headless',
      message: 'Run headless (no browser window)?',
      default: true,
    },
    {
      type: 'input',
      name: 'output',
      message: 'Report output path:',
      default: './contrast-report.html',
    },
  ]);

  await checkCommand(answers.url, {
    output: answers.output,
    headless: answers.headless,
    viewport: answers.viewport,
    darkMode: answers.darkMode,
    json: false,
  });
}
