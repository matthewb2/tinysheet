import DOMPurify from 'dompurify'
import { ROWS, COLS, hf, sheetId, dbg, getCellRaw, getCellValue, setCellValue, getRecordedRaw, shiftRows, shiftCols } from './init'
import {
  type CellPos,
  focusCell,
  getColumnLabel,
  applySelection,
  applyHeaderHighlights,
  normalizeSelection,
  setSelection,
  setDragging,
  getSelection,
  renderGrid,
  refreshDisplay,
} from './render'

let contextMenuRow = 0
let contextMenuCol = 0
let activeCellRow = 0
let activeCellCol = 0

let isFilling = false
let fillStart: { r1: number; c1: number; r2: number; c2: number } | null = null
let fillPreview: CellPos | null = null

function clampCell(row: number, col: number): CellPos {
  return {
    row: Math.max(0, Math.min(row, ROWS - 1)),
    col: Math.max(0, Math.min(col, COLS - 1)),
  }
}

function cellAtPoint(clientX: number, clientY: number): CellPos | null {
  const table = document.getElementById('spreadsheet') as HTMLTableElement
  if (!table) return null
  const anchorTd = table.querySelector(
    '.cell-input[data-row="0"][data-col="0"]'
  )?.parentElement as HTMLElement | null
  if (!anchorTd) return null
  const rect = anchorTd.getBoundingClientRect()
  if (rect.height <= 0 || rect.width <= 0) return null
  const row = Math.floor((clientY - rect.top) / rect.height)
  const col = Math.floor((clientX - rect.left) / rect.width)
  return clampCell(row, col)
}

function fillPreviewTo(row: number, col: number) {
  if (!fillStart) return
  const r3 = Math.max(fillStart.r2, row)
  const c3 = Math.max(fillStart.c2, col)
  setSelection({ row: fillStart.r1, col: fillStart.c1 }, { row: r3, col: c3 })
  applySelection()
  applyHeaderHighlights()
}

function performFill(row: number, col: number) {
  if (!fillStart) return
  const src = fillStart
  const r3 = Math.max(src.r2, row)
  const c3 = Math.max(src.c2, col)
  if (r3 === src.r2 && c3 === src.c2) return
  const rowSpan = src.r2 - src.r1 + 1
  const colSpan = src.c2 - src.c1 + 1

  for (let r = src.r1; r <= r3; r++) {
    for (let c = src.c1; c <= c3; c++) {
      if (r >= src.r1 && r <= src.r2 && c >= src.c1 && c <= src.c2) continue
      let sourceRow: number
      let sourceCol: number
      if (r >= src.r1 && r <= src.r2) {
        sourceRow = r
        sourceCol = src.c1 + ((c - (src.c2 + 1)) % colSpan)
      } else {
        sourceRow = src.r1 + ((r - (src.r2 + 1)) % rowSpan)
        if (c >= src.c1 && c <= src.c2) {
          sourceCol = c
        } else {
          sourceCol = src.c1 + ((c - (src.c2 + 1)) % colSpan)
        }
      }
      setCellValue(r, c, getCellRaw(sourceRow, sourceCol))
    }
  }
  refreshDisplay()
}

export function setupFillHandle() {
  const handle = document.querySelector('.fill-handle') as HTMLElement | null
  if (!handle) return

  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    const sel = normalizeSelection()
    if (!sel) return
    e.preventDefault()
    e.stopPropagation()
    fillStart = sel
    isFilling = true
    fillPreview = null
  })

  document.addEventListener('mousemove', (e) => {
    if (!isFilling || !fillStart) return
    const pos = cellAtPoint(e.clientX, e.clientY)
    if (!pos) return
    fillPreview = pos
    fillPreviewTo(pos.row, pos.col)
  })

  document.addEventListener('mouseup', () => {
    if (!isFilling || !fillStart) return
    if (fillPreview) {
      performFill(fillPreview.row, fillPreview.col)
    }
    isFilling = false
    fillStart = null
    fillPreview = null
  })
}

function updateFormulaBar(row: number, col: number) {
  activeCellRow = row
  activeCellCol = col
  const addrEl = document.getElementById('cell-address')
  const inputEl = document.getElementById('formula-bar-input') as HTMLInputElement | null
  if (addrEl) addrEl.textContent = getColumnLabel(col) + (row + 1)
  if (inputEl) inputEl.value = getCellRaw(row, col)
}

function positionMenu(menu: HTMLElement, x: number, y: number) {
  menu.style.left = x + 'px'
  menu.style.top = y + 'px'
  menu.style.display = 'block'

  const rect = menu.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    menu.style.left = (x - rect.width) + 'px'
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = (y - rect.height) + 'px'
  }
}

