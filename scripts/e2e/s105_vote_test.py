#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
S105 L1 清偿：票签（nodeRatio=50）端到端实测。

取证链（不留手工 SQL fixture）：
  骨架定义（save-json 标准接口，开始→提交申请→票签审批→结束，票签节点挂 REJECT 驳回边）
  → 新设计器「新版设计」入口载入 → 面板写入票签参数（审批人=admin@@vote002@@vote003 +
    办理模式=票签·通过率 50 → warm:nodeRatio=50）→ 设计器保存（v2）/发布（浏览器成功文案实证）
  → 本脚本走既有审批链路实测票签语义。

场景 A（通过渐进）：3 人票签 50%
  - 第 1 签通过（1/3=33.3% < 50%）→ 不推进，实例仍停票签节点，另两人待办仍在
  - 第 2 签通过（2/3=66.7% ≥ 50%）→ 推进办结，第 3 人待办被引擎清理
场景 B（驳回累积）：
  - 第 1 签驳回（驳回率 33.3% ≤ 50%）→ 不推进
  - 第 2 签驳回（驳回率 66.7% > 50%）→ 沿 REJECT 边回退「提交申请」，实例 flowStatus=9

前置：8080 dev 运行中（库 pivotos_dev）；admin/admin123；vote002/vote003（Admin@123456）。

**fixture 自愈（S129 补）**：S129 重建 dev 库做 Flyway 全量重放后，「vote002/vote003 用户」与
「bpmn_s105_vote 定义」这两个**历史累积 fixture 一并清零**，脚本直接跑会在 STEP1 登录处即失败
（`2001 账号或密码错误`）。按 S124 确立的 fixture 自愈口径，改为**脚本自建、幂等复用**：
  ① 用户：登录试探 → 失败则经 admin 的 `POST /system/user` 自建（角色取首个可用角色）；
  ② 定义：`GET /workflow/definition/page` 查 `flowCode` → 无则 `POST /warm-flow/save-json`
     建「开始→提交申请→票签审批(nodeRatio=50)→结束」并发布。
