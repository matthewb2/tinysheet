import './styles.css'

const ROWS = 30
const COLS = 15

const gridData: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(''))

function getColumnLabel(index: number): string {
  return String.fromCharCode(65 + index)
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
      input.value = gridData[r][c]

      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement
        const row = parseInt(target.dataset.row || '0', 10)
        const col = parseInt(target.dataset.col || '0', 10)
        gridData[row][col] = target.value
      })

      td.appendChild(input)
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
}

function parseAndLoad(content: string) {
  const lines = content.split(/\r?\n/)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      gridData[r][c] = ''
    }
  }
  for (let r = 0; r < Math.min(lines.length, ROWS); r++) {
    const line = lines[r]
    const delimiter = line.includes('\t') ? '\t' : ','
    const cells = line.split(delimiter)
    for (let c = 0; c < Math.min(cells.length, COLS); c++) {
      gridData[r][c] = cells[c]
    }
  }
  renderGrid()
}

document.addEventListener('DOMContentLoaded', () => {
  renderGrid()

  if (window.electronAPI?.onFileOpen) {
    window.electronAPI.onFileOpen((content: string) => {
      parseAndLoad(content)
    })
  }
})
