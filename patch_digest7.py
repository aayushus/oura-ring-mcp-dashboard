import re

with open("tests/digest.test.ts", "r") as f:
    content = f.read()

content = content.replace(
"""    await checkAndSendDigest();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Digest] Error generating daily morning digest:",
      mockError
    );""",
"""    await expect(checkAndSendDigest()).rejects.toThrow(mockError);"""
)

with open("tests/digest.test.ts", "w") as f:
    f.write(content)
