// Smoke tầng Stellar (PHA 5.1): build + simulate MỘT invoke THẬT trên testnet
// qua service — chứng minh "service gọi được testnet, ví phí tách custody".
// Chạy: bun scripts/smoke-stellar.ts (cần FEE_WALLET_SECRET + mạng).
// Gọi web_auth_verify (contract SEP-45 đã deploy) ở mode record → simulation
// trả AUTH ENTRIES mà ví người dùng sẽ phải ký — backend không ký hộ được.
import { argsToScVal } from "@/modules/sep45/entries";
import { buildInvokeTx, feeWallet } from "@/services/stellar/stellar.service";

const WEB_AUTH_CONTRACT = "CAKV3MKK3WA2CJX56LA52YYAG7FDMQTD7ZYRT3FKXUOCOEXZIANG2SST";

const built = await buildInvokeTx({
  contractId: WEB_AUTH_CONTRACT,
  method: "web_auth_verify",
  args: [
    argsToScVal({
      account: WEB_AUTH_CONTRACT,
      home_domain: "localhost:5173",
      web_auth_domain: "localhost:3000",
      web_auth_domain_account: feeWallet().publicKey(),
      nonce: `smoke-${Date.now()}`,
    }),
  ],
});

console.log(
  JSON.stringify(
    {
      ok: true,
      feeWallet: feeWallet().publicKey(),
      authEntriesFromSimulation: built.authEntriesXdr.length,
      latestLedger: built.latestLedger,
      txXdrBytes: built.transactionXdr.length,
    },
    null,
    2,
  ),
);
process.exit(0);