function showCellContextMenu(x: number, y: number, row: number, col: number) {
  contextMenuRow = row
  contextMenuCol = col
  const menu = document.getElementById('cell-context-menu') as HTMLElement
  if (menu) positionMenu(menu, x, y)
}

function showRowContextMenu(x: number, y: number, row: number) {
  contextMenuRow = row
  const menu = document.getElementById('row-context-menu') as HTMLElement
  if (menu) positionMenu(menu, x, y)
}

function hideAllContextMenus() {
  const menus = document.querySelectorAll('.context-menu') as NodeListOf<HTMLElement>
  menus.forEach((m) => (m.style.display = 'none'))
}

function executeMenuAction(action: string) {
  const active = document.activeElement as HTMLInputElement | null
  if (active && active.classList.contains('cell-input')) active.blur()

  switch (action) {
    case 'insertRowAbove':
      hf.addRows(sheetId, [contextMenuRow, 1])
      shiftRows(contextMenuRow, 1)
      renderGrid()
      attachAllCellEvents()
      break
    case 'insertRowBelow':
      hf.addRows(sheetId, [contextMenuRow + 1, 1])
      shiftRows(contextMenuRow + 1, 1)
      renderGrid()
      attachAllCellEvents()
      break
    case 'insertColBefore':
      hf.addColumns(sheetId, [contextMenuCol, 1])
      shiftCols(contextMenuCol, 1)
      renderGrid()
      attachAllCellEvents()
      break
    case 'insertColAfter':
      hf.addColumns(sheetId, [contextMenuCol + 1, 1])
      shiftCols(contextMenuCol + 1, 1)
      renderGrid()
      attachAllCellEvents()
      break
    case 'deleteRow': {
      const { height } = hf.getSheetDimensions(sheetId)
      if (height > 1) {
        hf.removeRows(sheetId, [contextMenuRow, 1])
        shiftRows(contextMenuRow, -1)
        renderGrid()
        attachAllCellEvents()
      }
      break
    }
    case 'deleteCol': {
      const { width } = hf.getSheetDimensions(sheetId)
      if (width > 1) {
        hf.removeColumns(sheetId, [contextMenuCol, 1])
        shiftCols(contextMenuCol, -1)
        renderGrid()
        attachAllCellEvents()
      }
      break
    }
  }
}

function focusAnchorCell() {
  const anchor = getSelection().anchor
  if (!anchor) return
  const table = document.getElementById('spreadsheet') as HTMLTableElement
  const target = table?.querySelector(
    `.cell-input[data-row="${anchor.row}"][data-col="${anchor.col}"]`
  ) as HTMLInputElement | null
  if (target) target.focus()
}

export function createContextMenu() {
  const cellMenu = document.createElement('div')
  cellMenu.className = 'context-menu'
  cellMenu.id = 'cell-context-menu'
  cellMenu.style.display = 'none'
    // DOMPurify를 사용해 문자열을 정화한 뒤 innerHTML에 삽입
  // 정화되지 않은 문자열을 직접 삽입하면 XSS 위험이 존재한다.
  const menuHtml = `
    <div class="context-menu-item" data-action="cut">잘라내기<span class="shortcut">Ctrl+X</span></div>
    <div class="context-menu-item" data-action="copy">복사<span class="shortcut">Ctrl+C</span></div>
    <div class="context-menu-item" data-action="paste">붙여넣기<span class="shortcut">Ctrl+V</span></div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item has-submenu">
      삽입<span class="submenu-arrow">&#9654;</span>
      <div class="context-submenu">
        <div class="context-menu-item" data-action="insertRowAbove">위에 행 삽입</div>
        <div class="context-menu-item" data-action="insertRowBelow">아래에 행 삽입</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="insertColBefore">왼쪽에 열 삽입</div>
        <div class="context-menu-item" data-action="insertColAfter">오른쪽에 열 삽입</div>
      </div>
    </div>
    <div class="context-menu-item has-submenu">
      삭제<span class="submenu-arrow">&#9654;</span>
      <div class="context-submenu">
        <div class="context-menu-item" data-action="deleteRow">행 삭제</div>
        <div class="context-menu-item" data-action="deleteCol">열 삭제</div>
      </div>
    </div>
  `;
  cellMenu.innerHTML = DOMPurify.sanitize(menuHtml);
  document.body.appendChild(cellMenu);

  const rowMenu = document.createElement('div')
  rowMenu.className = 'context-menu'
  rowMenu.id = 'row-context-menu'
  rowMenu.style.display = 'none'
  rowMenu.innerHTML = `
    <div class="context-menu-item" data-action="insertRowAbove">위에 행 삽입</div>
    <div class="context-menu-item" data-action="insertRowBelow">아래에 행 삽입</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-action="deleteRow">행 삭제</div>
  `
  document.body.appendChild(rowMenu)

  const menuClass = (menu: HTMLDivElement) => {
    menu.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.context-menu-item') as HTMLElement
      if (!target) return
      const action = target.dataset.action
      if (!action) return
      executeMenuAction(action)
      hideAllContextMenus()
    })
  }
  menuClass(cellMenu)
  menuClass(rowMenu)
}

