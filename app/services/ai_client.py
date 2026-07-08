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
