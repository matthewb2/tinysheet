import './styles.css'
import { renderGrid } from './render'
import {
  createContextMenu,
  attachAllCellEvents,
  setupDocumentEvents,
  setupFormulaBar,
  registerFileOpen,
  registerSaveHandler,
} from './event'

document.addEventListener('DOMContentLoaded', () => {
  createContextMenu()
  renderGrid()
  attachAllCellEvents()
  setupDocumentEvents()
  setupFormulaBar()
  registerFileOpen()
  registerSaveHandler()
  document.querySelector<HTMLElement>('.formula-bar')!.style.display = 'flex'
})