function clearSelectedCells() {
  const sel = normalizeSelection()
  if (!sel) return false

  for (let r = sel.r1; r <= sel.r2; r++) {
    for (let c = sel.c1; c <= sel.c2; c++) {
      setCellValue(r, c, '')
    }
  }
  refreshDisplay()

  // 선택 범위에 현재 활성 셀이 포함되면 수식창도 비운다.
  if (
    activeCellRow >= sel.r1 && activeCellRow <= sel.r2 &&
    activeCellCol >= sel.c1 && activeCellCol <= sel.c2
  ) {
    updateFormulaBar(activeCellRow, activeCellCol)
  }
  return true
}

// Shift+화살표: 앵커(기준 셀)는 그대로 두고 선택 영역의 끝점만 이동한다.
function extendSelectionWithShift(row: number, col: number, dRow: number, dCol: number) {
  const sel = getSelection()
  const anchor = sel.anchor ?? { row, col }
  const end = sel.end ?? { row, col }
  const next = clampCell(end.row + dRow, end.col + dCol)
  if (next.row === end.row && next.col === end.col) return
  setSelection(anchor, next)
  applySelection()
  applyHeaderHighlights()
}

export function attachAllCellEvents() {
  const table = document.getElementById('spreadsheet') as HTMLTableElement
  if (!table) return

  table.querySelectorAll('.row-header').forEach((el) => {
    const rowEl = el as HTMLElement
    const r = parseInt(rowEl.dataset.row || '0', 10)
    rowEl.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      showRowContextMenu(e.clientX, e.clientY, r)
    })
  })

  table.querySelectorAll('.cell-input').forEach((el) => {
    const input = el as HTMLInputElement
    const r = parseInt(input.dataset.row || '0', 10)
    const c = parseInt(input.dataset.col || '0', 10)

    input.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      showCellContextMenu(e.clientX, e.clientY, r, c)
    })

    input.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      const active = document.activeElement as HTMLElement | null
      dbg(`[mousedown] ${r},${c} active=${active?.className ?? 'none'} isDragging=${getSelection().isDragging}`)
      // 이미 포커스된(편집 중인) 셀이면 기본 동작을 유지해
      // 텍스트 드래그 선택/캐럿 이동이 동작하도록 한다.
      if (active === input) {
        return
      }
      if (active && active !== input && active.classList.contains('cell-input')) {
        active.blur()
      }
      e.preventDefault()
      setDragging(true)
      setSelection({ row: r, col: c }, { row: r, col: c })
      applySelection()
      applyHeaderHighlights()
      input.focus()
    })

    input.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return
      if (!getSelection().isDragging) return
      setDragging(false)
      applySelection()
      applyHeaderHighlights()
    })

    input.addEventListener('mouseenter', () => {
      if (!getSelection().isDragging) return
      const anchor = getSelection().anchor
      setSelection(anchor, { row: r, col: c })
      applySelection()
      applyHeaderHighlights()
    })

    input.addEventListener('dblclick', (e) => {
      if (e.button !== 0) return
      setSelection({ row: r, col: c }, { row: r, col: c })
      applySelection()
      applyHeaderHighlights()
      input.focus()
      input.value = getCellRaw(r, c)
      const rect = input.getBoundingClientRect()
      const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0
      const index = Math.max(
        0,
        Math.min(input.value.length, Math.round(ratio * input.value.length))
      )
      input.setSelectionRange(index, index)
      input.dataset.editing = '1'
    })

    input.addEventListener('focus', () => {
      input.value = getCellRaw(r, c)
      input.dataset.editing = '0'
      updateFormulaBar(r, c)
      const sel = normalizeSelection()
      const inRange = sel && r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2
      dbg(`[focus] ${r},${c} inRange=${!!inRange} isDragging=${getSelection().isDragging} anchor=${getSelection().anchor?.row ?? '-'},${getSelection().anchor?.col ?? '-'}`)
      if (!getSelection().isDragging && !inRange) {
        setSelection({ row: r, col: c }, { row: r, col: c })
        applySelection()
        applyHeaderHighlights()
      }
    })

    input.addEventListener('blur', () => {
      const raw = input.value
      const hasFormula = hf.doesCellHaveFormula({ sheet: sheetId, row: r, col: c })
      const currentValue = getCellValue(r, c)
      const currentShown = hasFormula ? getCellRaw(r, c) : currentValue === null ? '' : String(currentValue)
      const unchanged = raw === currentShown
      if (unchanged) {
        dbg(`[blur] ${r},${c} unchanged -> skip commit`)
      } else {
        setCellValue(r, c, raw)
      }
      const calculated = getCellValue(r, c)
      input.value = calculated !== null ? String(calculated) : ''
      if (!getSelection().isDragging) {
        dbg(`[blur] ${r},${c} clearing selection`)
        setSelection(null, null)
        applySelection()
        applyHeaderHighlights()
      } else {
        dbg(`[blur] ${r},${c} isDragging -> selection kept`)
      }
    })

    input.addEventListener('keydown', (e) => {
      const editing = input.dataset.editing === '1'

      if (e.key === 'Enter') {
        e.preventDefault()
        input.blur()
        focusCell(r + 1, c)
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        input.blur()
        if (e.shiftKey) {
          focusCell(r, c - 1)
        } else {
          focusCell(r, c + 1)
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        const hasFormula = hf.doesCellHaveFormula({ sheet: sheetId, row: r, col: c })
        const currentValue = getCellValue(r, c)
        input.value = hasFormula ? getCellRaw(r, c) : (currentValue === null ? '' : String(currentValue))
        input.dataset.editing = '0'
        input.blur()
        focusCell(r, c)
        return
      }

      if (!editing && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        input.value = e.key
        input.dataset.editing = '1'
        input.setSelectionRange(1, 1)
        return
      }

      if (e.shiftKey && !editing) {
        const dRow = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
        const dCol = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        if (dRow !== 0 || dCol !== 0) {
          e.preventDefault()
          extendSelectionWithShift(r, c, dRow, dCol)
          return
        }
      }

      if (e.key === 'ArrowDown') {
        const pos = input.selectionStart ?? input.value.length
        if (!editing || (pos === input.value.length && input.selectionStart === input.selectionEnd)) {
          e.preventDefault()
          input.blur()
          focusCell(r + 1, c)
        }
      }

      if (e.key === 'ArrowUp') {
        const pos = input.selectionStart ?? 0
        if (!editing || (pos === 0 && input.selectionStart === input.selectionEnd)) {
          e.preventDefault()
          input.blur()
          focusCell(r - 1, c)
        }
      }

      if (e.key === 'ArrowRight') {
        const pos = input.selectionStart ?? input.value.length
        if (!editing || (pos === input.value.length && input.selectionStart === input.selectionEnd)) {
          e.preventDefault()
          input.blur()
          focusCell(r, c + 1)
          console.log("right key pressed");
        }
      }

      if (e.key === 'ArrowLeft') {
        const pos = input.selectionStart ?? 0
        if (!editing || (pos === 0 && input.selectionStart === input.selectionEnd)) {
          e.preventDefault()
          input.blur()
          focusCell(r, c - 1)
        }
      }
    })
  })
}

