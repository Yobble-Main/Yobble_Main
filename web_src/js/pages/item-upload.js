import { requireAuth } from "/js/auth.js";
import { mountTopbar } from "/js/layout.js";

await requireAuth();
await mountTopbar("uitemupload");

const codeInput = document.getElementById("code");
const nameInput = document.getElementById("name");
const descInput = document.getElementById("desc");
const priceInput = document.getElementById("price");
const iconInput = document.getElementById("icon");
const uploadBtn = document.getElementById("upload");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("uploadProgressWrap");
const progressBar = document.getElementById("uploadProgress");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ff7b7b" : "";
}

function sanitizeCode(v) {
  return v.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function setProgress(pct, visible = true) {
  if (progressWrap) progressWrap.style.display = visible ? "block" : "none";
  if (progressBar) progressBar.style.width = `${pct}%`;
}

uploadBtn.onclick = async () => {
  const code = sanitizeCode(codeInput.value.trim());
  const name = nameInput.value.trim();
  const description = descInput.value.trim();
  const priceRaw = priceInput ? priceInput.value : "0";
  const priceNum = Number(priceRaw);
  const price = Number.isFinite(priceNum) ? Math.floor(priceNum) : NaN;
  const icon = iconInput.files[0];

  if (!code || !name) {
    setStatus("Item code and name are required", true);
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    setStatus("Price must be 0 or higher", true);
    return;
  }
  if (icon && icon.size > 2 * 1024 * 1024) {
    setStatus("Icon file is too large (max 2MB)", true);
    return;
  }

  const form = new FormData();
  form.append("code", code);
  form.append("name", name);
  form.append("description", description);
  form.append("price", String(price));
  if (icon) form.append("icon", icon);

  uploadBtn.disabled = true;
  setStatus("Uploading...");
  setProgress(0, true);

  try {
    await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/items/upload");
      const token = localStorage.getItem("token");
      if (token) {
        xhr.setRequestHeader("Authorization", "Bearer " + token);
      }
      xhr.upload.addEventListener("progress", (evt) => {
        if (!evt.lengthComputable) return;
        setProgress(Math.round((evt.loaded / evt.total) * 100), true);
      });
      xhr.addEventListener("load", () => {
        let json = {};
        try {
          json = JSON.parse(xhr.responseText || "{}");
        } catch {}
        if (xhr.status === 401 || xhr.status === 403) {
          setStatus("You are not allowed to upload items", true);
        } else if (xhr.status >= 200 && xhr.status < 300 && json.ok) {
          setStatus("Item submitted for moderation");
          codeInput.value = "";
          nameInput.value = "";
          descInput.value = "";
          if (priceInput) priceInput.value = "";
          iconInput.value = "";
          setProgress(100, true);
        } else {
          setStatus("Upload failed: " + (json.error || xhr.responseText || "unknown error"), true);
        }
        resolve();
      });
      xhr.addEventListener("error", () => {
        setStatus("Network error while uploading", true);
        resolve();
      });
      xhr.addEventListener("loadend", () => {
        setTimeout(() => setProgress(0, false), 400);
      });
      xhr.send(form);
    });
  } catch (err) {
    console.error(err);
    setStatus("Network error while uploading", true);
  } finally {
    uploadBtn.disabled = false;
  }
};
