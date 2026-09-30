import { applySelection } from './render'

const MIN_ZOOM = 50
const MAX_ZOOM = 500
const ZOOM_STEP = 10
const DEFAULT_ZOOM = 100

let currentZoom = DEFAULT_ZOOM

export function getZoom(): number {
  return currentZoom
}

export function applyZoom(percent: number) {
  currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(percent)))

  const container = document.querySelector('.tinysheet-container') as HTMLElement | null
  if (container) {
    container.style.setProperty('--zoom', String(currentZoom / 100))
  }

  const valueBtn = document.getElementById('zoom-value') as HTMLButtonElement | null
  if (valueBtn) {
    valueBtn.textContent = currentZoom + '%'
    valueBtn.disabled = currentZoom === DEFAULT_ZOOM
  }

  const outBtn = document.getElementById('zoom-out') as HTMLButtonElement | null
  if (outBtn) outBtn.disabled = currentZoom <= MIN_ZOOM

  const inBtn = document.getElementById('zoom-in') as HTMLButtonElement | null
  if (inBtn) inBtn.disabled = currentZoom >= MAX_ZOOM

  // 셀 크기가 바뀌므로 선택 영역 오버레이 위치를 다시 계산한다.
  applySelection()
}

export function setZoom(percent: number) {
  applyZoom(percent)
}

export function zoomBy(deltaPercent: number) {
  applyZoom(currentZoom + deltaPercent)
}

export function resetZoom() {
  applyZoom(DEFAULT_ZOOM)
}

export function setupZoom() {
  applyZoom(currentZoom)

  document.getElementById('zoom-in')?.addEventListener('click', () => {
    zoomBy(ZOOM_STEP)
  })
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    zoomBy(-ZOOM_STEP)
  })
  document.getElementById('zoom-value')?.addEventListener('click', () => {
    resetZoom()
  })

  document.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    },
    { passive: false }
  )

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey) return
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomBy(ZOOM_STEP)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      zoomBy(-ZOOM_STEP)
    } else if (e.key === '0') {
      e.preventDefault()
      resetZoom()
    }
  })
}
