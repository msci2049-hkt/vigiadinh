# Video Feed kiểu TikTok — HLS / CDN / player / preload

Chỉ đọc nếu app có feed video dọc (vuốt fullscreen). Nếu không, bỏ qua.

## "Tua mượt kiểu TikTok" tách làm 2 việc

1. Kéo seek thấy preview khung hình tức thì.
2. Thả tay chạy ngay, không buffer.

Bí quyết KHÔNG nằm ở CDN nào cả — nằm ở **format + player**:

- **HLS segment ngắn** (2–6s): tua tới đâu chỉ tải chunk đó, không tải cả file. File mp4 nguyên khối 6–7GB thì CDN xịn cỡ nào cũng khựng.
- **Sprite thumbnail + WebVTT** (骨架 preview): ảnh ghép hàng trăm thumbnail nhỏ + file VTT map timecode→ô ảnh. Rê tới đâu cắt ô hiện ra — zero network, tức thì. Đây là 80% "cảm giác mượt".
- **GOP căn keyframe:** mỗi segment mở đầu bằng keyframe (closed GOP) → thả tay decode ngay.
- **ABR tụt khi seek:** thả tay kéo rendition thấp nhất trước (~200ms) rồi nâng dần → không xoay bánh xe.
- **Preload video kế:** buffer sẵn video n+1, n+2 khi n vào viewport → vuốt là chạy.

## FFmpeg tạo HLS seek-friendly

```bash
ffmpeg -i input.mp4 \
  -c:v libx264 -preset veryfast \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -force_key_frames "expr:gte(t,n_forced*2)" \
  -c:a aac -b:a 128k \
  -hls_time 2 -hls_playlist_type vod -hls_segment_type fmp4 \
  -master_pl_name master.m3u8 out_%v/stream.m3u8

# sprite storyboard cho preview scrub:
ffmpeg -i input.mp4 -vf "fps=1/2,scale=160:90,tile=10x10" storyboard.jpg
# + viết .vtt map timecode → toạ độ ô sprite
```

## Player mã nguồn mở (cảm giác TikTok)

- **bytedance/xgplayer** (MIT) — player của chính ByteDance, vePlayer build trên nó. MP4 staged-loading, gần "chất TikTok" nhất.
- **vidstack/player** (MIT) — hiện đại nhất, thumbnail preview + gesture dựng sẵn, DX ngon cho React.
- **ArtPlayer** (MIT) — nhẹ, plugin HLS/thumbnail đầy đủ.
- **hls.js** (Apache-2.0) — engine ABR chạy dưới mọi player trên.

## Feed UI dọc

- Ảo hoá `@tanstack/react-virtual` (xem smooth-nav tầng 6), snap scroll, `IntersectionObserver` autoplay/pause theo viewport.
- **Nhớ pause guard** nếu feed nằm trong tab keep-alive (pitfalls #1).

## CDN — chi phí (nếu cần chọn)

- Rẻ nhất global: **Bunny Volume Network** ~$0.005/GB phẳng (cả châu Á), hoặc BlazingCDN ~$0.004/GB. Pair với vePlayer + FFmpeg tự transcode.
- Managed đỡ việc: **Bunny Stream** (~$0.03/GB Á, transcode+player+DRM free) hoặc **Cloudflare Stream** ($1/1000 phút phát).
- Cloud Trung Quốc (Volcengine của ByteDance = "ké TikTok hợp pháp", Tencent, Alibaba): latency VN tốt nhưng egress đắt hơn nhiều (~$0.08/GB) + rủi ro data sovereignty. Chỉ cân nhắc cho app không nhạy cảm dữ liệu.
- **"Ké CDN TikTok" chui** (upload TikTok, hotlink URL): URL short-lived + token expire + anti-hotlink → gãy liên tục, ToS cấm, không production được. Bỏ.
