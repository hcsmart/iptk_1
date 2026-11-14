# -*- coding: utf-8 -*-
"""
IPTK MES 도면변환 프로그램 (사무실 PC 에서 실행)  — v358

웹 화면 [도면변환] 에서 올린 DWG(금형 전체 1개 파일, 2D 도면)를 가져와
  1) 도곽(도면 테두리)마다 부품을 찾아 부품별 PDF  →  <제번>_도면PDF.zip
  2) 부품별 가공용 파일  →  <제번>_가공용3D.zip
       STEP/<부품>.step : 윗면 외곽선 + 관통 구멍을 두께만큼 올린 2.5D 솔리드 (단순 판재·블록용, 확인 필요)
       DXF/<부품>.dxf   : 윗면(가공 윤곽) 도형 1:1, 원점 기준
       확인목록.csv     : 부품마다 결과·두께·크기·구멍 수·주의사항
를 만들어 다시 올린다.  AI 를 쓰지 않는 규칙 기반 변환이다.

쓰는 오픈소스: LibreDWG(dwg2dxf, GPL) · ezdxf(MIT) · matplotlib · shapely · CadQuery/OpenCascade(Apache/LGPL)
설치는 setup_windows.bat 이 %TEMP%\\iptk_dwg 에 자동으로 받는다.

실행:  python dwg_agent.py            (계속 대기하며 변환)
       python dwg_agent.py --once     (대기 중인 요청 1건만 처리하고 끝)
       python dwg_agent.py --file 도면.dwg --job 26ILA054A --out 결과폴더   (서버 없이 파일만 변환 — 시험용)
"""
import argparse, configparser, csv, io, json, math, os, re, shutil, socket, subprocess, sys, tempfile, time, traceback, zipfile
from datetime import datetime, timezone

VERSION = "359"
HERE = os.path.dirname(os.path.abspath(__file__))
PART_RE = re.compile(r"^[A-Z]\d{2}[A-Z]$")
PAPER = {"A0": (1189, 841), "A1": (841, 594), "A2": (594, 420), "A3": (420, 297), "A4": (297, 210)}


def log(*a):
    s = datetime.now().strftime("%H:%M:%S") + " " + " ".join(str(x) for x in a)
    print(s, flush=True)
    try:
        with open(os.path.join(work_dir(), "dwg_agent.log"), "a", encoding="utf-8") as f:
            f.write(s + "\n")
    except Exception:
        pass


def work_dir():
    d = os.environ.get("IPTK_DWG_HOME") or os.path.join(tempfile.gettempdir(), "iptk_dwg")
    os.makedirs(d, exist_ok=True)
    return d


# ───────────────────────── 서버(Supabase) ─────────────────────────
class Server:
    def __init__(self, cfg):
        import requests
        self.rq = requests
        self.url = cfg["url"].rstrip("/")
        self.key = cfg["key"]
        self.user = cfg["user"]
        self.pw = cfg["password"]
        self.tok = None
        self.refresh = None
        self.exp = 0

    def _h(self, extra=None):
        h = {"apikey": self.key, "Authorization": "Bearer " + (self.tok or self.key)}
        if extra:
            h.update(extra)
        return h

    def login(self):
        email = self.user
        if "@" not in email:   # 이름/아이디 → 이메일 (웹 로그인과 같은 방식)
            r = self.rq.post(self.url + "/rest/v1/rpc/login_email", headers=self._h({"Content-Type": "application/json"}),
                             json={"p_name": email}, timeout=30)
            r.raise_for_status()
            email = r.json()
            if not email:
                raise RuntimeError("등록되지 않은 사용자입니다: " + self.user)
        r = self.rq.post(self.url + "/auth/v1/token?grant_type=password", headers={"apikey": self.key, "Content-Type": "application/json"},
                         json={"email": email, "password": self.pw}, timeout=30)
        if r.status_code >= 400:
            raise RuntimeError("로그인 실패 — config.ini 의 아이디/비밀번호를 확인하세요 (" + r.text[:120] + ")")
        self._take(r.json())

    def _take(self, j):
        self.tok = j["access_token"]
        self.refresh = j.get("refresh_token")
        self.exp = time.time() + int(j.get("expires_in", 3600)) - 120

    def ensure(self):
        if self.tok and time.time() < self.exp:
            return
        if self.refresh:
            try:
                r = self.rq.post(self.url + "/auth/v1/token?grant_type=refresh_token", headers={"apikey": self.key, "Content-Type": "application/json"},
                                 json={"refresh_token": self.refresh}, timeout=30)
                if r.status_code < 400:
                    return self._take(r.json())
            except Exception:
                pass
        self.login()

    def get(self, path):
        self.ensure()
        r = self.rq.get(self.url + "/rest/v1/" + path, headers=self._h(), timeout=60)
        r.raise_for_status()
        return r.json()

    def patch(self, table, match, body, ret=False):
        self.ensure()
        q = "&".join("%s=eq.%s" % (k, v) for k, v in match.items())
        r = self.rq.patch(self.url + "/rest/v1/%s?%s" % (table, q), headers=self._h({"Content-Type": "application/json",
                          "Prefer": "return=representation" if ret else "return=minimal"}), json=body, timeout=60)
        r.raise_for_status()
        return r.json() if ret else None

    def upsert(self, table, rows, on):
        self.ensure()
        r = self.rq.post(self.url + "/rest/v1/%s?on_conflict=%s" % (table, on), headers=self._h({"Content-Type": "application/json",
                         "Prefer": "resolution=merge-duplicates,return=minimal"}), json=rows, timeout=60)
        r.raise_for_status()

    def download(self, bucket, path, dest):
        self.ensure()
        r = self.rq.get(self.url + "/storage/v1/object/authenticated/%s/%s" % (bucket, path), headers=self._h(), timeout=600)
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)

    def upload(self, bucket, path, src, ctype):
        self.ensure()
        with open(src, "rb") as f:
            r = self.rq.post(self.url + "/storage/v1/object/%s/%s" % (bucket, path), headers=self._h({"Content-Type": ctype, "x-upsert": "true"}),
                             data=f.read(), timeout=600)
        if r.status_code >= 400:
            raise RuntimeError("결과 올리기 실패: " + r.text[:160])


