import { httpGet } from "./_transactionsHttp.js";

const ACCEPT = "application/vnd.sparebank1.v1+json; charset=utf-8";

export default async (req, _context) => {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: true, message: "Method not allowed" });
  }

  const url = new URL(req.url);
  const params = url.searchParams;
  const accountKeyValues = params.getAll("accountKey");

  try {
    const data = await httpGet({
      path: "/transactions",
      query: {
        accountKey: parseArray(accountKeyValues.length ? accountKeyValues : params.get("accountKey")),
        fromDate: params.get("fromDate"),
        toDate: params.get("toDate"),
        rowLimit: params.get("rowLimit"),
        source: params.get("source"),
        enrichWithPaymentDetails: params.get("enrichWithPaymentDetails"),
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
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function handleError(error) {
  const status = error.statusCode || 500;
  return jsonResponse(status, {
    error: true,
    message: error.message || "Ukjent feil",
    status,
    code: error.code,
  });
}
