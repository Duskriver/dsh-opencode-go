// src/free-http-worker.ts
var headersSent = false;
function write(bytes) {
  return new Promise((resolve, reject) => process.stdout.write(bytes, (error) => error ? reject(error) : resolve()));
}
try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const options = {
    method: input.method,
    headers: input.headers,
    redirect: input.redirect,
    ...input.body === void 0 ? {} : { body: new Uint8Array(Buffer.from(input.body, "base64")) },
    ...input.proxy ? { proxy: input.proxy } : {}
  };
  const response = await fetch(input.url, options);
  const metadata = {
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers],
    url: response.url,
    redirected: response.redirected
  };
  await write(JSON.stringify(metadata) + "\n");
  headersSent = true;
  if (response.body) for await (const chunk of response.body) await write(chunk);
} catch {
  if (!headersSent) await write(JSON.stringify({ error: "Free HTTP worker could not send the request" }) + "\n").catch(() => {
  });
  process.exitCode = 1;
}
