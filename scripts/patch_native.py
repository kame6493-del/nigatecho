"""ネイティブ設定を書き換える。python scripts/patch_native.py kanri(試験を選べる版は python scripts/patch_native.py multi)
(iPhone専用・縦固定・日本語・暗号化の申告・ホーム画面の名前)。
何度流しても同じ結果になる。npx cap add の直後に1回流す。広告は入れていないので、カチマケの広告まわりは無い。"""
from pathlib import Path

import json, sys
APP = Path(__file__).resolve().parent.parent
if sys.argv[1] == "multi":
    # 試験を選べる版: 殻は exams/multi.json の appExam(公開中の管理栄養士のアプリ)、ホーム画面の名前は multi.json の homeName
    MULTI = json.loads((APP / "exams" / "multi.json").read_text(encoding="utf-8"))
    ROOT = APP / "exams" / MULTI["appExam"]
    HOME_NAME = MULTI.get("homeName") or json.loads((ROOT / "exam.json").read_text(encoding="utf-8"))["homeName"]
else:
    ROOT = APP / "exams" / sys.argv[1]
    HOME_NAME = json.loads((ROOT / "exam.json").read_text(encoding="utf-8"))["homeName"]


def patch(path: Path, pairs):
    s = path.read_text(encoding="utf-8")
    for old, new in pairs:
        if new in s:
            continue
        assert old in s, (path.name, old[:60])
        s = s.replace(old, new, 1)
    path.write_text(s, encoding="utf-8", newline="\n")


# ---------- Android ----------
patch(ROOT / "android/app/src/main/AndroidManifest.xml", [
    ('            android:launchMode="singleTask"\n',
     '            android:launchMode="singleTask"\n            android:screenOrientation="portrait"\n'),
])
strings = ROOT / "android/app/src/main/res/values/strings.xml"
s = strings.read_text(encoding="utf-8")
import re
s = re.sub(r'<string name="app_name">[^<]*</string>', f'<string name="app_name">{HOME_NAME}</string>', s)
s = re.sub(r'<string name="title_activity_main">[^<]*</string>', f'<string name="title_activity_main">{HOME_NAME}</string>', s)
strings.write_text(s, encoding="utf-8", newline="\n")

# ---------- iOS ----------
plist = ROOT / "ios/App/App/Info.plist"
s = plist.read_text(encoding="utf-8")
s = re.sub(r"(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)", rf"\g<1>{HOME_NAME}\g<2>", s)
plist.write_text(s, encoding="utf-8", newline="\n")
patch(plist, [
    ("\t<key>CFBundleDevelopmentRegion</key>\n\t<string>en</string>",
     "\t<key>CFBundleDevelopmentRegion</key>\n\t<string>ja</string>"),
    ("\t<key>LSRequiresIPhoneOS</key>\n",
     "\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n\t<key>LSRequiresIPhoneOS</key>\n"),
    ("\t\t<string>armv7</string>", "\t\t<string>arm64</string>"),
    ("\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n\t</array>",
     "\t<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>"),
])
pbx = ROOT / "ios/App/App.xcodeproj/project.pbxproj"
s = pbx.read_text(encoding="utf-8")
s = s.replace('TARGETED_DEVICE_FAMILY = "1,2";', "TARGETED_DEVICE_FAMILY = 1;").replace("MARKETING_VERSION = 1.0;", "MARKETING_VERSION = 1.0.0;")
pbx.write_text(s, encoding="utf-8", newline="\n")
print("ok")
