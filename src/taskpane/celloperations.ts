/* global console, Excel */
import { std, ceil } from 'mathjs';
import * as jstat from 'jstat';
import CellProperties from './cellproperties';
import CustomShape from './customshape';

export default class CellOperations {
  chartType: string;
  cells: CellProperties[];
  customShapes: CustomShape[];

  CellOperations() {
    this.cells = new Array<CellProperties>();
  }

  setCells(cells: CellProperties[]) {
    this.cells = cells;
  }

  async addImpact(focusCell: CellProperties) {
    this.addImpactInfo(focusCell);
    this.drawRectangles(focusCell.inputCells);
    this.drawRectangles(focusCell.outputCells);
  }

  private addImpactInfo(focusCell: CellProperties, color: string = null) {

    this.addImpactInfoToInputCells(focusCell, color);
    this.addImpactInfoOutputCells(focusCell);

  }

  private addImpactInfoToInputCells(focusCell: CellProperties, color: string = null) {

    const isFocusCellAverage = focusCell.formula.includes("AVERAGE") || focusCell.formula.includes("MITTELWERT");
    const isFocusCellSum = focusCell.formula.includes("SUM");
    const isFocusCellDiff = focusCell.formula.includes('-');
    let subtrahend = null;

    if (isFocusCellDiff) {
      let formula: string = focusCell.formula;
      let idx = formula.indexOf('-');
      subtrahend = formula.substring(idx + 1, formula.length);
    }

    focusCell.inputCells.forEach((inCell: CellProperties) => {

      let colorProperties;

      if (isFocusCellAverage) {
        colorProperties = this.inputColorPropertiesAverage(inCell.value, focusCell.value, focusCell.inputCells);
      }
      else if (isFocusCellSum) {
        colorProperties = this.inputColorProperties(inCell.value, focusCell.value, focusCell.inputCells);
      }
      else if (isFocusCellDiff) {
        let isSubtrahend = false;
        inCell.isImpact = true;

        if (inCell.address.includes(subtrahend)) {
          isSubtrahend = true;
        }

        colorProperties = this.inputColorProperties(inCell.value, focusCell.value, focusCell.inputCells, isSubtrahend);
      }

      inCell.isImpact = true;
      inCell.rectColor = color ? color : colorProperties.color;
      inCell.rectTransparency = colorProperties.transparency;
    })
  }

  private addImpactInfoOutputCells(focusCell: CellProperties) {

    focusCell.outputCells.forEach((outCell: CellProperties) => {

      let isSubtrahend: boolean = false;
      let isMinuend: boolean = false;

      if (outCell.formula.includes('-')) {
        //figure out whether the focus cell is minuend or subtrahend to the outcell
        let formula: string = outCell.formula;
        formula = formula.replace('=', '').replace(' ', '');
        let idx = formula.indexOf('-');
        let subtrahend = formula.substring(idx + 1, formula.length);

        if (focusCell.address.includes(subtrahend)) {
          isSubtrahend = true;
        } else {
          isMinuend = true;
        }
      }

      let colorProperties = this.outputColorProperties(outCell.value, focusCell.value, outCell.inputCells, isSubtrahend, isMinuend);
      outCell.isImpact = true;
      outCell.rectColor = colorProperties.color;
      outCell.rectTransparency = colorProperties.transparency;
    })
  }

  private drawRectangles(cells: CellProperties[]) {
    try {
      Excel.run((context) => {

        const sheet = context.workbook.worksheets.getActiveWorksheet();
        let i = 0;
        let MARGIN = 5;

        cells.forEach((cell: CellProperties) => {
          cell.rect = sheet.shapes.addGeometricShape("Rectangle");
          cell.rect.name = "Impact" + i;

          cell.rect.left = cell.left + MARGIN;
          cell.rect.top = cell.top + cell.height / 4;
          cell.rect.height = 5;
          cell.rect.width = 5;
          cell.rect.geometricShapeType = Excel.GeometricShapeType.rectangle;
          cell.rect.fill.setSolidColor(cell.rectColor);
          cell.rect.fill.transparency = cell.rectTransparency;
          cell.rect.lineFormat.weight = 0;
          cell.rect.lineFormat.color = cell.rectColor;
          i++;
        })
        return context.sync();
      });

    } catch (error) {
      console.error(error);
    }
  }

