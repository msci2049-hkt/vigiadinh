# Draft issue upstream — js-xdr 4.0.0 `Array.toXDR(value)` broken

> Máy dev này KHÔNG có `gh`/GITHUB_TOKEN (BLOCKERS B-CI-1) nên chưa mở issue được.
> Người có GitHub: mở tại `https://github.com/stellar/js-xdr/issues/new`, dán phần
> tiếng Anh dưới. Đây là bug tự tìm ra ở PHA 2.3 (BUILD-LOG + RESEARCH-LOG
> "Wire format authorization_entries"), điểm cộng hồ sơ thi.

---

**Title:** `VarArray.toXDR(value)` throws "XDR Write Error: value is not array" — instance serializes itself, ignoring the argument

**Body:**

With `js-xdr` 4.0.0 (as bundled by `@stellar/stellar-sdk` 16.0.1), calling the
documented static-style form on a typedef'd array such as
`xdr.SorobanAuthorizationEntries`:

```js
import { xdr } from "@stellar/stellar-sdk";

const entries = [entry1, entry2]; // SorobanAuthorizationEntry[]
xdr.SorobanAuthorizationEntries.toXDR(entries);
// => XDR Write Error: value is not array
```

The TypeScript declarations in `@stellar/stellar-sdk` describe
`SorobanAuthorizationEntries.toXDR(value: SorobanAuthorizationEntry[])` as
accepting the array, but at runtime the typedef instance's `toXDR(format?)`
treats the first argument as a **format string** and tries to serialize *itself*
(the type definition object), so any array argument lands in the error above.

`fromXDR` works fine in both directions:

```js
const decoded = xdr.SorobanAuthorizationEntries.fromXDR(base64, "base64"); // OK
```

**Workaround we ship** (SEP-45 server, needs to emit the vector wire format):
hand-frame the XDR var-array — 4-byte big-endian count + concatenated entries:

```js
function encodeEntriesXdr(entries) {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(entries.length, 0);
  return Buffer.concat([count, ...entries.map((e) => e.toXDR())]).toString("base64");
}
```

Round-trips against `fromXDR` and against a live Soroban RPC (testnet) correctly.

**Expected:** either the runtime accepts `toXDR(value[, format])` on typedef'd
arrays as the .d.ts advertises, or the SDK types stop advertising it.

Versions: `js-xdr` 4.0.0 · `@stellar/stellar-sdk` 16.0.1 · Bun 1.3.14 / Node 22.
