/**
 * Gateway Domain — Proxy
 *
 * API gateway for guest app communication and proxying.
 */
export function createGatewayService() {
    return {
        send: async (_appId, _message) => {
            // TODO: Implement message sending to guest apps
        },
        receive: async (_message) => {
            // TODO: Implement message receiving from guest apps
        },
    };
}
//# sourceMappingURL=proxy.js.map