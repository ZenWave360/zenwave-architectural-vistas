/**
 * Identity and version of the message protocol between an embedding host and this page.
 *
 * Increase EVENTFLOW_WEBVIEW_PROTOCOL_VERSION only when a change is not backwards compatible for a host:
 * a message is removed or renamed, or a payload field changes meaning. Additive changes (a new optional field,
 * a new message type the page ignores when unknown) keep the version.
 *
 * Keep packages/eventflow-webview/index.js in sync; its test fails when they differ.
 */
export const EVENTFLOW_WEBVIEW_PROTOCOL = 'zenwave.eventflow.webview';
export const EVENTFLOW_WEBVIEW_PROTOCOL_VERSION = 1;
