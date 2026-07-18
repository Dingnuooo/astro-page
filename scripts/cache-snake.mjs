import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(projectRoot, 'public', 'images', 'github-snake.svg')
const temporaryPath = `${outputPath}.tmp`
const sourceUrl = new URL(
  'https://raw.githubusercontent.com/Dingnuooo/astro-page/output/github-snake-gitlab-light.svg'
)

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      headers: { 'cache-control': 'no-cache' },
      redirect: 'follow',
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function cacheSnake() {
  sourceUrl.searchParams.set('build', Date.now().toString())

  try {
    const response = await fetchWithTimeout(sourceUrl, 15_000)
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const svg = await response.text()
    if (!svg.includes('<svg') || !svg.includes('</svg>')) {
      throw new Error('Downloaded content is not a complete SVG')
    }

    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(temporaryPath, svg, 'utf8')
    await rename(temporaryPath, outputPath)
    console.log(`[snake-cache] Updated ${path.relative(projectRoot, outputPath)}.`)
  } catch (error) {
    await rm(temporaryPath, { force: true })

    if (await fileExists(outputPath)) {
      console.warn(`[snake-cache] Refresh failed; using the existing cache: ${error.message}`)
      return
    }

    throw new Error(`Unable to cache the GitHub snake: ${error.message}`)
  }
}

cacheSnake().catch((error) => {
  console.error(`[snake-cache] ${error.message}`)
  process.exitCode = 1
})
