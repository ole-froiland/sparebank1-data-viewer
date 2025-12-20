exports.handler = async () => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SB1_CLIENT_ID,
    redirect_uri: "https://ole-sin-bank.netlify.app/.netlify/functions/auth-callback",
    scope: "accounts",
    state: "123",
  });

  return {
    statusCode: 302,
    headers: {
      Location: `https://api.sparebank1.no/oauth/authorize?${params.toString()}`,
    },
  };
};
