const form = document.querySelector("#document-form");
const generateButton = document.querySelector("#generate-button");
const saveSettingsButton = document.querySelector("#save-settings-button");
const previewText = document.querySelector("#preview-text");
const copyButton = document.querySelector("#copy-button");
const downloadLink = document.querySelector("#download-link");

async function loadSettings() {
  const response = await fetch("/api/settings");
  if (!response.ok) {
    throw new Error("Không tải được cấu hình mặc định.");
  }

  const settings = await response.json();
  document.querySelector("#ten_co_quan").value = settings.ten_co_quan || "";
  document.querySelector("#ten_giam_doc").value = settings.ten_giam_doc || "";
  document.querySelector("#chuc_vu").value = settings.chuc_vu || "";
}

function setDownloadLink(url, fileName = "") {
  if (!url) {
    downloadLink.setAttribute("aria-disabled", "true");
    downloadLink.setAttribute("href", "#");
    downloadLink.removeAttribute("download");
    return;
  }

  downloadLink.removeAttribute("aria-disabled");
  downloadLink.setAttribute("href", url);
  if (fileName) {
    downloadLink.setAttribute("download", fileName);
  }
}

async function readErrorMessage(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

async function saveSettings() {
  saveSettingsButton.disabled = true;
  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ten_co_quan: document.querySelector("#ten_co_quan").value,
        ten_giam_doc: document.querySelector("#ten_giam_doc").value,
        chuc_vu: document.querySelector("#chuc_vu").value,
      }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Không lưu được cấu hình."));
    }

    previewText.textContent = "Đã lưu cấu hình mặc định cho các lần soạn thảo tiếp theo.";
  } finally {
    saveSettingsButton.disabled = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generateButton.disabled = true;
  previewText.textContent = "Hệ thống đang xử lý hồ sơ và tạo dự thảo...";
  setDownloadLink("");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: new FormData(form),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Chưa thể tạo văn bản."));
    }

    const result = await response.json();
    previewText.textContent = result.preview_text || "";
    setDownloadLink(result.file_url || "", result.file_name || "");
  } catch (error) {
    previewText.textContent = error.message;
  } finally {
    generateButton.disabled = false;
  }
});

saveSettingsButton.addEventListener("click", () => {
  saveSettings().catch((error) => {
    previewText.textContent = error.message;
  });
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(previewText.textContent);
});

loadSettings().catch((error) => {
  previewText.textContent = error.message;
});
