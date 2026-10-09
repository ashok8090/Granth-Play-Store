import { Buffer } from "buffer";
import { registerRootComponent } from "expo";
import { App } from "./App";

const root = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!root.Buffer) root.Buffer = Buffer;

registerRootComponent(App);