# ───────────────────────── DWG → DXF ─────────────────────────
def find_dwg2dxf():
    cands = [os.environ.get("DWG2DXF", ""), os.path.join(work_dir(), "libredwg", "dwg2dxf.exe"),
             os.path.join(HERE, "libredwg", "dwg2dxf.exe"), shutil.which("dwg2dxf") or ""]
    for c in cands:
        if c and os.path.exists(c):
            return c
    raise RuntimeError("dwg2dxf(LibreDWG)를 찾지 못했습니다 — setup_windows.bat 을 다시 실행하세요.")


def find_oda():
    """무료 ODA File Converter 가 설치돼 있으면 그 경로 (LibreDWG 가 못 읽는 DWG 대비)"""
    import glob
    for pat in [os.environ.get("ODA_CONVERTER", ""), r"C:\Program Files\ODA\ODAFileConverter*\ODAFileConverter.exe",
                r"C:\Program Files (x86)\ODA\ODAFileConverter*\ODAFileConverter.exe"]:
        for c in sorted(glob.glob(pat)) if pat else []:
            if os.path.exists(c):
                return c
    return None


def dxf_ok(path):
    try:
        doc = load_doc(path)
        return sum(1 for _ in doc.modelspace()) > 0
    except Exception:
        return False


def to_dxf(src, tmp):
    """DWG → DXF. 1순위 LibreDWG(오픈소스), 읽지 못하면 ODA File Converter(무료, 설치된 경우)"""
    if src.lower().endswith(".dxf"):
        return src
    src = os.path.abspath(src)
    out = os.path.abspath(os.path.join(tmp, "in.dxf"))
    err = ""
    try:
        exe = os.path.abspath(find_dwg2dxf())   # LibreDWG 폴더에서 실행(DLL) — 경로는 모두 전체 경로로
        p = subprocess.run([exe, "-y", "-o", out, src], capture_output=True, text=True, timeout=900, cwd=os.path.dirname(exe))
        if os.path.exists(out) and os.path.getsize(out) > 100 and dxf_ok(out):
            return out
        err = (p.stderr or p.stdout or "")[-200:]
    except Exception as ex:
        err = str(ex)
    oda = find_oda()
    if oda:
        log("LibreDWG 로 읽지 못해 ODA File Converter 로 다시 시도")
        di, do = os.path.join(tmp, "oda_in"), os.path.join(tmp, "oda_out")
        os.makedirs(di, exist_ok=True)
        os.makedirs(do, exist_ok=True)
        shutil.copy(src, os.path.join(di, "in.dwg"))
        subprocess.run([oda, di, do, "ACAD2018", "DXF", "0", "1", "*.DWG"], capture_output=True, timeout=900)
        o2 = os.path.join(do, "in.dxf")
        if os.path.exists(o2) and dxf_ok(o2):
            return o2
    raise RuntimeError("DWG 를 읽지 못했습니다. CAD 에서 DXF 로 저장해 올리거나, 무료 ODA File Converter 를 설치해 주세요. (" + err + ")")


def load_doc(path):
    import ezdxf
    from ezdxf import recover
    try:
        doc, auditor = recover.readfile(path)
    except Exception:
        doc = ezdxf.readfile(path)
    return doc


# ───────────────────────── 도곽 찾기 ─────────────────────────
class Box:
    __slots__ = ("x0", "y0", "x1", "y1")

    def __init__(self, x0, y0, x1, y1):
        self.x0, self.y0, self.x1, self.y1 = min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)

    w = property(lambda s: s.x1 - s.x0)
    h = property(lambda s: s.y1 - s.y0)
    area = property(lambda s: (s.x1 - s.x0) * (s.y1 - s.y0))

    def contains(self, b, tol=0.0):
        return b.x0 >= self.x0 - tol and b.y0 >= self.y0 - tol and b.x1 <= self.x1 + tol and b.y1 <= self.y1 + tol

    def __repr__(self):
        return "Box(%.1f,%.1f %.1fx%.1f)" % (self.x0, self.y0, self.w, self.h)


