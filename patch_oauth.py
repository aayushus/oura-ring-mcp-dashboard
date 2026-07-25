import re

with open("src/auth/oauth.test.ts", "r") as f:
    content = f.read()

content = content.replace(
"""      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.ouraring.com/oauth/revoke?access_token=token-to-revoke",
        { method: "POST" }
      );""",
"""      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.ouraring.com/oauth/revoke",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: expect.any(URLSearchParams),
        }
      );"""
)

with open("src/auth/oauth.test.ts", "w") as f:
    f.write(content)
