import { build } from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";
const { esbuild } = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
await Promise.all([build(esbuild.worker), build(esbuild.manifest), build(esbuild.ui)]);
