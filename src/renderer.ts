import './styles.css'
import { HyperFormula } from 'hyperformula'

const ROWS = 30
const COLS = 15

function dbg(msg: string) {
  console.log('[debug]', msg)
}

const hf = HyperFormula.buildEmpty({
  licenseKey: 'gpl-v3',
  evaluateNullToZero: false,
})

const sheetName = hf.addSheet('Sheet1')
const sheetId = hf.getSheetId(sheetName)!

function getColumnLabel(index: number): string {
  return String.fromCharCode(65 + index)
}

function focusCell(row: number, col: number) {
  const clampedRow = Math.max(0, Math.min(row, ROWS - 1))
  const clampedCol = Math.max(0, Math.min(col, COLS - 1))
  const table = document.getElementById('spreadsheet') as HTMLTableElement
  if (!table) return
  const input = table.querySelector(
    `.cell-input[data-row="${clampedRow}"][data-col="${clampedCol}"]`
  ) as HTMLInputElement | null
  if (input) {
    input.focus()
    input.select()
  }
}

function getCellValue(row: number, col: number): string | number | null {
  try {
    const val = hf.getCellValue({ sheet: sheetId, row, col })
    if (val === null || val === undefined || val === '') return null
    return val as string | number
  } catch {
    return null
  }
}

function getCellRaw(row: number, col: number): string {
  try {
    if (hf.doesCellHaveFormula({ sheet: sheetId, row, col })) {
      return hf.getCellFormula({ sheet: sheetId, row, col }) as string
    }
    const val = hf.getCellValue({ sheet: sheetId, row, col })
    if (val === null || val === undefined || val === '') return ''
    return String(val)
  } catch {
    return ''
  }
}

function setCellValue(row: number, col: number, rawValue: string) {
  if (rawValue === '') {
    hf.setCellContents({ sheet: sheetId, row, col }, [['']])
  } else {
    hf.setCellContents({ sheet: sheetId, row, col }, [[rawValue]])
  }
}

let contextMenuRow = 0
let contextMenuCol = 0

interface CellPos { row: number; col: number }

let selectionAnchor: CellPos | null = null
let selectionEnd: CellPos | null = null
let isDragging = false

function normalizeSelection(): { r1: number; c1: number; r2: number; c2: number } | null {
  if (!selectionAnchor || !selectionEnd) return null
  return {
    r1: Math.min(selectionAnchor.row, selectionEnd.row),
    c1: Math.min(selectionAnchor.col, selectionEnd.col),
    r2: Math.max(selectionAnchor.row, selectionEnd.row),
    c2: Math.max(selectionAnchor.col, selectionEnd.col),
  }
}

function applySelection() {
  const table = document.getElementById('spreadsheet') as HTMLTableElement
  if (!table) return

  let clearedBorders = 0
  table.querySelectorAll('.cell-selected').forEach((el) => {
    el.classList.remove('cell-selected')
    const td = (el as HTMLElement).parentElement as HTMLElement
    if (td && td.style.boxShadow) {
      td.style.boxShadow = ''
      clearedBorders++
    }
  })

  const sel = normalizeSelection()
  dbg(`[applySelection] clearBorders=${clearedBorders} anchor=${selectionAnchor?.row ?? '-'},${selectionAnchor?.col ?? '-'} end=${selectionEnd?.row ?? '-'},${selectionEnd?.col ?? '-'} isDragging=${isDragging}`)
  if (!sel) return

  for (let r = sel.r1; r <= sel.r2; r++) {
    for (let c = sel.c1; c <= sel.c2; c++) {
      const input = table.querySelector(
        `.cell-input[data-row="${r}"][data-col="${c}"]`
      ) as HTMLElement | null
      if (input) {
        input.classList.add('cell-selected')
        const td = input.parentElement as HTMLElement
        const shadows: string[] = []
        if (r === sel.r1) {
          shadows.push('inset 0 2px 0 #1a73e8')
        } else {
          shadows.push('inset 0 1px 0 #ababab')
        }
        if (r === sel.r2) {
          shadows.push('inset 0 -2px 0 #1a73e8')
        }
        if (c === sel.c1) {
          shadows.push('inset 2px 0 0 #1a73e8')
        } else {
          shadows.push('inset 1px 0 0 #ababab')
        }
        if (c === sel.c2) {
          shadows.push('inset -2px 0 0 #1a73e8')
        }
        td.style.boxShadow = shadows.join(', ')
      }
    }
  }
}

