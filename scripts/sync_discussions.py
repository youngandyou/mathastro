#!/usr/bin/env python3
"""Build the Q&A JSON feed from GitHub Discussions."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


GRAPHQL_ENDPOINT = "https://api.github.com/graphql"
DEFAULT_CATEGORY = "Q&A"
DEFAULT_OUTPUT = "qna/questions.json"
ALLOWED_FIELDS = {
    "Astronomy",
    "Physics",
    "Mathematics",
    "Computer Science",
    "Others",
}
ALLOWED_DIFFICULTIES = {"입문", "학부", "대학원", "전문"}
SECTION_PATTERN = re.compile(r"^###\s+(.+?)\s*$", re.MULTILINE)
URL_PATTERN = re.compile(r"https?://[^\s<>\])}]+")
QUESTION_PREFIX_PATTERN = re.compile(r"^\[질문\]\s*", re.IGNORECASE)

QUERY = """
query MathastroDiscussions($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    discussions(
      first: 100
      after: $after
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        title
        body
        bodyText
        createdAt
        url
        isAnswered
        category {
          name
        }
        answer {
          bodyText
        }
      }
    }
    pinnedDiscussions(first: 100) {
      nodes {
        discussion {
          number
        }
      }
    }
  }
}
"""


class SyncError(RuntimeError):
    """Raised when Discussion data cannot be synchronized safely."""


def graphql_request(token: str, variables: dict[str, Any]) -> dict[str, Any]:
    payload = json.dumps({"query": QUERY, "variables": variables}).encode("utf-8")
    request = urllib.request.Request(
        GRAPHQL_ENDPOINT,
        data=payload,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "mathastro-discussion-sync",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")
        raise SyncError(f"GitHub GraphQL request failed ({error.code}): {message}") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise SyncError(f"GitHub GraphQL request failed: {error}") from error

    if result.get("errors"):
        messages = "; ".join(item.get("message", "Unknown error") for item in result["errors"])
        raise SyncError(f"GitHub GraphQL returned errors: {messages}")

    return result


def fetch_discussions(token: str, repository: str) -> tuple[list[dict[str, Any]], set[int]]:
    try:
        owner, name = repository.split("/", 1)
    except ValueError as error:
        raise SyncError("GITHUB_REPOSITORY must use the OWNER/REPOSITORY format") from error

    if not owner or not name:
        raise SyncError("GITHUB_REPOSITORY must use the OWNER/REPOSITORY format")

    discussions: list[dict[str, Any]] = []
    pinned_numbers: set[int] = set()
    cursor: str | None = None

    while True:
        result = graphql_request(
            token,
            {"owner": owner, "name": name, "after": cursor},
        )
        repository_data = result.get("data", {}).get("repository")
        if repository_data is None:
            raise SyncError(f"Repository not found or inaccessible: {repository}")

        connection = repository_data["discussions"]
        discussions.extend(connection.get("nodes") or [])
        pinned_numbers.update(
            node["discussion"]["number"]
            for node in (repository_data["pinnedDiscussions"].get("nodes") or [])
        )

        page_info = connection["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        cursor = page_info.get("endCursor")
        if not cursor:
            raise SyncError("GitHub returned another page without an end cursor")

    return discussions, pinned_numbers


def clean_form_value(value: str) -> str:
    cleaned = value.strip()
    if cleaned.casefold() in {"no response", "_no response_"}:
        return ""
    return cleaned


def parse_form_sections(body: str) -> dict[str, str]:
    normalized_body = body.replace("\r\n", "\n")
    matches = list(SECTION_PATTERN.finditer(normalized_body))
    sections: dict[str, str] = {}

    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized_body)
        sections[match.group(1).strip()] = clean_form_value(normalized_body[start:end])

    return sections


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def excerpt(value: str, limit: int = 180) -> str:
    compact = collapse_whitespace(value)
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def related_mathastro_articles(value: str) -> list[dict[str, str]]:
    articles: list[dict[str, str]] = []
    seen: set[str] = set()

    for match in URL_PATTERN.finditer(value):
        url = match.group(0).rstrip(".,;:")
        parsed = urllib.parse.urlparse(url)
        if parsed.netloc.casefold() != "youngandyou.github.io":
            continue
        if not parsed.path.startswith("/mathastro/") or url in seen:
            continue

        seen.add(url)
        path_parts = [part for part in parsed.path.split("/") if part]
        slug = urllib.parse.unquote(path_parts[-1]) if path_parts else ""
        title = re.sub(r"[_-]+", " ", slug).strip() or "관련 Mathastro 글"
        articles.append({"title": title, "url": url})

    return articles


def discussion_to_question(
    discussion: dict[str, Any],
    pinned_numbers: set[int],
) -> dict[str, Any]:
    number = int(discussion["number"])
    sections = parse_form_sections(discussion.get("body") or "")

    field = sections.get("분야", "")
    if field not in ALLOWED_FIELDS:
        field = "Others"

    difficulty = sections.get("난이도", "")
    if difficulty not in ALLOWED_DIFFICULTIES:
        difficulty = "입문"

    question = clean_form_value(sections.get("질문 내용", ""))
    if not question:
        question = collapse_whitespace(discussion.get("bodyText") or discussion.get("body") or "")
    if not question:
        question = "질문 내용이 입력되지 않았습니다."

    title = QUESTION_PREFIX_PATTERN.sub("", discussion.get("title") or "").strip()
    if not title:
        title = f"질문 #{number}"

    is_featured = number in pinned_numbers
    is_answered = bool(discussion.get("isAnswered") and discussion.get("answer"))
    if is_featured:
        status = "Featured"
    elif is_answered:
        status = "답변 완료"
    else:
        status = "답변 대기"

    created_at = discussion.get("createdAt") or ""
    date = created_at[:10] if len(created_at) >= 10 else created_at
    related_material = sections.get("관련 자료 또는 Mathastro 글", "")

    return {
        "id": f"discussion-{number}",
        "title": title,
        "field": field,
        "difficulty": difficulty,
        "status": status,
        "featured": is_featured,
        "date": date,
        "excerpt": excerpt(question),
        "question": question,
        "answer": discussion["answer"]["bodyText"].strip() if is_answered else None,
        "relatedArticles": related_mathastro_articles(related_material),
        "developedArticle": None,
        "discussionUrl": discussion.get("url"),
    }


def build_questions(
    discussions: list[dict[str, Any]],
    pinned_numbers: set[int],
    category: str,
) -> list[dict[str, Any]]:
    return [
        discussion_to_question(discussion, pinned_numbers)
        for discussion in discussions
        if (discussion.get("category") or {}).get("name") == category
    ]


def write_questions(path: Path, questions: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(questions, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"JSON output path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--category",
        default=os.environ.get("QNA_DISCUSSION_CATEGORY", DEFAULT_CATEGORY),
        help=f"Discussion category name (default: {DEFAULT_CATEGORY})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    repository = os.environ.get("GITHUB_REPOSITORY", "").strip()

    if not token:
        raise SyncError("GITHUB_TOKEN is required")
    if not repository:
        raise SyncError("GITHUB_REPOSITORY is required")

    discussions, pinned_numbers = fetch_discussions(token, repository)
    questions = build_questions(discussions, pinned_numbers, args.category)
    write_questions(Path(args.output), questions)
    print(f"Synced {len(questions)} questions from the {args.category!r} category.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SyncError as error:
        print(f"sync_discussions.py: {error}", file=sys.stderr)
        sys.exit(1)
