/** Protocol identity sent in the webviewReady payload and written to webview/protocol.json. */
export const EVENTFLOW_WEBVIEW_PROTOCOL = 'zenwave.eventflow.webview';

/** Version of the host/page message protocol. It changes only for changes that are not backwards compatible. */
export const EVENTFLOW_WEBVIEW_PROTOCOL_VERSION = 1;

/** Directory inside this package that holds index.html and its assets. Serve it as one directory. */
export const EVENTFLOW_WEBVIEW_DIRECTORY = 'webview';

/** Page entry, relative to the package root. */
export const EVENTFLOW_WEBVIEW_ENTRY = 'webview/index.html';

/** Message types a host may send to the page. The page ignores any other type. */
export const EVENTFLOW_WEBVIEW_INBOUND_MESSAGES = Object.freeze([
  'renderBundle',
  'setViewMode',
  'setDisplaySettings',
  'highlightNode',
  'renderGraph',
]);

/** Message types the page sends to its host. */
export const EVENTFLOW_WEBVIEW_OUTBOUND_MESSAGES = Object.freeze(['webviewReady']);