  private deleteCustomShapes() {
    try {
      Excel.run(async (context) => {

        const sheet = context.workbook.worksheets.getActiveWorksheet();
        let i = 0;

        this.customShapes.forEach((customShape: CustomShape) => {
          customShape.shape = sheet.shapes.getItem("Impact" + i)
          customShape.shape.delete();
          i++;

        })
        await context.sync();
      });

    } catch (error) {
      console.error(error);
    }
  }

  private computeColor(cellValue: number, focusCellValue: number, cells: CellProperties[], isSubtrahend: boolean = false, isMinuend: boolean = false) {

    let color = "green";

    if (isSubtrahend) {
      color = "red";
      return color;
    }

    if (focusCellValue > 0 && cellValue < 0) {
      if (isMinuend) {
        color = "green";
      } else {
        color = "red";
      }
    }

    if (focusCellValue < 0 && cellValue < 0) { // because of the negative sign, the smaller the number the higher it is
      let isAnyCellPositive = false;

      cells.forEach((cell: CellProperties) => {
        if (cell.value > 0) {
          isAnyCellPositive = true;
        }
      })

      if (isAnyCellPositive) { // if even one cell is positive, then it means that only that cell is contributing positively and rest all are contributing negatively
        color = "red";
      }
    }
    return color;
  }

  private inputColorProperties(cellValue: number, focusCellValue: number, cells: CellProperties[], isSubtrahend: boolean = false, isMinuend: boolean = false) {

    let transparency = 0;
    const color = this.computeColor(cellValue, focusCellValue, cells, isSubtrahend, isMinuend);

    // Make both values positive
    if (cellValue < 0) {
      cellValue = -cellValue;
    }

    if (focusCellValue < 0) {
      focusCellValue = -focusCellValue;
    }

    if (cellValue < focusCellValue) {

      let value = cellValue / focusCellValue;

      transparency = 1 - value;
    }
    else {

      let maxValue = cellValue;
      // go through the input cells of the focus cell
      cells.forEach((c: CellProperties) => {
        let val = c.value;

        if (val < 0) {
          val = -val;
        }
        if (val > maxValue) {
          maxValue = val;
        }
      })

      transparency = 1 - (cellValue / maxValue);
    }

    return { color: color, transparency: transparency };
  }

  private inputColorPropertiesAverage(cellValue: number, focusCellValue: number, cells: CellProperties[]) {

    let transparency = 0;
    let values: number[] = new Array<number>();


    cells.forEach((cell: CellProperties) => {
      values.push(cell.value);
    });

    let stdDev = std(values);

    transparency = (focusCellValue - cellValue) / (2 * stdDev);

    if (transparency < 0) {
      transparency = -transparency;
    }

    if (transparency > 1) {
      transparency = 1;
    }

    return { color: "green", transparency: transparency }
  }

  // Fix color values for negative values
  private outputColorProperties(cellValue: number, focusCellValue: number, cells: CellProperties[], isSubtrahend: boolean = false, isMinuend: boolean = false) {

    let transparency = 0;
    const color = this.computeColor(cellValue, focusCellValue, cells, isSubtrahend, isMinuend);

    // Make both values positive
    if (cellValue < 0) {
      cellValue = -cellValue;
    }

    if (focusCellValue < 0) {
      focusCellValue = -focusCellValue;
    }

    if (cellValue > focusCellValue) {

      let value = focusCellValue / cellValue;

      transparency = 1 - value;

    }
    else {
      let maxValue = cellValue;
      // go through the input cells of the output cell
      cells.forEach((c: CellProperties) => {
        let val = c.value;
        if (val < 0) {
          val = -val;
        }
        if (val > maxValue) {
          maxValue = val;
        }
      })

      transparency = 1 - (focusCellValue / maxValue);
    }

    return { color: color, transparency: transparency };
  }

