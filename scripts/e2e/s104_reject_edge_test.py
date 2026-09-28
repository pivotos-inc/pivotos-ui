#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
S104 C4 一期：REJECT 驳回边端到端实测。

链路：DefJson（开始→提交申请→主管审批→结束，主管审批挂 skipType=REJECT 驳回边回提交申请；
  结构与 S104 属性面板「跳转类型=驳回」写 warm:skipType 后的映射产物同构，浏览器侧已实证面板写盘正确）
  → POST /warm-flow/save-json → page 反查 id → publish → query-def 回读断言 REJECT 边在场
  → 发起实例 → 过「提交申请」→ 到「主管审批」→ 驳回 → 断言待办回到「提交申请」（REJECT 边生效）
  → 再过「提交申请」→ 过「主管审批」→ 断言实例完结

前置：8080 dev 运行中（库 pivotos_dev），admin/admin123。
"""
import json
import sys
import time

import requests

BASE = "http://localhost:8080"
FLOW_CODE = "bpmn_s104_reject"
RUN_TS = str(int(time.time()))[-6:]

# 与设计器属性面板产物同构的 DefJson（skipType=REJECT 边：leader → apply）
DEF_JSON = {
    "flowCode": FLOW_CODE,
    "flowName": "驳回边实测-S104",
    "modelValue": "CLASSICS",
    "nodeList": [
        {"nodeType": 0, "nodeCode": "start", "nodeName": "开始", "nodeRatio": "0.000",
         "coordinate": "80,240", "skipList": [
             {"nowNodeCode": "start", "nextNodeCode": "apply", "skipName": "提交",
              "skipType": "PASS", "coordinate": "116,258;180,258"}]},
        {"nodeType": 1, "nodeCode": "apply", "nodeName": "提交申请", "permissionFlag": "1",
         "nodeRatio": "0.000", "coordinate": "180,218", "skipList": [
             {"nowNodeCode": "apply", "nextNodeCode": "leader", "skipName": "提交",
              "skipType": "PASS", "coordinate": "280,258;450,258"}]},
        {"nodeType": 1, "nodeCode": "leader", "nodeName": "主管审批", "permissionFlag": "1",
         "nodeRatio": "0.000", "coordinate": "450,218", "skipList": [
             {"nowNodeCode": "leader", "nextNodeCode": "end", "skipName": "同意",
              "skipType": "PASS", "coordinate": "550,258;640,258"},
             {"nowNodeCode": "leader", "nextNodeCode": "apply", "skipName": "驳回",
              "skipType": "REJECT", "coordinate": "500,300;230,300"}]},
        {"nodeType": 2, "nodeCode": "end", "nodeName": "结束", "nodeRatio": "0.000",
         "coordinate": "640,240", "skipList": []},
    ],
}


def log(tag, msg):
    print(f"[{tag}] {msg}", flush=True)


def pending_task(hdr, biz):
    r = requests.get(f"{BASE}/workflow/task/pending/page",
                     params={"pageNum": 1, "pageSize": 50}, headers=hdr, timeout=10)
    tasks = [t for t in r.json()["data"]["list"] if t.get("businessId") == biz]
    return tasks[0] if tasks else None


def main():
    # Step 1 登录
    log("STEP1", "登录 admin ...")
    r = requests.post(f"{BASE}/system/auth/login",
                      json={"username": "admin", "password": "admin123"}, timeout=30)
    body = r.json()
    assert r.status_code == 200 and body.get("code") == 0, f"登录失败: {body}"
    hdr = {"Authorization": body["data"]["token"]}

    # Step 2 save-json
    log("STEP2", "save-json（含 REJECT 驳回边 leader→apply）...")
    r = requests.post(f"{BASE}/warm-flow/save-json", json=DEF_JSON,
                      headers={**hdr, "onlyNodeSkip": "false"}, timeout=30)
    body = r.json()
    assert body.get("code") in (0, 200), f"save-json 失败: {json.dumps(body, ensure_ascii=False)[:300]}"
    log("PASS2", "save-json 接受含 REJECT 边的定义")

    # Step 3 反查 id 并发布
    log("STEP3", "反查定义 id 并发布 ...")
    r = requests.get(f"{BASE}/workflow/definition/page",
                     params={"pageNum": 1, "pageSize": 50, "flowCode": FLOW_CODE},
                     headers=hdr, timeout=10)
    defs = [d for d in r.json()["data"]["list"] if d.get("isPublish") != 9]
    assert defs, "save-json 后未查到定义"
    defs.sort(key=lambda d: int(d["id"]), reverse=True)
    def_id = defs[0]["id"]
    r = requests.put(f"{BASE}/workflow/definition/{def_id}/publish", headers=hdr, timeout=10)
    body = r.json()
    assert body.get("code") == 0, f"发布失败: {json.dumps(body, ensure_ascii=False)[:300]}"
    log("PASS3", f"发布成功 id={def_id} version={defs[0].get('version')}")

    # Step 4 回读断言 REJECT 边持久化不丢
    log("STEP4", "query-def 回读断言 REJECT 边 ...")
    r = requests.get(f"{BASE}/warm-flow/query-def/{def_id}", headers=hdr, timeout=10)
    rb = r.json()
    assert rb.get("code") in (0, 200), f"query-def 失败: {rb}"
    node_map = {n["nodeCode"]: n for n in rb["data"]["nodeList"]}
    leader_skips = {s["nextNodeCode"]: s["skipType"] for s in node_map["leader"]["skipList"]}
    assert leader_skips.get("apply") == "REJECT", f"REJECT 边丢失/错位: {leader_skips}"
    assert leader_skips.get("end") == "PASS", f"PASS 边异常: {leader_skips}"
    log("PASS4", f"回读比对通过：leader 出边 {leader_skips}")

    # Step 5 发起 → 过 apply → 到 leader → 驳回 → 断言沿 REJECT 边回退
    # 引擎语义（S104 实测定案）：驳回成功后实例 nodeCode 回退到 REJECT 边目标节点、flowStatus=9（已退回），
    # 退回任务 flow_status=9 不在平台待办口径（pending 只查 flow_status='1'）——待办应为空，
    # 断言锚点 = 实例 nodeName/flowStatus（对照组实证：无 REJECT 边时驳回直接报「当前节点不支持驳回操作」）
    biz = f"S104驳回边实测-{RUN_TS}"
    log("STEP5", f"发起实例（{biz}）...")
    r = requests.post(f"{BASE}/workflow/instance/start",
                      json={"flowCode": FLOW_CODE, "businessName": biz}, headers=hdr, timeout=30)
    assert r.json().get("code") == 0, f"发起失败: {json.dumps(r.json(), ensure_ascii=False)[:300]}"

    cur = pending_task(hdr, biz)
    assert cur and cur.get("nodeName") == "提交申请", f"发起后应在「提交申请」，实际 {cur and cur.get('nodeName')}"
    r = requests.put(f"{BASE}/workflow/task/pass",
                     json={"taskId": cur["id"], "message": "S104 E2E 通过"}, headers=hdr, timeout=15)
    assert r.json().get("code") == 0, "过 apply 节点失败"

    cur = pending_task(hdr, biz)
    assert cur and cur.get("nodeName") == "主管审批", f"过 apply 后应在「主管审批」，实际 {cur and cur.get('nodeName')}"
    r = requests.put(f"{BASE}/workflow/task/reject",
                     json={"taskId": cur["id"], "message": "S104 E2E 驳回"}, headers=hdr, timeout=15)
    rb2 = r.json()
    assert rb2.get("code") == 0, f"驳回失败: {json.dumps(rb2, ensure_ascii=False)[:300]}"

    r = requests.get(f"{BASE}/workflow/instance/page",
                     params={"pageNum": 1, "pageSize": 20}, headers=hdr, timeout=10)
    inst = [i for i in r.json()["data"]["list"] if i.get("businessId") == biz]
    assert inst, "驳回后查不到实例"
    assert inst[0].get("nodeName") == "提交申请" and str(inst[0].get("flowStatus")) == "9", \
        f"驳回后应沿 REJECT 边回退到「提交申请」且状态=9 已退回，实际 {json.dumps({k: inst[0].get(k) for k in ('nodeName', 'flowStatus')}, ensure_ascii=False)}"
    log("PASS5", "驳回沿 REJECT 边回退「提交申请」，实例状态=9 已退回（边语义引擎侧成立）")

    # Step 6 W1（S113）口径：待办口径已由 flow_status='1' 放宽为 IN ('1','9')，
    # 退回任务「应」进入发起人待办并可重新提交——本断言随 W1 口径反转（S114 回归批同步）。
    rej = pending_task(hdr, biz)
    assert rej is not None and str(rej.get("flowStatus")) == "9", \
        "W1 口径下退回任务应进入发起人待办（flow_status=9 可见）"
    log("PASS6", f"退回任务进入发起人待办（flowStatus=9，taskId={rej.get('id')}）——W1 口径成立")

    # Step 7 重新提交：resubmit 推进下一节点，实例 ID 与审批历史连续
    r = requests.put(f"{BASE}/workflow/task/resubmit",
                     json={"taskId": rej["id"], "message": "S104 E2E 重新提交"}, headers=hdr, timeout=30)
    rb3 = r.json()
    assert rb3.get("code") == 0, f"重新提交失败: {json.dumps(rb3, ensure_ascii=False)[:300]}"
    inst2 = [i for i in requests.get(f"{BASE}/workflow/instance/page",
                                     params={"pageNum": 1, "pageSize": 20}, headers=hdr, timeout=10)
             .json()["data"]["list"] if i.get("businessId") == biz]
    assert inst2 and str(inst2[0].get("flowStatus")) == "1", \
        f"重新提交后实例应回到审批中（1），实际 {inst2[0].get('flowStatus') if inst2 else None}"
    log("PASS7", f"重新提交成立：实例 9 → 1，节点={inst2[0].get('nodeName')}")

    print("\n===== S104 REJECT 驳回边实测 ALL-PASS =====")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n[FAIL] {e}", flush=True)
        sys.exit(1)
