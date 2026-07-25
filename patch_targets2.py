import re

with open("tests/targets.test.ts", "r") as f:
    content = f.read()

content = content.replace(
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "sleep_need",
      "7.75h", // old value from prevTargets
      expect.any(String), // new value
      expect.any(String), // reason
      expect.any(String)  // date
    );""",
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "sleep_need",
      "7.75h", // old value from prevTargets
      expect.any(String), // new value
      expect.any(String), // reason
      expect.any(String), // date
      1
    );"""
)


with open("tests/targets.test.ts", "w") as f:
    f.write(content)
