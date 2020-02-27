import CellProperties from "../cellproperties";

/* global console, Excel */
export default class Relationship {

  private referenceCell: CellProperties;
  private cells: CellProperties[];
  private degreeOfNeighbourhood: number;

  constructor(cells: CellProperties[], referenceCell: CellProperties) {
    this.cells = cells;
    this.referenceCell = referenceCell;
  }

  showInputRelationship(n: number) {
    let colors = new Array<string>('black', 'grey', 'lightgrey');
    this.addInputRelation(this.referenceCell, n, 0, colors);
  }

  showOutputRelationship(n: number) {
    let colors = new Array<string>('black', 'grey', 'lightgrey');
    this.addOutputRelation(this.referenceCell, n, 0, colors);
  }

  removeInputRelationship() {
    this.deleteTriangles('Input');
  }

  removeOutputRelationship() {
    this.deleteTriangles('Output');
  }

  private async deleteTriangles(type: string) {

    this.cells.forEach((cell: CellProperties) => {
      if (type == 'Input') {
        cell.isInputRelationship = false;
      }
      if (type == 'Output') {
        cell.isOutputRelationship = false;
      }
    })

    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      var shapes = sheet.shapes;
      shapes.load("items/name");

      return context.sync().then(function () {
        shapes.items.forEach(function (shape) {
          if (shape.name.includes(type)) {
            shape.delete();
          }
        });
        return context.sync();
      });
    });
  }

  private drawInputRelation(cell: CellProperties, color: string) {

    Excel.run(async (context) => {

      let type: Excel.GeometricShapeType;
      var shapes = context.workbook.worksheets.getActiveWorksheet().shapes;

      type = Excel.GeometricShapeType.triangle;
      let triangle = shapes.addGeometricShape(type);
      triangle.name = "Input";
      triangle.rotation = 90;
      triangle.left = cell.left;
      triangle.top = cell.top + cell.height / 4;
      triangle.height = 3;
      triangle.width = 6;
      triangle.lineFormat.weight = 0;
      triangle.lineFormat.color = color;
      triangle.fill.setSolidColor(color);

      await context.sync();
    })
  }

  private addInputRelation(cell: CellProperties, n: number, colorIndex: number, colors: string[]) {

    cell.inputCells.forEach((inCell: CellProperties) => {

      if (inCell.isInputRelationship) {
        return;
      }

      inCell.isInputRelationship = true;
      this.drawInputRelation(inCell, colors[colorIndex]);

      if (n == 1) {
        return;
      }

      let newColorIndex = colorIndex + 1;

      this.addInputRelation(inCell, n - 1, newColorIndex, colors);
    })
  }

  private addOutputRelation(cell: CellProperties, n: number, colorIndex: number, colors: string[]) {

    cell.outputCells.forEach((outCell: CellProperties) => {

      if (outCell.isOutputRelationship) {
        return;
      }

      outCell.isOutputRelationship = true;
      this.drawOutputRelation(outCell, colors[colorIndex]);

      if (n == 1) {
        return;
      }

      let newColorIndex = colorIndex + 1;

      this.addOutputRelation(outCell, n - 1, newColorIndex, colors);
    })
  }

  private drawOutputRelation(cell: CellProperties, color: string) {

    Excel.run(async (context) => {
      let type: Excel.GeometricShapeType;
      var shapes = context.workbook.worksheets.getActiveWorksheet().shapes;

      type = Excel.GeometricShapeType.triangle;
      let triangle = shapes.addGeometricShape(type);
      triangle.name = "Output"
      triangle.rotation = 270;
      triangle.left = cell.left;
      triangle.top = cell.top + cell.height / 4;
      triangle.height = 3;
      triangle.width = 6;
      triangle.lineFormat.weight = 0;
      triangle.lineFormat.color = color;
      triangle.fill.setSolidColor(color);
      await context.sync();
    })
  }
}