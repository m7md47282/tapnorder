declare module 'xlsx-populate' {
  export interface Cell {
    value(value?: any): any;
    style(style: any): Cell;
    dataValidation(validation: any): Cell;
  }

  export interface Column {
    width(width: number): Column;
  }

  export interface Sheet {
    name(name: string): Sheet;
    cell(row: number, col: number): Cell;
    column(col: number): Column;
  }

  export interface Workbook {
    sheet(index: number | string): Sheet;
    addSheet(name: string): Sheet;
    definedName(name: string, formula: string): void;
    outputAsync(): Promise<Blob>;
  }

  export function fromBlankAsync(): Promise<Workbook>;
}

