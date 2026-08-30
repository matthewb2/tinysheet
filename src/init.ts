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
    hf.setCellContents({ sheet: sheetId, row, col }, [['']])
  } else {
    hf.setCellContents({ sheet: sheetId, row, col }, [[rawValue]])
  }
}