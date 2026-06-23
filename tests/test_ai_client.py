from app.services.ai_client import extract_response_text


def test_extract_openai_compatible_response_text():
    payload = {"choices": [{"message": {"content": "Noi dung OpenAI compatible"}}]}

    assert extract_response_text("openai", payload) == "Noi dung OpenAI compatible"


def test_extract_gemini_response_text():
    payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "Noi dung Gemini"},
                    ]
                }
            }
        ]
    }

    assert extract_response_text("gemini", payload) == "Noi dung Gemini"
