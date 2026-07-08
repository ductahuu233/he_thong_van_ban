const form = document.querySelector("#document-form");


const generateButton = document.querySelector("#generate-button");


const saveSettingsButton = document.querySelector("#save-settings-button");


const previewText = document.querySelector("#preview-container");


const copyButton = document.querySelector("#copy-button");


const downloadLink = document.querySelector("#download-link");


const generationModeRadios = document.querySelectorAll('input[name="generation_mode"]');


const aiFields = document.querySelector("#ai-fields");


const manualFields = document.querySelector("#manual-fields");





function handleGenerationModeChange() {


  const selectedMode = document.querySelector('input[name="generation_mode"]:checked').value;


  if (selectedMode === "ai") {


    aiFields.classList.remove("hidden");


    manualFields.classList.add("hidden");


  } else {


    aiFields.classList.add("hidden");


    manualFields.classList.remove("hidden");


  }


}





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





function collectRequiredFields() {
  // Danh sách các input/select/textarea bắt buộc trong form
  const requiredNames = [
    "template_type",
    "loai_van_ban",
    "so_ky_hieu",
    "ten_co_quan",
    "nguoi_ky",
    "chuc_vu",
    "trich_yeu",
    "dia_danh",
    "don_vi_nhan",
    "noi_luu",
  ];

  const mode = document.querySelector('input[name="generation_mode"]:checked')?.value || "ai";
  if (mode === "ai") {
    requiredNames.push("user_request");
  } else {
    requiredNames.push("manual_content");
  }

  // staff_list chỉ bắt buộc khi dùng mẫu congvan có bảng cán bộ
  const templateType = document.querySelector('select[name="template_type"]')?.value || "default";
  if (templateType === "congvan") {
    requiredNames.push("staff_list");
  }

  return requiredNames;
}

function normalizeVietnameseNameClient(s) {
  // Fallback nhẹ (mapping phổ biến) để người ký có dấu đúng hơn.
  if (!s) return s;
  const map = {
    "nguyen": "Nguyễn",
    "van": "Văn",
    "thanh": "Thành",
    "minh": "Minh",
    "duc": "Đức",
    "hiep": "Hiệp",
    "khanh": "Khánh",
    "phuong": "Phương",
    "thu": "Thư",
    "tuan": "Tuấn",
    "linh": "Linh",
    "b": "B",
    "a": "A",
  };

  const raw = String(s).trim();
  const tokens = raw.split(/\s+/);
  const fixToken = (token) => {
    let lower = token.toLowerCase().trim();
    let suffix = "";
    while (lower.length && [".", ",", ";", ":"].includes(lower.slice(-1))) {
      suffix = lower.slice(-1) + suffix;
      lower = lower.slice(0, -1);
    }
    const fixed = map[lower];
    if (!fixed) return token;
    const first = token[0];
    if (first && first === first.toUpperCase()) {
      return fixed + suffix;
    }
    return fixed + suffix;
  };

  return tokens.map(fixToken).join(" ");
}

function getValueByName(name) {
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) return "";
  if (el.type === "file") return ""; // không dùng cho validate
  return (el.value || "").toString();
}

function validateFormAndToggleGenerate() {
  const requiredNames = collectRequiredFields();
  let missing = [];

  requiredNames.forEach((name) => {
    const v = getValueByName(name).trim();
    if (!v) missing.push(name);
  });

  if (missing.length) {
    generateButton.setAttribute("disabled", "true");
    return false;
  }

  generateButton.removeAttribute("disabled");
  return true;
}

// Chuẩn hoá người ký khi người dùng hoàn thành nhập và di chuột ra ngoài (blur)
const nguoiKyEl = document.querySelector("#ten_giam_doc");
if (nguoiKyEl) {
  nguoiKyEl.addEventListener("blur", () => {
    nguoiKyEl.value = normalizeVietnameseNameClient(nguoiKyEl.value);
    validateFormAndToggleGenerate();
  });
}

// Init state
validateFormAndToggleGenerate();

// Listen change/input để bật nút đúng yêu cầu
form.addEventListener("input", () => validateFormAndToggleGenerate());
form.addEventListener("change", () => validateFormAndToggleGenerate());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Chặn nếu thiếu trường
  const ok = validateFormAndToggleGenerate();
  if (!ok) {
    previewText.textContent = "Vui lòng nhập đầy đủ tất cả các trường bắt buộc trước khi tạo văn bản.";
    return;
  }

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
    previewText.innerHTML = result.preview_html || "<p>Không có nội dung xem trước.</p>";
    previewText.dataset.text = previewText.textContent;
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


  const text = previewText.dataset.text || previewText.textContent;


  try {


    await navigator.clipboard.writeText(text);


    copyButton.textContent = "Đã copy!";


    setTimeout(() => (copyButton.textContent = "Copy nội dung"), 1500);


  } catch {


    copyButton.textContent = "Lỗi copy";


  }


});





generationModeRadios.forEach(radio => {


    radio.addEventListener('change', handleGenerationModeChange);


});





loadSettings().catch((error) => {


  previewText.textContent = error.message;


});


