// WHY: Chỉ compose feature routes — KHÔNG business logic.
import { Hono } from "hono";
import { getWalletRoute } from "./features/get-wallet/handler";
import { listWalletsRoute } from "./features/list-wallets/handler";

export const walletsRoutes = new Hono().route("/", listWalletsRoute).route("/", getWalletRoute);
