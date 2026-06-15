"use client";

import PageState from "./PageState";

interface RetryBlockProps {
  title?: string;
  description?: string;
  onRetry: () => void;
}

export default function RetryBlock({
  title = "Something went wrong",
  description = "We could not load this page. Check your connection and try again.",
  onRetry,
}: RetryBlockProps) {
  return (
    <PageState
      variant="error"
      title={title}
      description={description}
      onRetry={onRetry}
    />
  );
}