谁创建谁可用，不删（该定义与两个用户是长期 fixture，清场后重建一次即可长期复用）。
"""
import json
import sys
import time

import requests

BASE = "http://localhost:8080"
FLOW_CODE = "bpmn_s105_vote"
RUN_TS = str(int(time.time()))[-6:]
VOTE_USERS = ("vote002", "vote003")
VOTE_PWD = "Admin@123456"


def log(tag, msg):
    print(f"[{tag}] {msg}", flush=True)


def login(username, password):
    r = requests.post(f"{BASE}/system/auth/login",
                      json={"username": username, "password": password}, timeout=60)
    body = r.json()
    assert r.status_code == 200 and body.get("code") == 0, f"{username} 登录失败: {body}"
    return {"Authorization": body["data"]["token"]}


def try_login(username, password):
    """登录试探：成功返回 header，失败返回 None（不抛，供 fixture 自愈判定）。"""
    r = requests.post(f"{BASE}/system/auth/login",
                      json={"username": username, "password": password}, timeout=60)
    body = r.json()
    if r.status_code == 200 and body.get("code") == 0:
        return {"Authorization": body["data"]["token"]}
    return None


def ensure_vote_users(hdr_admin):
    """dev 库清场后 vote002/vote003 丢失 → 经 admin API 自建（幂等）。"""
    for u in VOTE_USERS:
        if try_login(u, VOTE_PWD):
            log("FIXTURE", f"用户 {u} 已存在，复用")
            continue
        roles = requests.get(f"{BASE}/system/role/all", headers=hdr_admin, timeout=30).json()
        role_list = roles.get("data") or []
        role_id = str((role_list[0] or {}).get("id")) if role_list else ""
        body = {"username": u, "nickname": u, "password": VOTE_PWD, "status": 0,
                "deptId": "1", "roleIds": [role_id] if role_id else []}
        r = requests.post(f"{BASE}/system/user", json=body, headers=hdr_admin, timeout=30)
        rb = r.json()
        assert rb.get("code") == 0, f"自建用户 {u} 失败: {json.dumps(rb, ensure_ascii=False)[:300]}"
        assert try_login(u, VOTE_PWD), f"自建用户 {u} 后仍无法登录"
        log("FIXTURE", f"用户 {u} 已自建（roleId={role_id or '无'}）")


def find_user_id(hdr_admin, username):
    """按 username 查用户 id（permissionFlag 收的是**用户 ID**，不是登录名）。"""
    r = requests.get(f"{BASE}/system/user/page", headers=hdr_admin, timeout=30,
                     params={"pageNum": 1, "pageSize": 50, "username": username})
    for u in (r.json().get("data") or {}).get("list", []):
        if u.get("username") == username:
            return str(u["id"])
    return None


def vote_defjson(perm_ids):
    """开始 → 提交申请 → 票签审批（三人 + nodeRatio=50，带 REJECT 驳回边）→ 结束。"""
    def node(code, name, ntype, perm=None, ratio=None, coord="0,0", skips=()):
        n = {"nodeType": ntype, "nodeCode": code, "nodeName": name,
             "nodeRatio": ratio or "0.000", "coordinate": coord,
             "skipList": [dict(s) for s in skips]}
        if perm is not None:
            n["permissionFlag"] = perm
        return n

    def skip(now, nxt, name, stype="PASS"):
        return {"nowNodeCode": now, "nextNodeCode": nxt, "skipName": name, "skipType": stype}

    return {
        "flowCode": FLOW_CODE,
        "flowName": "S105票签50（S129 自愈重建）",
        "modelValue": "CLASSICS",
        "nodeList": [
            node("start", "开始", 0, coord="80,240", skips=[skip("start", "apply", "提交")]),
            node("apply", "提交申请", 1, perm="1", coord="240,240",
                 skips=[skip("apply", "vote", "提交")]),
            node("vote", "票签审批", 1, perm=perm_ids, ratio="50.000", coord="400,240",
                 skips=[skip("vote", "end", "同意"), skip("vote", "apply", "驳回", "REJECT")]),
            node("end", "结束", 2, coord="560,240"),
        ],
    }


def ensure_vote_definition(hdr_admin):
    """dev 库清场后 bpmn_s105_vote 定义丢失 → save-json 自建并发布（幂等）。"""
    r = requests.get(f"{BASE}/workflow/definition/page", headers=hdr_admin, timeout=30,
                     params={"pageNum": 1, "pageSize": 50, "flowCode": FLOW_CODE})
    defs = [d for d in (r.json().get("data") or {}).get("list", []) if d.get("isPublish") != 9]
    if defs:
        log("FIXTURE", f"定义 {FLOW_CODE} 已存在，复用 id={defs[0]['id']}")
        return
    admin_id = find_user_id(hdr_admin, "admin")
    ids = [admin_id] + [find_user_id(hdr_admin, u) for u in VOTE_USERS]
    assert all(ids), f"取不到票签三人的用户 id：{ids}"
    perm_ids = "@@".join(ids)
    r = requests.post(f"{BASE}/warm-flow/save-json", headers={**hdr_admin, "onlyNodeSkip": "false"},
                      json=vote_defjson(perm_ids), timeout=30)
    rb = r.json()
    assert rb.get("code") in (0, 200), f"save-json 失败: {json.dumps(rb, ensure_ascii=False)[:300]}"
    r = requests.get(f"{BASE}/workflow/definition/page", headers=hdr_admin, timeout=30,
                     params={"pageNum": 1, "pageSize": 50, "flowCode": FLOW_CODE})
    defs = [d for d in (r.json().get("data") or {}).get("list", []) if d.get("isPublish") != 9]
    assert defs, "save-json 后未查到定义"
    def_id = max(defs, key=lambda d: int(d["id"]))["id"]
    rb = requests.put(f"{BASE}/workflow/definition/{def_id}/publish",
                      headers=hdr_admin, timeout=30).json()
    assert rb.get("code") == 0, f"发布失败: {json.dumps(rb, ensure_ascii=False)[:200]}"
    log("FIXTURE", f"定义 {FLOW_CODE} 已自建并发布 id={def_id}")


def pending_task(hdr, biz, node_name=None):
    r = requests.get(f"{BASE}/workflow/task/pending/page",
                     params={"pageNum": 1, "pageSize": 50}, headers=hdr, timeout=30)
    tasks = [t for t in r.json()["data"]["list"] if t.get("businessId") == biz]
    if node_name:
        tasks = [t for t in tasks if t.get("nodeName") == node_name]
    return tasks[0] if tasks else None


def instance_of(hdr, biz):
    r = requests.get(f"{BASE}/workflow/instance/page",
                     params={"pageNum": 1, "pageSize": 20}, headers=hdr, timeout=30)
    inst = [i for i in r.json()["data"]["list"] if i.get("businessId") == biz]
    return inst[0] if inst else None


def act(action, hdr, task_id, msg):
    r = requests.put(f"{BASE}/workflow/task/{action}",
                     json={"taskId": task_id, "message": msg}, headers=hdr, timeout=30)
    body = r.json()
    assert body.get("code") == 0, f"{action} 失败: {json.dumps(body, ensure_ascii=False)[:300]}"


def start_instance(hdr, biz):
    r = requests.post(f"{BASE}/workflow/instance/start",
                      json={"flowCode": FLOW_CODE, "businessName": biz}, headers=hdr, timeout=30)
    assert r.json().get("code") == 0, f"发起失败: {json.dumps(r.json(), ensure_ascii=False)[:300]}"
    cur = pending_task(hdr, biz, "提交申请")
    assert cur, "发起后应在「提交申请」"
    act("pass", hdr, cur["id"], "S105 E2E 提交")


def main():
    log("STEP1", "登录 admin / vote002 / vote003 ...")
    hdr_admin = login("admin", "admin123")
    ensure_vote_users(hdr_admin)          # fixture 自愈①：清场后用户丢失 → 自建
    ensure_vote_definition(hdr_admin)     # fixture 自愈②：清场后定义丢失 → 自建并发布
    hdr_002 = login("vote002", VOTE_PWD)
    hdr_003 = login("vote003", VOTE_PWD)

    # ---------- 场景 A：票签通过渐进 ----------
    biz_a = f"S105票签通过-{RUN_TS}"
    log("STEP2", f"场景A 发起（{biz_a}）并过「提交申请」...")
    start_instance(hdr_admin, biz_a)
    # 三人同时待办（多人派发）
    t_admin = pending_task(hdr_admin, biz_a, "票签审批")
    t_002 = pending_task(hdr_002, biz_a, "票签审批")
    t_003 = pending_task(hdr_003, biz_a, "票签审批")
    assert t_admin and t_002 and t_003, \
        f"票签节点应三人同时待办，实际 admin={bool(t_admin)} vote002={bool(t_002)} vote003={bool(t_003)}"
    log("PASS2", "票签节点三人同时派发待办（permissionFlag @@ 三人生效）")

    log("STEP3", "场景A 第 1 签：admin 通过（1/3=33.3% < 50%，不推进）...")
    act("pass", hdr_admin, t_admin["id"], "S105 E2E 票签第1签通过")
    inst = instance_of(hdr_admin, biz_a)
    assert inst and inst.get("nodeName") == "票签审批" and str(inst.get("flowStatus")) == "1", \
        f"第 1 签后不应推进，实际 {json.dumps({k: (inst or {}).get(k) for k in ('nodeName', 'flowStatus')}, ensure_ascii=False)}"
    assert pending_task(hdr_admin, biz_a) is None, "第 1 签后 admin 待办应移除"
    assert pending_task(hdr_002, biz_a, "票签审批") and pending_task(hdr_003, biz_a, "票签审批"), \
        "第 1 签后另两人待办应保留"
    log("PASS3", "第 1 签 33.3%<50% 不推进：实例停票签节点、另两人待办保留（渐进统计成立）")

    log("STEP4", "场景A 第 2 签：vote002 通过（2/3=66.7% ≥ 50%，推进办结）...")
    act("pass", hdr_002, t_002["id"], "S105 E2E 票签第2签通过")
    inst = instance_of(hdr_admin, biz_a)
    assert inst and str(inst.get("flowStatus")) == "8", \
        f"第 2 签后应办结 flowStatus=8，实际 {json.dumps({k: (inst or {}).get(k) for k in ('nodeName', 'flowStatus')}, ensure_ascii=False)}"
    assert pending_task(hdr_003, biz_a) is None, "办结后 vote003 待办应被引擎清理"
    log("PASS4", "第 2 签 66.7%≥50% 推进办结（flowStatus=8），剩余办理人待办被清理")

    # ---------- 场景 B：票签驳回累积 ----------
    biz_b = f"S105票签驳回-{RUN_TS}"
    log("STEP5", f"场景B 发起（{biz_b}）→ 第 1 签驳回（33.3% ≤ 50%，不推进）...")
    start_instance(hdr_admin, biz_b)
    t_admin = pending_task(hdr_admin, biz_b, "票签审批")
    t_002 = pending_task(hdr_002, biz_b, "票签审批")
    assert t_admin and t_002, "场景B 票签节点待办缺失"
    act("reject", hdr_admin, t_admin["id"], "S105 E2E 票签第1签驳回")
    inst = instance_of(hdr_admin, biz_b)
    assert inst and inst.get("nodeName") == "票签审批" and str(inst.get("flowStatus")) == "1", \
        f"第 1 签驳回后不应推进，实际 {json.dumps({k: (inst or {}).get(k) for k in ('nodeName', 'flowStatus')}, ensure_ascii=False)}"
    assert pending_task(hdr_002, biz_b, "票签审批") and pending_task(hdr_003, biz_b, "票签审批"), \
        "第 1 签驳回后另两人待办应保留"
    log("PASS5", "驳回率 33.3%≤50% 不推进：实例仍停票签节点")

    log("STEP6", "场景B 第 2 签驳回（66.7% > 50%，沿 REJECT 边回退）...")
    act("reject", hdr_002, t_002["id"], "S105 E2E 票签第2签驳回")
    inst = instance_of(hdr_admin, biz_b)
    assert inst and inst.get("nodeName") == "提交申请" and str(inst.get("flowStatus")) == "9", \
        f"第 2 签驳回后应沿 REJECT 边回退「提交申请」flowStatus=9，实际 {json.dumps({k: (inst or {}).get(k) for k in ('nodeName', 'flowStatus')}, ensure_ascii=False)}"
    assert pending_task(hdr_003, biz_b) is None, "驳回推进后 vote003 待办应被清理"
    # W1（S113）口径：退回任务「应」回到发起人（admin）待办并可重新提交——
    # 断言随 W1 口径反转（S114 回归批同步），不再是 S104 K1 时代的「不落入待办」。
    rej = pending_task(hdr_admin, biz_b)
    assert rej is not None and str(rej.get("flowStatus")) == "9", \
        "W1 口径下退回任务应进入发起人待办（flow_status=9 可见）"
    r = requests.put(f"{BASE}/workflow/task/resubmit",
                     json={"taskId": rej["id"], "message": "S105 E2E 重新提交"}, headers=hdr_admin, timeout=30)
    rb = r.json()
    assert rb.get("code") == 0, f"票签退回后重新提交失败: {json.dumps(rb, ensure_ascii=False)[:300]}"
    log("PASS6", f"驳回率 66.7%>50% 沿 REJECT 边回退「提交申请」（flowStatus=9），"
                 f"退回任务进发起人待办且 resubmit 成功（W1 口径）")

    print("\n===== S105 票签（nodeRatio=50）端到端实测 ALL-PASS =====")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n[FAIL] {e}", flush=True)
        sys.exit(1)
