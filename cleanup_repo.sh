#!/bin/bash
# iptk 저장소 정리 — Git Bash 에서 저장소 루트로 이동 후 실행: bash cleanup_repo.sh
set -e

# 1) HTML/JS 어디에서도 참조하지 않는 JSON 80개 (초기 화면캡쳐 기반 예시 데이터)
git rm -q --cached '*.json'
rm -f *.json

# 2) 메뉴에서 빠졌거나 중복/구버전 사본
git rm -q --cached \
  index-1.html \
  "sale_order_input .html" \
  sale_order_input_.html \
  audit_log_inquiry.html \
  vendor_master_setup.html \
  sim_sales.js mes_flow_sim.js mes_logic_check.js \
  mes_audit.py sq_fix_v66.sql 2>/dev/null || true
rm -f index-1.html "sale_order_input .html" sale_order_input_.html audit_log_inquiry.html vendor_master_setup.html \
      sim_sales.js mes_flow_sim.js mes_logic_check.js mes_audit.py sq_fix_v66.sql

# 3) 앞으로 실수로 올라가지 않게
cat > .gitignore <<'EOF'
*.json
*.zip
*.py
*.sql
sim_*.js
*_bak*.html
*-1.html
EOF
git add .gitignore

git commit -qm "repo cleanup: remove unused json/backup/sim files"
echo "done. 확인 후: git push"
