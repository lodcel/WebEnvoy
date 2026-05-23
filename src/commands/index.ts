import { CommandRegistry } from "../core/registry.js";

import { abilityCommands } from "./ability.js";
import { downloadCommands } from "./download.js";
import { installCommands } from "./install.js";
import { l2Commands } from "./l2.js";
import { runtimeCommands } from "./runtime.js";
import { xhsCommands } from "./xhs.js";

export const createCommandRegistry = (): CommandRegistry => {
  const registry = new CommandRegistry();

  for (const command of runtimeCommands()) {
    registry.register(command);
  }

  for (const command of installCommands()) {
    registry.register(command);
  }

  for (const command of l2Commands()) {
    registry.register(command);
  }

  for (const command of abilityCommands()) {
    registry.register(command);
  }

  for (const command of downloadCommands()) {
    registry.register(command);
  }

  for (const command of xhsCommands()) {
    registry.register(command);
  }

  return registry;
};