def ebox(e, cache):
    """엔티티 범위 (블록 참조는 펼친 범위)"""
    k = id(e)
    if k in cache:
        return cache[k]
    from ezdxf import bbox
    b = None
    try:
        ext = bbox.extents([e], fast=True)
        if ext.has_data:
            b = Box(ext.extmin.x, ext.extmin.y, ext.extmax.x, ext.extmax.y)
    except Exception:
        b = None
    cache[k] = b
    return b


def paper_of(w, h):
    """도곽 크기 → 가장 가까운 A 용지와 배율 (모형공간 도곽은 배율만큼 커져 있다)"""
    L, S = max(w, h), min(w, h)
    best = None
    for name, (pw, ph) in PAPER.items():
        s = L / pw
        err = abs(S / s - ph) / ph
        if best is None or err < best[2]:
            best = (name, s, err)
    return best


def is_frame(b):
    if b is None or b.w <= 0 or b.h <= 0:
        return False
    r = min(b.w, b.h) / max(b.w, b.h)
    return 0.68 <= r <= 0.73 and paper_of(b.w, b.h)[2] < 0.03   # A 계열 비율 (1:√2)


def find_frames(msp, cache):
    """도곽 후보: A 용지 비율의 닫힌 사각 폴리선 또는 블록 참조. 다른 도곽 안에 든 것(표제란 등)은 뺀다."""
    cands = []
    for e in msp:
        t = e.dxftype()
        if t not in ("INSERT", "LWPOLYLINE", "POLYLINE"):
            continue
        if t != "INSERT":
            try:
                closed = e.closed if t == "LWPOLYLINE" else e.is_closed
                n = len(e) if t == "LWPOLYLINE" else len(list(e.vertices))
            except Exception:
                continue
            if not closed or n not in (4, 5):
                continue
        b = ebox(e, cache)
        if is_frame(b):
            cands.append((b, e))
    cands.sort(key=lambda x: -x[0].area)
    out = []
    for b, e in cands:
        if any(o[0].contains(b, tol=max(o[0].w, o[0].h) * 0.002) for o in out):
            continue
        out.append((b, e))
    # 너무 작은 것(가장 큰 도곽의 1/40 미만)은 상세도 테두리 등으로 보고 제외
    if out:
        big = out[0][0].area
        out = [x for x in out if x[0].area >= big / 40.0]
    return out


def texts_in(msp, box, cache):
    """도곽 안의 글자 (블록 속성·블록 안 글자 포함): (문자열, x, y)"""
    res = []

    def add(s, p):
        s = re.sub(r"\\[A-Za-z][^;]*;|[{}]", "", str(s or "")).strip()
        if s:
            res.append((s, p[0], p[1]))

    for e in msp:
        t = e.dxftype()
        try:
            if t in ("TEXT", "MTEXT"):
                p = e.dxf.insert
                if box.x0 <= p.x <= box.x1 and box.y0 <= p.y <= box.y1:
                    add(e.plain_text() if t == "MTEXT" else e.dxf.text, (p.x, p.y))
            elif t == "INSERT":
                b = ebox(e, cache)
                if b is None or not (box.x0 - 1 <= b.x0 and b.x1 <= box.x1 + 1 and box.y0 - 1 <= b.y0 and b.y1 <= box.y1 + 1):
                    continue
                for a in e.attribs:
                    add(a.dxf.text, (a.dxf.insert.x, a.dxf.insert.y))
                for v in e.virtual_entities():
                    if v.dxftype() in ("TEXT", "MTEXT"):
                        add(v.plain_text() if v.dxftype() == "MTEXT" else v.dxf.text, (v.dxf.insert.x, v.dxf.insert.y))
        except Exception:
            continue
    return res


def part_of_frame(texts, box, parts):
    """도곽 안 글자 중 금형번호 — PartList 목록에 있는 번호 우선, 표제란(오른쪽 아래)에 가까운 것"""
    hits = []
    for s, x, y in texts:
        for tok in re.split(r"[\s,/()\[\]]+", s.upper()):
            if PART_RE.match(tok):
                known = tok in parts
                d = math.hypot(box.x1 - x, y - box.y0) / max(box.w, box.h)
                hits.append((0 if known else 1, d, tok))
    if not hits:
        return None
    hits.sort()
    return hits[0][2]


