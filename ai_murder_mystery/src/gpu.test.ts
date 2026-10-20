import { describe, it, expect, afterEach } from "vitest";
import { checkWebGPU } from "./gpu";

const original = Object.getOwnPropertyDescriptor(navigator, "gpu");
afterEach(() => {
    if (original) Object.defineProperty(navigator, "gpu", original);
    else delete (navigator as unknown as Record<string, unknown>).gpu;
});

describe("checkWebGPU", () => {
    it("explains when the browser has no WebGPU", async () => {
        delete (navigator as unknown as Record<string, unknown>).gpu;
        const r = await checkWebGPU();
        expect(r.ok).toBe(false);
    });

    it("explains when WebGPU exists but no GPU adapter is available", async () => {
        Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => null }, configurable: true });
        expect(await checkWebGPU()).toMatchObject({ ok: false });
    });

    it("passes with an adapter", async () => {
        Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => ({}) }, configurable: true });
        expect(await checkWebGPU()).toEqual({ ok: true });
    });
});
