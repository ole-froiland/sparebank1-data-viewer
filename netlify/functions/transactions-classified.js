const { httpGet } = require("./_transactionsHttp");

const ACCEPT = "application/vnd.sparebank1.v1+json; charset=utf-8";

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: true, message: "Method not allowed" });
  }

  try {
    const data = await httpGet({
      path: "/transactions/classified",
      query: {
        accountKey: parseArray(event.queryStringParameters?.accountKey),
        fromDate: event.queryStringParameters?.fromDate,
        toDate: event.queryStringParameters?.toDate,
        rowLimit: event.queryStringParameters?.rowLimit,
        source: event.queryStringParameters?.source,
        enrichWithPaymentDetails: event.queryStringParameters?.enrichWithPaymentDetails,
        enrichWithMerchantLogo: event.queryStringParameters?.enrichWithMerchantLogo,
      },
      accept: ACCEPT,
    });
    return jsonResponse(200, data);
  } catch (error) {
    return handleError(error);
  }
};

function parseArray(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.includes(",")) return value.split(",").map((v) => v.trim());
  return [value];
}

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
