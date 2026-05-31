/**
 * JSX runtime shim for guest apps.
 *
 * Guest apps' tsconfig sets:
 *
 *   "jsx": "react-jsx",
 *   "jsxImportSource": "@ensemble-edge/workspace/guest-runtime"
 *
 * which makes TypeScript and esbuild emit calls to this module's `jsx`,
 * `jsxs`, and `Fragment`. We delegate to whatever React is on
 * window.Ensemble at runtime — so the guest's compiled JS contains
 * NO React copy; React lives in the host-served runtime.
 *
 * The compiled output looks like:
 *
 *   import { jsx, jsxs, Fragment } from '@ensemble-edge/workspace/guest-runtime/jsx-runtime';
 *   const tree = jsxs('Page', { title: 'Hi', children: [...] });
 *
 * At runtime, those become createElement calls against window.Ensemble.React.
 */
export declare function jsx(type: any, props: any, key?: any): any;
export declare const jsxs: typeof jsx;
export declare const jsxDEV: typeof jsx;
export declare function Fragment(props: {
    children?: any;
}): any;
//# sourceMappingURL=jsx-runtime.d.ts.map