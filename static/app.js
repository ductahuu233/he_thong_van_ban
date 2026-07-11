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


    downloadLink.textContent = "Nhấn 'Tạo văn bản' để tải Word";


    return;


  }





  downloadLink.removeAttribute("aria-disabled");


  downloadLink.setAttribute("href", url);


  if (fileName) {


    downloadLink.setAttribute("download", fileName);


  }


  downloadLink.textContent = "Tải file Word (.docx)";


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
form.addEventListener("input", () => {
  validateFormAndToggleGenerate();
  if (previewText.dataset.generated !== "true") {
    renderLivePreview();
  }
});
form.addEventListener("change", () => {
  validateFormAndToggleGenerate();
  if (previewText.dataset.generated !== "true") {
    renderLivePreview();
  }
});

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
        cell.innerHTML = cell.innerHTML.replace(/----+/g, '<span style="display: inline-block; border-top: 1.5px solid black; width: 100px; margin: 4px 0; vertical-align: middle;"></span>');
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

function paginatePreview() {
  const container = document.getElementById("preview-container");
  if (!container) return;

  const rawHtml = container.innerHTML;
  
  // Clear container styling to act as a transparent wrapper for pages
  container.innerHTML = "";
  container.style.background = "transparent";
  container.style.border = "none";
  container.style.boxShadow = "none";
  container.style.padding = "0";
  container.style.width = "auto";
  container.style.minHeight = "auto";

  // Create a temporary container to measure heights accurately
  const temp = document.createElement("div");
  temp.className = "docx-page";
  temp.style.height = "auto";
  temp.style.position = "absolute";
  temp.style.visibility = "hidden";
  temp.style.top = "-9999px";
  temp.innerHTML = rawHtml;
  document.body.appendChild(temp);

  // Extract all child elements
  const elements = Array.from(temp.children);
  
  // Printable height in pixels (257mm at 96 DPI)
  // 257mm = 971px
  const maxPageHeight = 970;

  let pages = [];
  let currentPageElements = [];
  let currentHeight = 0;

  elements.forEach((el) => {
    // Measure element height inside the temp container
    const elHeight = el.getBoundingClientRect().height;
    
    // Check if adding this element exceeds the page height
    if (currentHeight + elHeight > maxPageHeight && currentPageElements.length > 0) {
      pages.push(currentPageElements);
      currentPageElements = [el.cloneNode(true)];
      currentHeight = elHeight;
    } else {
      currentPageElements.push(el.cloneNode(true));
      currentHeight += elHeight;
    }
  });

  if (currentPageElements.length > 0) {
    pages.push(currentPageElements);
  }

  // Clean up temp
  document.body.removeChild(temp);

  // Render separate A4 pages
  pages.forEach((pageEls, index) => {
    const pageNum = index + 1;
    
    const pageDiv = document.createElement("div");
    pageDiv.className = "docx-page";
    
    // If page >= 2, add the page number at the top center
    if (pageNum >= 2) {
      const pageNumDiv = document.createElement("div");
      pageNumDiv.className = "docx-page-number";
      pageNumDiv.textContent = pageNum;
      pageDiv.appendChild(pageNumDiv);
    }
    
    const pageContent = document.createElement("div");
    pageContent.className = "docx-page-content";
    
    pageEls.forEach((el) => {
      pageContent.appendChild(el);
    });
    
    pageDiv.appendChild(pageContent);
    container.appendChild(pageDiv);
  });
}

let triggerDownloadAfterGenerate = false;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Chặn nếu thiếu trường
  const ok = validateFormAndToggleGenerate();
  if (!ok) {
    previewText.textContent = "Vui lòng nhập đầy đủ tất cả các trường bắt buộc trước khi tạo văn bản.";
    triggerDownloadAfterGenerate = false;
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
    previewText.dataset.generated = "true"; // Đánh dấu đã sinh thật
    paginatePreview();
    autoFitPageWidth();
    setDownloadLink(result.file_url || "", result.file_name || "");

    if (triggerDownloadAfterGenerate) {
      triggerDownloadAfterGenerate = false;
      setTimeout(() => {
        downloadLink.click();
      }, 100);
    }
  } catch (error) {
    previewText.textContent = error.message;
    triggerDownloadAfterGenerate = false;
  } finally {
    generateButton.disabled = false;
  }
});

