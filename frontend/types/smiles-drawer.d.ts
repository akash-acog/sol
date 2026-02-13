declare module "smiles-drawer" {
  export interface DrawerOptions {
    width?: number;
    height?: number;
    bondThickness?: number;
    bondLength?: number;
    shortBondLength?: number;
    bondSpacing?: number;
    atomVisualization?: string;
    isomeric?: boolean;
    debug?: boolean;
    terminalCarbons?: boolean;
    explicitHydrogens?: boolean;
    overlapSensitivity?: number;
    overlapResolutionIterations?: number;
    compactDrawing?: boolean;
    fontSizeLarge?: number;
    fontSizeSmall?: number;
    padding?: number;
    experimental?: boolean;
    themes?: any;
  }

  export class Drawer {
    constructor(options: DrawerOptions);
    draw(
      tree: any,
      target: HTMLCanvasElement | string,
      theme?: string,
      infoOnly?: boolean,
    ): void;
  }

  export function parse(
    smiles: string,
    callback: (tree: any) => void,
    errorCallback?: (error: any) => void,
  ): void;

  const SmilesDrawer: {
    Drawer: typeof Drawer;
    parse: typeof parse;
  };

  export default SmilesDrawer;
}
