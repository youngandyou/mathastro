#!/usr/bin/env python3
"""
scripts/update_category_counts.py
Automatically scans posts/ to count articles per category and updates:
1. assets/category-counts.json
2. _quarto.yml navbar counts
3. assets/navbar-submenus.html subcategory counts
4. index.qmd archive card counts

Usage: python3 scripts/update_category_counts.py
"""

import os
import re
import json
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(ROOT_DIR, "posts")
QUARTO_YML = os.path.join(ROOT_DIR, "_quarto.yml")
NAVBAR_SUBMENUS = os.path.join(ROOT_DIR, "assets", "navbar-submenus.html")
CATEGORY_JSON = os.path.join(ROOT_DIR, "assets", "category-counts.json")
INDEX_QMD = os.path.join(ROOT_DIR, "index.qmd")

def find_qmd_files(dir_path):
    qmd_files = []
    for root, _, files in os.walk(dir_path):
        for f in files:
            if f.endswith(".qmd"):
                qmd_files.append(os.path.join(root, f))
    return qmd_files

def parse_frontmatter_categories(content):
    match = re.match(r"^---\r?\n([\s\S]*?)\r?\n---", content)
    if not match:
        return []

    frontmatter = match.group(1)

    # Ignore drafts
    if re.search(r"^draft:\s*true", frontmatter, re.MULTILINE):
        return []

    categories = []
    lines = frontmatter.splitlines()
    in_categories = False

    for line in lines:
        if re.match(r"^categories:\s*$", line):
            in_categories = True
            continue

        single_arr_match = re.match(r"^categories:\s*\[(.*?)\]", line)
        if single_arr_match:
            items = [s.strip().strip("'\"") for s in single_arr_match.group(1).split(",") if s.strip()]
            categories.extend(items)
            continue

        if in_categories:
            item_match = re.match(r"^\s*-\s*(.+)$", line)
            if item_match:
                categories.append(item_match.group(1).strip().strip("'\""))
            elif re.match(r"^\S", line):
                in_categories = False

    return categories

def count_posts():
    qmd_files = find_qmd_files(POSTS_DIR)
    path_counts = {}
    leaf_counts = {}
    total_posts = 0

    for file_path in qmd_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(file_path, "r", encoding="cp949", errors="ignore") as f:
                content = f.read()

        raw_categories = parse_frontmatter_categories(content)
        if not raw_categories:
            continue

        total_posts += 1
        counted_paths_for_post = set()

        for raw_cat in raw_categories:
            parts = [p.strip() for p in re.split(r"\s*(?:>|/|::)\s*", raw_cat) if p.strip()]
            current_path = ""
            for part in parts:
                current_path = f"{current_path} > {part}" if current_path else part
                counted_paths_for_post.add(current_path)

        for p in counted_paths_for_post:
            path_counts[p] = path_counts.get(p, 0) + 1
            leaf = p.split(" > ")[-1]
            leaf_counts[leaf] = leaf_counts.get(leaf, 0) + 1
            leaf_counts[leaf.lower()] = leaf_counts.get(leaf.lower(), 0) + 1

    return total_posts, path_counts, leaf_counts

