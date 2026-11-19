# Draws the synthwave app icons. Run by the deploy workflow: python3 scripts/make_icons.py icons
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import sys, glob
out = sys.argv[1] if len(sys.argv) > 1 else 'icons'
import os; os.makedirs(out, exist_ok=True)
fonts = glob.glob("/usr/share/fonts/**/DejaVuSans-Bold.ttf", recursive=True) + glob.glob("/usr/share/fonts/**/*Bold.ttf", recursive=True)
def make(size, pad_frac):
    S = size*4
    img = Image.new('RGBA', (S,S), (13,2,33,255))
    d = ImageDraw.Draw(img)
    # background gradient
    for y in range(S):
        t = y/S
        r = int(13+(60-13)*(1-abs(t-.55)*1.6)); g=int(2+10*(1-t)); b=int(33+(110-33)*(1-abs(t-.55)*1.6))
        d.line([(0,y),(S,y)], fill=(max(r,13),g,max(b,33),255))
    inner = S*(1-2*pad_frac)
    cx, cy, R = S/2, S/2 - inner*0.06, inner*0.36
    sun = Image.new('RGBA',(S,S),(0,0,0,0)); sd = ImageDraw.Draw(sun)
    top, bot = cy-R, cy+R
    for y in range(int(top), int(bot)):
        t=(y-top)/(2*R)
        stops=[(249,200,14),(255,108,17),(255,43,214),(123,44,191)]
        seg=min(int(t*3),2); f=t*3-seg
        a,bb=stops[seg],stops[seg+1]
        col=tuple(int(a[i]+(bb[i]-a[i])*f) for i in range(3))
        if t>0.5 and int((y-top)/(inner*0.035))%2==1: continue
        dx=max(0.0,R*R-(y-cy)**2)**0.5
        sd.line([(cx-dx,y),(cx+dx,y)], fill=col+(255,))
    glow = sun.filter(ImageFilter.GaussianBlur(S*0.03))
    img.alpha_composite(glow); img.alpha_composite(sun)
    # grid floor
    gy = cy+R*0.95
    d=ImageDraw.Draw(img)
    for i in range(6):
        y = gy + (S-gy)*(i/5)**1.6
        d.line([(0,y),(S,y)], fill=(255,43,214,200), width=max(2,S//200))
    for i in range(-6,7):
        d.line([(cx+i*S*0.04,gy),(cx+i*S*0.25,S)], fill=(255,43,214,170), width=max(2,S//220))
    # text
    font = ImageFont.truetype(fonts[0], int(inner*0.34)) if fonts else ImageFont.load_default(size=int(inner*0.34))
    txt="JP"
    tl = Image.new('RGBA',(S,S),(0,0,0,0)); td=ImageDraw.Draw(tl)
    bbox=td.textbbox((0,0),txt,font=font); w=bbox[2]-bbox[0]; h=bbox[3]-bbox[1]
    pos=(cx-w/2-bbox[0], cy-h/2-bbox[1]+inner*0.02)
    td.text(pos, txt, font=font, fill=(45,226,230,255), stroke_width=int(S*0.012), stroke_fill=(18,0,43,255))
    g2 = tl.filter(ImageFilter.GaussianBlur(S*0.02))
    img.alpha_composite(g2); img.alpha_composite(tl)
    return img.resize((size,size), Image.LANCZOS).convert('RGB')
make(192,0.04).save(f'{out}/icon-192.png')
make(512,0.04).save(f'{out}/icon-512.png')
make(512,0.14).save(f'{out}/icon-maskable-512.png')
print('icons written to', out)
