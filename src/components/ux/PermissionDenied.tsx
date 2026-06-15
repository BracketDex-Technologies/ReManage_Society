"use client";

import PageState from "./PageState";

export default function PermissionDenied() {
  return (
    <PageState
      variant="permission-denied"
      title="You do not have access"
      description="This workflow is not available for your role. Contact your society admin if you need access."
      actionLabel="Go to dashboard"
      actionHref="/dashboard"
    />
  );
}
