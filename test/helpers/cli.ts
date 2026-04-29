import { spawn } from 'child_process';
import { resolve as resolvePath } from 'path';

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    const binPath = resolvePath(process.cwd(), 'bin', 'contrastcheck.js');
    const child = spawn('bun', [binPath, ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
      });
    });
  });
}
