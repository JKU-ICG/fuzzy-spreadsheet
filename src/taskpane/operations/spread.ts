/* global console, Excel */
import { ceil } from 'mathjs';
import * as jstat from 'jstat';
import CellProperties from '../cellproperties';
import SheetProperties from '../sheetproperties';

// the original file should not contain the variance and likelihood inforamtion at all, so adapt accordingly
export default class Spread {
  private chartType: string;
  private cells: CellProperties[];
  private referenceCell: CellProperties;
  private sheetName: string;
  private rangeAddresses: Excel.Range[];

  constructor(cells: CellProperties[], referenceCell: CellProperties, sheetName: string = 'CheatSheet') {
    this.cells = cells;
    this.referenceCell = referenceCell;
    this.sheetName = sheetName;
    this.rangeAddresses = new Array<Excel.Range>();
  }


  public showSpread(n: number) {

    try {

      this.addVarianceInfo();

      this.showReferenceCellSpread();
      this.showInputSpread(this.referenceCell.inputCells, n);
      this.showOutputSpread(this.referenceCell.outputCells, n);

    } catch (error) {
      console.log('Error in Show spread', error);
    }
  }

  public showReferenceCellSpread() {

    try {

      this.addSamplesToCell(this.referenceCell);
      this.drawBarCodePlot(this.referenceCell);

    } catch (error) {
      console.log('Error in Show Reference Cell Spread', error);
    }
  }

  public showInputSpread(cells: CellProperties[], i: number) {

    try {
      cells.forEach((cell: CellProperties) => {

        if (cell.isSpread) {
          console.log(cell.address + ' already has a spread');
          return;
        }

        cell.isSpread = true;
        this.addSamplesToCell(cell);
        this.drawBarCodePlot(cell);

        if (i == 1) {
          return;
        }
        this.showInputSpread(cell.inputCells, i - 1);
      })

    } catch (error) {
      console.log('Error in Show Input Cell Spread', error);
    }
  }

  public showOutputSpread(cells: CellProperties[], i: number) {

    try {

      cells.forEach((cell: CellProperties) => {

        if (cell.isSpread) {
          return;
        }

        cell.isSpread = true;
        this.addSamplesToCell(cell);
        this.drawBarCodePlot(cell);
        if (i == 1) {
          return;
        }
        this.showOutputSpread(cell.outputCells, i - 1);
      })

    } catch (error) {
      console.log('Error in Show Output Cell Spread', error);
    }
  }

  public drawBarCodePlot(cell: CellProperties) {
    try {
      Excel.run((context) => {

        const sheet = context.workbook.worksheets.getActiveWorksheet();
        // let totalWidth = cell.width;
        let totalHeight = cell.height;

        let startLineTop = cell.top;
        let startLineLeft = cell.left + 10;
        let endLineTop = cell.top + totalHeight;
        // let endLineLeft = cell.left + totalWidth;

        cell.mySamples.forEach((sample: { value: number, likelihood: number }) => {
          let valueToBeAdded: number = sample.value; // Math.round((sample.value + Number.EPSILON) * 100) / 100;

          let line = sheet.shapes.addLine(startLineLeft + valueToBeAdded, startLineTop, startLineLeft + valueToBeAdded, endLineTop);
          // line.lineFormat.transparency = 1 - sample.likelihood;
        })

        return context.sync().then(() => {
          console.log('Finished drawing the bar code plot')
        }).
          catch((reason: any) => console.log('Failed to draw the bar code plot: ' + reason));
      });
    } catch (error) {
      console.log('Could not draw the bar code plot because of the following error', error);
    }

  }

