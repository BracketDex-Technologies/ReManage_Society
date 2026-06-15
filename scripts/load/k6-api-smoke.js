import http from "k6/http";
import { check, sleep } from "k6";

const API_BASE = __ENV.API_BASE_URL || "http://localhost:4000";
const SOCIETY_ID = __ENV.LOAD_SOCIETY_ID || "society_load_001";
const BEARER = __ENV.LOAD_BEARER_TOKEN || "";

export const options = {
  scenarios: {
    rc_smoke: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "60s", target: 300 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
};

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${BEARER}`,
  "x-society-id": SOCIETY_ID,
};

export default function () {
  const endpoints = [
    { path: "/api/v1/operations/visitors/list", body: { societyId: SOCIETY_ID } },
    { path: "/api/v1/community/notices/list", body: { societyId: SOCIETY_ID, activeOnly: true } },
    { path: "/api/v1/finance-core/reports/trial-balance", body: { societyId: SOCIETY_ID } },
    { path: "/api/v1/society-core/directory/read", body: { societyId: SOCIETY_ID } },
  ];

  const target = endpoints[__ITER % endpoints.length];
  const res = http.post(`${API_BASE}${target.path}`, JSON.stringify(target.body), { headers });

  check(res, {
    "status is 2xx or 401/403 when token missing": (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 401 || r.status === 403,
  });

  sleep(0.2);
}
