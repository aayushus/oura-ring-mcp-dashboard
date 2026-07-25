import re

with open("tests/digest.test.ts", "r") as f:
    content = f.read()

content = content.replace(
"""    const nodemailer = await import("nodemailer");
    (nodemailer.default.createTransport as any).mockReturnValueOnce({
      sendMail: vi.fn().mockRejectedValue(mockError),
    });""",
"""    const nodemailer = await import("nodemailer");
    (nodemailer.default.createTransport as any).mockReturnValueOnce({
      sendMail: vi.fn().mockRejectedValue(mockError),
    });"""
)


with open("tests/digest.test.ts", "w") as f:
    f.write(content)
