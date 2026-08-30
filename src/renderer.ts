import './styles.css'
import { renderGrid } from './render'
import {
  createContextMenu,
  attachAllCellEvents,
  setupDocumentEvents,
  setupFormulaBar,
  registerFileOpen,
} from './event'

document.addEventListener('DOMContentLoaded', () => {
  createContextMenu()
  renderGrid()
  attachAllCellEvents()
  setupDocumentEvents()
  setupFormulaBar()
  registerFileOpen()
})