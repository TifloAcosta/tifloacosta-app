// Apple TN3125: a provisioning profile is an entitlement allowlist.
// The exact wildcard observed in an active Apple profile authorizes the service.
// A signed app must declare CloudDocuments explicitly; see the IPA verifier.
export function profileAllowsCloudDocuments(value) {
  return value === '*' || (Array.isArray(value) && value.every(x => typeof x === 'string') && (value.includes('*') || value.includes('CloudDocuments')));
}
