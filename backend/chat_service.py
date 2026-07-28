import json
import os
from openai import OpenAI
from sqlalchemy.orm import Session
from audit_service import create_audit_log_entry
from auth import UserResponse
from pricing import calculate_cost


def call_chat_api(message: str, model_name: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set in environment")

    client = OpenAI(api_key=api_key)

    system_prompt = (
        "You are a helpful AI assistant. Respond ONLY with valid JSON in this exact format: "
        '{"reply": "your response here", "rationale": "1-2 sentence explanation"}'
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
    )

    usage = response.usage or type('Usage', (), {'prompt_tokens': 0, 'completion_tokens': 0})()

    return {
        "content": response.choices[0].message.content,
        "model": response.model,
        "prompt_tokens": usage.prompt_tokens,
        "completion_tokens": usage.completion_tokens,
    }


def parse_response(response_text: str) -> dict:
    try:
        parsed = json.loads(response_text)
        reply = parsed.get("reply", "")
        rationale = parsed.get("rationale", "")
        return {"reply": reply, "rationale": rationale, "parsed": True}
    except json.JSONDecodeError:
        return {
            "reply": response_text,
            "rationale": "Not returned by model in parseable form",
            "parsed": False,
        }


def process_chat_message(
    message: str,
    policy_id: str,
    current_user: UserResponse,
    db: Session,
) -> dict:
    model_name = os.getenv("MODEL_NAME", "gpt-4o-mini")

    api_response = call_chat_api(message, model_name)
    parsed_response = parse_response(api_response["content"])

    prompt_tokens = api_response.get("prompt_tokens", 0)
    completion_tokens = api_response.get("completion_tokens", 0)
    cost = calculate_cost(model_name, prompt_tokens, completion_tokens)

    entry = create_audit_log_entry(
        source_type="chat_console",
        user_id=current_user.id,
        user_display_name=current_user.display_name,
        ai_system="OpenAI ChatGPT API",
        model_version=model_name,
        input_text=message,
        input_source="chat_console_ui",
        policy_invoked=policy_id,
        reasoning_summary=parsed_response["rationale"],
        output_text=parsed_response["reply"],
        downstream_action="Response displayed to user in chat UI",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_per_response=cost,
        db=db,
    )

    return {
        "reply": parsed_response["reply"],
        "response_id": entry.response_id,
    }
