"""分段并行下载一个大文件的剩余部分（ModelScope 单个连接约 0.4 MB/s，多开几个连接才快）。

    python3 pfetch.py <URL> <输出文件> <总字节数> [连接数，默认 8]

已经下载的部分保留：从输出文件的现有长度接着下，剩下的切成几段同时下载（每段各自可续传、卡住自动重连），
全部下完后按顺序接到输出文件后面。完整性由调用方用 SHA-256 校验。
"""
import os
import subprocess
import sys
import threading
import time


def fetch_part(url, part, a, b, log):
    for attempt in range(60):
        have = os.path.getsize(part) if os.path.exists(part) else 0
        if a + have > b:
            return True
        with open(part, 'ab') as f:
            rc = subprocess.run(['curl', '-sfL', '--speed-limit', '20000', '--speed-time', '60', '-r', f'{a + have}-{b}', url],
                                stdout=f).returncode
        if rc == 0 and os.path.getsize(part) == b - a + 1:
            return True
        log(f'  第 {attempt + 1} 次重连：{os.path.basename(part)}（{os.path.getsize(part)}/{b - a + 1} 字节）')
        time.sleep(3)
    return False


def main(url, out, total, n=8):
    total, n = int(total), int(n)
    start = os.path.getsize(out) if os.path.exists(out) else 0
    if start >= total:
        print(f'{out} 已经完整')
        return
    chunk = -(-(total - start) // n)
    ranges = [(start + i * chunk, min(total, start + (i + 1) * chunk) - 1) for i in range(n)]
    ranges = [(a, b) for a, b in ranges if a <= b]
    lock = threading.Lock()
    def log(s):
        with lock:
            print(s, flush=True)
    ok = [False] * len(ranges)
    def run(i, a, b):
        ok[i] = fetch_part(url, f'{out}.part{i}', a, b, log)
    threads = [threading.Thread(target=run, args=(i, a, b)) for i, (a, b) in enumerate(ranges)]
    t0 = time.time()
    for t in threads:
        t.start()
    while any(t.is_alive() for t in threads):
        time.sleep(30)
        got = sum(os.path.getsize(f'{out}.part{i}') for i in range(len(ranges)) if os.path.exists(f'{out}.part{i}'))
        log(f'  {time.strftime("%H:%M:%S")} 已下 {got / 1e9:.2f}/{(total - start) / 1e9:.2f} GB，{got / 1e6 / (time.time() - t0):.2f} MB/s')
    if not all(ok):
        raise SystemExit('有分段没有下完，重新运行会接着下')
    with open(out, 'ab') as f:
        for i in range(len(ranges)):
            with open(f'{out}.part{i}', 'rb') as p:
                while True:
                    buf = p.read(1 << 24)
                    if not buf:
                        break
                    f.write(buf)
    for i in range(len(ranges)):
        os.remove(f'{out}.part{i}')
    print(f'完成：{out}（{os.path.getsize(out)} 字节，用时 {time.time() - t0:.0f} 秒）')


if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
