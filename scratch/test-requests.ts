export {};

async function run() {
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "choudharidarshan5453@gmail.com",
      password: "password",
    }),
  });

  console.log("Login Status:", loginRes.status);
  const loginJson = await loginRes.json();
  console.log("Login Response:", loginJson);

  const cookieHeader = loginRes.headers.get("set-cookie");
  console.log("Set-Cookie Header:", cookieHeader);

  if (!cookieHeader) {
    console.error("No cookie received!");
    return;
  }

  // Extract session cookie
  const sessionCookie = cookieHeader.split(";")[0];

  const endpoints = [
    "http://localhost:3000/api/mobile/bootstrap",
    "http://localhost:3000/api/my-visitors",
    "http://localhost:3000/api/packages"
  ];

  for (const url of endpoints) {
    console.log(`\nFetching ${url}...`);
    const res = await fetch(url, {
      headers: {
        Cookie: sessionCookie,
      },
    });
    console.log(`Status for ${url}:`, res.status);
    const text = await res.text();
    try {
      console.log(`Response for ${url}:`, JSON.parse(text));
    } catch {
      console.log(`Response for ${url} (non-JSON):`, text.slice(0, 1000));
    }
  }
}

run().catch(console.error);
