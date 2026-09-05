# -*- coding: utf-8 -*-
"""index.html v68 패치 — 같은 폴더의 index.html 을 고치고 index_v67.bak 을 남긴다.
   python patch_index_v68.py
"""
import re, shutil, sys, os

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')
if not os.path.exists(p):
    sys.exit('index.html 이 이 폴더에 없습니다.')
s = open(p, encoding='utf-8').read()
orig = s
log = []

# 1) APP_VER 67 → 68
n = len(re.findall(r"const APP_VER='67';", s))
s = s.replace("const APP_VER='67';", "const APP_VER='68';")
log.append(f"APP_VER 67→68 : {n}건")

# 2) 설계관리 메뉴 — 외주설계발주등록 숨김, 그룹명 '외주설계', 외주설계실적조회 추가
old_sec = "{name:'외주설계발주',icon:'✎'},"
new_sec = "{name:'외주설계',icon:'✎'},"
n = s.count(old_sec); s = s.replace(old_sec, new_sec)
log.append(f"secondary 외주설계발주→외주설계 : {n}건")

old_menu = "'외주설계발주':[{name:'외주설계발주',items:['외주설계발주등록','외주설계발주입고','외주설계발주현황']}],"
new_menu = "'외주설계':[{name:'외주설계',items:['외주설계발주입고','외주설계발주현황','외주설계실적조회']}],"
n = s.count(old_menu); s = s.replace(old_menu, new_menu)
log.append(f"menus 외주설계 항목 교체 : {n}건")

# 3) 화면 등록 — 외주설계실적조회 (설계실적조회 줄 바로 아래)
anchor = "'설계실적조회':{id:'design_result_inquiry_design',file:'design_result_inquiry.html?mode=design',title:'설계실적조회'},"
add = "\n'외주설계실적조회':{id:'design_result_inquiry_outsourced',file:'design_result_inquiry.html?mode=design&src=외주',title:'외주설계실적조회'},"
if "'외주설계실적조회':{" in s:
    log.append("pageRegistry 외주설계실적조회 : 이미 있음")
else:
    n = s.count(anchor); s = s.replace(anchor, anchor + add)
    log.append(f"pageRegistry 외주설계실적조회 추가 : {n}건")

print('\n'.join(log))
if s == orig:
    sys.exit('변경된 내용이 없습니다 — 원본 문구가 다르면 CHANGES_v68.txt 를 보고 수동 반영하세요.')
bak = p.replace('index.html', 'index_v67.bak')
shutil.copy(p, bak)
open(p, 'w', encoding='utf-8').write(s)
print(f'완료. 백업: {os.path.basename(bak)}')