# ───────────────────────── PDF ─────────────────────────
def render_pdf(doc, layout, box, filt, dest, paper_name):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from ezdxf.addons.drawing import RenderContext, Frontend
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
    from ezdxf.addons.drawing.config import Configuration, ColorPolicy, BackgroundPolicy
    pw, ph = PAPER.get(paper_name, (box.w, box.h))
    if box.h > box.w:
        pw, ph = ph, pw
    fig = plt.figure(figsize=(pw / 25.4, ph / 25.4))
    ax = fig.add_axes([0, 0, 1, 1])
    cfg = Configuration(color_policy=ColorPolicy.BLACK, background_policy=BackgroundPolicy.WHITE, lineweight_scaling=0.6)
    ctx = RenderContext(doc)
    out = MatplotlibBackend(ax)
    Frontend(ctx, out, config=cfg).draw_layout(layout, finalize=True, filter_func=filt)
    m = max(box.w, box.h) * 0.004
    ax.set_xlim(box.x0 - m, box.x1 + m)
    ax.set_ylim(box.y0 - m, box.y1 + m)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")
    fig.savefig(dest, format="pdf", facecolor="white")
    plt.close(fig)


# ───────────────────────── 윗면 찾기 · 2.5D ─────────────────────────
SKIP_TYPES = {"TEXT", "MTEXT", "DIMENSION", "HATCH", "LEADER", "MULTILEADER", "MLEADER", "ATTDEF", "ATTRIB", "POINT", "SOLID", "WIPEOUT", "IMAGE", "TOLERANCE", "VIEWPORT", "RAY", "XLINE"}
GEOM_TYPES = {"LINE", "ARC", "CIRCLE", "LWPOLYLINE", "POLYLINE", "ELLIPSE", "SPLINE"}


def solid_line(doc, e):
    """실선만 (숨은선·중심선·가상선 제외)"""
    try:
        lt = (e.dxf.get("linetype") or "BYLAYER").upper()
        if lt == "BYLAYER":
            lay = doc.layers.get(e.dxf.layer)
            lt = (lay.dxf.linetype if lay else "CONTINUOUS").upper()
        if lt == "BYBLOCK":
            lt = "CONTINUOUS"
        lay = (e.dxf.layer or "").upper()
        if any(k in lay for k in ("DIM", "치수", "HATCH", "CEN", "중심", "HID", "숨은", "TEXT", "문자", "TITLE", "BORDER", "도곽")):
            return False
        return lt in ("CONTINUOUS", "") or not any(k in lt for k in ("HID", "DASH", "CENT", "PHAN", "DOT", "DIVIDE", "BORDER"))
    except Exception:
        return True


def frame_geometry(doc, msp, box, frame_ent, cache):
    """도곽 안의 실선 도형 (도곽·표제란처럼 도곽 테두리에 붙은 것 제외)"""
    out = []
    tol = max(box.w, box.h) * 0.01
    for e in msp:
        if e is frame_ent:
            continue
        t = e.dxftype()
        if t not in GEOM_TYPES:
            continue
        b = ebox(e, cache)
        if b is None or not box.contains(b, tol=0.5):
            continue
        if not solid_line(doc, e):
            continue
        touch = (b.x0 - box.x0 < tol) or (box.x1 - b.x1 < tol) or (b.y0 - box.y0 < tol) or (box.y1 - b.y1 < tol)
        if touch:
            continue
        out.append((e, b))
    return out


