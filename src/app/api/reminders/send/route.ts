// This endpoint has been permanently removed. Use NestJS /api/v1/community/notifications/send instead.
export async function POST() {
  return Response.json(
    {
      error: "Gone",
      message: "This endpoint has been removed. Use the new notification service.",
      successor: "/api/v1/community/notifications/send",
    },
    { status: 410 }
  );
}
