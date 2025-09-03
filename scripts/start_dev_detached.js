const { spawn } = require('child_process')
const path = require('path')

const cwd = process.cwd()
const nextBin = path.join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next')

console.log('Starting Next.js dev server on port 3006 (detached)...')
const child = spawn(nextBin, ['dev', '--port', '3006'], {
  cwd,
  detached: true,
  stdio: 'ignore'
})

child.unref()
console.log('Spawned PID:', child.pid)
