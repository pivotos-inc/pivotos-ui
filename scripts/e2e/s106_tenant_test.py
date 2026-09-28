#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
S106 C2 租户管理面：dev 环境端到端实测（pivotos.tenant.enabled=true 全接线链路）。

场景：
  A 套餐 CRUD + 菜单范围回读
  B 租户 CRUD + 编码唯一（2151）+ 分页富化（packageName/accountCount）
  C 初始化向导：建租户→配套餐→建管理员（绑测试角色，角色菜单 ⊋ 套餐菜单）
     C1 租户管理员登录成功（接线①：enabled=true + 租户正常 → LoginUser.tenantId 填充）
     C2 路由菜单过滤（接线②：角色菜单 ∩ 套餐菜单——用户管理可见、角色管理不可见）
     C3 权限点同步过滤（有 system:user:list、无 system:role:list）
  D 租户停用拒登（2153）+ 恢复
  E 租户过期拒登（2154）+ 恢复
  F 删除守卫：租户有用户 2152 / 套餐被占用 2157
  G 平台用户零影响回归：admin 路由含新菜单（租户管理/租户套餐）
  H 清理：删向导管理员 → 删租户 → 删角色 → 删套餐

前置：8080 已用 S106 新 jar 重启（Flyway V1.2.44~46 已应用）；admin/admin123。
"""
import json
import sys
import time

import requests

BASE = "http://localhost:8080"
RUN_TS = str(int(time.time()))[-6:]
TENANT_CODE = f"s106e{RUN_TS}"
PKG_NAME = f"S106实测套餐{RUN_TS}"
ROLE_NAME = f"S106实测角色{RUN_TS}"
ADMIN_NAME = f"s106a{RUN_TS}"

passed = []


def log(tag, msg):
    print(f"[{tag}] {msg}", flush=True)


def ok(tag, msg):
    passed.append(tag)
    log("PASS", f"{tag} {msg}")


def login(username, password, expect_code=0):
    r = requests.post(f"{BASE}/system/auth/login",
                      json={"username": username, "password": password}, timeout=60)
    body = r.json()
    assert body.get("code") == expect_code, f"{username} 登录期望 code={expect_code}，实际 {body}"
    return body


def auth(token):
    return {"Authorization": token}


def main():
    admin = auth(login("admin", "admin123")["data"]["token"])

    # ---------- A 套餐 CRUD ----------
    r = requests.post(f"{BASE}/system/tenant-package", headers=admin,
                      json={"packageName": PKG_NAME, "menuIds": [1000, 1010], "status": 0,
                            "remark": "S106 E2E"}, timeout=30)
    assert r.json()["code"] == 0, r.json()
    pkg_id = r.json()["data"]
    r = requests.get(f"{BASE}/system/tenant-package/{pkg_id}", headers=admin, timeout=30)
    d = r.json()["data"]
    assert d["packageName"] == PKG_NAME and sorted(d["menuIds"]) == ["1000", "1010"], d
    ok("A", f"套餐 CRUD + 菜单范围回读（id={pkg_id}）")

    # ---------- B 租户 CRUD ----------
    r = requests.post(f"{BASE}/system/tenant", headers=admin,
                      json={"tenantCode": TENANT_CODE, "tenantName": "S106实测租户",
                            "packageId": pkg_id, "accountLimit": 10}, timeout=30)
    assert r.json()["code"] == 0, r.json()
    tenant_id = r.json()["data"]
    r = requests.post(f"{BASE}/system/tenant", headers=admin,
                      json={"tenantCode": TENANT_CODE, "tenantName": "重复编码"}, timeout=30)
    assert r.json()["code"] == 2151, r.json()
    r = requests.get(f"{BASE}/system/tenant/page",
                     params={"pageNum": 1, "pageSize": 10, "tenantCode": TENANT_CODE},
                     headers=admin, timeout=30)
    row = r.json()["data"]["list"][0]
    assert row["packageName"] == PKG_NAME and int(row["accountCount"]) == 0, row
    ok("B", f"租户 CRUD + 2151 编码唯一 + 分页富化（id={tenant_id}）")

    # ---------- C 初始化向导 ----------
    # 造测试角色：菜单 ⊋ 套餐（含角色管理 1020，套餐只含 1000/1010）
    r = requests.post(f"{BASE}/system/role", headers=admin,
                      json={"roleName": ROLE_NAME, "roleCode": f"s106_role_{RUN_TS}",
                            "menuIds": ["1000", "1010", "1020"], "status": 0}, timeout=30)
    assert r.json()["code"] == 0, r.json()
    role_id = r.json()["data"]

    r = requests.post(f"{BASE}/system/tenant/init", headers=admin,
                      json={"tenantCode": f"{TENANT_CODE}w", "tenantName": "S106向导租户",
                            "packageId": pkg_id, "accountLimit": 5,
                            "adminUsername": ADMIN_NAME, "adminNickname": "向导管理员",
                            "adminPassword": "Admin@123456", "adminRoleIds": [role_id]}, timeout=30)
    assert r.json()["code"] == 0, r.json()
    wiz = r.json()["data"]
    wiz_tenant_id, wiz_admin_id = wiz["tenantId"], wiz["adminUserId"]
    ok("C", f"向导初始化成功（tenant={wiz_tenant_id} admin={wiz_admin_id}）")

    # C1 租户管理员登录（接线①）
    tenant_admin = auth(login(ADMIN_NAME, "Admin@123456")["data"]["token"])
    ok("C1", "租户管理员登录成功（接线①：租户正常 → 放行）")

    # C2 路由过滤（接线②）：可见 用户管理(1010)，不可见 角色管理(1020)
    r = requests.get(f"{BASE}/system/menu/routers", headers=tenant_admin, timeout=30)
    titles = json.dumps(r.json()["data"], ensure_ascii=False)
    assert "用户管理" in titles, titles
    assert "角色管理" not in titles, titles
    ok("C2", "路由菜单过滤（用户管理可见 / 角色管理不可见）")

    # C3 权限点过滤
    r = requests.get(f"{BASE}/system/auth/getInfo", headers=tenant_admin, timeout=30)
    perms_str = json.dumps(r.json()["data"].get("perms", []))
    assert "system:user:list" in perms_str, perms_str
    assert "system:role:list" not in perms_str, perms_str
    ok("C3", "权限点同步过滤（有 user:list / 无 role:list）")

    # ---------- D 停用拒登 ----------
    r = requests.get(f"{BASE}/system/tenant/{wiz_tenant_id}", headers=admin, timeout=30)
    t = r.json()["data"]
    t["status"] = 1
    r = requests.put(f"{BASE}/system/tenant", headers=admin, json=t, timeout=30)
    assert r.json()["code"] == 0, r.json()
    login(ADMIN_NAME, "Admin@123456", expect_code=2153)
    t["status"] = 0
    requests.put(f"{BASE}/system/tenant", headers=admin, json=t, timeout=30)
    login(ADMIN_NAME, "Admin@123456")
    ok("D", "租户停用拒登 2153 + 恢复后可登")

    # ---------- E 过期拒登 ----------
    t["expireTime"] = "2020-01-01 00:00:00"
    r = requests.put(f"{BASE}/system/tenant", headers=admin, json=t, timeout=30)
    assert r.json()["code"] == 0, r.json()
    login(ADMIN_NAME, "Admin@123456", expect_code=2154)
    t["expireTime"] = None
    requests.put(f"{BASE}/system/tenant", headers=admin, json=t, timeout=30)
    login(ADMIN_NAME, "Admin@123456")
    ok("E", "租户过期拒登 2154 + 恢复后可登")

    # ---------- F 删除守卫 ----------
    r = requests.delete(f"{BASE}/system/tenant/{wiz_tenant_id}", headers=admin, timeout=30)
    assert r.json()["code"] == 2152, r.json()
    r = requests.delete(f"{BASE}/system/tenant-package/{pkg_id}", headers=admin, timeout=30)
    assert r.json()["code"] == 2157, r.json()
    ok("F", "删除守卫（租户有用户 2152 / 套餐被占用 2157）")

    # ---------- G 平台用户零影响 ----------
    r = requests.get(f"{BASE}/system/menu/routers", headers=admin, timeout=30)
    titles = json.dumps(r.json()["data"], ensure_ascii=False)
    assert "租户管理" in titles and "租户套餐" in titles, titles
    ok("G", "admin 路由含新菜单（平台用户零影响 + 菜单权限点已生效）")

    # ---------- H 清理 ----------
    r = requests.delete(f"{BASE}/system/user/{wiz_admin_id}", headers=admin, timeout=30)
    assert r.json()["code"] == 0, r.json()
    r = requests.delete(f"{BASE}/system/tenant/{wiz_tenant_id}", headers=admin, timeout=30)
    assert r.json()["code"] == 0, r.json()
    r = requests.delete(f"{BASE}/system/tenant/{tenant_id}", headers=admin, timeout=30)
    assert r.json()["code"] == 0, r.json()
    r = requests.delete(f"{BASE}/system/role/{role_id}", headers=admin, timeout=30)
    assert r.json()["code"] == 0, r.json()
    r = requests.delete(f"{BASE}/system/tenant-package/{pkg_id}", headers=admin, timeout=30)
    assert r.json()["code"] == 0, r.json()
    ok("H", "清理完成（用户/租户×2/角色/套餐全删）")

    log("DONE", f"ALL-PASS（{len(passed)} 项）: {', '.join(passed)}")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        log("FAIL", str(e)[:500])
        sys.exit(1)
