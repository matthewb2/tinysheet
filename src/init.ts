import { HyperFormula } from 'hyperformula'

export const ROWS = 30
export const COLS = 15

export function dbg(msg: string) {
  console.log('[debug]', msg)
}

export const hf = HyperFormula.buildEmpty({
  licenseKey: 'gpl-v3',
  evaluateNullToZero: false,
})

const sheetName = hf.addSheet('Sheet1')
export const sheetId = hf.getSheetId(sheetName)!

const rawTexts = new Map<string, string>()
const cellKey = (row: number, col: number) => row + ',' + col

export function getCellValue(row: number, col: number): string | number | null {
  try {
    const val = hf.getCellValue({ sheet: sheetId, row, col })
    if (val === null || val === undefined || val === '') return null
    return val as string | number
  } catch {
    return null
  }
}

export function getCellRaw(row: number, col: number): string {
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

export function setCellValue(row: number, col: number, rawValue: string) {
  if (rawValue === '') {
    rawTexts.delete(cellKey(row, col))
    hf.setCellContents({ sheet: sheetId, row, col }, [['']])
  } else {
    rawTexts.set(cellKey(row, col), rawValue)
    hf.setCellContents({ sheet: sheetId, row, col }, [[rawValue]])
  }
}

export function getRecordedRaw(row: number, col: number): string | null {
  const raw = rawTexts.get(cellKey(row, col))
  return raw === undefined ? null : raw
}

export function shiftRows(fromRow: number, delta: number) {
  const rows = Array.from(rawTexts.keys())
    .map((key) => parseInt(key.split(',')[0], 10))
    .filter((r) => r >= fromRow)
    .sort((a, b) => (delta > 0 ? b - a : a - b))
  for (const r of rows) {
    const cols = Array.from(rawTexts.keys())
      .filter((key) => parseInt(key.split(',')[0], 10) === r)
      .map((key) => parseInt(key.split(',')[1], 10))
    for (const c of cols) {
      const value = rawTexts.get(cellKey(r, c))!
      rawTexts.delete(cellKey(r, c))
      rawTexts.set(cellKey(r + delta, c), value)
    }
  }
}

export function shiftCols(fromCol: number, delta: number) {
  const cols = Array.from(rawTexts.keys())
    .map((key) => parseInt(key.split(',')[1], 10))
    .filter((c) => c >= fromCol)
    .sort((a, b) => (delta > 0 ? b - a : a - b))
  for (const c of cols) {
    const rows = Array.from(rawTexts.keys())
      .filter((key) => parseInt(key.split(',')[1], 10) === c)
      .map((key) => parseInt(key.split(',')[0], 10))
    for (const r of rows) {
      const value = rawTexts.get(cellKey(r, c))!
      rawTexts.delete(cellKey(r, c))
      rawTexts.set(cellKey(r, c + delta), value)
    }
  }
}