// Ví hiện hoạt của user (v1: một hộ một ví — lấy ví đầu). Màn nào cũng cần
// walletId nên gom một chỗ; sau này có chọn ví thì đổi ở ĐÂY, không sờ từng màn.
import { useQuery } from "@tanstack/react-query";
import { walletsOptions } from "../api/wallets";

export function useActiveWallet() {
  const query = useQuery(walletsOptions);
  return {
    wallet: query.data?.[0] ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
