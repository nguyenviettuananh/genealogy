import json
import sys


def find_subtree(node, needle):
    if needle in node.get("name", "").lower():
        return node
    for ch in node.get("children", []):
        r = find_subtree(ch, needle)
        if r is not None:
            return r
    return None


def find_path(node, needle):
    if needle in node.get("name", "").lower():
        return [node]
    for ch in node.get("children", []):
        p = find_path(ch, needle)
        if p:
            return [node] + p
    return None


def build_path_tree(path_list):
    def clone_basic(n):
        return {"id": n.get("id"), "name": n.get("name"), "children": []}

    chain = clone_basic(path_list[0])
    cur = chain
    for node in path_list[1:]:
        nxt = clone_basic(node)
        cur["children"].append(nxt)
        cur = nxt
    # last has empty children
    return chain


def main():
    src = sys.argv[1]
    target_name = sys.argv[2].strip().lower()
    clone_path = sys.argv[3]
    mode = sys.argv[4] if len(sys.argv) > 4 else "subtree"

    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)

    if mode == "path":
        path = find_path(data, target_name)
        if not path:
            print("Path not found")
            return
        result = build_path_tree(path)
    elif mode.startswith("id_max:"):
        try:
            max_id = int(mode.split(":", 1)[1])
        except Exception:
            print("Invalid id_max mode")
            return

        def id_num(n):
            try:
                return int(str(n.get("id", "")).lstrip("n"))
            except Exception:
                return 0

        def filter_tree(node):
            if id_num(node) > max_id:
                return None
            kept = {"id": node.get("id"), "name": node.get("name"), "children": []}
            for ch in node.get("children", []):
                fch = filter_tree(ch)
                if fch is not None:
                    kept["children"].append(fch)
            return kept

        result = filter_tree(data)
    elif mode == "to_name_depth":
        def find_depth(node, needle, depth=0):
            if needle in node.get("name", "").lower():
                return depth
            for ch in node.get("children", []):
                d = find_depth(ch, needle, depth + 1)
                if d is not None:
                    return d
            return None

        target_depth = find_depth(data, target_name)
        if target_depth is None:
            print("Target name depth not found")
            return

        def prune_by_depth(node, cur=0):
            kept = {"id": node.get("id"), "name": node.get("name"), "children": []}
            if cur >= target_depth:
                return kept
            for ch in node.get("children", []):
                kept["children"].append(prune_by_depth(ch, cur + 1))
            return kept

        result = prune_by_depth(data)
    else:
        result = find_subtree(data, target_name)
        if result is None:
            print("Subtree not found")
            return

    with open(clone_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
