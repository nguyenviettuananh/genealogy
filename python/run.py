import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


# ============ CẤU HÌNH LAYOUT ============

UNIT_WIDTH = 260
H_MARGIN = 200
V_MARGIN_TOP = 150
BOX_MIN_HEIGHT = 80
GAP_MIN = 60
GAP_FACTOR = 0.35
GAP_BASE_MULT = 2.0
SPECIAL_LEVEL_NAME = "Trần Đức Vịnh"
SPECIAL_GAP_MULTIPLIER = 1.8

BACKGROUND_COLOR = (255, 255, 255)
BOX_FILL = (240, 240, 240)
BOX_OUTLINE = (100, 100, 100)
LINE_COLOR = (50, 50, 50)
TEXT_COLOR = (0, 0, 0)

FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux thường
    "/Library/Fonts/Arial Unicode.ttf",                 # macOS (có thể đổi)
]


# ============ CẤU TRÚC NODE CÂY ============

class Node:
    def __init__(self, obj, depth=0):
        self.name = obj.get("name", "")
        self.children = [Node(ch, depth + 1) for ch in obj.get("children", [])]
        self.depth = depth
        self.subtree_width = 1.0
        self.x = 0.0      # vị trí logic (unit)
        self.y = 0.0      # không dùng nhiều, vì ta tính y theo depth
        self.x_px = 0     # pixel
        self.y_px = 0
        self.box_w = 0
        self.box_h = 0
        self.lines = []


# ============ HÀM HỖ TRỢ FONT ============

def load_font(size: int = 20) -> ImageFont.FreeTypeFont:
    for p in FONT_PATHS:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    # fallback
    return ImageFont.load_default()


# ============ TÍNH TOÁN CÂY ============

def annotate_depth(node: Node, depth: int = 0, max_depth_ref=None):
    node.depth = depth
    if max_depth_ref is not None:
        max_depth_ref[0] = max(max_depth_ref[0], depth)
    for ch in node.children:
        annotate_depth(ch, depth + 1, max_depth_ref)


def compute_subtree_width(node: Node) -> float:
    """
    subtree_width dùng để chia layout ngang.
    """
    if not node.children:
        node.subtree_width = 1.0
    else:
        total = 0.0
        for ch in node.children:
            compute_subtree_width(ch)
            total += ch.subtree_width + 0.6  # khoảng cách giữa các nhánh
        total -= 0.6  # bỏ bớt khoảng dư
        node.subtree_width = max(1.0, total)
    return node.subtree_width


def assign_x_positions(node: Node, start_x: float):
    """
    start_x: toạ độ logic trái của subtree.
    """
    if not node.children:
        node.x = start_x + node.subtree_width / 2.0
    else:
        cur_x = start_x
        centers = []
        for ch in node.children:
            assign_x_positions(ch, cur_x)
            centers.append(ch.x)
            cur_x += ch.subtree_width + 0.6
        node.x = (centers[0] + centers[-1]) / 2.0


def collect_nodes(node: Node):
    result = []

    def dfs(n: Node):
        result.append(n)
        for c in n.children:
            dfs(c)

    dfs(node)
    return result


# ============ TÍNH WIDTH BOX THEO TEXT ============

def compute_box_width_for_text(text: str, font: ImageFont.FreeTypeFont) -> int:
    """
    Đo chiều rộng lớn nhất của các phần tách bởi '|'
    (mỗi phần sẽ render trên 1 dòng riêng trong box).
    """
    parts = [p.strip() for p in text.split("|")]
    max_width = 0
    for part in parts:
        if not part:
            part = " "  # tránh lỗi length=0
        w = font.getlength(part)
        max_width = max(max_width, w)
    # padding thêm hai bên
    return int(max_width + 60)


def compute_box_height_for_text(text: str, font: ImageFont.FreeTypeFont) -> int:
    parts = [p.strip() for p in text.split("|")]
    lh = font.getbbox("Ag")[3] - font.getbbox("Ag")[1]
    lines_count = max(1, len(parts))
    content_h = lh * lines_count
    return max(BOX_MIN_HEIGHT, int(content_h + 40))


# ============ VẼ CÂY ============

