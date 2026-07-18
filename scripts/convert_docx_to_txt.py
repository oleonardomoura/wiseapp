import sys
import os
import zipfile
import xml.etree.ElementTree as ET


def extract_text_from_docx(docx_path: str) -> str:
    with zipfile.ZipFile(docx_path) as z:
        xml_bytes = z.read("word/document.xml")

    root = ET.fromstring(xml_bytes)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    paragraphs = []
    for p in root.findall(".//w:p", ns):
        parts = []
        for node in p.iter():
            tag = node.tag
            if tag == f"{{{ns['w']}}}t":
                if node.text:
                    parts.append(node.text)
            elif tag == f"{{{ns['w']}}}tab":
                parts.append("\t")
            elif tag == f"{{{ns['w']}}}br":
                parts.append("\n")
        text = "".join(parts).strip()
        if text:
            paragraphs.append(text)

    return "\n\n".join(paragraphs).strip() + "\n"


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python3 scripts/convert_docx_to_txt.py <input_dir>", file=sys.stderr)
        return 2

    input_dir = sys.argv[1]
    if not os.path.isdir(input_dir):
        print(f"input_dir not found: {input_dir}", file=sys.stderr)
        return 2

    converted = 0
    skipped = 0
    failed = 0

    for name in sorted(os.listdir(input_dir)):
        if not name.lower().endswith(".docx"):
            continue
        docx_path = os.path.join(input_dir, name)
        txt_path = os.path.join(input_dir, os.path.splitext(name)[0] + ".txt")

        try:
            text = extract_text_from_docx(docx_path)
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(text)
            converted += 1
        except Exception as e:
            failed += 1
            print(f"failed: {name}: {e}", file=sys.stderr)

    print(f"converted={converted} skipped={skipped} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

