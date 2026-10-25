import os
import json
import re

R2_BASE_URL = "https://pub-763a3a5ae235415cbef15b64f7a20820.r2.dev"

def normalize_title(name):
    title = os.path.splitext(name)[0]
    title = re.sub(r'^[xX]22', '', title)
    title = re.sub(r'[_\-]+', ' ', title)
    title = re.sub(r'\bread[\s_-]*along\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\bbook\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\bside[\s_-]*[0-9]+\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\bpart[\s_-]*[0-9]+\b', '', title, flags=re.IGNORECASE)
    return title.strip()

def get_unique_id(name):
    base = os.path.splitext(name)[0]
    base = re.sub(r'^[xX]22', '', base)
    base = re.sub(r'[_\-\s,\.]+', '_', base).strip('_').lower()
    return base

def scan_folder(folder_path=".", base_url=R2_BASE_URL):
    groups = {}

    for root, dirs, files in os.walk(folder_path):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext not in ['.pdf', '.mp3', '.m4a', '.wav', '.json', '.jpg', '.jpeg', '.png', '.webp']:
                continue

            rel_path = os.path.relpath(os.path.join(root, f), folder_path).replace("\\", "/")
            if rel_path.startswith("node_modules") or rel_path.startswith(".git") or rel_path.startswith("sync_data"):
                continue

            if f == "books.json":
                continue

            item_id = get_unique_id(f)
            # Find matching group
            matched_key = None
            for k in groups:
                if k == item_id or k in item_id or item_id in k:
                    matched_key = k
                    break
            
            if not matched_key:
                matched_key = item_id
                groups[matched_key] = {
                    "id": matched_key,
                    "title": normalize_title(f),
                    "pdfUrl": "",
                    "audioUrl": "",
                    "audios": [],
                    "syncUrl": "",
                    "coverUrl": ""
                }

            file_url = f"{base_url.rstrip('/')}/{rel_path.lstrip('/')}"
            
            if ext == '.pdf':
                groups[matched_key]["pdfUrl"] = file_url
                if not groups[matched_key]["title"]:
                    groups[matched_key]["title"] = normalize_title(f)
            elif ext in ['.mp3', '.m4a', '.wav']:
                part_match = re.search(r'part[_\s-]*(\d+)|side[_\s-]*([ab])|disc[_\s-]*(\d+)', f, re.IGNORECASE)
                part_label = None
                if part_match:
                    part_label = f"Part {part_match.group(1)}" if part_match.group(1) else (f"Side {part_match.group(2).upper()}" if part_match.group(2) else f"Disc {part_match.group(3)}")
                
                groups[matched_key]["audios"].append({
                    "name": f,
                    "url": file_url,
                    "partLabel": part_label
                })
                if not groups[matched_key]["audioUrl"]:
                    groups[matched_key]["audioUrl"] = file_url
            elif ext == '.json':
                groups[matched_key]["syncUrl"] = file_url
            elif ext in ['.jpg', '.jpeg', '.png', '.webp']:
                groups[matched_key]["coverUrl"] = file_url

    books = []
    for g in groups.values():
        if g["pdfUrl"] or len(g["audios"]) > 0:
            books.append(g)

    books.sort(key=lambda x: x["title"].lower())
    
    with open("books.json", "w", encoding="utf-8") as out:
        json.dump(books, out, ensure_ascii=False, indent=2)
    
    print(f"✅ Đã tạo thành công 'books.json' với {len(books)} cuốn sách!")
    print(f"🔗 Mẫu kiểm tra đường dẫn đầu tiên: {books[0] if books else 'Trống'}")

if __name__ == "__main__":
    scan_folder(".")
