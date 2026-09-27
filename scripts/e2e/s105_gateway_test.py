#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
S105 T1 配套实证：并行网关（nodeType=4）/包容网关（nodeType=5）走向 E2E。

palette 开放两类网关后，用映射产物同构 DefJson 造最小定义（开始→提交申请→网关→双审批→汇聚网关→结束），
实证 warm-flow 引擎语义：
  - 分叉：过「提交申请」后两个分支节点同时生成待办
  - 汇聚：一个分支通过后不办结（等另一分支），两分支都通过才到结束（isGenerateNewTask 汇聚闸）
  - 包容网关不带条件时行为同并行（两分支同时激活）

前置：8080 dev 运行中（库 pivotos_dev），admin/admin123。
"""
import json
import sys
import time

import requests

BASE = "http://localhost:8080"
RUN_TS = str(int(time.time()))[-6:]


def log(tag, msg):
    print(f"[{tag}] {msg}", flush=True)


def make_def(flow_code, flow_name, gw_type):
    """gw_type: 4=并行 5=包容。开始→apply→gw→(a1,a2)→gw2→end"""
    return {
        "flowCode": flow_code,
        "flowName": flow_name,
        "modelValue": "CLASSICS",
        "nodeList": [
            {"nodeType": 0, "nodeCode": "start", "nodeName": "开始", "nodeRatio": "0.000",
             "coordinate": "60,240", "skipList": [
                 {"nowNodeCode": "start", "nextNodeCode": "apply", "skipName": "提交",
                  "skipType": "PASS", "coordinate": "96,258;160,258"}]},
            {"nodeType": 1, "nodeCode": "apply", "nodeName": "提交申请", "permissionFlag": "1",
             "nodeRatio": "0.000", "coordinate": "160,218", "skipList": [
                 {"nowNodeCode": "apply", "nextNodeCode": "gw", "skipName": "提交",
                  "skipType": "PASS", "coordinate": "260,258;330,258"}]},
            {"nodeType": gw_type, "nodeCode": "gw", "nodeName": "分叉", "nodeRatio": "0.000",
             "coordinate": "330,233", "skipList": [
                 {"nowNodeCode": "gw", "nextNodeCode": "a1", "skipName": "分支一",
                  "skipType": "PASS", "coordinate": "380,258;450,198"},
                 {"nowNodeCode": "gw", "nextNodeCode": "a2", "skipName": "分支二",
                  "skipType": "PASS", "coordinate": "380,258;450,318"}]},
            {"nodeType": 1, "nodeCode": "a1", "nodeName": "审批一", "permissionFlag": "1",
             "nodeRatio": "0.000", "coordinate": "450,158", "skipList": [
                 {"nowNodeCode": "a1", "nextNodeCode": "gw2", "skipName": "同意",
                  "skipType": "PASS", "coordinate": "550,198;610,258"}]},
            {"nodeType": 1, "nodeCode": "a2", "nodeName": "审批二", "permissionFlag": "1",
             "nodeRatio": "0.000", "coordinate": "450,278", "skipList": [
                 {"nowNodeCode": "a2", "nextNodeCode": "gw2", "skipName": "同意",
                  "skipType": "PASS", "coordinate": "550,318;610,258"}]},
            {"nodeType": gw_type, "nodeCode": "gw2", "nodeName": "汇聚", "nodeRatio": "0.000",
             "coordinate": "610,233", "skipList": [
                 {"nowNodeCode": "gw2", "nextNodeCode": "end", "skipName": "完成",
                  "skipType": "PASS", "coordinate": "660,258;720,258"}]},
            {"nodeType": 2, "nodeCode": "end", "nodeName": "结束", "nodeRatio": "0.000",
             "coordinate": "720,240", "skipList": []},
        ],
    }


def pending_tasks(hdr, biz):
    r = requests.get(f"{BASE}/workflow/task/pending/page",
                     params={"pageNum": 1, "pageSize": 50}, headers=hdr, timeout=30)
    return [t for t in r.json()["data"]["list"] if t.get("businessId") == biz]


def instance_of(hdr, biz):
    r = requests.get(f"{BASE}/workflow/instance/page",
                     params={"pageNum": 1, "pageSize": 20}, headers=hdr, timeout=30)
    inst = [i for i in r.json()["data"]["list"] if i.get("businessId") == biz]
    return inst[0] if inst else None


def act(hdr, task_id, msg):
    r = requests.put(f"{BASE}/workflow/task/pass",
                     json={"taskId": task_id, "message": msg}, headers=hdr, timeout=30)
    body = r.json()
    assert body.get("code") == 0, f"pass 失败: {json.dumps(body, ensure_ascii=False)[:300]}"


def run_gateway(hdr, flow_code, gw_name):
    # 建定义 + 发布
    r = requests.post(f"{BASE}/warm-flow/save-json", json=make_def(flow_code, f"{gw_name}网关实测-S105", 4 if flow_code.endswith("parallel") else 5),
                      headers={**hdr, "onlyNodeSkip": "false"}, timeout=30)
    assert r.json().get("code") in (0, 200), f"save-json 失败: {r.json()}"
    r = requests.get(f"{BASE}/workflow/definition/page",
                     params={"pageNum": 1, "pageSize": 10, "flowCode": flow_code}, headers=hdr, timeout=30)
    defs = [d for d in r.json()["data"]["list"] if d.get("isPublish") != 9]
    defs.sort(key=lambda d: int(d["id"]), reverse=True)
    def_id = defs[0]["id"]
    r = requests.put(f"{BASE}/workflow/definition/{def_id}/publish", headers=hdr, timeout=30)
    assert r.json().get("code") == 0, f"发布失败: {r.json()}"

    biz = f"S105{gw_name}网关-{RUN_TS}"
    r = requests.post(f"{BASE}/workflow/instance/start",
                      json={"flowCode": flow_code, "businessName": biz}, headers=hdr, timeout=30)
    assert r.json().get("code") == 0, f"发起失败: {json.dumps(r.json(), ensure_ascii=False)[:300]}"

    cur = pending_tasks(hdr, biz)
    assert len(cur) == 1 and cur[0].get("nodeName") == "提交申请", f"发起后应在「提交申请」，实际 {[t.get('nodeName') for t in cur]}"
    act(hdr, cur[0]["id"], "S105 E2E 提交")

    # 分叉：双分支同时待办
    branches = pending_tasks(hdr, biz)
    names = sorted(t.get("nodeName") for t in branches)
    assert names == ["审批一", "审批二"], f"{gw_name}分叉后应双分支同时待办，实际 {names}"
    log(f"PASS-{gw_name}1", f"{gw_name}网关分叉：审批一/审批二同时生成待办")

    # 汇聚闸：过一个分支不办结
    t1 = next(t for t in branches if t.get("nodeName") == "审批一")
    act(hdr, t1["id"], "S105 E2E 分支一通过")
    inst = instance_of(hdr, biz)
    rest = pending_tasks(hdr, biz)
    assert inst and str(inst.get("flowStatus")) == "1", f"单分支通过后不应办结，实际 flowStatus={(inst or {}).get('flowStatus')}"
    assert len(rest) == 1 and rest[0].get("nodeName") == "审批二", f"单分支通过后应仅剩审批二待办，实际 {[t.get('nodeName') for t in rest]}"
    log(f"PASS-{gw_name}2", f"{gw_name}汇聚闸：审批一通过后不办结，审批二待办保留")

    # 双分支都通过 → 办结
    act(hdr, rest[0]["id"], "S105 E2E 分支二通过")
    inst = instance_of(hdr, biz)
    assert inst and str(inst.get("flowStatus")) == "8", f"双分支通过后应办结 flowStatus=8，实际 {(inst or {}).get('flowStatus')}"
    assert pending_tasks(hdr, biz) == [], "办结后不应有残留待办"
    log(f"PASS-{gw_name}3", f"{gw_name}汇聚：双分支通过后办结（flowStatus=8）")


def main():
    log("STEP1", "登录 admin ...")
    r = requests.post(f"{BASE}/system/auth/login",
                      json={"username": "admin", "password": "admin123"}, timeout=60)
    body = r.json()
    assert r.status_code == 200 and body.get("code") == 0, f"登录失败: {body}"
    hdr = {"Authorization": body["data"]["token"]}

    run_gateway(hdr, "bpmn_s105_parallel", "并行")
    run_gateway(hdr, "bpmn_s105_inclusive", "包容")

    print("\n===== S105 并行/包容网关走向实测 ALL-PASS =====")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n[FAIL] {e}", flush=True)
        sys.exit(1)
