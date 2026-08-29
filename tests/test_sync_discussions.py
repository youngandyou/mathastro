import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from sync_discussions import build_questions, parse_form_sections  # noqa: E402


class SyncDiscussionsTest(unittest.TestCase):
    def test_parses_github_discussion_form_sections(self):
        sections = parse_form_sections(
            """### 분야

Astronomy

### 난이도

학부

### 질문 내용

첫째 줄입니다.
둘째 줄입니다.

### 관련 자료 또는 Mathastro 글

_No response_
"""
        )

        self.assertEqual(sections["분야"], "Astronomy")
        self.assertEqual(sections["난이도"], "학부")
        self.assertEqual(sections["질문 내용"], "첫째 줄입니다.\n둘째 줄입니다.")
        self.assertEqual(sections["관련 자료 또는 Mathastro 글"], "")

    def test_builds_answered_and_featured_question(self):
        discussions = [
            {
                "number": 7,
                "title": "[질문] Visibility란 무엇인가요?",
                "body": """### 분야

Astronomy

### 난이도

대학원

### 질문 내용

Visibility의 물리적 의미가 궁금합니다.

### 관련 자료 또는 Mathastro 글

https://youngandyou.github.io/mathastro/posts/Astronomy/Interferometer_1/
https://example.com/reference
""",
                "bodyText": "fallback",
                "createdAt": "2026-08-29T11:30:00Z",
                "url": "https://github.com/youngandyou/mathastro/discussions/7",
                "isAnswered": True,
                "category": {"name": "Q&A"},
                "answer": {"bodyText": "Visibility는 복소 상관값입니다."},
            }
        ]

        questions = build_questions(discussions, {7}, "Q&A")

        self.assertEqual(len(questions), 1)
        question = questions[0]
        self.assertEqual(question["id"], "discussion-7")
        self.assertEqual(question["title"], "Visibility란 무엇인가요?")
        self.assertEqual(question["status"], "Featured")
        self.assertTrue(question["featured"])
        self.assertEqual(question["date"], "2026-08-29")
        self.assertEqual(question["answer"], "Visibility는 복소 상관값입니다.")
        self.assertEqual(
            question["relatedArticles"],
            [
                {
                    "title": "Interferometer 1",
                    "url": "https://youngandyou.github.io/mathastro/posts/Astronomy/Interferometer_1/",
                }
            ],
        )

    def test_filters_category_and_supplies_safe_fallbacks(self):
        discussions = [
            {
                "number": 1,
                "title": "[질문] ",
                "body": "### 질문 내용\n\n테스트 질문",
                "bodyText": "테스트 질문",
                "createdAt": "2026-08-29T00:00:00Z",
                "url": "https://github.com/youngandyou/mathastro/discussions/1",
                "isAnswered": False,
                "category": {"name": "Q&A"},
                "answer": None,
            },
            {
                "number": 2,
                "title": "공지",
                "body": "공지입니다.",
                "bodyText": "공지입니다.",
                "createdAt": "2026-08-28T00:00:00Z",
                "url": "https://github.com/youngandyou/mathastro/discussions/2",
                "isAnswered": False,
                "category": {"name": "Announcements"},
                "answer": None,
            },
        ]

        questions = build_questions(discussions, set(), "Q&A")

        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["title"], "질문 #1")
        self.assertEqual(questions[0]["field"], "Others")
        self.assertEqual(questions[0]["difficulty"], "입문")
        self.assertEqual(questions[0]["status"], "답변 대기")


if __name__ == "__main__":
    unittest.main()
