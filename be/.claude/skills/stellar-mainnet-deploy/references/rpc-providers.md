# RPC & Horizon Providers cho Stellar Mainnet

> SDF **không** vận hành public RPC cho Mainnet (chỉ có cho Testnet/Futurenet). Lên mainnet bắt buộc chọn một trong các hướng: (a) public endpoint miễn phí, (b) provider trả phí có API key/SLA, (c) tự chạy node.
> Nguồn: developers.stellar.org/docs/data/apis/rpc/providers (cập nhật 7/2026). Trước khi chốt, mở lại trang này kiểm tra vì danh sách thay đổi.

## Public RPC Mainnet miễn phí (không cần đăng ký)

| Provider | URL |
|---|---|
| sorobanrpc.com | `https://mainnet.sorobanrpc.com` |
| Gateway.fm | `https://soroban-rpc.mainnet.stellar.gateway.fm` |
| Nodies | `https://stellar-soroban-public.nodies.app` |
| OnFinality | `https://stellar.api.onfinality.io/public` |
| Lightsail (Quasar) | `https://rpc.lightsail.network/` |
| Lightsail — full archive | `https://archive-rpc.lightsail.network/` |
| Ankr — full archive | `https://rpc.ankr.com/stellar_soroban` |
| Liquify | `https://stellar-mainnet.liquify.com/api=41EEWAH79Y5OCGI7/mainnet` |

Lưu ý public endpoint: có rate-limit, không SLA. Dùng để dev/demo/dự án nhỏ. App production nên có ít nhất 1 endpoint dự phòng (fallback) trong config.

## Provider trả phí / có API key (mainnet)

Blockdaemon, Validation Cloud, QuickNode, NowNodes, Gateway, Ankr, Infstones, Obsrvr, Nodies, OnFinality, Lightsail, Uniblock, Exaion, Alchemy (`https://stellar-mainnet.g.alchemy.com/v2/<api-key>`), GetBlock.

- Cần **dedicated node**: Blockdaemon, QuickNode, NowNodes, Gateway, Infstones, OnFinality, Exaion, Alchemy, GetBlock.
- Cần **RPC Archive** (full ledger history qua `getLedgers`): Gateway, Ankr, Obsrvr, OnFinality, Lightsail, Exaion, GetBlock.

## Horizon Mainnet

- SDF: `https://horizon.stellar.org` — miễn phí, rate-limit, không SLA. Đủ cho traffic thấp.
- Production: dùng Horizon của provider (nhiều provider phía trên có cả Horizon lẫn RPC) hoặc tự chạy.
- Lưu ý: RPC chỉ giữ tối đa ~7 ngày lịch sử. Cần lịch sử dài → Horizon, RPC Archive, hoặc indexer riêng.

## Tự chạy node

Theo Admin Guide: developers.stellar.org/docs/data/apis/rpc/admin-guide. Chỉ đáng làm khi cần chủ quyền hạ tầng hoặc traffic rất lớn; còn lại dùng provider rẻ và nhanh hơn.

## Chọn nhanh

- Hackathon/demo mainnet, MVP: public endpoint (sorobanrpc.com hoặc Gateway.fm) + 1 fallback.
- Sản phẩm có user thật: 1 provider trả phí (Alchemy/QuickNode/Validation Cloud) + public endpoint làm fallback.
- Cần đọc event/lịch sử dài (indexer, analytics): thêm RPC Archive (Ankr/Lightsail) hoặc Horizon provider.
