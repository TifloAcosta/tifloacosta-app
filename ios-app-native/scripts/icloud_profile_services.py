"""Distinguish a provisioning allowlist from the app's signed entitlement."""
def profile_allows_cloud_documents(value):
    return value == "*" or (
        isinstance(value, list) and all(isinstance(item, str) for item in value)
        and ("*" in value or "CloudDocuments" in value)
    )

def signed_claims_cloud_documents(value):
    return (
        isinstance(value, list) and all(isinstance(item, str) for item in value)
        and "CloudDocuments" in value and "*" not in value
    )
