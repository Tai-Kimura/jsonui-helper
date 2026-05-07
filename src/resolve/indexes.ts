import { buildColorsIndex, type ColorsIndex } from "./colorsRef";
import { buildImageIndex, type ImageIndex } from "./imageRef";
import { buildLayoutIndex, type LayoutIndex } from "./layoutRef";
import { buildSpecIndex, type SpecIndex } from "./specRef";
import { buildStringsIndex, type StringsIndex } from "./stringsRef";
import { buildStyleIndex, type StyleIndex } from "./styleRef";
import { buildTypeNameCatalog, type TypeNameCatalog } from "./typeNames";
import { loadCustomRules, type CustomRules } from "./customRules";
import type { JuiConfig } from "../config/juiConfig";

export interface ProjectIndexes {
  layouts: LayoutIndex;
  styles: StyleIndex;
  specs: SpecIndex;
  strings: StringsIndex;
  colors: ColorsIndex;
  images: ImageIndex;
  typeNames: TypeNameCatalog;
  rules: CustomRules;
}

export function buildIndexes(extensionRoot: string, config: JuiConfig): ProjectIndexes {
  return {
    layouts: buildLayoutIndex(config.layoutsDirectory),
    styles: buildStyleIndex(config.layoutsDirectory, config.stylesDirectory),
    specs: buildSpecIndex(config.specDirectory),
    strings: buildStringsIndex(config.stringsFile),
    colors: buildColorsIndex(config.layoutsDirectory),
    images: buildImageIndex(config.imagesDirectory),
    typeNames: buildTypeNameCatalog(extensionRoot, config.typeMapFile),
    rules: loadCustomRules(config.rulesFile),
  };
}
