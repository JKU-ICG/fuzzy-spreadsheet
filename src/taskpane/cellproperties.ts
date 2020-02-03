/* global console, Excel */
export default class CellProperties {
  public id: string;
  public address: string;
  public value: number;
  public top: number;
  public left: number;
  public height: number;
  public width: number;
  public isFocus: boolean;
  public degreeToFocus: number;
  public formula: any;
  public inputCells: CellProperties[];
  public outputCells: CellProperties[];

  CellProperties() {
    this.id = "";
    this.address = "";
    this.value = 0;
    this.top = 0;
    this.left = 0;
    this.height = 0;
    this.width = 0;
    this.isFocus = false;
    this.degreeToFocus = -1;
    this.formula = "";
  }

  async getCellsProperties(cells = new Array<CellProperties>()) {

    await Excel.run(async (context) => {

      const sheet = context.workbook.worksheets.getActiveWorksheet();
      const range = sheet.getUsedRange(true);
      range.load(["columnIndex", "rowIndex", "columnCount", "rowCount"]);
      await context.sync();

      const rowIndex = range.rowIndex;
      const colIndex = range.columnIndex;
      const rowCount = range.rowCount;
      const colCount = range.columnCount;

      for (let i = rowIndex; i < rowIndex + rowCount; i++) {
        for (let j = colIndex; j < colIndex + colCount; j++) {

          let cell = sheet.getCell(i, j);
          cell.load(["formulas", "top", "left", "height", "width", "address", "values"]);

          await context.sync();

          if (cell.values[0][0] == "") {
            continue;
          }

          let cellProperties = new CellProperties();
          cellProperties.id = "R" + i + "C" + j;
          cellProperties.address = cell.address;
          cellProperties.value = cell.values[0][0];
          cellProperties.top = cell.top;
          cellProperties.left = cell.left;
          cellProperties.height = cell.height;
          cellProperties.width = cell.width;
          cellProperties.formula = cell.formulas[0][0];
          cellProperties.degreeToFocus = -1;

          if (cellProperties.formula == cellProperties.value) {
            cellProperties.formula = "";
          }
          cellProperties.inputCells = new Array<CellProperties>();
          cellProperties.outputCells = new Array<CellProperties>();
          cells.push(cellProperties);
        }
      }
      await context.sync();
    });
    return cells;
  }

  async getRelationshipOfCells(cells: CellProperties[]) {

    try {
      for (let i = 0; i < cells.length; i++) {

        if (cells[i].formula == "") {
          continue;
        }

        let rangeAddress = this.getRangeFromFormula(cells[i].formula);

        await Excel.run(async (context) => {
          const sheet = context.workbook.worksheets.getActiveWorksheet();

          for (let rangeIndex = 0; rangeIndex < rangeAddress.length; rangeIndex++) {

            const range = sheet.getRange(rangeAddress[rangeIndex]);
            range.load(["columnIndex", "rowIndex", "columnCount", "rowCount"]);
            await context.sync();

            const rowIndex = range.rowIndex;
            const colIndex = range.columnIndex;
            const rowCount = range.rowCount;
            const colCount = range.columnCount;

            for (let r = rowIndex; r < rowIndex + rowCount; r++) {
              for (let c = colIndex; c < colIndex + colCount; c++) {
                const id = "R" + r + "C" + c;

                cells.forEach((cell: CellProperties) => {

                  if (cell.id == id) {

                    cells[i].inputCells.push(cell);
                    cell.outputCells.push(cells[i]);
                  }
                })
              }
            }
          }
        });
      }
    } catch (error) {
      console.error(error);
    }
    return cells;
  }

  getNeighbouringCells(cells: CellProperties[], focusCellAddress: string) {
    let focusCell = new CellProperties();

    cells.forEach((cell: CellProperties) => {
      if (cell.address == focusCellAddress) {
        focusCell = cell;
      }
    });

    focusCell.degreeToFocus = 0;

    this.inCellsDegree(focusCell.inputCells, 1);
    this.outCellsDegree(focusCell.outputCells, 1);
    return focusCell;
  }

  private getRangeFromFormula(formula: string) {
    let rangeAddress = new Array<string>();
    if (formula == "") {
      return;
    }
    if (formula.includes("SUM") && formula.includes(',')) {
      let i = formula.indexOf("SUM");
      formula = formula.slice(i + 3);
      formula = formula.replace('(', '');
      formula = formula.replace(')', '');
      rangeAddress = formula.split(',');
    }

    if (formula.includes("SUM") && formula.includes(":")) {
      let i = formula.indexOf("SUM");
      rangeAddress.push(formula.slice(i + 3));
    }
    if (formula.includes("MEDIAN")) {
      let i = formula.indexOf("MEDIAN");
      rangeAddress.push(formula.slice(i + 6));
    }

    return rangeAddress;
  }

  private inCellsDegree(cells: CellProperties[], i: number) {

    cells.forEach((cell: CellProperties) => {
      let j = i;
      cell.degreeToFocus = j;
      if (cell.inputCells.length > 0) {
        j = i + 1;
        this.inCellsDegree(cell.inputCells, j);
      }
      j = i;
    });
  }

  private outCellsDegree(cells: CellProperties[], i: number) {

    cells.forEach((cell: CellProperties) => {
      let j = i;
      cell.degreeToFocus = j;
      if (cell.outputCells.length > 0) {
        j = i + 1;
        this.outCellsDegree(cell.outputCells, j);
      }
      j = i;
    });
  }
}