// Thêm sự kiện click cho downloadLink để tự động tạo và tải khi chưa có sẵn file
downloadLink.addEventListener("click", (event) => {
  if (downloadLink.getAttribute("aria-disabled") === "true" || downloadLink.getAttribute("href") === "#") {
    event.preventDefault();
    triggerDownloadAfterGenerate = true;
    if (form.requestSubmit) {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event("submit"));
    }
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
    radio.addEventListener('change', (e) => {
      handleGenerationModeChange(e);
      if (previewText.dataset.generated !== "true") {
        renderLivePreview();
      }
    });
});

const templateTypeSelect = document.querySelector('select[name="template_type"]');
const staffListContainer = document.getElementById("staff-list-container");

function updateStaffListVisibility() {
  if (templateTypeSelect && staffListContainer) {
    if (templateTypeSelect.value === "congvan") {
      staffListContainer.style.display = "flex";
    } else {
      staffListContainer.style.display = "none";
    }
  }
}

function renderLivePreview() {
  if (!templateTypeSelect) return;
  const templateType = templateTypeSelect.value;
  const coQuan = document.getElementById("ten_co_quan")?.value.trim() || "[Tên cơ quan]";
  const soKyHieu = document.querySelector('input[name="so_ky_hieu"]')?.value.trim() || "[Số ký hiệu]";
  const loaiVanBan = document.querySelector('input[name="loai_van_ban"]')?.value.trim() || "[Loại văn bản]";
  const trichYeu = document.querySelector('input[name="trich_yeu"]')?.value.trim() || "[Trích yếu nội dung]";
  const diaDanh = document.querySelector('input[name="dia_danh"]')?.value.trim() || "[Địa danh]";
  const donViNhan = document.querySelector('input[name="don_vi_nhan"]')?.value.trim() || "[Đơn vị nhận]";
  const noiLuu = document.querySelector('input[name="noi_luu"]')?.value.trim() || "VT";
  const chucVu = document.getElementById("chuc_vu")?.value.trim() || "[Chức vụ]";
  const nguoiKy = document.getElementById("ten_giam_doc")?.value.trim() || "[Họ tên người ký]";
  const staffListRaw = document.querySelector('textarea[name="staff_list"]')?.value.trim() || "";
  const manualContent = document.querySelector('textarea[name="manual_content"]')?.value.trim() || "";
  const mode = document.querySelector('input[name="generation_mode"]:checked')?.value || "ai";

  const today = new Date();
  const dateStr = `${diaDanh}, ngày ${String(today.getDate()).padStart(2, '0')} tháng ${String(today.getMonth() + 1).padStart(2, '0')} năm ${today.getFullYear()}`;

  // Build header table HTML
  let headerHtml = `
    <table style="border: none; width: 100%; border-collapse: collapse; margin-bottom: 1.5em;">
      <tr>
        <td style="border: none; width: 33%; text-align: center; vertical-align: top; font-family: 'Times New Roman', Times, serif; font-size: 13pt;">
          <strong>${coQuan}</strong>
          ${templateType === 'congvan' ? '<br/><strong>Đoàn công tác</strong>' : ''}<br/>
          <span style="display: inline-block; border-top: 1.5px solid black; width: 60px; margin: 4px 0; vertical-align: middle;"></span><br/>
          Số: ${soKyHieu}
        </td>
        <td style="border: none; width: 67%; text-align: center; vertical-align: top; font-family: 'Times New Roman', Times, serif; font-size: 13pt;">
          <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
          <span style="display: inline-block; border-bottom: 1.5px solid black; padding-bottom: 2px; margin-bottom: 4px;"><strong>Độc lập - Tự do - Hạnh phúc</strong></span><br/>
          <span style="font-style: italic;">${dateStr}</span>
        </td>
      </tr>
    </table>
  `;

  // Build body HTML
  let bodyHtml = "";
  if (templateType === "congvan") {
    bodyHtml += `
      <p style="text-align: center; font-weight: bold; margin-bottom: 1.5em; text-indent: 0;">Kính gửi: ${donViNhan}.</p>
      <p style="text-indent: 1.27cm; text-align: justify; line-height: 1.5;">Về việc cử cán bộ tham gia hoạt động: cử các đồng chí có tên sau đây:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 1em 0 1.5em 0;">
        <thead>
          <tr>
            <th style="border: 1px solid black; padding: 6px 8px; font-weight: bold; text-align: center;">TT</th>
            <th style="border: 1px solid black; padding: 6px 8px; font-weight: bold; text-align: center;">Họ và tên</th>
            <th style="border: 1px solid black; padding: 6px 8px; font-weight: bold; text-align: center;">Năm sinh</th>
            <th style="border: 1px solid black; padding: 6px 8px; font-weight: bold; text-align: center;">Chức vụ</th>
            <th style="border: 1px solid black; padding: 6px 8px; font-weight: bold; text-align: center;">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Parse staff list
    const staffLines = staffListRaw.split("\n").filter(line => line.trim());
    if (staffLines.length > 0) {
      staffLines.forEach((line, idx) => {
        const parts = line.split("|").map(p => p.trim());
        bodyHtml += `
          <tr>
            <td style="border: 1px solid black; padding: 6px 8px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid black; padding: 6px 8px;">${parts[0] || ""}</td>
            <td style="border: 1px solid black; padding: 6px 8px; text-align: center;">${parts[1] || ""}</td>
            <td style="border: 1px solid black; padding: 6px 8px;">${parts[2] || ""}</td>
            <td style="border: 1px solid black; padding: 6px 8px;">${parts[3] || ""}</td>
          </tr>
        `;
      });
    } else {
      bodyHtml += `
        <tr>
          <td style="border: 1px solid black; padding: 6px 8px; text-align: center;">1</td>
          <td style="border: 1px solid black; padding: 6px 8px; color: #888;">[Họ tên cán bộ]</td>
          <td style="border: 1px solid black; padding: 6px 8px; text-align: center; color: #888;">[Năm sinh]</td>
          <td style="border: 1px solid black; padding: 6px 8px; color: #888;">[Chức vụ]</td>
          <td style="border: 1px solid black; padding: 6px 8px; color: #888;">[Ghi chú]</td>
        </tr>
      `;
    }

    bodyHtml += `
        </tbody>
      </table>
      <p style="text-indent: 1.27cm; text-align: justify; line-height: 1.5;">${mode === "manual" && manualContent ? manualContent : "[Nội dung đề xuất và ý kiến chỉ đạo sẽ hiển thị tại đây sau khi nhấn Tạo văn bản...]"}</p>
    `;
  } else if (templateType === "quyetdinh") {
    bodyHtml += `
      <p style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 0.25em; text-indent: 0; text-transform: uppercase;">QUYẾT ĐỊNH</p>
      <p style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 1.5em; text-indent: 0;">${trichYeu}</p>
    `;
    
    if (mode === "manual" && manualContent) {
      const lines = manualContent.split("\n");
      lines.forEach(line => {
        if (line.trim().startsWith("Căn cứ")) {
          bodyHtml += `<p style="font-style: italic; text-indent: 0; text-align: justify; margin-bottom: 0.25em; line-height: 1.5;">${line.trim()}</p>`;
        } else {
          bodyHtml += `<p style="text-indent: 1.27cm; text-align: justify; line-height: 1.5;">${line.trim()}</p>`;
        }
      });
    } else {
      bodyHtml += `
        <p style="font-style: italic; text-indent: 0; text-align: justify; margin-bottom: 0.25em; line-height: 1.5;">Căn cứ các quy định pháp luật liên quan và thẩm quyền ban hành...</p>
        <p style="text-align: center; font-weight: bold; margin-top: 1em; margin-bottom: 1em; text-indent: 0;">QUYẾT ĐỊNH:</p>
        <p style="text-indent: 1.27cm; text-align: justify; line-height: 1.5;">[Nội dung chi tiết các Điều khoản Quyết định sẽ được tự động soạn thảo tại đây sau khi nhấn Tạo văn bản...]</p>
      `;
    }
  } else {
    // Mẫu chung
    bodyHtml += `
      <p style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 0.25em; text-indent: 0; text-transform: uppercase;">${loaiVanBan}</p>
      <p style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 1.5em; text-indent: 0;">${trichYeu}</p>
      <p style="text-indent: 1.27cm; text-align: justify; line-height: 1.5;">${mode === "manual" && manualContent ? manualContent : "[Nội dung chi tiết văn bản sẽ được tự động soạn thảo tại đây sau khi nhấn Tạo văn bản...]"}</p>
    `;
  }

  // Build footer/signer HTML
  let footerHtml = `
    <table style="border: none; width: 100%; border-collapse: collapse; margin-top: 2em;">
      <tr>
        <td style="border: none; width: 50%; text-align: left; vertical-align: top; font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.3;">
          <strong>Nơi nhận:</strong><br/>
          - Như trên;<br/>
          - Lưu: ${noiLuu}.
        </td>
        <td style="border: none; width: 50%; text-align: center; vertical-align: top; font-family: 'Times New Roman', Times, serif; font-size: 13pt; position: relative;">
          <strong>${chucVu}</strong>
          <br/><br/><br/>
          <img src="/static/stamp.jpg" style="position: absolute; width: 110px; height: 110px; opacity: 0.75; mix-blend-mode: multiply; top: 10px; left: 25px; pointer-events: none; z-index: 5;" />
          <strong>${nguoiKy}</strong>
        </td>
      </tr>
    </table>
  `;

  previewText.innerHTML = headerHtml + bodyHtml + footerHtml;
  paginatePreview();
}

if (templateTypeSelect) {
  templateTypeSelect.addEventListener("change", () => {
    previewText.dataset.generated = "false"; // Reset
    
    const loaiVanBanInput = document.querySelector('input[name="loai_van_ban"]');
    const soKyHieuInput = document.querySelector('input[name="so_ky_hieu"]');
    const templateType = templateTypeSelect.value;
    
    if (templateType === "congvan") {
      if (loaiVanBanInput) loaiVanBanInput.value = "Công văn";
      if (soKyHieuInput) soKyHieuInput.value = "06/2026/CV-HĐND";
    } else if (templateType === "quyetdinh") {
      if (loaiVanBanInput) loaiVanBanInput.value = "Quyết định";
      if (soKyHieuInput) soKyHieuInput.value = "06/2026/QĐ-HĐND";
    } else {
      if (loaiVanBanInput) loaiVanBanInput.value = "Nghị quyết";
      if (soKyHieuInput) soKyHieuInput.value = "06/2026/NQ-HĐND";
    }

    updateStaffListVisibility();
    renderLivePreview();
    autoFitPageWidth();
  });
}

function autoFitPageWidth() {
  const previewContainer = document.querySelector(".docx-preview-container");
  const zoomSlider = document.getElementById("zoom-slider");
  const zoomValue = document.getElementById("zoom-value");
  const preview = document.getElementById("preview-container");
  
  if (!previewContainer || !zoomSlider || !zoomValue || !preview) return;

  // Get available width
  const containerWidth = previewContainer.clientWidth;
  const style = window.getComputedStyle(previewContainer);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const availableWidth = containerWidth - paddingLeft - paddingRight - 24; // 24px buffer
  
  // Get available height
  const containerHeight = previewContainer.clientHeight;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const availableHeight = containerHeight - paddingTop - paddingBottom - 24; // 24px buffer
  
  const a4Width = 794;  // approx A4 width in pixels (210mm)
  const a4Height = 1122; // approx A4 height in pixels (297mm)
  
  if (availableWidth > 0 && availableHeight > 0) {
    const widthZoom = availableWidth / a4Width;
    const heightZoom = availableHeight / a4Height;
    
    // Choose the minimum zoom to fit the entire page vertically and horizontally without scrolling
    let idealZoom = Math.min(widthZoom, heightZoom);
    let fitZoom = Math.round(idealZoom * 100);
    
    // Clamp zoom between 40% and 200%
    fitZoom = Math.max(40, Math.min(200, fitZoom));
    
    zoomSlider.value = fitZoom;
    zoomValue.textContent = `${fitZoom}%`;
    preview.style.zoom = fitZoom / 100;
  }
}

loadSettings().then(() => {
  updateStaffListVisibility();
  renderLivePreview();
  autoFitPageWidth();
}).catch((error) => {
  previewText.textContent = error.message;
});

// Zoom Slider Logic
const zoomSlider = document.getElementById("zoom-slider");
const zoomValue = document.getElementById("zoom-value");
if (zoomSlider && zoomValue) {
  zoomSlider.addEventListener("input", () => {
    const val = zoomSlider.value;
    zoomValue.textContent = `${val}%`;
    const preview = document.getElementById("preview-container");
    if (preview) {
      preview.style.zoom = val / 100;
    }
  });
}

// Robust ResizeObserver to handle Tailwind CDN layout changes and viewport resizing
const previewContainerEl = document.querySelector(".docx-preview-container");
if (previewContainerEl) {
  const resizeObserver = new ResizeObserver(() => {
    autoFitPageWidth();
  });
  resizeObserver.observe(previewContainerEl);
}

// OCR Scanning Frontend Logic
const scanDocBtn = document.getElementById("scan-doc-btn");
const scanDocInput = document.getElementById("scan-doc-input");
const ocrLoadingModal = document.getElementById("ocr-loading-modal");
const ocrResultModal = document.getElementById("ocr-result-modal");
const ocrResultText = document.getElementById("ocr-result-text");
const ocrCloseBtn = document.getElementById("ocr-close-btn");
const ocrFillRequestBtn = document.getElementById("ocr-fill-request-btn");
const ocrFillContentBtn = document.getElementById("ocr-fill-content-btn");
const ocrCopyBtn = document.getElementById("ocr-copy-btn");

if (scanDocBtn && scanDocInput) {
  scanDocBtn.addEventListener("click", () => {
    scanDocInput.click();
  });

  scanDocInput.addEventListener("change", async () => {
    const file = scanDocInput.files[0];
    if (!file) return;

    // Show loading modal
    if (ocrLoadingModal) {
      ocrLoadingModal.classList.remove("hidden");
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/scan-document", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Không thể nhận diện hình ảnh.");
      }

      const result = await response.json();

      // Show result modal and populate text
      if (ocrResultText) {
        ocrResultText.value = result.text || "";
      }
      if (ocrResultModal) {
        ocrResultModal.classList.remove("hidden");
      }
    } catch (error) {
      alert(`Lỗi quét tài liệu: ${error.message}`);
    } finally {
      // Hide loading modal & reset input
      if (ocrLoadingModal) {
        ocrLoadingModal.classList.add("hidden");
      }
      scanDocInput.value = "";
    }
  });
}

// Modal actions
if (ocrCloseBtn && ocrResultModal) {
  ocrCloseBtn.addEventListener("click", () => {
    ocrResultModal.classList.add("hidden");
  });
}

if (ocrFillRequestBtn && ocrResultModal) {
  ocrFillRequestBtn.addEventListener("click", () => {
    const userRequestTextarea = document.getElementsByName("user_request")[0];
    if (userRequestTextarea && ocrResultText) {
      userRequestTextarea.value = ocrResultText.value;
      userRequestTextarea.dispatchEvent(new Event("input"));
    }
    
    // Switch to AI mode
    const aiRadio = document.querySelector('input[name="generation_mode"][value="ai"]');
    if (aiRadio) {
      aiRadio.checked = true;
      handleGenerationModeChange();
      if (previewText.dataset.generated !== "true") {
        renderLivePreview();
      }
    }
    
    ocrResultModal.classList.add("hidden");
  });
}

if (ocrFillContentBtn && ocrResultModal) {
  ocrFillContentBtn.addEventListener("click", () => {
    const manualContentTextarea = document.getElementsByName("manual_content")[0];
    if (manualContentTextarea && ocrResultText) {
      manualContentTextarea.value = ocrResultText.value;
      manualContentTextarea.dispatchEvent(new Event("input"));
    }

    // Switch to manual mode
    const manualRadio = document.querySelector('input[name="generation_mode"][value="manual"]');
    if (manualRadio) {
      manualRadio.checked = true;
      handleGenerationModeChange();
      if (previewText.dataset.generated !== "true") {
        renderLivePreview();
      }
    }

    ocrResultModal.classList.add("hidden");
  });
}

if (ocrCopyBtn && ocrResultText) {
  ocrCopyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ocrResultText.value);
      const originalText = ocrCopyBtn.textContent;
      ocrCopyBtn.textContent = "Đã sao chép!";
      ocrCopyBtn.disabled = true;
      setTimeout(() => {
        ocrCopyBtn.textContent = originalText;
        ocrCopyBtn.disabled = false;
      }, 1500);
    } catch (err) {
      alert("Không thể sao chép văn bản.");
    }
  });
}