function loadContent(content: string) {
  dbg('loadContent: content length = ' + content.length)
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  dbg('loadContent: parsed ' + lines.length + ' lines')
  const data: string[][] = []
  for (const line of lines) {
    const delimiter = line.includes('\t') ? '\t' : ','
    data.push(line.split(delimiter))
  }

  try {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        setCellValue(r, c, '')
      }
    }

    for (let r = 0; r < Math.min(data.length, ROWS); r++) {
      for (let c = 0; c < Math.min(data[r].length, COLS); c++) {
        if (data[r][c] !== '') {
          try {
            setCellValue(r, c, data[r][c])
          } catch (err) {
            dbg('loadContent: cell [' + r + ',' + c + '] value='
              + JSON.stringify(data[r][c]) + ' ERROR - ' + (err as Error).message)
          }
        }
      }
    }
  } catch (err) {
    dbg('loadContent: ERROR - ' + (err as Error).message)
    return
  }

  dbg('loadContent: loaded ' + Math.min(data.length, ROWS) + ' rows')
  refreshDisplay()
  dbg('loadContent: refreshDisplay done')
}

export function setupDocumentEvents() {
  document.addEventListener('click', () => hideAllContextMenus())

  document.addEventListener('mouseup', () => {
    if (getSelection().isDragging) {
      setDragging(false)
      applySelection()
      applyHeaderHighlights()
    }
  })

  // 선택된 셀(또는 셀 범위)의 내용을 지운다. 더블클릭 입력모드나
  // 수식창 등 텍스트 입력 중에는 브라우저 기본 삭제 동작에 맡긴다.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    const active = document.activeElement as HTMLElement | null
    if (active && active.classList.contains('cell-input')) {
      if (active.dataset.editing === '1') return
    } else if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      return
    }

    if (!clearSelectedCells()) return
    e.preventDefault()
  })
}

