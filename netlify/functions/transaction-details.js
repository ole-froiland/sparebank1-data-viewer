const { httpGet } = require("./_transactionsHttp");

const ACCEPT = "application/vnd.sparebank1.v1+json; charset=utf-8";

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: true, message: "Method not allowed" });
  }

  const id = event.queryStringParameters?.id;
  if (!id) {
    return jsonResponse(400, { error: true, message: "id er påkrevd" });
  }

  try {
    const data = await httpGet({
      path: `/transactions/${encodeURIComponent(id)}/details`,
      accept: ACCEPT,
    });
    return jsonResponse(200, data);
  } catch (error) {
    return handleError(error);
  }
};

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function handleError(error) {
  const status = error.statusCode || 500;
  return jsonResponse(status, {
    error: true,
    message: error.message || "Ukjent feil",
    status,
  });
}
