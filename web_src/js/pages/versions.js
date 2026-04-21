import { api } from "../api-pages/versions.js";
import { requireAuth } from "../auth.js";
const me = await requireAuth();
const projectInput = document.getElementById("project");
const loadBtn = document.getElementById("loadBtn");
const meta = document.getElementById("meta");
const versions = document.getElementById("versions");
const uploads = document.getElementById("uploads");
function card(html){
  const d=document.createElement("div");
  d.className="card";
  d.innerHTML=html;
  return d;
}
async function load(){
  const project = projectInput.value.trim();
  if(!project) return;
  meta.textContent = "Loading…";
  versions.innerHTML = "";
  uploads.innerHTML = "";
  const r = await api.get("/api/gamehosting/versions?project=" + encodeURIComponent(project));
  meta.textContent = `${r.game.title} — ${r.game.project} (${r.game.category || "uncategorized"})`;
  for(const v of (r.versions || [])){
    const isPublished = v.is_published === 1 || v.is_published === true;
    const canPublish = (me.role === "admin" || me.role === "moderator") && v.approval_status === "approved";
    const d = card(`
      <h3>${v.version} ${isPublished ? "✅ Published" : ""}</h3>
      <div class="muted">status: ${v.approval_status}</div>
      ${v.rejected_reason ? `<div class="muted">reject: ${v.rejected_reason}</div>` : ""}
      <div class="muted">entry: ${v.entry_html}</div>
      ${canPublish && !isPublished ? `<button class="primary" data-v="${v.version}" data-action="publish" style="margin-top:10px">Publish</button>` : ""}
      ${isPublished ? `<button class="secondary" data-v="${v.version}" data-action="unpublish" style="margin-top:10px">Unpublish</button>` : ""}
    `);
    const btn = d.querySelector("button");
    if(btn){
      btn.onclick = async ()=>{
        const action = btn.dataset.action;
        if(action === "unpublish"){
          await api.post("/api/gamehosting/publish", { project, version: btn.dataset.v, published: false });
        }else{
          await api.post("/api/gamehosting/publish", { project, version: btn.dataset.v });
        }
        await load();
      };
    }
    versions.appendChild(d);
  }
  for(const u of (r.uploads || [])){
    uploads.appendChild(card(`
      <h3>${u.version}</h3>
      <div class="muted">uploader: ${u.uploader || "?"}</div>
      <div class="muted">time: ${new Date(u.created_at).toLocaleString()}</div>
    `));
  }
}
loadBtn.onclick = load;
