"""持ち主が用意した UI の見本画像(Downloads/nigatecho_ref_1〜5_941x1672.png)から絵を切り出し、背景(縁につながる薄い色)を透明にする。
python scripts/make_redesign_assets.py → src/assets/ill/*.webp(試験の絵5つ・チューリップ・キャラクター)。2026-10-10"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
D=os.path.join(os.path.expanduser('~'),'Downloads')+'/'
OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'src','assets','ill')+'/'
S=4
# name: (ref, box, edges to flood from, tolerance)
JOBS={
 'exam_kaigo':(2,(279,419,341,495),'tlrb',26),
 'exam_shakai':(2,(279,551,341,615),'tlrb',44),
 'exam_seishin':(2,(279,683,341,755),'tlrb',34),
 'exam_kanri':(2,(279,812,341,882),'tlrb',22),
 'exam_pt':(2,(279,940,341,1028),'tlrb',22),
 'tulip':(1,(219,745,255,797),'tlrb',26),
 'girl_ok':(4,(629,436,706,527),'tlr',22),
 'bird_party':(4,(744,494,891,592),'tlrb',30),
 'woman_cheer':(3,(872,543,925,626),'tlr',22),
 'bird_q':(5,(183,586,246,633),'tlr',14),
 'bird_pencil':(5,(849,644,917,716),'tlr',16),
}
def run(name, ref, box, edges, tol):
    im=Image.open(D+f'nigatecho_ref_{ref}_941x1672.png').convert('RGB').crop(box)
    im=im.resize((im.width*S,im.height*S),Image.LANCZOS)
    a=np.asarray(im).astype(float)
    h,w,_=a.shape
    border=[]
    if 't' in edges: border.append(a[0])
    if 'b' in edges: border.append(a[-1])
    if 'l' in edges: border.append(a[:,0])
    if 'r' in edges: border.append(a[:,-1])
    bg=np.median(np.concatenate(border),axis=0)
    # 背景色からの距離(局所の背景のむらにも追従するため、縁の色の中で最も近い物との距離にはしない)
    dist=np.sqrt(((a-bg)**2).sum(-1))
    near=dist<tol
    lab,_=ndimage.label(near)
    seeds=set()
    if 't' in edges: seeds|=set(lab[0].tolist())
    if 'b' in edges: seeds|=set(lab[-1].tolist())
    if 'l' in edges: seeds|=set(lab[:,0].tolist())
    if 'r' in edges: seeds|=set(lab[:,-1].tolist())
    seeds.discard(0)
    bgmask=np.isin(lab,list(seeds))
    alpha=np.where(bgmask,0,255).astype(np.uint8)
    am=Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.6))
    im=im.filter(ImageFilter.UnsharpMask(radius=2,percent=60,threshold=2))
    out=im.convert('RGBA'); out.putalpha(am)
    bb=out.getbbox()
    out=out.crop(bb)
    s=min(1,360/max(out.size)); out=out.resize((round(out.width*s),round(out.height*s)),Image.LANCZOS)
    out.save(OUT+name+'.webp',quality=88,method=6)
    return out
for k,(ref,box,e,t) in JOBS.items():
    run(k,ref,box,e,t)
print('ok')
