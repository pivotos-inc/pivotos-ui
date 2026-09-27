#!/usr/bin/env python3
"""从 InAppBrowser CDP captureScreenshot 的输出文件提取 base64 落盘 PNG。
用法: python3 scripts/e2e/s106_shot.py <tool-output-path> <目标png路径>
"""
import base64
import json
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
raw = open(src, encoding="utf-8").read()
# 输出可能是完整 JSON，也可能带截断预览；先按 JSON 解析，失败则正则抠 data 字段
data = None
try:
    data = json.loads(raw)["data"]
except Exception:
    m = re.search(r'"data"\s*:\s*"([A-Za-z0-9+/=]+)"', raw)
    if m:
        data = m.group(1)
if not data:
    sys.exit("no data field found")
png = base64.b64decode(data)
with open(dst, "wb") as f:
    f.write(png)
print(f"saved {dst} ({len(png)} bytes)")
