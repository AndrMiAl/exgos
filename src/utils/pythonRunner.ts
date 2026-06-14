declare global {
  interface Window {
    loadPyodide?: (options: { indexURL: string }) => Promise<any>
  }
}

export type PythonRunResult = {
  status: 'ok' | 'error'
  stdout: string
  stderr: string
}

export type PythonRunOptions = {
  stdin?: string
  setupCode?: string
  pyodidePackages?: string[]
  pipPackages?: string[]
}

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/'
const benignStderrPatterns = [/^Matplotlib is building the font cache; this may take a moment\.?$/u]

let runtimePromise: Promise<any> | null = null
let scriptPromise: Promise<void> | null = null
const loadedPackages = new Set<string>()
const installedPipPackages = new Set<string>()

function sanitizePythonStderr(stderr: string) {
  const cleanedLines = stderr
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !benignStderrPatterns.some((pattern) => pattern.test(line.trim())))

  return cleanedLines.join('\n').trim()
}

function loadScript(src: string) {
  if (scriptPromise) {
    return scriptPromise
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить Pyodide.')), {
        once: true,
      })

      if ((window as Window).loadPyodide) {
        resolve()
      }
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Не удалось загрузить Pyodide.'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export async function warmPythonRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      if (!window.loadPyodide) {
        await loadScript(`${PYODIDE_INDEX_URL}pyodide.js`)
      }

      if (!window.loadPyodide) {
        throw new Error('Pyodide не инициализировался.')
      }

      return window.loadPyodide({ indexURL: PYODIDE_INDEX_URL })
    })().catch((error) => {
      runtimePromise = null
      throw error
    })
  }

  return runtimePromise
}

export async function runPythonCode(code: string, options: PythonRunOptions | string = ''): Promise<PythonRunResult> {
  const resolvedOptions = typeof options === 'string' ? { stdin: options } : options
  const stdin = resolvedOptions.stdin ?? ''
  const setupCode = resolvedOptions.setupCode ?? ''
  const pyodide = await warmPythonRuntime()
  const script = `
import builtins
import io
import json
import sys
import traceback

_code = ${JSON.stringify(code)}
_setup_code = ${JSON.stringify(setupCode)}
_stdin_data = ${JSON.stringify(stdin)}
_stdout = io.StringIO()
_stderr = io.StringIO()
_old_stdout, _old_stderr, _old_stdin = sys.stdout, sys.stderr, sys.stdin
_old_input = builtins.input

def _patched_input(prompt=''):
    line = sys.stdin.readline()
    if line == '':
        raise EOFError
    if line.endswith('\\n'):
        return line[:-1]
    return line

sys.stdout = _stdout
sys.stderr = _stderr
sys.stdin = io.StringIO(_stdin_data)
builtins.input = _patched_input
_status = "ok"
_globals = {"__name__": "__main__"}

try:
    if _setup_code.strip():
        exec(_setup_code, _globals)
    exec(_code, _globals)
    _plot_flusher = _globals.get("__emit_captured_plots__")
    if callable(_plot_flusher):
        _plot_flusher()
except BaseException:
    _status = "error"
    traceback.print_exc()
finally:
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr
    sys.stdin = _old_stdin
    builtins.input = _old_input

json.dumps({
    "status": _status,
    "stdout": _stdout.getvalue(),
    "stderr": _stderr.getvalue(),
}, ensure_ascii=False)
`

  try {
    await pyodide.loadPackagesFromImports(`${setupCode}\n${code}`)

    const extraPackages = resolvedOptions.pyodidePackages?.filter((packageName) => !loadedPackages.has(packageName)) ?? []

    if (extraPackages.length > 0) {
      await pyodide.loadPackage(extraPackages)
      extraPackages.forEach((packageName) => loadedPackages.add(packageName))
    }

    const pipPackages = resolvedOptions.pipPackages?.filter((packageName) => !installedPipPackages.has(packageName)) ?? []

    if (pipPackages.length > 0) {
      await pyodide.loadPackage('micropip')
      await pyodide.runPythonAsync(`
import micropip
await micropip.install(${JSON.stringify(pipPackages)})
`)
      pipPackages.forEach((packageName) => installedPipPackages.add(packageName))
    }

    const rawResult = await pyodide.runPythonAsync(script)
    const parsedResult = JSON.parse(String(rawResult)) as PythonRunResult

    return {
      ...parsedResult,
      stderr: sanitizePythonStderr(parsedResult.stderr),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: 'error',
      stdout: '',
      stderr: message,
    }
  }
}