def update_quarto_yml(path_counts, leaf_counts):
    if not os.path.exists(QUARTO_YML):
        return

    with open(QUARTO_YML, "r", encoding="utf-8") as f:
        content = f.read()

    category_map = {
        "Math": ["Math"],
        "Calculus": ["Math > Calculus", "Calculus"],
        "Abstract Algebra": ["Math > Abstract Algebra", "Abstract Algebra"],
        "Linear Algebra": ["Math > Linear Algebra", "Linear Algebra"],
        "Matrix Algebra": ["Math > Matrix Algebra", "Matrix Algebra"],
        "Complex Analysis": ["Math > Complex Analysis", "Complex Analysis"],
        "Analysis": ["Math > Analysis", "Analysis"],
        "Topology": ["Math > Topology", "Topology"],
        "Differential Geometry": ["Math > Differential Geometry", "Differential Geometry"],
        "Graph Theory": ["Math > Graph Theory", "Graph Theory"],
        "Numerical Analysis": ["Math > Numerical Analysis", "Numerical Analysis"],
        "Astronomy": ["Astronomy"],
        "Radio Astronomy": ["Astronomy > Radio Astronomy", "Radio Astronomy"],
        "General Relativity": ["Astronomy > General Relativity", "General Relativity"],
        "High Energy": ["Astronomy > High Energy Astrophysics", "High Energy Astrophysics", "High Energy"],
        "Relativistic Jets": ["Astronomy > Relativistic Jets", "Relativistic Jets"],
        "Physics": ["Physics"],
        "Thermodynamics": ["Physics > Thermodynamics", "Thermodynamics"],
        "Computer": ["Computer"],
        "Reinforcement Learning": ["Computer > Machine Learning > Reinforcement Learning", "Reinforcement Learning"]
    }

    lines = content.splitlines()
    for i in range(len(lines)):
        line = lines[i]
        href_match = re.search(r"href:\s*index\.qmd#category=([^#\s]+)", line)
        if href_match and i + 1 < len(lines):
            import urllib.parse
            raw_cat_key = urllib.parse.unquote(href_match.group(1)).strip()
            lookups = category_map.get(raw_cat_key, [raw_cat_key])
            count = 0
            for k in lookups:
                if k in path_counts:
                    count = path_counts[k]
                    break
                elif k in leaf_counts:
                    count = leaf_counts[k]
                    break

            next_line = lines[i + 1]
            if re.search(r'text:\s*"?[^"]*\(\d+\)"?', next_line):
                lines[i + 1] = re.sub(r"\(\d+\)", f"({count})", next_line)

    with open(QUARTO_YML, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("✓ Updated _quarto.yml navbar counts")

def update_navbar_submenus(path_counts):
    if not os.path.exists(NAVBAR_SUBMENUS):
        return

    with open(NAVBAR_SUBMENUS, "r", encoding="utf-8") as f:
        content = f.read()

    subcat_lookups = {
        "Group Theory": "Math > Abstract Algebra > Group Theory",
        "Ring Theory": "Math > Abstract Algebra > Ring Theory",
        "Binary Algebraic Structure": "Math > Abstract Algebra > Binary Algebraic Structure",
        "Field Theory": "Math > Abstract Algebra > Field Theory",
        "Vector Calculus": "Math > Calculus > Vector Calculus",
        "Multivariable": "Math > Analysis > Multivariable",
        "Curve Theory": "Math > Differential Geometry > Curve Theory",
        "Graph": "Math > Graph Theory > Graph",
        "Network Analysis": "Math > Graph Theory > Network Analysis",
        "Algorithm": "Math > Graph Theory > Algorithm",
        "Tree": "Math > Graph Theory > Tree",
        "Radio Software": "Astronomy > Radio Astronomy > Radio Software",
        "AIPS": "Astronomy > Radio Astronomy > Radio Software > AIPS",
        "resolve": "Astronomy > Radio Astronomy > Radio Software > resolve",
        "Equivalence Principle": "Astronomy > General Relativity > Equivalence Principle"
    }

    for key, p in subcat_lookups.items():
        count = path_counts.get(p, 0)
        pattern = rf'(key:\s*["\']{re.escape(key)}["\'][\s\S]*?count:\s*)\d+'
        content = re.sub(pattern, rf'\g<1>{count}', content)

    with open(NAVBAR_SUBMENUS, "w", encoding="utf-8") as f:
        f.write(content)
    print("✓ Updated assets/navbar-submenus.html counts")

def update_index_qmd(path_counts):
    if not os.path.exists(INDEX_QMD):
        return

    with open(INDEX_QMD, "r", encoding="utf-8") as f:
        content = f.read()

    math_count = path_counts.get("Math", 0)
    astro_count = path_counts.get("Astronomy", 0)

    content = re.sub(r"(Mathematics\s*\(수학\)\s*</div>\s*<div[^>]*>)\d+편", rf"\g<1>{math_count}편", content)
    content = re.sub(r"(Astronomy\s*\(천문학\)\s*</div>\s*<div[^>]*>)\d+편", rf"\g<1>{astro_count}편", content)

    with open(INDEX_QMD, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✓ Updated index.qmd archive cards (Math: {math_count}편, Astronomy: {astro_count}편)")

def write_category_json(total_posts, path_counts, leaf_counts):
    data = {
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "totalPosts": total_posts,
        "counts": path_counts,
        "leafCounts": leaf_counts,
        "topCategories": {
            "Math": path_counts.get("Math", 0),
            "Astronomy": path_counts.get("Astronomy", 0),
            "Physics": path_counts.get("Physics", 0),
            "Computer": path_counts.get("Computer", 0),
        }
    }
    with open(CATEGORY_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {CATEGORY_JSON} (Total: {total_posts} posts)")

def main():
    print("Scanning posts and updating category counts...")
    total_posts, path_counts, leaf_counts = count_posts()
    print(f"Found {total_posts} posts.")
    update_quarto_yml(path_counts, leaf_counts)
    update_navbar_submenus(path_counts)
    update_index_qmd(path_counts)
    write_category_json(total_posts, path_counts, leaf_counts)
    print("Category counts successfully updated!")

if __name__ == "__main__":
    main()
