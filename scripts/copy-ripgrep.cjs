#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const arch = process.env.npm_config_arch || process.arch;
const binaryName = process.platform === "win32" ? "rg.exe" : "rg";
const platformPkg = `@vscode/ripgrep-${process.platform}-${arch}`;

let sourcePath;
try {
  sourcePath = require.resolve(`${platformPkg}/bin/${binaryName}`);
} catch (error) {
  console.error(`Could not find ${platformPkg}/bin/${binaryName}.`);
  console.error("Run `npm install` without disabling optional dependencies, then try again.");
  throw error;
}

execFileSync(sourcePath, ["--version"], { stdio: "ignore", timeout: 1000 });

const assetsDir = path.join(__dirname, "..", "assets");
const destinationPath = path.join(assetsDir, binaryName);

fs.mkdirSync(assetsDir, { recursive: true });
fs.copyFileSync(sourcePath, destinationPath);

if (process.platform !== "win32") {
  fs.chmodSync(destinationPath, 0o755);
}

console.log(`Copied ripgrep binary to assets/${binaryName}`);
