"""臨床検査技師 iOS 1.1.1 の App Store 用の写真(1290x2796、6枚)。ASO 案(ios_release/promo/ios_aso_plan_2026-10-19.md の4)の順。
python scripts/make_store_ios_rinsho_111.py [URL] [--compose-only]
先に node scripts/use-multi.mjs exams/multi.rinsho.json で組み、開発サーバー(npx vite --port 5297)を出しておく。
撮り方・型・地は make_store_play_rinsho.py と同じ(淡い青の方眼、生成りの地にしない)。値段・「無料」の字があれば止まる。
2枚目は図の問題(第72回 午前 問69 喀痰の Gram 染色標本)。しるしをこの1問だけにして「しるし」から開いて撮る。
出力 store/ios_rinsho_111/1〜6.png"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_store_play_rinsho as P  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

OUT = os.path.join(P.APP, "store", "ios_rinsho_111")
FIG_ID = "72-069"
SHOTS = [
    ("home", "あと何問わからないか、\n毎日【ひと目】でわかる。", "苦手ノートの問題数と、試験日までの日数"),
    ("figure", "顕微鏡写真も心電図も、\n【画像のまま】解ける。", "第68回〜第72回の1,000問"),
    ("stats", "本番なら【何点】か、\nひと目でわかる。", "合格の線と並べて、科目ごとの正答率も"),
    ("explain", "全問に、\n【なぜ違うか】の解説。", "正答の理由と、ほかの選択肢の誤りを1つずつ"),
    ("note", "まちがえた問題が\n【苦手ノート】に残る。", "2回続けて正解すると、ノートから消える"),
    ("plan", "試験日までの\n【1日の目安】を出す。", "苦手とまだ解いていない問題を、試験日までに終える数"),
]


def capture_figure():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_context(**P.VIEW).new_page()
        P.demo(pg)
        pg.evaluate("""(id) => {
            const k = Object.keys(localStorage).find(x => /^CapacitorStorage\.nigatecho\..+\.v1$/.test(x));
            const d = JSON.parse(localStorage.getItem(k)); d.marks = [id]; localStorage.setItem(k, JSON.stringify(d));
        }""", FIG_ID)
        pg.goto(P.URL)
        pg.wait_for_selector(".home")
        pg.click(".tabbar button[data-tab=search]")
        pg.click("button[data-find=marks]")
        pg.wait_for_selector(".choices .choice")
        src = pg.locator(".q-src").text_content()
        assert "第72回" in src and "69" in src, src
        pg.wait_for_function("() => [...document.querySelectorAll('img')].some(i => i.complete && i.naturalWidth > 0 && i.src.includes('72-069'))")
        pg.evaluate("() => window.scrollTo(0, 0)")
        P.snap(pg, "figure")
        b.close()


def compose_all():
    for i, (name, title, sub) in enumerate(SHOTS, 1):
        P.compose(name, title, sub, W=1290, H=2796, phone_w=1000, title_size=92, top=120).save(os.path.join(OUT, f"{i}.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    if "--compose-only" not in sys.argv:
        P.capture()
        capture_figure()
    compose_all()
    from PIL import Image
    for i in range(1, 7):
        assert Image.open(os.path.join(OUT, f"{i}.png")).size == (1290, 2796), i
    print("ok")
