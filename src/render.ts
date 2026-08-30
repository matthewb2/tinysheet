import { ROWS, COLS, dbg, getCellValue } from './init'

export interface CellPos { row: number; col: number }

let selectionAnchor: CellPos | null = null
let selectionEnd: CellPos | null = null
let isDragging = false

export function setSelection(anchor: CellPos | null, end: CellPos | null) {
  selectionAnchor = anchor
  selectionEnd = end
}

export function setDragging(dragging: boolean) {
  isDragging = dragging
}

export function getSelection(): { anchor: CellPos | null; end: CellPos | null; isDragging: boolean } {
  return { anchor: selectionAnchor, end: selectionEnd, isDragging }
}

export function normalizeSelection(): { r1: number; c1: number; r2: number; c2: number } | null {
  if (!selectionAnchor || !selectionEnd) return null
  return {
    r1: Math.min(selectionAnchor.row, selectionEnd.row),
    c1: Math.min(selectionAnchor.col, selectionEnd.col),
    r2: Math.max(selectionAnchor.row, selectionEnd.row),
    c2: Math.max(selectionAnchor.col, selectionEnd.col),
  }
}

export function getColumnLabel(index: number): string {
  return String.fromCharCode(65 + index)
}

export function focusCell(row: number, col: number) {
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

export function applySelection() {
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
  dbg(
    `[applySelection] clearBorders=${clearedBorders}` +
      ` anchor=${selectionAnchor?.row ?? '-'},${selectionAnchor?.col ?? '-'}` +
      ` end=${selectionEnd?.row ?? '-'},${selectionEnd?.col ?? '-'}` +
      ` isDragging=${isDragging}`
  )
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

export function applyHeaderHighlights() {
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

export function renderGrid() {
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
    rowTh.dataset.row = r.toString()
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

      td.appendChild(input)
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
}

export function refreshDisplay() {
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