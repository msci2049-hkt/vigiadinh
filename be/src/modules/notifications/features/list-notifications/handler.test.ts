import { describe, expect, it } from "bun:test";
import { notificationChannelEnum, notificationStatusEnum } from "../../domain/validators";

describe("notifications validators", () => {
  it("status enum khớp CHECK constraint", () => {
    expect(notificationStatusEnum.options).toEqual(["queued", "sent", "failed"]);
  });
  it("channel enum khớp CHECK constraint", () => {
    expect(notificationChannelEnum.options).toEqual(["push", "email", "sse"]);
  });
});