  private addLikelihoodInfo() {

    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i].isUncertain) {
        this.cells[i].likelihood = this.cells[i + 2].value;
        console.log(this.cells[i].value + " has " + this.cells[i].likelihood);
      }
    }
  }

  async addLikelihood(focusCell: CellProperties) {

    this.addLikelihoodInfo();
    let k = 0;
    try {

      if (this.customShapes == null) {

        this.customShapes = new Array<CustomShape>();

        focusCell.inputCells.forEach((inCell: CellProperties) => {
          inCell.isLikelihood = true;
          console.log("Incell likelihood: " + inCell.isLikelihood);
          let customShape: CustomShape = { cell: inCell, shape: null, color: 'gray', transparency: 0 }
          this.customShapes.push(customShape);
        });

        focusCell.outputCells.forEach((outCell: CellProperties) => {
          outCell.isLikelihood = true;
          console.log("Outcell likelihood: " + outCell.isLikelihood);
          let customShape: CustomShape = { cell: outCell, shape: null, color: 'gray', transparency: 0 }
          this.customShapes.push(customShape);
        });

        // this.drawRectangles();
      }

      await Excel.run(async (context) => {

        for (let i = 0; i < this.customShapes.length; i++) {

          const sheet = context.workbook.worksheets.getActiveWorksheet();
          let key = "Impact" + i;
          let shape = sheet.shapes.getItem(key);
          k++;
          shape.load(["height", "width", "top"]);

          await context.sync();

          let likelihood = this.customShapes[i].cell.likelihood / 10;
          this.customShapes[i].cell.isLikelihood = true;
          if (likelihood == 10) {
            likelihood = this.cells[i].height;
            shape.top = shape.top - 4;
          }
          shape.height = likelihood;
          shape.width = likelihood;
        }

        // createLikelihoodLegend().then(function () { });
        await context.sync();
      });
    } catch (error) {
      console.log("Didn't work for " + k);
      console.error(error);
    }

  }

  private addVarianceInfo() {

    // use the info of uncertain cells
    for (let i = 0; i < this.cells.length; i++) {
      for (let r = 5; r < 22; r++) {
        let id = "R" + r + "C8";
        if (this.cells[i].id == id) {
          this.cells[i].variance = this.cells[i + 2].value;
          console.log('Variance:' + this.cells[i].variance);
        }
      }
    }
  }

  async createNormalDistributions() {

    this.addVarianceInfo();
    await Excel.run(async (context) => {

      let cheatsheet = context.workbook.worksheets.getItemOrNullObject("CheatSheet");
      await context.sync();

      if (!cheatsheet.isNullObject) {
        cheatsheet.delete();
      }

      cheatsheet = context.workbook.worksheets.add("CheatSheet");
      let rowIndex = -1;
      // let min = mean - variance * 2;
      // let max = mean + variance * 2;

      for (let c = 0; c < this.cells.length; c++) {

        this.cells[c].samples = new Array<number>();


        let overallMin = -10;
        let overallMax = 40;
        let mean = this.cells[c].value;


        let variance = this.cells[c].variance

        if (variance > 0) {
          rowIndex++;
          let sampleSize = (variance * 2) / 50;

          for (let i = overallMin; i <= overallMax; i = i + sampleSize) {
            this.cells[c].samples.push(jstat.normal.pdf(i, mean, variance));
            this.cells[c].isLineChart = true;
          }
        }
        else {
          rowIndex++;
          if (this.cells[c].degreeToFocus >= 0) {
            for (let i = overallMin; i <= overallMax; i++) {
              if (i == ceil(this.cells[c].value)) {
                this.cells[c].samples.push(1);
              } else {
                this.cells[c].samples.push(0);
              }
            }
          }
        }

        if (this.cells[c].samples.length == 0) {
          continue;
        }

        let range = cheatsheet.getRangeByIndexes(rowIndex, 0, 1, this.cells[c].samples.length);
        range.values = [this.cells[c].samples];
        range.load('address');
        await context.sync();
        this.cells[c].spreadRange = range.address;
      }

      await context.sync();
    });
  }

  async addSpread(focusCell: CellProperties) {

    await this.createNormalDistributions();

    this.drawLineChart(focusCell);
    // this.drawCompleteLineChart(focusCell);

    focusCell.inputCells.forEach((cell: CellProperties) => {
      this.drawLineChart(cell);

    })

    focusCell.outputCells.forEach((cell: CellProperties) => {
      this.drawLineChart(cell);
    })
  }

  private drawLineChart(cell: CellProperties) {

    if (cell.spreadRange == null) {
      return;
    }
    try {
      Excel.run((context) => {

        const sheet = context.workbook.worksheets.getActiveWorksheet();
        const cheatSheet = context.workbook.worksheets.getItem("CheatSheet");
        const dataRange = cheatSheet.getRange(cell.spreadRange);

        let chart: Excel.Chart;

        if (cell.isLineChart) {
          console.log("Line chart");
          chart = sheet.charts.add(Excel.ChartType.line, dataRange, Excel.ChartSeriesBy.rows);
        } else {
          console.log("Column chart");
          chart = sheet.charts.add(Excel.ChartType.columnClustered, dataRange, Excel.ChartSeriesBy.rows);
        }

        chart.setPosition(cell.address, cell.address);
        chart.left = cell.left + 0.2 * cell.width;
        chart.title.visible = false;
        chart.legend.visible = false;
        chart.axes.valueAxis.minimum = 0;
        // chart.axes.valueAxis.maximum = 0.21;
        chart.dataLabels.showValue = false;
        chart.axes.valueAxis.visible = false;
        chart.axes.categoryAxis.visible = false;
        chart.axes.valueAxis.majorGridlines.visible = false;
        chart.plotArea.top = 0;
        chart.plotArea.left = 0;
        chart.plotArea.width = cell.width - 0.4 * cell.width;
        chart.plotArea.height = 100;
        chart.format.fill.clear();
        chart.format.border.clear();
        return context.sync();
      });
    } catch (error) {
      console.log('Could not draw chart because of the following error', error);
    }
  }

  showPopUpWindow(address: string) {
    this.removePopUps();

    this.cells.forEach((cell: CellProperties) => {
      if (cell.address.includes(address)) {
        if (cell.spreadRange == null) {
          return;
        }

        Excel.run((context) => {

          const sheet = context.workbook.worksheets.getActiveWorksheet();
          const cheatSheet = context.workbook.worksheets.getItem("CheatSheet");

          let MARGIN = 120
          let TEXTMARGIN = 20;
          let TOPMARGIN = 15;

          console.log("MArgin: " + MARGIN + " TOP MARGIN: " + TOPMARGIN);
          let shape1 = sheet.shapes.addGeometricShape("Rectangle");
          shape1.name = "Pop7";
          shape1.left = cell.left + cell.width;
          shape1.top = cell.top - cell.height;
          shape1.height = 250;
          shape1.width = 300;
          shape1.geometricShapeType = Excel.GeometricShapeType.rectangle;
          shape1.fill.setSolidColor('ADD8E6');
          shape1.lineFormat.weight = 0;
          shape1.lineFormat.color = 'ADD8E6';

          if (cell.isImpact) {

            this.customShapes.forEach((cShape: CustomShape) => {

              if (cShape.cell == cell) {

                let impact = sheet.shapes.addGeometricShape("Rectangle");
                impact.name = "Pop1";
                impact.left = cell.left + MARGIN;
                impact.top = cell.top + TOPMARGIN;
                impact.height = 5;
                impact.width = 5;
                impact.geometricShapeType = Excel.GeometricShapeType.rectangle;
                impact.fill.setSolidColor(cShape.color);
                impact.fill.transparency = cShape.transparency;
                impact.lineFormat.weight = 0;
                impact.lineFormat.color = cShape.color;
                impact.setZOrder(Excel.ShapeZOrder.bringForward);

                let text = (Math.ceil((1 - cShape.transparency) * 100)) + '%';

                if (cShape.color == 'green') {
                  text += 'Positive Impact';
                } else {
                  text += 'Negative Impact';
                }

                let textbox = sheet.shapes.addTextBox(text);
                textbox.name = "Pop2";
                textbox.left = cell.left + MARGIN + TEXTMARGIN;
                textbox.top = cell.top;
                textbox.height = 20;
                textbox.width = 150;

                textbox.setZOrder(Excel.ShapeZOrder.bringForward);
              }
            })
          }

          if (cell.isLikelihood) {

            let likelihood = sheet.shapes.addGeometricShape("Rectangle");
            likelihood.name = "Pop3";
            likelihood.left = cell.left + MARGIN;
            likelihood.top = cell.top + 2 * TOPMARGIN;
            likelihood.height = cell.likelihood / 10;
            likelihood.width = cell.likelihood / 10;
            likelihood.geometricShapeType = Excel.GeometricShapeType.rectangle;
            likelihood.fill.setSolidColor('gray');
            likelihood.lineFormat.weight = 0;
            likelihood.lineFormat.color = 'gray';
            likelihood.setZOrder(Excel.ShapeZOrder.bringForward);

            let text = cell.likelihood + '% Likelihood';

            let textbox2 = sheet.shapes.addTextBox(text);
            textbox2.name = "Pop4";
            textbox2.left = cell.left + MARGIN + TEXTMARGIN
            textbox2.top = cell.top + 2 * TOPMARGIN;
            textbox2.height = 20;
            textbox2.width = 150;
            textbox2.setZOrder(Excel.ShapeZOrder.bringForward);
          }

          const dataRange = cheatSheet.getRange(cell.spreadRange);
          let chart = sheet.charts.add(Excel.ChartType.columnClustered, dataRange, Excel.ChartSeriesBy.auto);
          chart.name = "Pop5";
          chart.setPosition(cell.address);
          chart.left = cell.left + MARGIN;
          chart.top = cell.top + 3 * TOPMARGIN;
          chart.height = 180;
          chart.width = 210;
          // chart.axes.valueAxis.minimum = -10;
          // chart.axes.valueAxis.maximum = 40;
          // chart.axes.valueAxis.tickLabelSpacing = 1;
          chart.axes.categoryAxis.visible = false;
          chart.axes.valueAxis.majorGridlines.visible = false;
          chart.title.visible = false;
          chart.format.fill.clear();
          chart.format.border.clear();

          // let textbox3 = sheet.shapes.addTextBox('Mean and Variance');
          // textbox3.name = "Pop6";
          // textbox3.left = cell.left + MARGIN;
          // textbox3.top = cell.top + 180;
          // textbox3.setZOrder(Excel.ShapeZOrder.bringForward);
          return context.sync();
        });
      }
    })
  }
  async removePopUps() {
    // remove();
    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      var shapes = sheet.shapes;
      shapes.load("items/name");

      return context.sync().then(function () {
        shapes.items.forEach(function (shape) {
          if (shape.name.includes('Pop')) {
            shape.delete();
          }
        });
        return context.sync();
      });
    });
  }

  addInArrows(focusCell: CellProperties, cells: CellProperties[]) {

    Excel.run(async (context) => {

      for (let i = 0; i < cells.length; i++) {

        let type: Excel.GeometricShapeType;
        var shapes = context.workbook.worksheets.getActiveWorksheet().shapes;

        type = Excel.GeometricShapeType.triangle;
        let triangle = shapes.addGeometricShape(type);
        triangle.rotation = 90;
        triangle.left = cells[i].left;
        triangle.top = cells[i].top + cells[i].height / 4;
        triangle.height = 3;
        triangle.width = 6;
        triangle.lineFormat.weight = 0;
        triangle.lineFormat.color = 'black';
        triangle.fill.setSolidColor('black');
      }

      await context.sync();
    })
  }

  addOutArrows(focusCell: CellProperties, cells: CellProperties[]) {

    Excel.run(async (context) => {

      for (let i = 0; i < cells.length; i++) {
        let type: Excel.GeometricShapeType;
        var shapes = context.workbook.worksheets.getActiveWorksheet().shapes;

        type = Excel.GeometricShapeType.triangle;
        let triangle = shapes.addGeometricShape(type);
        triangle.rotation = 270;
        triangle.left = cells[i].left;
        triangle.top = cells[i].top + cells[i].height / 4;
        triangle.height = 3;
        triangle.width = 6;
        triangle.lineFormat.weight = 0;
        triangle.lineFormat.color = 'black';
        triangle.fill.setSolidColor('black');
      }
      await context.sync();
    })
  }
}