import './styles.css'
import { renderGrid } from './render'
import { setupZoom } from './zoom'
import {
  createContextMenu,
  attachAllCellEvents,
  setupDocumentEvents,
  setupFillHandle,
  setupFormulaBar,
  registerFileOpen,
  registerSaveHandler,
} from './event'

document.addEventListener('DOMContentLoaded', () => {
  createContextMenu()
  renderGrid()
  attachAllCellEvents()
  setupDocumentEvents()
  setupFillHandle()
  setupFormulaBar()
  setupZoom()
  registerFileOpen()
  registerSaveHandler()
  document.querySelector<HTMLElement>('.formula-bar')!.style.display = 'flex'
  document.querySelector<HTMLElement>('.status-bar')!.style.display = 'flex'
  // 그리드까지 그려졌으므로 로딩 스피너를 제거한다.
  document.getElementById('loading-screen')?.remove()
})