import { getMetaConfig } from "@passaparola/shared/config";
import { createMetaClient, type GraphResponse, type MetaClient } from "@passaparola/shared/meta";

let client: MetaClient | null = null;

/** Server-side Meta client built from environment variables. */
export function getMetaClient(): MetaClient {
  client ??= createServerMetaClient();
  return client;
}

/** A dedicated client, e.g. to observe every response during a sync run. */
export function createServerMetaClient(options: { onResponse?: (response: GraphResponse) => void } = {}): MetaClient {
  const config = getMetaConfig();
  return createMetaClient({
    appId: config.appId,
    appSecret: config.appSecret,
    graphVersion: config.graphVersion,
    baseUrl: config.graphBaseUrl ?? undefined,
    onResponse: options.onResponse,
  });
}
