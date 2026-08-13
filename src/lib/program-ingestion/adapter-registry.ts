import { ProgramSourceAdapter } from "./adapter-interface";
import { GenericHtmlProgramAdapter } from "./generic-adapter";
import { OxfordProgramAdapter } from "./adapters/oxford-adapter";
import { CambridgeProgramAdapter } from "./adapters/cambridge-adapter";
import { ImperialProgramAdapter } from "./adapters/imperial-adapter";
import { BocconiProgramAdapter } from "./adapters/bocconi-adapter";

export class AdapterRegistry {
  private adapters: ProgramSourceAdapter[] = [];
  private genericAdapter: ProgramSourceAdapter;

  constructor() {
    this.genericAdapter = new GenericHtmlProgramAdapter();
    this.adapters = [
      new OxfordProgramAdapter(),
      new CambridgeProgramAdapter(),
      new ImperialProgramAdapter(),
      new BocconiProgramAdapter(),
    ];
  }

  getAdapter(url: string, domain: string): ProgramSourceAdapter {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url, domain)) {
        return adapter;
      }
    }
    return this.genericAdapter;
  }
}
