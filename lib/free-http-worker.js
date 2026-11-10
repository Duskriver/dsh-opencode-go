// src/free-http-worker.ts
var MAX_PACKET_BYTES = 256 * 1024 * 1024;
var headersSent = false;
function write(bytes) {
  return new Promise((resolve, reject) => process.stdout.write(bytes, (error) => error ? reject(error) : resolve()));
}
try {
  const chunks = [];
  let stdinBytes = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.from(chunk);
    stdinBytes += bytes.byteLength;
    if (stdinBytes > MAX_PACKET_BYTES) throw new RangeError("Free HTTP worker input exceeds the 256 MiB limit");
    chunks.push(bytes);
  }
  const raw = Buffer.concat(chunks, stdinBytes);
  const newline = raw.indexOf(10);
  const headerBytes = newline >= 0 ? raw.subarray(0, newline) : raw;
  const trailingBody = newline >= 0 && newline + 1 < raw.byteLength ? raw.subarray(newline + 1) : void 0;
  const input = JSON.parse(headerBytes.toString());
  if (input.bodyLength !== void 0 && (trailingBody?.byteLength ?? 0) !== input.bodyLength) {
    throw new TypeError("Free HTTP worker body length mismatch");
  }
  const bodyBytes = trailingBody ?? (input.body === void 0 ? void 0 : Buffer.from(input.body, "base64"));
  const options = {
    method: input.method,
    headers: input.headers,
    redirect: input.redirect,
    ...bodyBytes === void 0 ? {} : { body: new Uint8Array(bodyBytes.buffer, bodyBytes.byteOffset, bodyBytes.byteLength) },
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
