import { spawn } from 'node:child_process'

const commands = [
  ['server', 'node', ['server/index.mjs']],
  ['vite', 'vite', ['--host', '0.0.0.0']],
]

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`)
      process.exitCode = code
    }
    children.forEach((item) => {
      if (item !== child && !item.killed) {
        item.kill()
      }
    })
  })

  return child
})

process.on('SIGINT', () => {
  children.forEach((child) => child.kill('SIGINT'))
})
