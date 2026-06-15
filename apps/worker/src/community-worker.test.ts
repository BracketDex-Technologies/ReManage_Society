import test from "node:test";
import assert from "node:assert/strict";
import { buildCommunityWorkerJob } from "./community-worker.js";

test("buildCommunityWorkerJob creates deterministic retry-safe reminder jobs", () => {
  assert.deepEqual(
    buildCommunityWorkerJob({
      societyId: "society_a",
      command: "meeting-reminder",
      referenceId: "meeting_1",
    }),
    {
      id: "community:meeting-reminder:society_a:meeting_1",
      queue: "community",
      name: "meeting-reminder",
      attempts: 5,
      payload: {
        societyId: "society_a",
        command: "meeting-reminder",
        referenceId: "meeting_1",
      },
    },
  );
});

test("buildCommunityWorkerJob includes a per-recipient target for nudges", () => {
  assert.deepEqual(
    buildCommunityWorkerJob({
      societyId: "society_a",
      command: "unread-notice-nudge",
      referenceId: "notice_1",
      targetRef: "user_1",
    }),
    {
      id: "community:unread-notice-nudge:society_a:notice_1:user_1",
      queue: "community",
      name: "unread-notice-nudge",
      attempts: 5,
      payload: {
        societyId: "society_a",
        command: "unread-notice-nudge",
        referenceId: "notice_1",
        targetRef: "user_1",
      },
    },
  );
});

test("buildCommunityWorkerJob rejects missing identifiers", () => {
  assert.throws(
    () =>
      buildCommunityWorkerJob({
        societyId: "  ",
        command: "poll-closing-nudge",
        referenceId: "poll_1",
      }),
    /societyId and referenceId/,
  );
});
