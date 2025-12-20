exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;

  if (!code) {
    return { statusCode: 400, body: "Missing ?code" };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.SB1_CLIENT_ID,
    client_secret: process.env.SB1_CLIENT_SECRET,
    redirect_uri: "https://ole-sin-bank.netlify.app/.netlify/functions/auth-callback",
  });

  const res = await fetch("https://api.sparebank1.no/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();

  return {
    statusCode: res.status,
    headers: { "Content-Type": "application/json" },
    body: text,
  };
};
