/**
 * Host half of the chat-screenshot bundle.
 *
 * There is nothing to run here on purpose. The capture happens in the browser page: it reads the
 * conversation the page has already laid out and writes the clipboard or a file, so the host needs
 * no route, no service and no stored state. The browser half is `client.js`, built from
 * `src/client/` by `build.mjs`.
 *
 * @module dsh-chat-screenshot
 */

/** Cordis plugin name, used in host logs. */
export const name = 'chat-screenshot';

/** Host services this plugin needs: none. The client half asks for its own. */
export const inject = [];

/** Registers nothing; present because a Loader entry must be a plugin. */
export function apply() {}
