import { ROWS, COLS, hf, sheetId, dbg, getCellRaw, getCellValue, setCellValue } from './init'
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
  switch (action) {
    case 'insertRowAbove':
      hf.addRows(sheetId, [contextMenuRow, 1])
      renderGrid()
      attachAllCellEvents()
      break
    case 'insertRowBelow':
      hf.addRows(sheetId, [contextMenuRow + 1, 1])
      renderGrid()
      attachAllCellEvents()
      break
    case 'insertColBefore':
      hf.addColumns(sheetId, [contextMenuCol, 1])
      renderGrid()
      attachAllCellEvents()
      break
    case 'insertColAfter':
      hf.addColumns(sheetId, [contextMenuCol + 1, 1])
      renderGrid()
      attachAllCellEvents()
      break
    case 'deleteRow': {
      const { height } = hf.getSheetDimensions(sheetId)
      if (height > 1) {
        hf.removeRows(sheetId, [contextMenuRow, 1])
        renderGrid()
        attachAllCellEvents()
      }
      break
    }
    case 'deleteCol': {
      const { width } = hf.getSheetDimensions(sheetId)
      if (width > 1) {
        hf.removeColumns(sheetId, [contextMenuCol, 1])
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
  cellMenu.innerHTML = `
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
  `
  document.body.appendChild(cellMenu)

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
      if (active && active !== input && active.classList.contains('cell-input')) {
        active.blur()
      }
      e.preventDefault()
      setDragging(true)
      setSelection({ row: r, col: c }, { row: r, col: c })
      applySelection()
      applyHeaderHighlights()
    })

    input.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return
      if (!getSelection().isDragging) return
      const anchor = getSelection().anchor
      setDragging(false)
      if (anchor) {
        const tbl = document.getElementById('spreadsheet') as HTMLTableElement
        const target = tbl?.querySelector(
          `.cell-input[data-row="${anchor.row}"][data-col="${anchor.col}"]`
        ) as HTMLInputElement | null
        if (target) {
          dbg(`[mouseup] ${r},${c} focus-anchor=${anchor.row},${anchor.col} targetFocused=${document.activeElement === target}`)
          target.focus()
        }
      }
    })

    input.addEventListener('mouseenter', () => {
      if (!getSelection().isDragging) return
      const anchor = getSelection().anchor
      setSelection(anchor, { row: r, col: c })
      applySelection()
      applyHeaderHighlights()
    })

    input.addEventListener('focus', () => {
      input.value = getCellRaw(r, c)
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
      setCellValue(r, c, raw)
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

      if (e.key === 'ArrowDown') {
        const pos = input.selectionStart ?? input.value.length
        if (pos === input.value.length || input.selectionStart === input.selectionEnd) {
          e.preventDefault()
          input.blur()
          focusCell(r + 1, c)
        }
      }

      if (e.key === 'ArrowUp') {
        const pos = input.selectionStart ?? 0
        if (pos === 0 || input.selectionStart === input.selectionEnd) {
          e.preventDefault()
          input.blur()
          focusCell(r - 1, c)
        }
      }

      if (e.key === 'ArrowRight') {
        const pos = input.selectionStart ?? input.value.length
        if (pos === input.value.length && input.selectionStart === input.selectionEnd) {
          e.preventDefault()
          input.blur()
          focusCell(r, c + 1)
        }
      }

      if (e.key === 'ArrowLeft') {
        const pos = input.selectionStart ?? 0
        if (pos === 0 && input.selectionStart === input.selectionEnd) {
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
        hf.setCellContents({ sheet: sheetId, row: r, col: c }, [['']])
      }
    }

    for (let r = 0; r < Math.min(data.length, ROWS); r++) {
      for (let c = 0; c < Math.min(data[r].length, COLS); c++) {
        if (data[r][c] !== '') {
          try {
            hf.setCellContents({ sheet: sheetId, row: r, col: c }, [[data[r][c]]])
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
      const anchor = getSelection().anchor
      if (anchor) {
        const table = document.getElementById('spreadsheet') as HTMLTableElement
        const target = table?.querySelector(
          `.cell-input[data-row="${anchor.row}"][data-col="${anchor.col}"]`
        ) as HTMLInputElement | null
        if (target && document.activeElement !== target) target.focus()
      }
    }
  })
}

export function setupFormulaBar() {
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
      const table = document.getElementById('spreadsheet') as HTMLTableElement
      if (!table) return
      const cellInput = table.querySelector(
        `.cell-input[data-row="${activeCellRow}"][data-col="${activeCellCol}"]`
      ) as HTMLInputElement | null
      if (cellInput) {
        cellInput.value = formulaInput.value
        cellInput.blur()
      }
      focusCell(activeCellRow + 1, activeCellCol)
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const table = document.getElementById('spreadsheet') as HTMLTableElement
      if (!table) return
      const cellInput = table.querySelector(
        `.cell-input[data-row="${activeCellRow}"][data-col="${activeCellCol}"]`
      ) as HTMLInputElement | null
      if (cellInput) {
        cellInput.value = formulaInput.value
        cellInput.blur()
      }
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
      if (getCellValue(r, c) !== null) {
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
      const val = getCellValue(r, c)
      cells.push(val === null ? '' : escapeCsvField(String(val)))
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