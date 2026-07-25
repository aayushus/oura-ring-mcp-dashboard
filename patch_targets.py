import re

with open("tests/targets.test.ts", "r") as f:
    content = f.read()

# Fix upsertUserTargets mock arguments
content = content.replace(
"""    expect(db.upsertUserTargets).toHaveBeenCalledWith(
      expect.objectContaining({
        sleep_need_seconds: expect.any(Number),
        recommended_bedtime: expect.any(String),
        step_goal: expect.any(Number),
        max_hr: expect.any(Number),
        bmr_kcal: expect.any(Number),
      })
    );""",
"""    expect(db.upsertUserTargets).toHaveBeenCalledWith(
      expect.objectContaining({
        sleep_need_seconds: expect.any(Number),
        recommended_bedtime: expect.any(String),
        step_goal: expect.any(Number),
        max_hr: expect.any(Number),
        bmr_kcal: expect.any(Number),
      }),
      1
    );"""
)

# Fix addTargetHistory mock arguments in initial seed test
content = content.replace(
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "sleep_need",
      "Seed",
      expect.any(String),
      "Initial calculation seed.",
      expect.any(String)
    );""",
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "sleep_need",
      "Seed",
      expect.any(String),
      "Initial calculation seed.",
      expect.any(String),
      1
    );"""
)

content = content.replace(
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "step_goal",
      "Seed",
      expect.any(String),
      "Initial calculation seed.",
      expect.any(String)
    );""",
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "step_goal",
      "Seed",
      expect.any(String),
      "Initial calculation seed.",
      expect.any(String),
      1
    );"""
)

# Fix addTargetHistory mock arguments in new targets differ test
content = content.replace(
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "sleep_need",
      "7.75h", // old value from prevTargets
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );""",
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "sleep_need",
      "7.75h", // old value from prevTargets
      expect.any(String),
      expect.any(String),
      expect.any(String),
      1
    );"""
)

content = content.replace(
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "step_goal",
      "8000",
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );""",
"""    expect(db.addTargetHistory).toHaveBeenCalledWith(
      "step_goal",
      "8000",
      expect.any(String),
      expect.any(String),
      expect.any(String),
      1
    );"""
)

with open("tests/targets.test.ts", "w") as f:
    f.write(content)
