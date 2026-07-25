// WHY: Chỉ compose feature routes — KHÔNG business logic.
import { Hono } from "hono";
import { createWalletRoute } from "./features/create-wallet/handler";
import { getWalletRoute } from "./features/get-wallet/handler";
import { listWalletsRoute } from "./features/list-wallets/handler";
import { recoveryConfigRoute } from "./features/recovery-config/handler";

export const walletsRoutes = new Hono()
  .route("/", listWalletsRoute)
  .route("/", createWalletRoute)
  .route("/", getWalletRoute)
  .route("/", recoveryConfigRoute);
