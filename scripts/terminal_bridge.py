"""
WebSocket bridge: TradingApp Named Pipe → ws://localhost:8766

Run:  python scripts/terminal_bridge.py
Then: open http://localhost:3000/stacks in the browser

Reads live L1 data from TradingApp's DATA_PIPE for the tickers listed
in data/stacks.json, broadcasts a JSON snapshot to all WebSocket clients
every 500ms (or sooner if values change).

Requirements:  pip install pywin32 websockets
"""

import asyncio
import json
import sys
import time
from pathlib import Path

# ── config ────────────────────────────────────────────────────────────────────

DATA_PIPE   = r"\\.\pipe\TradingAppPipeServerStreamAPI"
WS_PORT     = 8766
POLL_HZ     = 2          # requests per second
STACKS_FILE = Path(__file__).parent.parent / "data" / "stacks.json"

FIELDS = [
    "LstPrc",          # last price
    "Bid",
    "Ask",
    "YCls",            # yesterday close
    "Gap%",            # gap from ycls to today open
    "DayMove%",        # intraday from open
    "AskLstClsΔ%",    # ask vs yesterday close  ← главный "net %"
    "Vol",
    "TrdStatus",
]

# ── pipe I/O ──────────────────────────────────────────────────────────────────

def _pipe_connect(pipe_name: str):
    import win32file
    return win32file.CreateFile(
        pipe_name,
        win32file.GENERIC_READ | win32file.GENERIC_WRITE,
        0, None,
        win32file.OPEN_EXISTING,
        0, None,
    )

def _pipe_request(handle, payload: bytes, buf: int = 131072) -> bytes:
    import win32file
    win32file.WriteFile(handle, payload)
    _, data = win32file.ReadFile(handle, buf)
    return bytes(data)

def build_request(tickers: list[str], fields: list[str]) -> bytes:
    items = [
        {"Ticker": t, "FieldName": f}
        for t in tickers
        for f in fields
    ]
    return json.dumps(items).encode()

def parse_response(raw: bytes, tickers: list[str], fields: list[str]) -> list[dict]:
    text = raw.decode(errors="replace").strip("\x00").strip()
    values_str: str = json.loads(text)          # outer JSON string → inner CSV
    tokens = values_str.split(";")

    rows = []
    n = len(fields)
    for i, ticker in enumerate(tickers):
        chunk = tokens[i * n : (i + 1) * n]
        row: dict = {"ticker": ticker}
        for j, field in enumerate(fields):
            raw_val = chunk[j] if j < len(chunk) else ""
            row[field] = _coerce(raw_val)
        rows.append(row)
    return rows

def _coerce(raw: str):
    if raw == "" or raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return raw

# ── WebSocket server ──────────────────────────────────────────────────────────

_clients: set = set()
_last_snapshot: list[dict] = []

async def handler(ws):
    _clients.add(ws)
    print(f"[bridge] client connected (total={len(_clients)})")
    # Send current snapshot immediately
    if _last_snapshot:
        await ws.send(json.dumps({"type": "snapshot", "data": _last_snapshot}))
    try:
        await ws.wait_closed()
    finally:
        _clients.discard(ws)
        print(f"[bridge] client disconnected (total={len(_clients)})")

async def broadcast(msg: str):
    if _clients:
        await asyncio.gather(*[c.send(msg) for c in list(_clients)], return_exceptions=True)

# ── polling loop ──────────────────────────────────────────────────────────────

def load_tickers() -> list[str]:
    try:
        data = json.loads(STACKS_FILE.read_text())
        tickers = data.get("tickers", data) if isinstance(data, dict) else data
        return [str(t).upper() for t in tickers if t]
    except Exception as e:
        print(f"[bridge] cannot read {STACKS_FILE}: {e}")
        return []

async def poll_loop():
    global _last_snapshot
    handle = None
    interval = 1.0 / POLL_HZ

    while True:
        tickers = load_tickers()
        if not tickers:
            print("[bridge] stacks.json is empty — add tickers and restart")
            await asyncio.sleep(5)
            continue

        # (re)connect pipe
        try:
            if handle is None:
                import win32file  # noqa: PLC0415
                handle = _pipe_connect(DATA_PIPE)
                print(f"[bridge] connected to pipe, watching {len(tickers)} tickers")
        except Exception as e:
            print(f"[bridge] pipe not available: {e}")
            handle = None
            await asyncio.sleep(3)
            continue

        try:
            t0 = time.monotonic()
            raw = _pipe_request(handle, build_request(tickers, FIELDS))
            rows = parse_response(raw, tickers, FIELDS)
            _last_snapshot = rows
            msg = json.dumps({"type": "snapshot", "data": rows,
                              "ts": time.strftime("%H:%M:%S")})
            await broadcast(msg)
            elapsed = time.monotonic() - t0
            await asyncio.sleep(max(0, interval - elapsed))
        except Exception as e:
            print(f"[bridge] pipe error: {e} — reconnecting")
            try:
                handle.Close()
            except Exception:
                pass
            handle = None
            await asyncio.sleep(1)

# ── main ──────────────────────────────────────────────────────────────────────

async def main():
    import websockets
    print(f"[bridge] starting ws://localhost:{WS_PORT}")
    async with websockets.serve(handler, "localhost", WS_PORT):
        await poll_loop()

if __name__ == "__main__":
    if sys.platform != "win32":
        print("ERROR: terminal bridge only runs on Windows (needs pywin32)")
        sys.exit(1)
    try:
        import websockets  # noqa: F401
    except ImportError:
        print("Run:  pip install pywin32 websockets")
        sys.exit(1)
    asyncio.run(main())
