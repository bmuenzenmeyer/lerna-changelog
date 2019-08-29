const fs = require("fs");
const path = require("path");
const execa = require("execa");
const normalize = require("normalize-git-url");

import ConfigurationError from "./configuration-error";

export interface Configuration {
  repo: string;
  rootPath: string;
  labels: { [key: string]: string };
  ignoreCommitters: string[];
  cacheDir?: string;
  nextVersion: string | undefined;
  nextVersionFromMetadata?: boolean;
  gitUrl?: string;
  gitAPIUrl?: string
}

export interface ConfigLoaderOptions {
  nextVersionFromMetadata?: boolean;
}

export function load(options: ConfigLoaderOptions = {}): Configuration {
  let cwd = process.cwd();
  let rootPath = execa.sync("git", ["rev-parse", "--show-toplevel"], { cwd }).stdout;

  return fromPath(rootPath, options);
}

export function fromPath(rootPath: string, options: ConfigLoaderOptions = {}): Configuration {
  // Step 1: load partial config from `package.json` or `lerna.json`
  let config = fromPackageConfig(rootPath) || fromLernaConfig(rootPath) || {};

  // Step 2: fill partial config with defaults
  let { repo, nextVersion, labels, cacheDir, ignoreCommitters, gitUrl, gitAPIUrl } = config;

  if (!repo) {
    repo = findRepo(rootPath, config);
    if (!repo) {
      throw new ConfigurationError('Could not infer "repo" from the "package.json" file.');
    }
  }

  if (options.nextVersionFromMetadata || config.nextVersionFromMetadata) {
    nextVersion = findNextVersion(rootPath);

    if (!nextVersion) {
      throw new ConfigurationError('Could not infer "nextVersion" from the "package.json" file.');
    }
  }

  if (!labels) {
    labels = {
      breaking: ":boom: Breaking Change",
      enhancement: ":rocket: Enhancement",
      bug: ":bug: Bug Fix",
      documentation: ":memo: Documentation",
      internal: ":house: Internal",
    };
  }

  if (!ignoreCommitters) {
    ignoreCommitters = [
      "dependabot-bot",
      "dependabot[bot]",
      "greenkeeperio-bot",
      "greenkeeper[bot]",
      "renovate-bot",
      "renovate[bot]",
    ];
  }

  return {
    repo,
    nextVersion,
    rootPath,
    labels,
    ignoreCommitters,
    cacheDir,
    gitUrl,
    gitAPIUrl
  };
}

function fromLernaConfig(rootPath: string): Partial<Configuration> | undefined {
  const lernaPath = path.join(rootPath, "lerna.json");
  if (fs.existsSync(lernaPath)) {
    return JSON.parse(fs.readFileSync(lernaPath)).changelog;
  }
}

function fromPackageConfig(rootPath: string): Partial<Configuration> | undefined {
  const pkgPath = path.join(rootPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    return JSON.parse(fs.readFileSync(pkgPath)).changelog;
  }
}

function findRepo(rootPath: string, config: Partial<Configuration>): string | undefined {
  const pkgPath = path.join(rootPath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath));
  if (!pkg.repository) {
    return;
  }

  return findRepoFromPkg(pkg, config);
}

function findNextVersion(rootPath: string): string | undefined {
  const pkgPath = path.join(rootPath, "package.json");
  const lernaPath = path.join(rootPath, "lerna.json");

  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath)) : {};
  const lerna = fs.existsSync(lernaPath) ? JSON.parse(fs.readFileSync(lernaPath)) : {};

  return pkg.version ? `v${pkg.version}` : lerna.version ? `v${lerna.version}` : undefined;
}

export function findRepoFromPkg(pkg: any, config: Partial<Configuration>): string | undefined {
  const url = pkg.repository.url || pkg.repository;
  const normalized = normalize(url).url;

  const repoRegexPattern = `${config.gitUrl.replace(/\/\s*$/, "")}[:/]([^./]+\/[^./]+)(?:\.git)?`
  const repoRegex = new RegExp(repoRegexPattern, "g");

  const match = repoRegex.exec(normalized)

  if (!match) {
    return;
  }

  return match[1];
}
