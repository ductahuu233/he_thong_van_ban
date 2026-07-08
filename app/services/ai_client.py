import os

import httpx


DEFAULT_SYSTEM_PROMPT = (
    "Ban la tro ly soan thao van ban hanh chinh Viet Nam. "
    "Viet ro rang, trang trong, dung trong tam, khong bia du kien."
)


async def generate_ai_text(
    system_prompt: str,
    context_text: str,
    user_request: str,
) -> str:
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    base_url = os.getenv("LLM_BASE_URL", "").rstrip("/")
    api_key = os.getenv("LLM_API_KEY", "")
    model = os.getenv("LLM_MODEL", default_model_for_provider(provider))

    if not base_url and provider not in {"gemini", "ollama"}:
        return build_offline_draft(context_text=context_text, user_request=user_request)

    endpoint, headers, payload = build_llm_request(
        provider=provider,
        base_url=base_url,
        api_key=api_key,
        model=model,
        system_prompt=system_prompt or DEFAULT_SYSTEM_PROMPT,
        context_text=context_text,
        user_request=user_request,
    )

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    return extract_response_text(provider, data)


def default_model_for_provider(provider: str) -> str:
    if provider == "gemini":
        return "gemini-1.5-flash"
    if provider == "ollama":
        return "llama3.2"
    return "gpt-4o-mini"


def build_llm_request(
    provider: str,
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    context_text: str,
    user_request: str,
) -> tuple[str, dict[str, str], dict]:
    headers = {"Content-Type": "application/json"}
    prompt = f"Ngu canh:\n{context_text}\n\nYeu cau:\n{user_request}"

    if provider == "gemini":
        gemini_base = base_url or "https://generativelanguage.googleapis.com/v1beta"
        endpoint = f"{gemini_base}/models/{model}:generateContent"
        if api_key:
            endpoint = f"{endpoint}?key={api_key}"
        return (
            endpoint,
            headers,
            {
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2},
            },
        )

    if provider == "ollama":
        ollama_base = base_url or "http://127.0.0.1:11434"
        return (
            f"{ollama_base}/api/chat",
            headers,
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
            },
        )

    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    return (
        f"{base_url}/chat/completions",
        headers,
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        },
    )


def extract_response_text(provider: str, data: dict) -> str:
    if provider == "gemini":
        parts = data["candidates"][0]["content"]["parts"]
        return "\n".join(part.get("text", "") for part in parts).strip()
    if provider == "ollama":
        return data["message"]["content"].strip()
    return data["choices"][0]["message"]["content"].strip()


