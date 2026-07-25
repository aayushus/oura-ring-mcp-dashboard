const fs = require('fs');
let clientTestCode = fs.readFileSync('src/client.test.ts', 'utf8');

clientTestCode += `
import { requestContextStorage } from "./auth/context.js";

describe("fetch with context", () => {
  it("should use context client token if available", async () => {
    const client = new OuraClient({ accessToken: TEST_TOKEN });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    const contextClient = new OuraClient({ accessToken: "context-token" });

    await requestContextStorage.run({ userId: 1, ouraClient: contextClient }, async () => {
      await client.getPersonalInfo();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("personal_info"),
      expect.objectContaining({
        headers: { Authorization: "Bearer context-token" },
      })
    );
  });
});
`;

fs.writeFileSync('src/client.test.ts', clientTestCode);
