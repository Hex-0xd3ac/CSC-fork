import loadModule, { importModule } from "./module-loader";
import EventEmitter2 from "node:events";
import process from "node:process";

export default class Hazel extends EventEmitter2 {
  mainConfig: any;
  loadedFunctions: Map<string, any>;
  moduleDir: Map<string, string>;
  loadHistory: Map<string, number>;
  loadIDMax: Map<string, number>;

  constructor(mainConfig: any) {
    super();
    this.mainConfig = mainConfig;
    this.loadedFunctions = new Map();
    this.moduleDir = new Map();
    this.loadHistory = new Map();
    this.loadIDMax = new Map();

    process.on("unhandledRejection", (error) => {
      this.emit("error", error);
    });
  }

  #core = {
    version: "0.3.6",
  };
  #hold = {};
  initLoadID = 0;
  functionLoadID = 0;

  async initialize(forceInit) {
    console.log("Initializing " + this.mainConfig.projectName + "...\n");

    if ((await this.loadModules(forceInit)) || forceInit) {
      const staticDirs = this.mainConfig.hazel.moduleDirs.staticDir.split(",");
      for (const staticDir of staticDirs) {
        await import("file:///" + this.mainConfig.baseDir + staticDir)
          .then((module) => {
            module.default(this, this.#core, this.#hold);
          })
          .catch((error) => {
            this.emit("error", error);
            console.error(error);
            if (!forceInit) {
              process.exit();
            }
          });
        console.log(`√ Static function ${staticDir} executed.`);
      }
    } else {
      process.exit();
    }
    this.loadIDMax.forEach((loadID, modulePath) => {
      this.loadIDMax.set(modulePath, this.functionLoadID);
    });
    this.emit("initialized");
    console.log(
      "\n==" + this.mainConfig.projectName + " Initialize Complete==\n",
    );
  }

  async getModulePath(moduleName: string) {
    return this.moduleDir.get(moduleName);
  }

  async reloadModule(modulePath: string) {
    let loadID =
      this.loadHistory.get(modulePath) !== undefined
        ? this.loadHistory.get(modulePath)[0] + 1
        : this.functionLoadID + 1;
    let module = await importModule(modulePath, loadID);
    this.loadHistory.set(modulePath, loadID);
    this.loadedFunctions.set(module.name, module);
    this.loadIDMax.set(
      modulePath,
      this.loadIDMax.get(modulePath) === undefined
        ? this.functionLoadID
        : Math.max(loadID, this.loadIDMax.get(modulePath)),
    );
  }

  async reloadModuleByID(modulePath: string, loadID: number) {
    let module = await importModule(modulePath, loadID);
    this.loadHistory.set(modulePath, loadID);
    this.loadedFunctions.set(module.name, module);
    this.loadIDMax.set(
      modulePath,
      this.loadIDMax.get(modulePath) === undefined
        ? this.functionLoadID
        : Math.max(loadID, this.loadIDMax.get(modulePath)),
    );
  }

  async runFunction(functionName, ...functionArgs) {
    if (!this.loadedFunctions.has(functionName)) {
      this.emit(
        "error",
        new Error("The function name '" + functionName + "' do not exist."),
      );
      console.error("The function name '" + functionName + "' do not exist.");
      return false;
    }

    let result;
    let targetFunction = this.loadedFunctions.get(functionName).run;
    try {
      result = await targetFunction(
        this,
        this.#core,
        this.#hold,
        ...functionArgs,
      );
    } catch (error) {
      this.emit("error", error);
      console.error(error);
      return false;
    }

    return result;
  }

  async reloadModules(forceReload) {
    this.emit("reload-start");
    if (
      !forceReload &&
      (await this.loadModules(forceReload || false)) == false
    ) {
      return false;
    }
    this.loadHistory.forEach((loadID, modulePath) => {
      this.loadHistory.set(modulePath, loadID + 1);
      this.loadIDMax.set(
        modulePath,
        this.loadIDMax.get(modulePath) === undefined
          ? this.functionLoadID
          : Math.max(loadID + 1, this.loadIDMax.get(modulePath)),
      );
    });
    this.emit("reload-complete");
    return true;
  }

  async loadModules(forceLoad: boolean) {
    let result = (await loadModule(
      this,
      this.mainConfig.baseDir + this.mainConfig.hazel.moduleDirs.initsDir,
      "init",
      ++this.initLoadID,
    )) as { moduleList: any; existError: boolean };
    let { moduleList: loadedInits, existError: initsExistError } = result;
    if (!forceLoad && initsExistError) {
      return false;
    }

    this.removeAllListeners();
    this.on("error", () => {});

    for (let property in this.#core) {
      delete this.#core[property];
    }

    loadedInits.forEach((initFunction) => {
      initFunction.run(this, this.#core, this.#hold).catch((error) => {
        this.emit("error", error);
        console.error(error);
        if (!forceLoad) {
          return false;
        }
      });
    });

    console.log(`√ Initialize inits ${loadedInits.length} complete!\n`);

    let { moduleList: loadedFunctions, existError: functionExistError } =
      (await loadModule(
        this,
        this.mainConfig.baseDir + this.mainConfig.hazel.moduleDirs.functionsDir,
        "function",
        ++this.functionLoadID,
      )) as { moduleList: any; existError: boolean };
    if (!forceLoad && functionExistError) {
      return false;
    }

    this.loadedFunctions = loadedFunctions;

    console.log(
      `√ Initialize functions ${this.loadedFunctions.size} complete!\n`,
    );

    return !(initsExistError || functionExistError);
  }
}
