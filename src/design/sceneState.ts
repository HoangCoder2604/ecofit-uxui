import type { DesignNode } from './types';

// The schedule frame starts with the days marked in the Figma design selected.
// An explicit false in local state must take precedence over that initial state.
export function initialChoice(node: DesignNode): boolean {
  return Boolean(node.name?.startsWith('Choose day /') && node.children.some(
    child => typeof child !== 'string' && child.name === 'V4 / Icon / check',
  ));
}
