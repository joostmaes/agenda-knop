import urllib.parse, html, datetime, pathlib, sys
src = pathlib.Path(sys.argv[1])
CDN = "https://cdn.jsdelivr.net/gh/joostmaes/agenda-knop@main/"
def loader(f):
    # fetch + eval (2Jours staat jsDelivr toe in connect-src en heeft unsafe-eval);
    # lukt fetch niet, dan als terugval een <script>-tag.
    js = ("(async()=>{const u='%s%s';"
          "const fout=()=>alert('Knop kon niet laden. Gebruik de reserveknop op bbm.joostmaes.nl/bladwijzers.');"
          "let t;try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw 0;t=await r.text();}"
          "catch(e){const s=document.createElement('script');s.src=u;s.onerror=fout;"
          "(document.head||document.documentElement).appendChild(s);return;}(0,eval)(t);})()") % (CDN, f)
    return "javascript:" + urllib.parse.quote(js, safe="(){}[];,=>'.:/!*_-~@")
def reserve(f):
    code = (src / f).read_text(encoding="utf-8")
    return "javascript:" + urllib.parse.quote(code, safe="")
t = (pathlib.Path(__file__).resolve().parent / "template.html").read_text(encoding="utf-8")
rep = {"L_AGENDA":loader("agenda.js"),"L_KOPIEER":loader("kopieer.js"),"L_PLAK":loader("plak.js"),
       "R_AGENDA":reserve("agenda.js"),"R_KOPIEER":reserve("kopieer.js"),"R_PLAK":reserve("plak.js"),
       "DATUM":datetime.date.today().strftime("%d-%m-%Y")}
for k,v in rep.items(): t = t.replace("{{%s}}"%k, html.escape(v, quote=True))
assert "{{" not in t
out = pathlib.Path(__file__).resolve().parent.parent / "bladwijzers" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(t, encoding="utf-8")
print("ok", len(t))

# Overzichtspagina (root)
hier = pathlib.Path(__file__).resolve().parent
tpl = (hier / "template.html").read_text(encoding="utf-8")
import re as _re
fav = _re.search(r'<link rel="icon"[^>]*>', tpl).group(0)
logo = _re.search(r'<svg class="logo".*?</svg>', tpl, _re.S).group(0)
o = (hier / "overzicht.html").read_text(encoding="utf-8").replace("{{FAVICON}}", fav).replace("{{LOGO}}", logo)
(hier.parent / "index.html").write_text(o, encoding="utf-8")
print("overzicht ok", len(o))
