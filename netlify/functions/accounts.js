exports.handler = async (event, context) => {
  const mod = await import("./accounts_v2.js");
  if (typeof mod.handler !== "function") {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: true,
        message: "accounts_v2.handler not exported correctly",
        exportedKeys: Object.keys(mod || {}),
      }),
    };
  }
  return mod.handler(event, context);
};