function applyHeaderHighlights() {
  const table = document.getElementById('spreadsheet') as HTMLTableElement
  if (!table) return

  table.querySelectorAll('.row-header-highlight, .col-header-highlight').forEach((el) => {
    el.classList.remove('row-header-highlight', 'col-header-highlight')
  })

  const sel = normalizeSelection()
  if (!sel) return

  const thead = table.querySelector('thead') as HTMLTableSectionElement
  const tbody = table.querySelector('tbody') as HTMLTableSectionElement
  if (!thead || !tbody) return

  for (let c = sel.c1; c <= sel.c2; c++) {
    const th = thead.children[0]?.children[c + 1] as HTMLElement
    if (th) th.classList.add('col-header-highlight')
  }
  for (let r = sel.r1; r <= sel.r2; r++) {
    const tr = tbody.children[r] as HTMLTableRowElement
    if (tr) {
      const rh = tr.querySelector('.row-header') as HTMLElement
      if (rh) rh.classList.add('row-header-highlight')
    }
  }
}

function createContextMenu() {
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

  cellMenu.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.context-menu-item') as HTMLElement
    if (!target) return
    const action = target.dataset.action
    if (!action) return
    executeMenuAction(action)
    hideAllContextMenus()
  })

  rowMenu.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.context-menu-item') as HTMLElement
    if (!target) return
    const action = target.dataset.action
    if (!action) return
    executeMenuAction(action)
    hideAllContextMenus()
  })
}

