import { cleanEnv } from "./_token.js";

export async function handler() {
  const rawSB1 = process.env.SB1_REFRESH_TOKEN || "";
  const rawAlt = process.env.REFRESH_TOKEN || "";

  const cleanedSB1 = rawSB1 ? cleanEnv(rawSB1) : "";
  const cleanedAlt = rawAlt ? cleanEnv(rawAlt) : "";

  const pick = rawSB1 ? "SB1_REFRESH_TOKEN" : rawAlt ? "REFRESH_TOKEN" : "NONE";

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pick,
      raw: {
        SB1_REFRESH_TOKEN: { present: !!rawSB1, len: rawSB1.length },
        REFRESH_TOKEN: { present: !!rawAlt, len: rawAlt.length },
      },
      cleaned: {
        SB1_REFRESH_TOKEN: { present: !!cleanedSB1, len: cleanedSB1.length },
        REFRESH_TOKEN: { present: !!cleanedAlt, len: cleanedAlt.length },
      },
    }),
  };
}
