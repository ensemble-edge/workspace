/**
 * Gateway Domain — Proxy
 *
 * API gateway for guest app communication and proxying.
 */

export interface GatewayMessage {
  type: string;
  payload: unknown;
  source: string;
}

export function createGatewayService() {
  return {
    send: async (_appId: string, _message: GatewayMessage) => {
      // TODO: Implement message sending to guest apps
    },
    receive: async (_message: GatewayMessage) => {
      // TODO: Implement message receiving from guest apps
    },
  };
}
