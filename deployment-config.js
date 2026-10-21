// Operator-reviewed build input only. Never load this from URL parameters,
// localStorage, wallet metadata or an untrusted remote discovery endpoint.
// null preserves the existing public simulation and isolated local launcher.
// This profile permits reads and unsigned review only; it cannot enable signing.
export const DEPLOYMENT = null;
