exports.handler = async (event, context) => {
  try {
    const mod = await import("./accounts_v2.js");
    const fn = mod.handler || mod.default;

    if (typeof fn !== "function") {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: true,
          message: "accounts_v2 has no callable export",
          exportedKeys: Object.keys(mod || {}),
        }),
      };
    }

    const result = await fn(event, context);

    // If accounts_v2 already returns Netlify-style response, pass through.
    if (result && typeof result === "object" && "statusCode" in result) {
      return result;
    }

    // If accounts_v2 returns a Fetch Response object (common mistake), convert it.
    if (result && typeof result === "object" && typeof result.text === "function") {
      const text = await result.text();
      return {
        statusCode: result.status || 200,
        headers: Object.fromEntries(result.headers?.entries?.() || []),
        body: text,
      };
    }

    // Fallback: stringify anything else
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result ?? null),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: true,
        message: err?.message || String(err),
        stack: err?.stack || null,
      }),
    };
  }
};
