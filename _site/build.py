import urllib.parse, html, datetime, pathlib, sys
src = pathlib.Path(sys.argv[1])
CDN = "https://cdn.jsdelivr.net/gh/joostmaes/agenda-knop@main/"
def loader(f):
    js = ("(()=>{const s=document.createElement('script');s.src='%s%s';"
          "s.onerror=()=>alert('Knop kon niet laden. Gebruik de reserveknop op bbm.joostmaes.nl.');"
          "(document.head||document.documentElement).appendChild(s);})()") % (CDN, f)
    return "javascript:" + urllib.parse.quote(js, safe="(){}[];,=>'.:/!*_-~@")
def reserve(f):
    code = (src / f).read_text(encoding="utf-8")
    return "javascript:" + urllib.parse.quote(code, safe="")
t = pathlib.Path("template.html").read_text(encoding="utf-8")
rep = {"L_AGENDA":loader("agenda.js"),"L_KOPIEER":loader("kopieer.js"),"L_PLAK":loader("plak.js"),
       "R_AGENDA":reserve("agenda.js"),"R_KOPIEER":reserve("kopieer.js"),"R_PLAK":reserve("plak.js"),
       "DATUM":datetime.date.today().strftime("%d-%m-%Y")}
for k,v in rep.items(): t = t.replace("{{%s}}"%k, html.escape(v, quote=True))
assert "{{" not in t
pathlib.Path("index.html").write_text(t, encoding="utf-8")
print("ok", len(t))
