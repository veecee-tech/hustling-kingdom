import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
async function fixtures(mode: string) {
  await exec(
    process.execPath,
    ['apps/api/dist/hustles/test-fixtures.js', mode],
    { env: { ...process.env, NODE_ENV: 'test' }, maxBuffer: 1024 * 1024 },
  );
}
export default async function setup() {
  await fixtures('--prepare');
  return async () => {
    await fixtures('--disable');
  };
}
