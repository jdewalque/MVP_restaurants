// Login flow specifics (Facebook Login, "Instagram API with Facebook Login").
// When moving to Facebook Login for Business / unified login, adapt this file.

import { META_SCOPES } from "../config";

export interface LoginUrlOptions {
  appId: string;
  graphVersion: string;
  redirectUri: string;
  state: string;
  /** Facebook Login for Business configuration ID. When set, it replaces `scope`. */
  configId?: string | null;
}

export function buildLoginUrl(options: LoginUrlOptions): string {
  const url = new URL(`https://www.facebook.com/${options.graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", options.appId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  url.searchParams.set("response_type", "code");
  if (options.configId) {
    url.searchParams.set("config_id", options.configId);
  } else {
    url.searchParams.set("scope", META_SCOPES.join(","));
  }
  return url.toString();
}
