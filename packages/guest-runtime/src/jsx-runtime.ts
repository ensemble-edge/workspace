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

/* eslint-disable @typescript-eslint/no-explicit-any */

// We DON'T augment `Window` here — runtime.tsx is the canonical declarer.
// At runtime, this module reads window.Ensemble.React indirectly via any.
function getReact(): { createElement: any; Fragment: any } {
  const w = globalThis as any;
  if (!w.Ensemble) {
    throw new Error(
      'Ensemble runtime not loaded. Add <script src="/_ensemble/runtime/v1/runtime.js"></script> to your iframe HTML.',
    );
  }
  return w.Ensemble.React;
}

export function jsx(type: any, props: any, key?: any): any {
  const React = getReact();
  if (key !== undefined) return React.createElement(type, { ...props, key });
  return React.createElement(type, props);
}

export const jsxs = jsx;
export const jsxDEV = jsx;

export function Fragment(props: { children?: any }): any {
  const React = getReact();
  return React.createElement(React.Fragment, null, props.children);
}