function executeMenuAction(action: string) {
  switch (action) {
    case 'insertRowAbove':
      hf.addRows(sheetId, [contextMenuRow, 1])
      renderGrid()
      break
    case 'insertRowBelow':
      hf.addRows(sheetId, [contextMenuRow + 1, 1])
      renderGrid()
      break
    case 'insertColBefore':
      hf.addColumns(sheetId, [contextMenuCol, 1])
      renderGrid()
      break
    case 'insertColAfter':
      hf.addColumns(sheetId, [contextMenuCol + 1, 1])
      renderGrid()
      break
    case 'deleteRow': {
      const { height } = hf.getSheetDimensions(sheetId)
      if (height > 1) {
        hf.removeRows(sheetId, [contextMenuRow, 1])
        renderGrid()
      }
      break
    }
    case 'deleteCol': {
      const { width } = hf.getSheetDimensions(sheetId)
      if (width > 1) {
        hf.removeColumns(sheetId, [contextMenuCol, 1])
        renderGrid()
      }
      break
    }
  }
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

let highlightedRow = -1
let highlightedCol = -1
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

function highlightHeaders(row: number, col: number) {
  selectionAnchor = { row, col }
  selectionEnd = { row, col }
  applySelection()
  applyHeaderHighlights()
  highlightedRow = row
  highlightedCol = col
}

function clearHighlights() {
  if (!isDragging) {
    selectionAnchor = null
    selectionEnd = null
  }
  applySelection()
  applyHeaderHighlights()
  highlightedRow = -1
  highlightedCol = -1
}

function renderGrid() {
  const table = document.getElementById('spreadsheet') as HTMLTableElement
  if (!table) return

  table.innerHTML = ''

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')

  const cornerTh = document.createElement('th')
  cornerTh.textContent = '#'
  headerRow.appendChild(cornerTh)

  for (let c = 0; c < COLS; c++) {
    const th = document.createElement('th')
    th.textContent = getColumnLabel(c)
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  for (let r = 0; r < ROWS; r++) {
    const tr = document.createElement('tr')

    const rowTh = document.createElement('td')
    rowTh.textContent = (r + 1).toString()
    rowTh.className = 'row-header'
    rowTh.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      showRowContextMenu(e.clientX, e.clientY, r)
    })
    tr.appendChild(rowTh)

    for (let c = 0; c < COLS; c++) {
      const td = document.createElement('td')
      const input = document.createElement('input')

      input.type = 'text'
      input.className = 'cell-input'
      input.dataset.row = r.toString()
      input.dataset.col = c.toString()

      const displayValue = getCellValue(r, c)
      input.value = displayValue !== null ? String(displayValue) : ''

      input.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        showCellContextMenu(e.clientX, e.clientY, r, c)
      })

      input.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return
        const active = document.activeElement as HTMLElement | null
        dbg(`[mousedown] ${r},${c} active=${active?.className ?? 'none'} isDragging=${isDragging}`)
        if (active && active !== input && active.classList.contains('cell-input')) {
          active.blur()
        }
        e.preventDefault()
        isDragging = true
        selectionAnchor = { row: r, col: c }
        selectionEnd = { row: r, col: c }
        applySelection()
        applyHeaderHighlights()
      })

      input.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return
        if (!isDragging) return
        const anchor = selectionAnchor
        isDragging = false
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
        if (!isDragging) return
        selectionEnd = { row: r, col: c }
        applySelection()
        applyHeaderHighlights()
      })

      input.addEventListener('focus', () => {
        input.value = getCellRaw(r, c)
        updateFormulaBar(r, c)
        const sel = normalizeSelection()
        const inRange = sel && r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2
        dbg(`[focus] ${r},${c} inRange=${!!inRange} isDragging=${isDragging} anchor=${selectionAnchor?.row ?? '-'},${selectionAnchor?.col ?? '-'}`)
        if (!isDragging && !inRange) {
          selectionAnchor = { row: r, col: c }
          selectionEnd = { row: r, col: c }
          applySelection()
          applyHeaderHighlights()
        }
      })

      input.addEventListener('blur', () => {
        const raw = input.value
        setCellValue(r, c, raw)
        const calculated = getCellValue(r, c)
        input.value = calculated !== null ? String(calculated) : ''
        if (!isDragging) {
          dbg(`[blur] ${r},${c} clearing selection`)
          selectionAnchor = null
          selectionEnd = null
          applySelection()
          applyHeaderHighlights()
        } else {
          dbg(`[blur] ${r},${c} isDragging -> selection kept`)
        }
      })

      input.addEventListener('keydown', (e) => {
        const r = parseInt(input.dataset.row || '0', 10)
        const c = parseInt(input.dataset.col || '0', 10)

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

      td.appendChild(input)
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
}

function refreshDisplay() {
  const table = document.getElementById('spreadsheet') as HTMLTableElement
  if (!table) return
  const inputs = table.querySelectorAll('.cell-input') as NodeListOf<HTMLInputElement>
  inputs.forEach((input) => {
    const r = parseInt(input.dataset.row || '0', 10)
    const c = parseInt(input.dataset.col || '0', 10)
    const val = getCellValue(r, c)
    input.value = val !== null ? String(val) : ''
  })
}

function parseAndLoad(content: string) {
  dbg('parseAndLoad: content length = ' + content.length)
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  dbg('parseAndLoad: parsed ' + lines.length + ' lines')
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
            dbg('parseAndLoad: cell [' + r + ',' + c + '] value='
              + JSON.stringify(data[r][c]) + ' ERROR - ' + (err as Error).message)
          }
        }
      }
    }
  } catch (err) {
    dbg('parseAndLoad: ERROR - ' + (err as Error).message)
    return
  }

  dbg('parseAndLoad: loaded ' + Math.min(data.length, ROWS) + ' rows')
  refreshDisplay()
  dbg('parseAndLoad: refreshDisplay done')
}

document.addEventListener('DOMContentLoaded', () => {
  createContextMenu()
  renderGrid()

  document.addEventListener('click', () => hideAllContextMenus())

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false
      const anchor = selectionAnchor
      if (anchor) {
        const table = document.getElementById('spreadsheet') as HTMLTableElement
        const target = table?.querySelector(
          `.cell-input[data-row="${anchor.row}"][data-col="${anchor.col}"]`
        ) as HTMLInputElement | null
        if (target && document.activeElement !== target) target.focus()
      }
    }
  })

  const formulaInput = document.getElementById('formula-bar-input') as HTMLInputElement | null
  if (formulaInput) {
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

  dbg('electronAPI.something')
  if (window.electronAPI?.onFileOpen) {
    dbg('onFileOpen registered')
    window.electronAPI.onFileOpen((content: string) => {
      dbg('onFileOpen received content, length=' + content.length)
      parseAndLoad(content)
    })
  } else {
    dbg('window.electronAPI.onFileOpen NOT available')
  }
})
