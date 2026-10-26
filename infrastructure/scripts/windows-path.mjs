import { delimiter, join } from 'node:path';

// Test/dev runners use taskkill to clean up children on Windows. Restricted shells
// may omit System32 from PATH even though the utility is installed.
if (process.platform === 'win32' && process.env.SystemRoot) {
  process.env.PATH = `${process.env.PATH ?? ''}${delimiter}${join(process.env.SystemRoot, 'System32')}`;
}