def clusters(items, gap):
    """가까운 도형끼리 묶어 '뷰' 로 나눈다"""
    n = len(items)
    parent = list(range(n))

    def f(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    order = sorted(range(n), key=lambda i: items[i][1].x0)
    for a_i, a in enumerate(order):
        ba = items[a][1]
        for b in order[a_i + 1:]:
            bb = items[b][1]
            if bb.x0 > ba.x1 + gap:
                break
            if bb.y0 <= ba.y1 + gap and ba.y0 <= bb.y1 + gap:
                parent[f(a)] = f(b)
    g = {}
    for i in range(n):
        g.setdefault(f(i), []).append(items[i])
    res = []
    for mem in g.values():
        bx = Box(min(m[1].x0 for m in mem), min(m[1].y0 for m in mem), max(m[1].x1 for m in mem), max(m[1].y1 for m in mem))
        res.append((bx, [m[0] for m in mem]))
    res.sort(key=lambda x: -x[0].area)
    return res


def spec_dims(row):
    nums = []
    for k in ("spec",):
        s = str((row or {}).get(k) or "")
        nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", s)]
    t = (row or {}).get("thickness_dia")
    try:
        t = float(t) if t not in (None, "") else None
    except Exception:
        t = None
    return nums, t


def pick_top_view(views, nums, t):
    """윗면 = 크기가 규격의 두 큰 치수(가로·세로)와 맞는 뷰. 맞는 게 없으면 가장 큰 뷰"""
    if not views:
        return None, None, "뷰 없음"
    dims = sorted([x for x in nums if x > 0], reverse=True)
    if t is None and len(dims) >= 3:
        t = dims[2]
    if len(dims) >= 2:
        # 원형 부품(펀치·핀): 원만 있는 뷰의 지름이 규격 치수 하나와 맞으면 그 뷰가 윗면, 나머지 큰 치수가 길이
        for bx, ents in views:
            if ents and all(e.dxftype() == "CIRCLE" for e in ents) and abs(bx.w - bx.h) / max(bx.w, bx.h) < 0.01:
                D = bx.w
                rest = [x for x in dims if abs(x - D) / D >= 0.01]
                if len(rest) < len(dims) and rest:
                    return (bx, ents), rest[0], ""
        L, W = dims[0], dims[1]
        best = None
        for bx, ents in views:
            a, b = sorted([bx.w, bx.h], reverse=True)
            err = abs(a - L) / L + abs(b - W) / W
            if best is None or err < best[0]:
                best = (err, bx, ents)
        if best and best[0] < 0.06:
            return best[1:], t, ""
        return (views[0][0], views[0][1]), t, "규격(%s)과 맞는 뷰가 없어 가장 큰 뷰를 윗면으로 씀" % "×".join("%g" % d for d in dims[:3])
    return (views[0][0], views[0][1]), t, "규격 치수가 없어 가장 큰 뷰를 윗면으로 씀"


def view_polygon(ents):
    """윗면 도형 → (바깥 외곽 고리, 구멍 고리 목록, 원 목록, 메모).
    바깥 외곽 = 모든 닫힌 면을 합친 테두리. 구멍 = 바깥 외곽선에 닿지 않는 닫힌 선 덩어리(그 바깥 테두리).
    구멍 안의 구멍(카운터보어 안쪽 원 등)은 뺀다. 원은 원 그대로 기억해 STEP 에서 진짜 원으로 만든다"""
    from ezdxf import path as zpath
    from shapely.geometry import LineString, Point, Polygon
    from shapely.ops import polygonize, unary_union
    geoms, circles, plines = [], [], []
    for e in ents:
        if e.dxftype() == "LWPOLYLINE" and e.closed and len(e) >= 2:
            try:
                fl = [(v.x, v.y) for v in zpath.make_path(e).flattening(0.005)]
                plines.append(([(float(x), float(y), float(b)) for x, y, b in e.get_points("xyb")], fl))
            except Exception:
                pass
        if e.dxftype() == "CIRCLE":
            c = e.dxf.center
            circles.append((c.x, c.y, e.dxf.radius))
            geoms.append(Point(c.x, c.y).buffer(e.dxf.radius, quad_segs=64).exterior)
            continue
        try:
            pts = [(v.x, v.y) for v in zpath.make_path(e).flattening(0.005)]
            if len(pts) >= 2:
                geoms.append(LineString(pts))
        except Exception:
            continue
    if not geoms:
        return None, [], circles, "윤곽선 없음", []
    faces = list(polygonize(unary_union(geoms)))
    if not faces:
        return None, [], circles, "닫힌 외곽선을 찾지 못함", []
    shape = unary_union(faces)
    if shape.geom_type == "MultiPolygon":
        shape = max(shape.geoms, key=lambda g: g.area)
    outer = Polygon(shape.exterior)
    # 서로 닿는 선끼리 묶기
    n = len(geoms)
    par = list(range(n))

    def f(i):
        while par[i] != i:
            par[i] = par[par[i]]
            i = par[i]
        return i

    for i in range(n):
        for j in range(i + 1, n):
            if geoms[i].distance(geoms[j]) < 1e-3:
                par[f(i)] = f(j)
    comp = {}
    for i in range(n):
        comp.setdefault(f(i), []).append(geoms[i])
    tol = 1e-3
    holes = []
    for gs in comp.values():
        u = unary_union(gs)
        if u.distance(outer.exterior) < tol or not outer.contains(u):
            continue
        fs = list(polygonize(u))
        if not fs:
            continue
        hp = unary_union(fs)
        if hp.geom_type == "MultiPolygon":
            hp = max(hp.geoms, key=lambda g: g.area)
        holes.append(Polygon(hp.exterior))
    holes.sort(key=lambda h: -h.area)
    keep = []
    for h in holes:
        if not any(k.contains(h) for k in keep):
            keep.append(h)
    rings = [list(outer.exterior.coords)[:-1]] + [list(h.exterior.coords)[:-1] for h in keep]
    exact = [match_pline(r, plines) for r in rings]   # 닫힌 폴리선과 같은 고리면 원래 꼭짓점·호(bulge) 그대로
    return rings[0], rings[1:], circles, "", exact


def bulge_mid(p, q, b):
    """bulge 호의 가운데 점 (b>0 = 반시계)"""
    dx, dy = q[0] - p[0], q[1] - p[1]
    c = math.hypot(dx, dy)
    h = b * c / 2.0
    return ((p[0] + q[0]) / 2 + dy / c * h, (p[1] + q[1]) / 2 - dx / c * h)


def match_pline(ring, plines):
    """고리(ring)와 같은 모양의 닫힌 폴리선이 있으면 그 꼭짓점·bulge 목록"""
    from shapely.geometry import Polygon
    try:
        rp = Polygon(ring)
        if not rp.is_valid or rp.area <= 0:
            return None
    except Exception:
        return None
    for pl, fl in plines:
        try:
            pp = Polygon(fl)
            if pp.is_valid and pp.symmetric_difference(rp).area / rp.area < 0.005:
                return pl
        except Exception:
            continue
    return None


def pline_wp(pl, z=0):
    import cadquery as cq
    wp = cq.Workplane("XY").moveTo(pl[0][0], pl[0][1])
    n = len(pl)
    for i in range(n):
        x, y, b = pl[i]
        q = pl[(i + 1) % n]
        if abs(b) > 1e-9:
            wp = wp.threePointArc(bulge_mid((x, y), (q[0], q[1]), b), (q[0], q[1]))
        elif i < n - 1:
            wp = wp.lineTo(q[0], q[1])
    return wp.close()


def as_circle(pts, circles):
    """고리가 원이면 (cx, cy, r) — 도면의 원과 맞으면 그 원의 정확한 값"""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    rs = [math.hypot(p[0] - cx, p[1] - cy) for p in pts]
    r = sum(rs) / len(rs)
    if r <= 0 or (max(rs) - min(rs)) / r > 0.02 or len(pts) < 16:
        return None
    c = min(circles, key=lambda c: abs(c[0] - cx) + abs(c[1] - cy) + abs(c[2] - r), default=None)
    if c and abs(c[2] - r) / r < 0.02 and math.hypot(c[0] - cx, c[1] - cy) < r * 0.02:
        return c
    return (cx, cy, r)


def make_step(outer, holes, circles, t, dest, exact=None):
    """2.5D 솔리드: 외곽을 두께만큼 올리고 구멍을 관통. 원은 진짜 원, 닫힌 폴리선은 원래 선·호 그대로(곡면)"""
    import cadquery as cq
    exact = exact or [None] * (1 + len(holes))

    def body(ring, ex):
        c = as_circle(ring, circles)
        if c:
            return cq.Workplane("XY").center(c[0], c[1]).circle(c[2]).extrude(t)
        if ex:
            try:
                return pline_wp(ex).extrude(t)
            except Exception:
                pass
        return cq.Workplane("XY").polyline(simplify(ring)).close().extrude(t)

    wp = body(outer, exact[0])
    for h, ex in zip(holes, exact[1:]):
        wp = wp.cut(body(h, ex))
    cq.exporters.export(wp, dest)
    return len(holes)


def simplify(ring, tol=0.002):
    from shapely.geometry import Polygon
    try:
        p = Polygon(ring).simplify(tol, preserve_topology=True)
        return list(p.exterior.coords)[:-1]
    except Exception:
        return ring


def nested_circles(circles):
    """같은 중심에 원이 2개 이상 → 카운터보어·단차 구멍일 수 있음"""
    seen = {}
    for x, y, r in circles:
        k = (round(x, 2), round(y, 2))
        seen[k] = seen.get(k, 0) + 1
    return sum(1 for v in seen.values() if v > 1)


def write_dxf(doc, ents, box, dest):
    import ezdxf
    from ezdxf.addons import Importer
    from ezdxf.math import Matrix44
    nd = ezdxf.new("R2010", setup=True)
    nd.units = doc.units if doc.units else 4
    imp = Importer(doc, nd)
    imp.import_entities(ents, nd.modelspace())
    imp.finalize()
    m = Matrix44.translate(-box.x0, -box.y0, 0)
    for e in nd.modelspace():
        try:
            e.transform(m)
        except Exception:
            pass
    nd.saveas(dest)


# ───────────────────────── 변환 전체 ─────────────────────────
def undup(s):
    """'BUTTON, DIE BUTTON, DIE' 처럼 같은 말이 두 번 붙은 품명 → 'BUTTON, DIE'"""
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    n = len(s)
    if n > 2 and n % 2 == 1 and s[n // 2] == " " and s[:n // 2] == s[n // 2 + 1:]:
        return s[:n // 2]
    return s


def safe(s):
    return re.sub(r"[^\w\-가-힣.]+", "_", str(s or "")).strip("_")[:60]


def convert(src, job, parts_rows, out_dir):
    """src(DWG/DXF) → out_dir 에 PDF zip · 가공용 zip. 결과 요약 dict"""
    tmp = tempfile.mkdtemp(prefix="cv_", dir=work_dir())
    try:
        dxf = to_dxf(src, tmp)
        doc = load_doc(dxf)
        msp = doc.modelspace()
        cache = {}
        parts = {str(r.get("part_no") or "").upper(): r for r in parts_rows if r.get("part_no")}
        frames = find_frames(msp, cache)
        log("도곽", len(frames), "개")
        pdf_dir = os.path.join(tmp, "pdf")
        step_dir = os.path.join(tmp, "cad", "STEP")
        dxf_dir = os.path.join(tmp, "cad", "DXF")
        for d in (pdf_dir, step_dir, dxf_dir):
            os.makedirs(d, exist_ok=True)
        rows = []
        if not frames:
            ext = None
            from ezdxf import bbox
            e2 = bbox.extents(msp, fast=True)
            if e2.has_data:
                ext = Box(e2.extmin.x, e2.extmin.y, e2.extmax.x, e2.extmax.y)
            if ext is None:
                raise RuntimeError("도면에 그려진 것이 없습니다.")
            frames = [(ext, None)]
            log("도곽을 찾지 못해 도면 전체를 한 장으로 처리")
        used = {}
        for i, (box, fe) in enumerate(frames, 1):
            pn = part_of_frame(texts_in(msp, box, cache), box, parts) if fe is not None else None
            key = pn or ("SHEET%02d" % i)
            used[key] = used.get(key, 0) + 1
            name = key if used[key] == 1 else "%s_%d" % (key, used[key])
            row = parts.get(pn or "", {})
            pname = safe(undup(row.get("part_name") or ""))
            paper = paper_of(box.w, box.h)[0]
            note = []
            # PDF
            pdf_name = "%s%s_%s.pdf" % (name, ("_" + pname) if pname else "", paper)
            try:
                render_pdf(doc, msp, box, lambda e, b=box: (ebox(e, cache) is not None and b.contains(ebox(e, cache), tol=1.0)), os.path.join(pdf_dir, pdf_name), paper)
            except Exception as ex:
                note.append("PDF 실패: %s" % ex)
            # 윗면 · DXF · STEP
            st, th, ow, oh, nh = "확인 필요", "", "", "", ""
            if fe is not None or len(frames) == 1:
                geo = frame_geometry(doc, msp, box, fe, cache)
                views = clusters(geo, gap=max(box.w, box.h) * 0.012)
                nums, t = spec_dims(row)
                top, t, why = pick_top_view(views, nums, t)
                if why:
                    note.append(why)
                if top:
                    tb, tents = top
                    ow, oh = "%.2f" % tb.w, "%.2f" % tb.h
                    try:
                        write_dxf(doc, tents, tb, os.path.join(dxf_dir, name + ".dxf"))
                    except Exception as ex:
                        note.append("DXF 실패: %s" % ex)
                    outer, holes, circles, why2, exact = view_polygon(tents)
                    if why2:
                        note.append(why2)
                    shape = outer
                    if shape is not None and t and t > 0:
                        try:
                            h = make_step(outer, holes, circles, t, os.path.join(step_dir, name + ".step"), exact)
                            th, nh = "%g" % t, str(h)
                            if nested_circles(circles):
                                note.append("같은 중심 원 %d곳 — 카운터보어·단차는 관통구멍(큰 지름)으로 만들었으니 확인" % nested_circles(circles))
                            if not why:
                                st = "자동 (2.5D)"
                        except Exception as ex:
                            note.append("STEP 실패: %s" % str(ex)[:80])
                    elif shape is not None:
                        note.append("두께를 알 수 없어 STEP 은 만들지 않음 (PartList 규격·두께 확인)")
            if not pn:
                note.append("도곽에서 금형번호를 찾지 못함")
            rows.append({"부품": name, "품명": undup(row.get("part_name") or ""), "용지": paper, "결과": st, "두께": th, "윗면 가로": ow, "윗면 세로": oh,
                         "구멍 수": nh, "주의": " / ".join(note)})
            log(" ", name, paper, st, (" / ".join(note))[:120])
        # 확인목록
        with open(os.path.join(tmp, "cad", "확인목록.csv"), "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        with open(os.path.join(tmp, "cad", "읽어주세요.txt"), "w", encoding="utf-8") as f:
            f.write("IPTK MES 도면변환 결과 (%s)\n\n" % job +
                    "STEP: 2D 도면의 윗면 외곽선과 관통 구멍을 두께만큼 올린 2.5D 솔리드입니다.\n"
                    "      포켓 깊이·카운터보어·탭·경사면·라운드 등은 반영되지 않으니 가공 전에 반드시 도면과 대조하세요.\n"
                    "DXF : 윗면(가공 윤곽) 도형을 1:1, 왼쪽 아래 원점으로 옮긴 것입니다.\n"
                    "확인목록.csv: 부품마다 결과와 주의사항.\n")
        os.makedirs(out_dir, exist_ok=True)
        pz = os.path.join(out_dir, "%s_도면PDF.zip" % safe(job))
        cz = os.path.join(out_dir, "%s_가공용3D.zip" % safe(job))
        _zip(pdf_dir, pz)
        _zip(os.path.join(tmp, "cad"), cz)
        auto = sum(1 for r in rows if r["결과"].startswith("자동"))
        return {"sheets": len(rows), "step_auto": auto, "step_files": len(os.listdir(step_dir)), "dxf_files": len(os.listdir(dxf_dir)),
                "pdf_files": len(os.listdir(pdf_dir)), "rows": rows, "pdf_zip": pz, "cad_zip": cz}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _zip(folder, dest):
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(folder):
            for fn in sorted(files):
                full = os.path.join(root, fn)
                z.write(full, os.path.relpath(full, folder))


# ───────────────────────── 대기 · 처리 ─────────────────────────
BUCKET = "mes-drawing"
TABLE = "dwg_convert_jobs"


def now():
    return datetime.now(timezone.utc).isoformat()


def heartbeat(sv, state):
    try:
        sv.upsert("page_state", [{"page": "cfg:dwg_agent", "data": {"last_seen": now(), "host": socket.gethostname(), "version": VERSION, "state": state}}], "page")
    except Exception as ex:
        log("상태 알림 실패:", ex)


def parts_of(sv, job):
    rows = []
    for t in ("partlist_materials", "partlist_purchases"):
        try:
            rows += sv.get("%s?select=part_no,part_name,spec,thickness_dia&job_no=eq.%s" % (t, job))
        except Exception:
            pass
    return rows


def process_one(sv):
    rs = sv.get("%s?select=*&status=eq.waiting&order=created_at&limit=1" % TABLE)
    if not rs:
        return False
    j = rs[0]
    got = sv.patch(TABLE, {"id": j["id"], "status": "waiting"}, {"status": "working", "message": "변환 중 (%s)" % socket.gethostname(), "started_at": now()}, ret=True)
    if not got:
        return True   # 다른 PC 가 먼저 가져감
    log("변환 시작", j["id"], j.get("job_no"), j.get("src_name"))
    heartbeat(sv, "working")
    tmp = tempfile.mkdtemp(prefix="job_", dir=work_dir())
    try:
        ext = os.path.splitext(j.get("src_name") or "a.dwg")[1].lower() or ".dwg"
        src = os.path.join(tmp, "src" + ext)
        sv.download(BUCKET, j["src_path"], src)
        res = convert(src, j["job_no"], parts_of(sv, j["job_no"]), os.path.join(tmp, "out"))
        base = "convert/%s/" % j["id"]
        sv.upload(BUCKET, base + "pdf.zip", res["pdf_zip"], "application/zip")
        sv.upload(BUCKET, base + "cad.zip", res["cad_zip"], "application/zip")
        summary = {k: res[k] for k in ("sheets", "step_auto", "step_files", "dxf_files", "pdf_files")}
        summary["rows"] = res["rows"][:300]
        msg = "도곽 %d장 → PDF %d · STEP %d (자동 %d) · DXF %d" % (res["sheets"], res["pdf_files"], res["step_files"], res["step_auto"], res["dxf_files"])
        sv.patch(TABLE, {"id": j["id"]}, {"status": "done", "message": msg, "pdf_path": base + "pdf.zip", "cad_path": base + "cad.zip",
                                          "summary": summary, "finished_at": now()})
        log("완료", msg)
    except Exception as ex:
        log("실패", ex)
        traceback.print_exc()
        try:
            sv.patch(TABLE, {"id": j["id"]}, {"status": "error", "message": str(ex)[:400], "finished_at": now()})
        except Exception:
            pass
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        heartbeat(sv, "idle")   # 끝나면 바로 '대기' 로
    return True


def read_cfg():
    p = os.path.join(HERE, "config.ini")
    c = configparser.ConfigParser()
    if not c.read(p, encoding="utf-8"):
        raise SystemExit("config.ini 가 없습니다 — config.sample.ini 를 config.ini 로 복사해 아이디/비밀번호를 적으세요.")
    s = c["server"]
    for k in ("url", "key", "user", "password"):
        if not s.get(k) or "여기에" in s.get(k):
            raise SystemExit("config.ini 의 [server] %s 를 채우세요." % k)
    return {k: s.get(k).strip() for k in ("url", "key", "user", "password")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--file")
    ap.add_argument("--job", default="TEST")
    ap.add_argument("--parts", help="시험용: 부품 목록 JSON 파일")
    ap.add_argument("--out", default=".")
    a = ap.parse_args()
    if a.file:
        rows = json.load(open(a.parts, encoding="utf-8")) if a.parts else []
        res = convert(a.file, a.job, rows, a.out)
        print(json.dumps({k: v for k, v in res.items() if k != "rows"}, ensure_ascii=False))
        for r in res["rows"]:
            print(r)
        return
    sv = Server(read_cfg())
    sv.login()
    log("도면변환 프로그램 v%s 시작 — 웹 [도면변환] 화면에서 DWG 를 올리면 여기서 변환합니다. (끝내려면 이 창을 닫으세요)" % VERSION)
    last_hb = 0
    while True:
        try:
            if time.time() - last_hb > 30:
                heartbeat(sv, "idle")
                last_hb = time.time()
            did = process_one(sv)
            if a.once:
                break
            if not did:
                time.sleep(5)
        except KeyboardInterrupt:
            break
        except Exception as ex:
            log("오류 (30초 뒤 다시 시도):", ex)
            time.sleep(30)


if __name__ == "__main__":
    main()
