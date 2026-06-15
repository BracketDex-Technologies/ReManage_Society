export {};

async function testUser(email: string) {
  console.log(`\n==================================================`);
  console.log(`Testing email: ${email}`);
  console.log(`==================================================`);
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password",
    }),
  });

  console.log("Login Status:", loginRes.status);
  const loginJson = await loginRes.json();
  if (loginRes.status !== 200) {
    console.error("Login failed:", loginJson);
    return;
  }

  const cookieHeader = loginRes.headers.get("set-cookie");
  if (!cookieHeader) {
    console.error("No cookie received!");
    return;
  }

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
      const data = JSON.parse(text);
      if (res.status === 500) {
        console.log(`Response for ${url} (500 Error JSON):`, data);
      } else {
        console.log(`Response for ${url} (Success):`, Object.keys(data));
      }
    } catch {
      console.log(`Response for ${url} (non-JSON):`, text.slice(0, 1000));
    }
  }
}

async function run() {
  await testUser("39brogaming@gmail.com");
  await testUser("mshashikant3600@gmail.com");
  await testUser("choudharidarshan5453@gmail.com");
}

run().catch(console.error);
