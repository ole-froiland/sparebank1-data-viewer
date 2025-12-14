import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listTransactions,
  listClassifiedTransactions,
  getTransactionDetails,
  getTransactionDetailsClassified,
  exportTransactionsCsv,
} from "../../scripts/api/transactionsClient.js";

describe("transactionsClient", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls listTransactions endpoint with params", async () => {
    mockJson({ transactions: [] });
    await listTransactions({ accountKey: ["abc"], rowLimit: 10 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/.netlify/functions/transactions?accountKey=abc&rowLimit=10"),
      expect.any(Object)
    );
  });

  it("calls classified endpoint", async () => {
    mockJson({ transactions: [] });
    await listClassifiedTransactions({ accountKey: ["abc"] });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/.netlify/functions/transactions-classified?accountKey=abc"),
      expect.any(Object)
    );
  });

  it("gets details", async () => {
    mockJson({ id: "t1" });
    await getTransactionDetails("t1");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/.netlify/functions/transaction-details?id=t1"),
      expect.any(Object)
    );
  });

  it("gets classified details", async () => {
    mockJson({ transaction: { id: "t1" } });
    await getTransactionDetailsClassified("t1", { enrichWithMerchantData: true });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/.netlify/functions/transaction-details-classified?id=t1&enrichWithMerchantData=true"
      ),
      expect.any(Object)
    );
  });

  it("exports CSV", async () => {
    const blob = new Blob(["csv"]);
    global.fetch.mockResolvedValueOnce(
      new Response(blob, { status: 200, headers: { "Content-Type": "application/csv" } })
    );
    const result = await exportTransactionsCsv({ accountKey: "a", fromDate: "2024-01-01", toDate: "2024-01-31" });
    expect(result).toBeInstanceOf(Blob);
  });
});

function mockJson(body, ok = true) {
  global.fetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: ok ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    })
  );
}
