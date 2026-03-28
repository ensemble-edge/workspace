// Gateway service for guest app communication

export interface GatewayMessage {
  type: string;
  payload: unknown;
  source: string;
}

export function createGatewayService() {
  return {
    send: async (appId: string, message: GatewayMessage) => {
      // TODO: Implement message sending to guest apps
    },
    receive: async (message: GatewayMessage) => {
      // TODO: Implement message receiving from guest apps
    },
  };
}
