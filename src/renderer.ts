import './styles.css'
import { HyperFormula } from 'hyperformula'

const ROWS = 30
const COLS = 15

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

      input.addEventListener('focus', () => {
        input.value = getCellRaw(r, c)
      })

      input.addEventListener('blur', () => {
        const raw = input.value
        setCellValue(r, c, raw)
        const calculated = getCellValue(r, c)
        input.value = calculated !== null ? String(calculated) : ''
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
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  const data: string[][] = []
  for (const line of lines) {
    const delimiter = line.includes('\t') ? '\t' : ','
    data.push(line.split(delimiter))
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      hf.setCellContents({ sheet: sheetId, row: r, col: c }, [['']])
    }
  }

  for (let r = 0; r < Math.min(data.length, ROWS); r++) {
    for (let c = 0; c < Math.min(data[r].length, COLS); c++) {
      if (data[r][c] !== '') {
        hf.setCellContents({ sheet: sheetId, row: r, col: c }, [[data[r][c]]])
      }
    }
  }

  refreshDisplay()
}

document.addEventListener('DOMContentLoaded', () => {
  renderGrid()

  if (window.electronAPI?.onFileOpen) {
    window.electronAPI.onFileOpen((content: string) => {
      parseAndLoad(content)
    })
  }
})
