import re

with open("tests/digest.test.ts", "r") as f:
    content = f.read()

content = content.replace(
"""    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await checkAndSendDigest();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Digest] Error generating daily morning digest:",
      mockError
    );""",
"""    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await checkAndSendDigest();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Digest] Failed to write digest log file:",
      mockError
    );"""
)

with open("tests/digest.test.ts", "w") as f:
    f.write(content)
