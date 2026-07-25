const fs = require('fs');
let clientTestCode = fs.readFileSync('src/client.test.ts', 'utf8');

clientTestCode += `
describe("setAccessToken", () => {
  it("should update the access token", () => {
    const client = new OuraClient({ accessToken: TEST_TOKEN });
    client.setAccessToken("new-token");
    expect(client.accessToken).toBe("new-token");
  });
});
`;

fs.writeFileSync('src/client.test.ts', clientTestCode);
