import os
import sys
import json
import re
import urllib.parse

DEFAULT_R2_URL = "https://pub-763a3a5ae235415cbef15b64f7a20820.r2.dev"

def choose_folder():
    """Hỗ trợ mở cửa sổ chọn thư mục bằng đồ họa (Tkinter) hoặc nhập qua Terminal"""
    selected_dir = ""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        selected_dir = filedialog.askdirectory(title="Chọn thư mục chứa sách (PDF & MP3) để tạo books.json")
        root.destroy()
    except Exception:
        pass

    if not selected_dir:
        print("\n📂 Nhập đường dẫn thư mục sách trên máy (hoặc Enter để chọn thư mục hiện tại):")
        inp = input("   Đường dẫn: ").strip().strip('"').strip("'")
        selected_dir = inp if inp else os.getcwd()

    return os.path.abspath(selected_dir)

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

def scan_and_generate():
    print("=" * 60)
    print(" 📚 CÔNG CỤ TỰ ĐỘNG TẠO BOOKS.JSON CHO CLOUDFLARE R2")
    print("=" * 60)

    target_folder = choose_folder()
    if not os.path.isdir(target_folder):
        print(f"❌ Thư mục không tồn tại: {target_folder}")
        return

    print(f"\n📂 Thư mục đã chọn: {target_folder}")

    # Nhập URL R2 hoặc dùng mặc định
    print(f"\n🌐 Nhập URL Cloudflare R2 bucket:")
    print(f"   (Bấm Enter để dùng mặc định: {DEFAULT_R2_URL})")
    url_input = input("   R2 URL: ").strip().rstrip('/')
    base_url = url_input if url_input else DEFAULT_R2_URL

    print(f"\n🔍 Đang quét các tệp PDF, MP3, Ảnh bìa, JSON...")

    groups = {}

    for root, dirs, files in os.walk(target_folder):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext not in ['.pdf', '.mp3', '.m4a', '.wav', '.ogg', '.json', '.jpg', '.jpeg', '.png', '.webp']:
                continue

            # Bỏ qua các file và thư mục ẩn/hệ thống
            rel_path = os.path.relpath(os.path.join(root, f), target_folder).replace("\\", "/")
            if rel_path.startswith(".") or rel_path.startswith("node_modules"):
                continue

            if f.lower() == "books.json":
                continue

            item_id = get_unique_id(f)
            # Khớp nhóm truyện
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
                    "coverUrl": "",
                    "pdfUrl": "",
                    "audioUrl": "",
                    "audios": [],
                    "syncUrl": ""
                }

            encoded_rel = '/'.join(urllib.parse.quote(seg) for seg in rel_path.lstrip('/').split('/'))
            file_url = f"{base_url}/{encoded_rel}"

            if ext == '.pdf':
                groups[matched_key]["pdfUrl"] = file_url
                if not groups[matched_key]["title"]:
                    groups[matched_key]["title"] = normalize_title(f)

            elif ext in ['.mp3', '.m4a', '.wav', '.ogg']:
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
            # Sắp xếp các part audio nếu có nhiều part
            if len(g["audios"]) > 1:
                g["audios"].sort(key=lambda x: x["name"].lower())
                for idx, aud in enumerate(g["audios"]):
                    if not aud["partLabel"]:
                        aud["partLabel"] = f"Part {idx + 1}"
            books.append(g)

    books.sort(key=lambda x: x["title"].lower())

    # Lưu file books.json ngay tại thư mục đã chọn
    output_path = os.path.join(target_folder, "books.json")
    with open(output_path, "w", encoding="utf-8") as out:
        json.dump(books, out, ensure_ascii=False, indent=2)

    print("=" * 60)
    print(f"🎉 THÀNH CÔNG! Đã tạo file: books.json")
    print(f"📍 Vị trí file: {output_path}")
    print(f"📖 Tổng số đầu sách: {len(books)}")
    print("=" * 60)
    print("👉 Bây giờ bạn chỉ cần upload toàn bộ thư mục này (kèm file books.json) lên Cloudflare R2 là xong!")
    print("\nNhấn Enter để kết thúc...")
    try:
        input()
    except Exception:
        pass

if __name__ == "__main__":
    scan_and_generate()
