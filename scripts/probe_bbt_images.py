import urllib.request

candidates = [
    "https://www.blindboxtracker.com/assets/collections/smiskis/series_one/huggingknees.webp",
    "https://www.blindboxtracker.com/assets/collections/smiskis/series_one/littlesmiskihugging.webp",
    "https://www.blindboxtracker.com/assets/collections/smiskis/series-1/hugging-knees.webp",
    "https://www.blindboxtracker.com/assets/collections/smiskis/series1/huggingknees.webp",
    "https://blindboxtracker.com/assets/collections/smiskis/series_one/huggingknees.webp",
]

for url in candidates:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            print(r.status, url, r.headers.get("content-type"))
    except Exception as e:
        print("fail", url, type(e).__name__, e)
