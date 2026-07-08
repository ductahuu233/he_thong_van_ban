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

function formatPreviewHtml(htmlString) {
  if (!htmlString) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const loaiVanBan = document.querySelector('input[name="loai_van_ban"]')?.value.trim();
  const trichYeu = document.querySelector('input[name="trich_yeu"]')?.value.trim();

  const tables = doc.querySelectorAll("table");
  tables.forEach((table) => {
    const text = table.textContent;
    // Kiểm tra xem là bảng tiêu ngữ (header) hay bảng chữ ký/nơi nhận (footer) để ẩn viền
    const isLayoutTable = 
      text.includes("CONG HOA XA HOI") || 
      text.includes("CỘNG HÒA XÃ HỘI") || 
      text.includes("Noi nhan:") || 
      text.includes("Nơi nhận:") ||
      text.includes("So:") ||
      text.includes("Số:");

    if (isLayoutTable) {
      table.removeAttribute("border");
      table.style.border = "none";
      table.style.width = "100%";
      table.style.marginBottom = "1.5em";
      table.style.borderCollapse = "collapse";
      
      const cells = table.querySelectorAll("td, th");
      cells.forEach((cell) => {
        cell.style.border = "none";
        cell.style.padding = "4px 8px";
        cell.style.verticalAlign = "top";
        
        // Thay thế các đường gạch nối (---) thành đường kẻ mảnh thực tế
        cell.innerHTML = cell.innerHTML.replace(/----+/g, '<div style="border-bottom: 1.5px solid black; margin: 4px auto; width: 40%; max-width: 120px;"></div>');
      });

      // Nếu là bảng footer (chứa chữ ký), chúng ta chèn con dấu đè lên ô bên phải
      if (text.includes("noi_luu") || text.includes("Nơi nhận:") || text.includes("Người ký") || text.includes("nguoi_ky")) {
        const rightCell = table.rows[0]?.cells[1];
        if (rightCell) {
          rightCell.style.position = "relative";
          const stampImg = document.createElement("img");
          stampImg.src = "/static/stamp.jpg";
          stampImg.style.position = "absolute";
          stampImg.style.width = "110px";
          stampImg.style.height = "110px";
          stampImg.style.opacity = "0.75";
          stampImg.style.mixBlendMode = "multiply";
          stampImg.style.top = "10px";
          stampImg.style.left = "25px";
          stampImg.style.pointerEvents = "none";
          stampImg.style.zIndex = "5";
          rightCell.appendChild(stampImg);
        }
      }
    } else {
      // Đây là bảng danh sách cán bộ / bảng dữ liệu cần có viền
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";
      table.style.marginBottom = "1.5em";
      
      const cells = table.querySelectorAll("td, th");
      cells.forEach((cell) => {
        cell.style.border = "1px solid #000";
        cell.style.padding = "6px 8px";
      });
    }
  });

  // Xử lý căn lề, in nghiêng cho các đoạn văn bản (P) ngoài bảng
  const paragraphs = doc.querySelectorAll("p");
  paragraphs.forEach((p) => {
    // Không thụt đầu dòng các đoạn văn nằm trong bảng
    if (p.closest("table")) return;

    const text = p.textContent.trim();
    if (!text) return;

    // A. Nếu paragraph chứa Loại văn bản hoặc Trích yếu -> Căn giữa, in đậm, không thụt dòng
    const isTitle = loaiVanBan && (text.toLowerCase() === loaiVanBan.toLowerCase() || text.toUpperCase() === loaiVanBan.toUpperCase());
    const isSubject = trichYeu && (text.includes(trichYeu) || trichYeu.includes(text));

    if (isTitle || isSubject) {
      p.style.textIndent = "0";
      p.style.textAlign = "center";
      p.style.fontWeight = "bold";
      p.style.fontSize = isTitle ? "14pt" : "13pt";
      p.style.marginTop = "0.5em";
      p.style.marginBottom = "0.5em";
      p.style.lineHeight = "1.3";
      
      if (isTitle) {
        p.style.textTransform = "uppercase";
      }
      return;
    }

    // B. Căn cứ pháp lý -> In nghiêng, không thụt đầu dòng
    if (text.startsWith("Căn cứ") || text.startsWith("Căn cứ ")) {
      p.style.fontStyle = "italic";
      p.style.textIndent = "0";
      p.style.textAlign = "justify";
      p.style.marginBottom = "0.25em";
      return;
    }

    // C. Tên loại văn bản in hoa đậm ở giữa -> Không thụt đầu dòng
    const isUppercaseTitle = text === text.toUpperCase() && text.length > 5;
    const isCenteredText = p.classList.contains("pydocx-center") || p.style.textAlign === "center";
    
    if (isUppercaseTitle || isCenteredText) {
      p.style.textIndent = "0";
      p.style.textAlign = "center";
      p.style.fontWeight = "bold";
      return;
    }

    // D. Các đoạn nội dung thông thường -> Thụt đầu dòng 1.27cm, căn đều 2 bên
    p.style.textIndent = "1.27cm";
    p.style.textAlign = "justify";
    p.style.lineHeight = "1.5";
  });

  return doc.body.innerHTML;
}

function addPageDividers() {
  const existing = previewText.querySelectorAll(".page-break-divider");
  existing.forEach(el => el.remove());

  previewText.style.position = "relative";
  const totalHeightPx = previewText.scrollHeight;

  const dummy = document.createElement("div");
  dummy.style.height = "297mm";
  dummy.style.visibility = "hidden";
  dummy.style.position = "absolute";
  previewText.appendChild(dummy);
  const pageHeightPx = dummy.offsetHeight;
  previewText.removeChild(dummy);

  if (!pageHeightPx || pageHeightPx <= 0) return;
  const numPages = Math.ceil(totalHeightPx / pageHeightPx);
  
  for (let i = 1; i < numPages; i++) {
    const divider = document.createElement("div");
    divider.className = "page-break-divider";
    divider.style.position = "absolute";
    divider.style.left = "0";
    divider.style.right = "0";
    divider.style.top = `${i * pageHeightPx}px`;
    divider.style.borderTop = "2px dashed #a8a090";
    divider.style.height = "0";
    divider.style.pointerEvents = "none";
    divider.style.zIndex = "10";
    
    const label = document.createElement("span");
    label.textContent = `Hết Trang ${i} / Sang Trang ${i + 1}`;
    label.style.position = "absolute";
    label.style.right = "20px";
    label.style.top = "-10px";
    label.style.background = "#fffdf8";
    label.style.padding = "2px 8px";
    label.style.fontSize = "9pt";
    label.style.color = "#8b7e66";
    label.style.fontFamily = "sans-serif";
    label.style.border = "1px solid #c8bfa8";
    label.style.borderRadius = "4px";
    
    divider.appendChild(label);
    previewText.appendChild(divider);
  }
}

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
    previewText.innerHTML = formatPreviewHtml(result.preview_html) || "<p>Không có nội dung xem trước.</p>";
    previewText.dataset.text = previewText.textContent;
    addPageDividers();
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


