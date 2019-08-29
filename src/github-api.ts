const path = require("path");

import ConfigurationError from "./configuration-error";
import fetch from "./fetch";

export interface GitHubUserResponse {
  login: string;
  name: string;
  html_url: string;
}

export interface GitHubIssueResponse {
  number: number;
  title: string;
  pull_request?: {
    html_url: string;
  };
  labels: Array<{
    name: string;
  }>;
  user: {
    login: string;
    html_url: string;
  };
}

export interface Options {
  repo: string;
  rootPath: string;
  cacheDir?: string;
  gitAPIUrl?: string;
  gitUrl?: string;
}

export default class GithubAPI {
  private cacheDir: string | undefined;
  private auth: string;
  private gitAPIUrl: string;
  private gitUrl: string

  constructor(config: Options) {
    this.cacheDir = config.cacheDir && path.join(config.rootPath, config.cacheDir, "github");
    this.gitAPIUrl = config.gitAPIUrl || 'https://api.github.com/'
    this.gitUrl = config.gitUrl || 'https://github.com/'
    this.auth = this.getAuthToken();
    if (!this.auth) {
      throw new ConfigurationError("Must provide GITHUB_AUTH");
    }
  }

  public getBaseIssueUrl(repo: string): string {
    return `${this.gitUrl}${repo}/issues/`;
  }

  public async getIssueData(repo: string, issue: string): Promise<GitHubIssueResponse> {
    return this._fetch(`${this.gitAPIUrl}repos/${repo}/issues/${issue}`);
  }

  public async getUserData(login: string): Promise<GitHubUserResponse> {
    return this._fetch(`${this.gitAPIUrl}users/${login}`);
  }

  private async _fetch(url: string): Promise<any> {
    const res = await fetch(url, {
      cacheManager: this.cacheDir,
      headers: {
        Authorization: `token ${this.auth}`,
      },
    });
    return res.json();
  }

  private getAuthToken(): string {
    return this.gitAPIUrl ? process.env.GITHUB_ENTERPRISE_AUTH : process.env.GITHUB_AUTH;
  }
}
