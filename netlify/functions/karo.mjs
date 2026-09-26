/* Karo-Speicher: merkt sich den Fortschritt zu einem geheimen Karo-Code.
   Kein Name, keine E-Mail. Gespeichert wird unter dem SHA-256 des Codes, nicht unter dem Code selbst.
   POST /api/karo  {aktion:"neu"} | {aktion:"laden", code} | {aktion:"speichern", code, daten, basis, erzwingen} */
import { getStore } from "@netlify/blobs";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};
const MAX = 2500000;
const ZEICHEN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   /* ohne I, L, O, 0, 1 (leicht zu verwechseln) */

const antwort = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });

function neuerCode(){
  let c = "";
  while(c.length < 12){
    for(const b of crypto.getRandomValues(new Uint8Array(24))){
      if(b < 248 && c.length < 12) c += ZEICHEN[b % 31];   /* 248 = 8 * 31, damit jedes Zeichen gleich oft vorkommt */
    }
  }
  return c;
}
const zeigen = c => c.slice(0, 4) + "-" + c.slice(4, 8) + "-" + c.slice(8);
const norm = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
async function schluessel(code){
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("karo:" + code));
  return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, "0")).join("");
}

export default async (req) => {
  if(req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if(req.method !== "POST") return antwort({ fehler: "nur_post" }, 405);
  const text = await req.text();
  if(text.length > MAX) return antwort({ fehler: "zu_gross" }, 413);
  let b;
  try{ b = JSON.parse(text); }catch(e){ return antwort({ fehler: "kaputt" }, 400); }
  if(!b || typeof b !== "object") return antwort({ fehler: "kaputt" }, 400);
  const store = getStore({ name: "karo", consistency: "strong" });

  if(b.aktion === "neu"){
    const code = neuerCode();
    await store.setJSON(await schluessel(code), { zeit: null, daten: null, erstellt: new Date().toISOString() });
    return antwort({ code: zeigen(code) });
  }

  const code = norm(b.code);
  if(!/^[A-HJKMNP-Z2-9]{12}$/.test(code)) return antwort({ fehler: "code" }, 400);
  const key = await schluessel(code);
  const alt = await store.get(key, { type: "json" });
  if(!alt) return antwort({ fehler: "unbekannt" }, 404);

  if(b.aktion === "laden") return antwort({ zeit: alt.zeit, daten: alt.daten });

  if(b.aktion === "speichern"){
    if(!b.daten || typeof b.daten !== "object" || Array.isArray(b.daten)) return antwort({ fehler: "kaputt" }, 400);
    /* Ein anderes Gerät hat inzwischen gespeichert: nicht einfach überschreiben */
    if(!b.erzwingen && alt.zeit && b.basis !== alt.zeit) return antwort({ fehler: "konflikt", zeit: alt.zeit, daten: alt.daten }, 409);
    const zeit = new Date().toISOString();
    await store.setJSON(key, { ...alt, zeit, daten: b.daten });
    return antwort({ zeit });
  }
  return antwort({ fehler: "aktion" }, 400);
};

export const config = { path: "/api/karo" };
