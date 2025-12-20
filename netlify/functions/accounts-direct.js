exports.handler = async (event) => {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: true, message: "Missing Authorization header" }),
    };
  }

  const res = await fetch("https://api.sparebank1.no/personal/banking/accounts", {
    headers: {
      Authorization: auth,
      Accept: "application/vnd.sparebank1.v1+json; charset=utf-8",
    },
  });

  const body = await res.text();
  return {
    statusCode: res.status,
    headers: { "Content-Type": "application/json" },
    body,
  };
};