  public addSamplesToCell(cell: CellProperties) {

    try {

      cell.mySamples = new Array<{ value: number, likelihood: number }>();

      const mean = cell.value;
      const variance = cell.variance;

      if (variance == 0) {
        cell.mySamples.push({ value: mean, likelihood: 1 });
      }
      else {

        if (cell.formula.includes('SUM')) {
          cell.mySamples = this.addSamplesToSumCell(cell);
          return;
        }

        if (cell.formula.includes('-')) {
          cell.mySamples = this.addSamplesToSumCell(cell, true);
          return;
        }

        cell.mySamples = this.addSamplesToAverageCell(cell);
      }
    } catch (error) {
      console.log(error);
    }
  }

  public addSamplesToAverageCell(cell: CellProperties) {


    try {

      const mean = cell.value;
      const variance = cell.variance;

      cell.mySamples = new Array<{ value: number, likelihood: number }>();

      cell.mySamples.push({ value: 0, likelihood: (1 - cell.likelihood) });

      let numberOfSamples = 0;
      let i = mean - variance;

      while (i <= mean + variance) {
        numberOfSamples++;
        i++;
      }

      for (let i = mean - variance; i <= mean + variance; i++) {

        cell.mySamples.push({ value: i, likelihood: (cell.likelihood / numberOfSamples) });
        cell.isLineChart = true;
      }

    } catch (error) {
      console.log('Error in Average Spread Computation', error);
    }

    return cell.mySamples;
  }

  public addSamplesToSumCell(cell: CellProperties, isDifference: boolean = false) {

    try {

      let inputCells = cell.inputCells;
      let index = 0;

      let resultantSample = new CellProperties();
      resultantSample.mySamples = new Array<{ value: number, likelihood: number }>();

      if (inputCells.length > 1) {
        resultantSample = this.addTwoSamples(inputCells[index], inputCells[index + 1], isDifference);
        index = index + 2;
      }

      while (index < inputCells.length) {

        resultantSample = this.addTwoSamples(resultantSample, inputCells[index], isDifference);
        index = index + 1;
      }

      resultantSample.mySamples.forEach((sample: { value: number, likelihood: number }) => {
        cell.mySamples.push(sample);
      })
    } catch (error) {
      console.log('Error in Average Spread Computation', error);
    }
    return cell.mySamples;
  }

  private addTwoSamples(sample1: CellProperties, sample2: CellProperties, isDifference: boolean = false) {

    let resultantSample = new CellProperties();
    resultantSample.mySamples = new Array<{ value: number, likelihood: number }>();

    try {

      if (sample1.mySamples == null) {
        this.addSamplesToCell(sample1);
      }

      if (sample2.mySamples == null) {
        this.addSamplesToCell(sample2);
      }

      sample1.mySamples.forEach((sampleCell1: { value: number, likelihood: number }) => {

        sample2.mySamples.forEach((sampleCell2: { value: number, likelihood: number }) => {

          let value = sampleCell1.value + sampleCell2.value;

          if (isDifference) {
            value = sampleCell1.value - sampleCell2.value;
          }
          const likelihood = sampleCell1.likelihood * sampleCell2.likelihood;

          let allowInsert = true;

          // code for duplicate removal
          resultantSample.mySamples.forEach((result: { value: number, likelihood: number }) => {
            if (result.value == value) {
              result.likelihood += likelihood;
              allowInsert = false;
              return;
            }
          })

          if (allowInsert) {
            resultantSample.mySamples.push({ value: value, likelihood: likelihood });
          }
        })
      })
    } catch (error) {
      console.log(error);
    }

    return resultantSample;
  }

  public addVarianceInfo() {

    try {
      for (let i = 0; i < this.cells.length; i++) {
        this.cells[i].variance = 0;

        if (this.cells[i].isUncertain) {

          this.cells[i].variance = this.cells[i + 1].value;
          this.cells[i].likelihood = this.cells[i + 2].value;
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  public async removeSpread() {

    this.cells.forEach((cell: CellProperties) => {
      cell.isSpread = false;
    })

    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      var charts = sheet.charts;
      charts.load("items/$none");
      return context.sync().then(function () {
        charts.items.forEach(function (chart) {
          chart.delete();
        });
        return context.sync();
      });
    });
  }
}