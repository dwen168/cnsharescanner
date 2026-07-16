from strategy_config import SECTORS
from waneye_scraper import match_text_to_sectors

def assess_threats(waneye_data, manual_halt=False):
    """
    分析 Waneye 舆情风险、战术机会、防御策略，匹配至板块并判定系统整体交易信号风控状态。
    
    返回：
    - trading_state: 风控级别 ("active", "low_risk", "medium_risk", "high_risk")
    - warnings_list: 系统运行警告列表
    - sector_modifiers: 板块因子调节值字典 (penalties, opportunities, defensives)
    - sector_matched_details: 板块匹配的具体情报明细
    """
    warnings_list = []
    
    sector_risk_penalties = {s: 0 for s in SECTORS}
    sector_opportunity_boosts = {s: 0 for s in SECTORS}
    sector_defensive_boosts = {s: 0 for s in SECTORS}
    
    sector_matched_risks = {s: [] for s in SECTORS}
    sector_matched_opportunities = {s: [] for s in SECTORS}
    sector_matched_defensive = {s: [] for s in SECTORS}
    
    threat_values = []
    
    if waneye_data:
        for r in waneye_data.get("risks", []):
            impact = (r.get("impact") or "").strip().lower()
            likelihood = (r.get("likelihood") or "").strip().lower()
            title = r.get("title") or ""
            mitigation = r.get("mitigation") or ""
            
            threat_val = 0
            if impact == "high":
                threat_val += 6
            elif impact == "medium":
                threat_val += 3
            else:
                threat_val += 1
                
            if likelihood == "high":
                threat_val += 4
            elif likelihood == "medium":
                threat_val += 2
            else:
                threat_val += 1
            
            threat_values.append(threat_val)
            
            # 使用包含置信度的匹配
            matched_sec_conf = []
            matched_sec_conf.extend(match_text_to_sectors(title))
            matched_sec_conf.extend(match_text_to_sectors(mitigation))
            for s in SECTORS:
                s_clean = s.lower()
                if any(part in title.lower() or part in mitigation.lower() for part in s_clean.replace('/', ' ').split()):
                    if not any(x["sector"] == s for x in matched_sec_conf):
                        matched_sec_conf.append({"sector": s, "confidence": "high"})
            
            sec_dict = {}
            for x in matched_sec_conf:
                sec = x["sector"]
                conf = x["confidence"]
                if sec not in sec_dict or (sec_dict[sec] == "low" and conf == "high"):
                    sec_dict[sec] = conf
            
            penalty = 15 if impact == "high" else (8 if impact == "medium" else 3)
            for s, conf in sec_dict.items():
                if conf == "high":
                    sector_risk_penalties[s] = min(40, sector_risk_penalties[s] + penalty)
                
                r_with_conf = r.copy()
                r_with_conf["match_confidence"] = conf
                sector_matched_risks[s].append(r_with_conf)
        
        for o in waneye_data.get("opportunities", []):
            title = o.get("title") or ""
            desc = o.get("description") or ""
            
            matched_sec_conf = []
            matched_sec_conf.extend(match_text_to_sectors(title))
            matched_sec_conf.extend(match_text_to_sectors(desc))
            for s in SECTORS:
                s_clean = s.lower()
                if any(part in title.lower() or part in desc.lower() for part in s_clean.replace('/', ' ').split()):
                    if not any(x["sector"] == s for x in matched_sec_conf):
                        matched_sec_conf.append({"sector": s, "confidence": "high"})
            
            sec_dict = {}
            for x in matched_sec_conf:
                sec = x["sector"]
                conf = x["confidence"]
                if sec not in sec_dict or (sec_dict[sec] == "low" and conf == "high"):
                    sec_dict[sec] = conf
                    
            for s, conf in sec_dict.items():
                if conf == "high":
                    sector_opportunity_boosts[s] += 10
                
                o_with_conf = o.copy()
                o_with_conf["match_confidence"] = conf
                sector_matched_opportunities[s].append(o_with_conf)
                
        for d in waneye_data.get("defensive", []):
            title = d.get("title") or ""
            desc = d.get("description") or ""
            
            matched_sec_conf = []
            matched_sec_conf.extend(match_text_to_sectors(title))
            matched_sec_conf.extend(match_text_to_sectors(desc))
            for s in SECTORS:
                s_clean = s.lower()
                if any(part in title.lower() or part in desc.lower() for part in s_clean.replace('/', ' ').split()):
                    if not any(x["sector"] == s for x in matched_sec_conf):
                        matched_sec_conf.append({"sector": s, "confidence": "high"})
            
            sec_dict = {}
            for x in matched_sec_conf:
                sec = x["sector"]
                conf = x["confidence"]
                if sec not in sec_dict or (sec_dict[sec] == "low" and conf == "high"):
                    sec_dict[sec] = conf
            
            for s, conf in sec_dict.items():
                if conf == "high":
                    sector_defensive_boosts[s] += 8
                
                d_with_conf = d.copy()
                d_with_conf["match_confidence"] = conf
                sector_matched_defensive[s].append(d_with_conf)

    waneye_score = waneye_data.get("score", 50)
    
    if threat_values:
        max_threat = max(threat_values)
        other_threats_sum = sum(threat_values) - max_threat
        global_threat_score = round(max_threat + min(1.5, 0.05 * other_threats_sum), 1)
    else:
        global_threat_score = 0.0
        
    trading_state = "active"
    if manual_halt or (waneye_score < 30) or (global_threat_score >= 12.0):
        trading_state = "high_risk"
    elif (30 <= waneye_score < 40) or (9.0 <= global_threat_score < 12.0):
        trading_state = "medium_risk"
    elif (40 <= waneye_score < 50) or (7.0 <= global_threat_score < 9.0):
        trading_state = "low_risk"

    if manual_halt:
        warnings_list.append("手动控制阀门打开，已强制开启高风险预警")
    elif waneye_score < 30:
        warnings_list.append(f"全局市场极度恐慌 (Waneye 得分 {waneye_score} < 30)，触发系统高风险避险机制")
    elif trading_state == "high_risk":
        warnings_list.append(f"全球宏观/地缘政治威胁极高 (威胁指数 {global_threat_score:.1f} >= 12.0)，系统已进入高风险防御状态")
    elif trading_state == "medium_risk":
        warnings_list.append(f"检测到中度市场风险 (Waneye 得分 {waneye_score}, 威胁指数 {global_threat_score:.1f})，系统冻结新增仓，并下发减仓避险提示")
    elif trading_state == "low_risk":
        warnings_list.append(f"检测到轻度市场风险 (Waneye 得分 {waneye_score}, 威胁指数 {global_threat_score:.1f})，系统提高信号触发阈值并建议轻仓操作")

    return {
        "trading_state": trading_state,
        "warnings": warnings_list,
        "modifiers": {
            "penalties": sector_risk_penalties,
            "opportunity_boosts": sector_opportunity_boosts,
            "defensive_boosts": sector_defensive_boosts
        },
        "details": {
            "risks": sector_matched_risks,
            "opportunities": sector_matched_opportunities,
            "defensive": sector_matched_defensive
        }
    }
