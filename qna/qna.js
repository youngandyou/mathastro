(function () {
  const root = document.querySelector("[data-qna-root]");

  if (!root) {
    return;
  }

  const featuredSection = root.querySelector("[data-qna-featured]");
  const featuredContent = root.querySelector("[data-qna-featured-content]");
  const list = root.querySelector("[data-qna-list]");
  const empty = root.querySelector("[data-qna-empty]");
  const error = root.querySelector("[data-qna-error]");
  const filterButtons = Array.from(root.querySelectorAll("[data-qna-filter]"));

  const statusClasses = {
    "답변 대기": "waiting",
    "검토 중": "reviewing",
    "답변 완료": "answered",
    Featured: "featured",
  };

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function createBadge(text, type) {
    return createElement("span", "qna-badge qna-badge-" + type, text);
  }

  function createArticleLink(article) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = article.url;
    link.textContent = article.title;
    item.appendChild(link);
    return item;
  }

  function createQuestionCard(question, isFeatured) {
    const article = createElement(
      "article",
      "qna-card" + (isFeatured ? " qna-card-featured" : "")
    );
    article.id = "question-" + question.id;

    const header = createElement("header", "qna-card-header");
    const title = createElement("h3", null, question.title);
    const metadata = createElement("div", "qna-metadata");
    metadata.append(
      createBadge(question.field, "field"),
      createBadge(question.difficulty, "difficulty"),
      createBadge(question.status, "status " + (statusClasses[question.status] || "waiting"))
    );
    header.append(title, metadata);

    const excerpt = createElement("p", "qna-excerpt", question.excerpt);
    const date = createElement("time", "qna-date", question.date);
    date.dateTime = question.date;

    const details = createElement("details", "qna-details");
    const summary = createElement(
      "summary",
      null,
      question.answer ? "질문과 답변 보기" : "질문 내용 보기"
    );
    const questionBody = createElement("div", "qna-question-body");
    questionBody.append(
      createElement("h4", null, "질문"),
      createElement("p", null, question.question)
    );
    details.append(summary, questionBody);

    if (question.answer) {
      const answer = createElement("section", "qna-official-answer");
      const label = createElement("p", "qna-answer-label");
      const icon = createElement("i", "bi bi-check-circle-fill");
      icon.setAttribute("aria-hidden", "true");
      label.append(icon, document.createTextNode(" Mathastro Official Answer"));
      answer.append(label, createElement("p", null, question.answer));
      details.appendChild(answer);
    }

    if (question.relatedArticles && question.relatedArticles.length) {
      const related = createElement("section", "qna-related");
      const relatedList = document.createElement("ul");
      question.relatedArticles.forEach((item) => {
        relatedList.appendChild(createArticleLink(item));
      });
      related.append(createElement("h4", null, "Mathastro에서 더 공부하기"), relatedList);
      details.appendChild(related);
    }

    if (question.developedArticle) {
      const developed = createElement("aside", "qna-developed");
      const developedText = createElement(
        "span",
        null,
        "이 질문은 Mathastro Article로 발전했습니다."
      );
      const developedLink = document.createElement("a");
      developedLink.href = question.developedArticle.url;
      developedLink.textContent = question.developedArticle.title;
      developed.append(developedText, developedLink);
      details.appendChild(developed);
    }

    if (question.discussionUrl) {
      const discussionLink = document.createElement("a");
      discussionLink.className = "qna-discussion-link";
      discussionLink.href = question.discussionUrl;
      discussionLink.target = "_blank";
      discussionLink.rel = "noopener noreferrer";
      discussionLink.textContent = "GitHub에서 대화 이어가기";
      details.appendChild(discussionLink);
    }

    article.append(header, excerpt, date, details);
    return article;
  }

  function renderFeatured(questions) {
    const featured = questions.find((question) => question.featured);
    featuredContent.replaceChildren();

    if (!featured) {
      featuredSection.hidden = true;
      return;
    }

    featuredContent.appendChild(createQuestionCard(featured, true));
    featuredSection.hidden = false;
  }

  function renderQuestions(questions, field) {
    const visibleQuestions = field === "All"
      ? questions
      : questions.filter((question) => question.field === field);

    list.replaceChildren();
    visibleQuestions.forEach((question) => {
      list.appendChild(createQuestionCard(question, false));
    });
    empty.hidden = visibleQuestions.length !== 0;
  }

  function setupFilters(questions) {
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        filterButtons.forEach((item) => {
          const selected = item === button;
          item.classList.toggle("active", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
        renderQuestions(questions, button.dataset.qnaFilter);
      });
    });
  }

  async function initialize() {
    try {
      const response = await fetch("questions.json");

      if (!response.ok) {
        throw new Error("Unable to load Q&A data");
      }

      const questions = await response.json();
      renderFeatured(questions);
      renderQuestions(questions, "All");
      setupFilters(questions);
    } catch (_error) {
      featuredSection.hidden = true;
      list.hidden = true;
      empty.hidden = true;
      error.hidden = false;
    }
  }

  initialize();
})();