export function setupFormulaBar() {
  const formulaLabel = document.querySelector<HTMLElement>('.formula-bar-label')
  if (formulaLabel) formulaLabel.textContent = 'f(x)'

  const formulaInput = document.getElementById('formula-bar-input') as HTMLInputElement | null
  if (!formulaInput) return

  formulaInput.addEventListener('focus', () => {
    const table = document.getElementById('spreadsheet') as HTMLTableElement
    if (!table) return
    const cellInput = table.querySelector(
      `.cell-input[data-row="${activeCellRow}"][data-col="${activeCellCol}"]`
    ) as HTMLInputElement | null
    if (cellInput) {
      cellInput.value = getCellRaw(activeCellRow, activeCellCol)
    }
  })

  formulaInput.addEventListener('input', () => {
    const table = document.getElementById('spreadsheet') as HTMLTableElement
    if (!table) return
    const cellInput = table.querySelector(
      `.cell-input[data-row="${activeCellRow}"][data-col="${activeCellCol}"]`
    ) as HTMLInputElement | null
    if (cellInput) {
      cellInput.value = formulaInput.value
    }
  })

  formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setCellValue(activeCellRow, activeCellCol, formulaInput.value)
      refreshDisplay()
      focusCell(activeCellRow + 1, activeCellCol)
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      setCellValue(activeCellRow, activeCellCol, formulaInput.value)
      refreshDisplay()
      if (e.shiftKey) {
        focusCell(activeCellRow, activeCellCol - 1)
      } else {
        focusCell(activeCellRow, activeCellCol + 1)
      }
    }

    if (e.key === 'Escape') {
      updateFormulaBar(activeCellRow, activeCellCol)
      focusCell(activeCellRow, activeCellCol)
    }
  })
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function serializeCsv(): string {
  const dims = hf.getSheetDimensions(sheetId)
  const maxRows = Math.min(dims.height, ROWS)
  const maxCols = Math.min(dims.width, COLS)

  let lastRow = -1
  let lastCol = -1
  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < maxCols; c++) {
      if (getCellValue(r, c) !== null || getRecordedRaw(r, c) !== null) {
        if (r > lastRow) lastRow = r
        if (c > lastCol) lastCol = c
      }
    }
  }

  if (lastRow < 0) return ''

  const lines: string[] = []
  for (let r = 0; r <= lastRow; r++) {
    const cells: string[] = []
    for (let c = 0; c <= lastCol; c++) {
      if (hf.doesCellHaveFormula({ sheet: sheetId, row: r, col: c })) {
        const val = getCellValue(r, c)
        cells.push(val === null ? '' : escapeCsvField(String(val)))
      } else {
        const recorded = getRecordedRaw(r, c)
        if (recorded !== null) {
          cells.push(escapeCsvField(recorded))
        } else {
          const val = getCellValue(r, c)
          cells.push(val === null ? '' : escapeCsvField(String(val)))
        }
      }
    }
    lines.push(cells.join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

export function registerSaveHandler() {
  dbg('registerSaveHandler')
  if (window.electronAPI?.onSaveRequested) {
    dbg('onSaveRequested registered')
    window.electronAPI.onSaveRequested((isSaveAs) => {
      const csv = serializeCsv()
      dbg('serialized csv length=' + csv.length + ' isSaveAs=' + isSaveAs)
      window.electronAPI?.saveCsv(csv, isSaveAs)
    })
  } else {
    dbg('window.electronAPI.onSaveRequested NOT available')
  }
}

export function registerFileOpen() {
  dbg('electronAPI.something')
  if (window.electronAPI?.onFileOpen) {
    dbg('onFileOpen registered')
    window.electronAPI.onFileOpen((content: string) => {
      dbg('onFileOpen received content, length=' + content.length)
      loadContent(content)
    })
  } else {
    dbg('window.electronAPI.onFileOpen NOT available')
  }
}