"""WebSocket bridge: TradingApp Named Pipe -> ws://localhost:8766

Run:  python scripts/terminal_bridge.py
Then: open http://localhost:3000/stacks

Requirements: pip install pywin32 websockets
"""
from __future__ import annotations  # Python 3.8 compat for list[str] hints

import asyncio
import json
import sys
import time
from pathlib import Path

# ── config ────────────────────────────────────────────────────────────────────

DATA_PIPE   = r"\\.\pipe\TradingAppPipeServerStreamAPI"
WS_PORT     = 8766
POLL_HZ     = 2
STACKS_FILE = Path(__file__).parent.parent / "data" / "stacks.json"

FIELDS = [
    "BidLstClsΔ%",
    "AskLstClsΔ%",
    "isTrash",
    "Report",
    "PosSize",
]

# ── pipe I/O ──────────────────────────────────────────────────────────────────

def _pipe_connect(pipe_name):
    import win32file
    return win32file.CreateFile(
        pipe_name,
        win32file.GENERIC_READ | win32file.GENERIC_WRITE,
        0, None,
        win32file.OPEN_EXISTING,
        0, None,
    )

def _pipe_request(handle, payload, buf=1048576):
    import win32file, pywintypes
    win32file.WriteFile(handle, payload)
    chunks = []
    while True:
        try:
            _, chunk = win32file.ReadFile(handle, buf)
            chunks.append(bytes(chunk))
            break
        except pywintypes.error as e:
            if e.winerror == 234:  # ERROR_MORE_DATA — message continues
                chunks.append(bytes(e.args[2]) if len(e.args) > 2 else b"")
                continue
            raise
    return b"".join(chunks)

def build_request(tickers, fields):
    items = [{"Ticker": t, "FieldName": f} for t in tickers for f in fields]
    return json.dumps(items).encode()

def parse_response(raw, tickers, fields):
    text = raw.decode(errors="replace").strip("\x00").strip()
    values_str = json.loads(text)   # outer JSON string -> inner semicolon CSV
    tokens = values_str.split(";")
    rows = []
    n = len(fields)
    for i, ticker in enumerate(tickers):
        chunk = tokens[i * n : (i + 1) * n]
        row = {"ticker": ticker}
        for j, field in enumerate(fields):
            raw_val = chunk[j] if j < len(chunk) else ""
            row[field] = _coerce(raw_val)
        rows.append(row)
    return rows

def _coerce(raw):
    if raw == "" or raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return raw

# ── WebSocket server ──────────────────────────────────────────────────────────

_clients = set()
_last_snapshot = []

async def handler(ws):
    _clients.add(ws)
    print(f"[bridge] client connected ({len(_clients)} total)")
    if _last_snapshot:
        await ws.send(json.dumps({"type": "snapshot", "data": _last_snapshot}))
    try:
        await ws.wait_closed()
    finally:
        _clients.discard(ws)
        print(f"[bridge] client disconnected ({len(_clients)} total)")

async def broadcast(msg):
    if _clients:
        await asyncio.gather(*[c.send(msg) for c in list(_clients)], return_exceptions=True)

# ── poll loop ─────────────────────────────────────────────────────────────────

def load_tickers():
    try:
        data = json.loads(STACKS_FILE.read_text(encoding="utf-8"))
        tickers = data.get("tickers", data) if isinstance(data, dict) else data
        return [str(t).upper() for t in tickers if t]
    except Exception as e:
        print(f"[bridge] cannot read {STACKS_FILE}: {e}")
        return []

def _pipe_query(tickers):
    """Connect → write → read → close. Pipe server closes after each request."""
    handle = _pipe_connect(DATA_PIPE)
    try:
        raw = _pipe_request(handle, build_request(tickers, FIELDS))
        return parse_response(raw, tickers, FIELDS)
    finally:
        try:
            handle.Close()
        except Exception:
            pass

async def poll_loop():
    global _last_snapshot
    interval = 1.0 / POLL_HZ
    last_ticker_count = 0

    while True:
        tickers = load_tickers()
        if not tickers:
            print("[bridge] stacks.json пуст — добавь тикеры и перезапусти")
            await asyncio.sleep(5)
            continue

        if len(tickers) != last_ticker_count:
            print(f"[bridge] watching {len(tickers)} tickers")
            last_ticker_count = len(tickers)

        try:
            t0 = time.monotonic()
            rows = await asyncio.get_event_loop().run_in_executor(None, _pipe_query, tickers)
            _last_snapshot = rows
            ts = time.strftime("%H:%M:%S")
            msg = json.dumps({"type": "snapshot", "data": rows, "ts": ts})
            await broadcast(msg)
            elapsed = time.monotonic() - t0
            print(f"[bridge] ok {ts} — {len(rows)} rows in {elapsed*1000:.0f}ms")
            await asyncio.sleep(max(0, interval - elapsed))
        except Exception as e:
            print(f"[bridge] pipe error: {e}")
            await asyncio.sleep(1)

# ── main ──────────────────────────────────────────────────────────────────────

async def main():
    import websockets
    print(f"[bridge] ws://localhost:{WS_PORT}")
    async with websockets.serve(handler, "localhost", WS_PORT):
        await poll_loop()

if __name__ == "__main__":
    if sys.platform != "win32":
        print("ERROR: только Windows (нужен pywin32)")
        sys.exit(1)
    try:
        import websockets  # noqa: F401
    except ImportError:
        print("Установи: pip install pywin32 websockets")
        sys.exit(1)
    asyncio.run(main())