def draw_tree_image(json_path: str, output_image_path: str):
    # 1. Load JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 2. Xây cây
    root = Node(data)
    max_depth_ref = [0]
    annotate_depth(root, 0, max_depth_ref)
    max_depth = max_depth_ref[0]

    compute_subtree_width(root)
    assign_x_positions(root, 0.0)

    nodes = collect_nodes(root)

    # 3. Chuẩn bị font
    font = load_font(size=20)

    # 4. Tính kích thước box theo text cho từng node
    for n in nodes:
        n.lines = [p.strip() for p in n.name.split("|")]
        bw = compute_box_width_for_text(n.name, font)
        n.box_w = max(200, bw)
        bh = compute_box_height_for_text(n.name, font)
        n.box_h = bh

    # 5. Tính kích thước ảnh
    max_x_unit = max(n.x for n in nodes) + 1.0
    img_width = int(H_MARGIN * 2 + max_x_unit * UNIT_WIDTH)

    levels = {}
    for n in nodes:
        levels.setdefault(n.depth, []).append(n)
    level_heights = [max(BOX_MIN_HEIGHT, max(m.box_h for m in levels.get(d, []))) for d in range(max_depth + 1)]
    lh = font.getbbox("Ag")[3] - font.getbbox("Ag")[1]
    base_gap_min = max(GAP_MIN, int(lh * GAP_BASE_MULT))
    special_depths = set()
    name_key = SPECIAL_LEVEL_NAME.lower()
    for n in nodes:
        if name_key in n.name.lower():
            special_depths.add(n.depth)
    special_gap_indices = set()
    for d0 in special_depths:
        if d0 >= 0 and d0 < max_depth:
            special_gap_indices.add(d0)
        if d0 - 1 >= 0:
            special_gap_indices.add(d0 - 1)
    gaps = []
    for d in range(max_depth):
        tallest = max(level_heights[d], level_heights[d + 1])
        g = int(base_gap_min + tallest * GAP_FACTOR)
        if d in special_gap_indices:
            g = int(g * SPECIAL_GAP_MULTIPLIER)
        gaps.append(g)
    total_content_h = sum(level_heights)
    print("LevelHeights:", level_heights)
    print("GapsBetweenLevels:", gaps)
    img_height = int(V_MARGIN_TOP * 2 + total_content_h + sum(gaps))

    # 6. Khởi tạo canvas
    img = Image.new("RGB", (img_width, img_height), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)

    # 7. Đặt toạ độ pixel cho từng node
    level_centers = []
    y_cursor = V_MARGIN_TOP
    for d in range(max_depth + 1):
        y_cursor += level_heights[d] // 2
        level_centers.append(y_cursor)
        y_cursor += level_heights[d] // 2
        if d < max_depth:
            y_cursor += gaps[d]
    for n in nodes:
        n.x_px = int(H_MARGIN + n.x * UNIT_WIDTH)
        n.y_px = int(level_centers[n.depth])

    # 8. Vẽ đường nối cha–con
    for n in nodes:
        for c in n.children:
            parent_bottom = (n.x_px, n.y_px + n.box_h // 2)
            child_top = (c.x_px, c.y_px - c.box_h // 2)

            mid_y = (parent_bottom[1] + child_top[1]) // 2
            # xuống dọc từ parent đến mid_y
            draw.line(
                [parent_bottom, (parent_bottom[0], mid_y)],
                fill=LINE_COLOR,
                width=2,
            )
            # ngang từ parent.x đến child.x
            draw.line(
                [(parent_bottom[0], mid_y), (child_top[0], mid_y)],
                fill=LINE_COLOR,
                width=2,
            )
            # dọc xuống child_top
            draw.line(
                [(child_top[0], mid_y), child_top],
                fill=LINE_COLOR,
                width=2,
            )

    # 9. Vẽ box + text
    lh = font.getbbox("Ag")[3] - font.getbbox("Ag")[1]

    for n in nodes:
        bw = n.box_w
        bh = n.box_h
        left = n.x_px - bw // 2
        top = n.y_px - bh // 2
        right = left + bw
        bottom = top + bh

        # Vẽ box
        draw.rounded_rectangle(
            [left, top, right, bottom],
            radius=10,
            fill=BOX_FILL,
            outline=BOX_OUTLINE,
            width=2,
        )

        lines = [p if p else " " for p in n.lines]
        total_text_height = lh * len(lines)
        text_y = n.y_px - total_text_height // 2

        for line in lines:
            text_width = font.getlength(line)
            text_x = n.x_px - text_width // 2
            draw.text((text_x, text_y), line, font=font, fill=TEXT_COLOR)
            text_y += lh

    # 10. Lưu ảnh
    output_path = Path(output_image_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, format="PNG")
    print(f"Saved tree image to: {output_path}")


# ============ MAIN ============

if __name__ == "__main__":
    argv_inputs = sys.argv[1:]
    if argv_inputs:
        inputs = argv_inputs
    else:
        inputs = [
            "genealogy.json",
            "genealogy2.json",
            "genealogy3.json",
            "gen4.json",
            "gen5.json",
        ]
    out_dir = Path("result")
    for in_json in inputs:
        out_png = out_dir / (Path(in_json).stem + ".png")
        draw_tree_image(in_json, str(out_png))