def build_offline_draft(context_text: str, user_request: str) -> str:
    user_req_lower = user_request.lower()
    if "nghị quyết" in user_req_lower or "nq-" in user_req_lower or "nq" in user_req_lower:
        return (
            "Căn cứ Luật Tổ chức chính quyền địa phương số 72/2025/QH15;\n"
            "Căn cứ Luật Ngân sách nhà nước số 89/2015/QH15;\n"
            "Căn cứ Luật Công an nhân dân số 37/2018/QH14; được sửa đổi, bổ sung bởi Luật số 21/2023/QH15;\n"
            "Căn cứ Luật Thủ đô số 39/2024/QH15;\n"
            "Xét Tờ trình số 110/TTr-UBND ngày 06 tháng 5 năm 2026 của Ủy ban nhân dân thành phố Hà Nội về việc đề nghị ban hành Nghị quyết \"Quy định nội dung, mức chi hỗ trợ một số lực lượng trong công tác đảm bảo an ninh trật tự và thực hiện các nhiệm vụ chính trị thuộc Công an thành phố Hà Nội\"; Báo cáo thẩm tra số 37/BC-BPC ngày 08 tháng 5 năm 2026 của Ban Pháp chế Hội đồng nhân dân Thành phố; ý kiến thảo luận và kết quả biểu quyết của đại biểu Hội đồng nhân dân Thành phố tại kỳ họp;\n\n"
            "Hội đồng nhân dân ban hành Nghị quyết Quy định nội dung, mức chi hỗ trợ một số lực lượng trong công tác đảm bảo an ninh trật tự và thực hiện các nhiệm vụ chính trị thuộc Công an thành phố Hà Nội.\n\n"
            "Điều 1. Phạm vi điều chỉnh\n"
            "Nghị quyết này quy định nội dung, mức chi hỗ trợ một số lực lượng trong công tác đảm bảo an ninh trật tự và thực hiện các nhiệm vụ chính trị thuộc Công an thành phố Hà Nội.\n\n"
            "Điều 2. Đối tượng áp dụng\n"
            "1. Cán bộ, chiến sĩ lực lượng điều tra, lực lượng Cảnh sát quản lý hành chính về trật tự xã hội, lực lượng Cảnh sát giao thông, lực lượng Cảnh sát cơ động, các Phòng chức năng, Đồn Công an trong công tác đảm bảo an ninh trật tự và thực hiện các nhiệm vụ chính trị thuộc Công an thành phố Hà Nội.\n"
            "2. Cơ quan, tổ chức, cá nhân có liên quan.\n\n"
            "Điều 3. Nội dung hỗ trợ, nguyên tắc, nguồn kinh phí thực hiện\n"
            "1. Hỗ trợ hàng tháng cho cán bộ, chiến sĩ Văn phòng Cơ quan Cảnh sát điều tra, Phòng Cảnh sát hình sự, Phòng Cảnh sát kinh tế, Phòng Cảnh sát quản lý hành chính về trật tự xã hội, Phòng Cảnh sát giao thông, Phòng Cảnh sát cơ động, Phòng Tài chính, Phòng Viễn thông, tin học và cơ yếu, Phòng Hậu cần, Phòng Tổ chức cán bộ, Phòng Công tác chính trị, Thanh tra Công an Thành phố, Cơ quan Ủy ban kiểm tra Đảng ủy Công an Thành phố, Đồn Công an thuộc Công an thuộc Công an thành phố Hà Nội; mức hỗ trợ: 5.000.000 đồng/người/tháng.\n"
            "2. Nguyên tắc thực hiện: Trường hợp một cán bộ, chiến sĩ ở nhiều vị trí hưởng các chính sách của Thành phố thì chỉ được hưởng một mức hỗ trợ cao nhất.\n"
            "3. Nguồn kinh phí thực hiện: Ngân sách cấp Thành phố.\n\n"
            "Điều 4. Tổ chức thực hiện\n"
            "1. Giao Ủy ban nhân dân Thành phố tổ chức thực hiện Nghị quyết.\n"
            "2. Giao Thường trực Hội đồng nhân dân, các Ban của Hội đồng nhân dân, các Tổ đại biểu Hội đồng nhân dân Thành phố giám sát việc thực hiện Nghị quyết.\n"
            "3. Đề nghị Ủy ban Mặt trận Tổ quốc Việt Nam thành phố Hà Nội và các tổ chức chính trị - xã hội phối hợp tổ chức tuyên truyền và giám sát việc thực hiện Nghị quyết.\n\n"
            "Điều 5. Hiệu lực thi hành\n"
            "1. Nghị quyết này có hiệu lực thi hành kể từ ngày 11 tháng 5 năm 2026.\n"
            "2. Nghị quyết số 38/2024/NQ-HĐND ngày 10 tháng 12 năm 2024 của Hội đồng nhân dân thành phố Hà Nội về việc quy định một số nội dung, mức chi hỗ trợ lực lượng Cảnh sát hình sự, lực lượng Cảnh sát chữa cháy và cứu nạn, cứu hộ thuộc Công an thành phố Hà Nội hết hiệu lực kể từ ngày Nghị quyết này có hiệu lực thi hành.\n\n"
            "Nghị quyết này đã được Hội đồng nhân dân thành phố Hà Nội khóa XVII, kỳ họp thứ hai thông qua ngày 11 tháng 5 năm 2026."
        )

    context_summary = context_text.strip()
    if len(context_summary) > 1200:
        context_summary = f"{context_summary[:1200].rstrip()}..."

    parts = [
        "Kính gửi: Các đơn vị, cá nhân có liên quan.",
        "",
        f"Căn cứ yêu cầu: {user_request.strip() or 'Soạn thảo văn bản hành chính theo thông tin đã cung cấp.'}",
    ]
    if context_summary:
        parts.extend(["", "Thông tin ngữ cảnh:", context_summary])

    parts.extend(
        [
            "",
            "Nội dung đề xuất:",
            "1. Ghi nhận nội dung, phạm vi và mục đích xử lý theo yêu cầu nêu trên.",
            "2. Đề nghị các bộ phận liên quan phối hợp rà soát, cung cấp thông tin và triển khai đúng tiến độ.",
            "3. Trong quá trình thực hiện, nếu phát sinh khó khăn, kịp thời báo cáo người có thẩm quyền để xem xét, chỉ đạo.",
            "",
            "Trân trọng./.",
        ]
    )
    return "\n".join(parts)
