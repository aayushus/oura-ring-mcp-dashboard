import re

with open('src/utils/errors.test.ts', 'r') as f:
    content = f.read()

# Fix the placement of the test that was appended outside a describe block.
content = re.sub(r'  it\("should format unknown json error gracefully".*$', '', content, flags=re.DOTALL)
content = re.sub(r'\}\);\n$', '', content, flags=re.DOTALL)

append_tests = """  it("should format unknown json error gracefully", () => {
    const error = new OuraApiError(400, "Bad Request", '{"foo": "bar"}');
    expect(error.message).toContain("Check your date format");
  });
});
"""

content = content + append_tests

with open('src/utils/errors.test.ts', 'w') as f:
    f.write(content)
