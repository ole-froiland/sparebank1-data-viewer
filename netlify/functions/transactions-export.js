const { httpGet } = require("./_transactionsHttp");

const ACCEPT = "application/csv;charset=UTF-8";

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: true, message: "Method not allowed" });
  }

  const { accountKey, fromDate, toDate } = event.queryStringParameters || {};
  if (!accountKey || !fromDate || !toDate) {
    return jsonResponse(400, {
      error: true,
      message: "accountKey, fromDate og toDate er påkrevd",
    });
  }

  try {
    const buffer = await httpGet({
      path: "/transactions/export",
      query: { accountKey, fromDate, toDate },
      accept: ACCEPT,
      expectBinary: true,
    });

    const filename = `transactions_${accountKey}_${fromDate}_${toDate}.csv`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": ACCEPT,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      isBase64Encoded: true,
      body: buffer.toString("base64"),
    };
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
