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
export declare function createGatewayService(): {
    send: (_appId: string, _message: GatewayMessage) => Promise<void>;
    receive: (_message: GatewayMessage) => Promise<void>;
};
//# sourceMappingURL=proxy.d.ts.map