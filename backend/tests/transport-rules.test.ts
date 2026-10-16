import { describe, expect, it } from "vitest";

import { calculateTransportAmount } from "../src/modules/transport/transport-calculator.js";

const calculate = (distanceKm: number, attendanceDays: number, contractStatus = "PKWTT") =>
  calculateTransportAmount({
    distanceKm,
    attendanceDays,
    baseFare: 2000,
    contractStatus,
  });

describe("Transport Allowance Business Rules", () => {
  it("distance <= 5 km should receive zero", () => {
    expect(calculate(5, 22).nominal).toBe(0);
    expect(calculate(4, 22).nominal).toBe(0);
  });

  it("5.5 km should round up to 6 km", () => {
    const result = calculate(5.5, 22);

    expect(result.jarak_dihitung_km).toBe(6);
    expect(result.nominal).toBe(264000);
  });

  it("12.4 km should round down to 12 km", () => {
    const result = calculate(12.4, 20);

    expect(result.jarak_dihitung_km).toBe(12);
    expect(result.nominal).toBe(480000);
  });

  it("12.5 km should round up to 13 km", () => {
    const result = calculate(12.5, 20);

    expect(result.jarak_dihitung_km).toBe(13);
    expect(result.nominal).toBe(520000);
  });

  it("distance > 25 km should be capped", () => {
    const result = calculate(30, 22);

    expect(result.jarak_dihitung_km).toBe(25);
    expect(result.nominal).toBe(1100000);
  });

  it("PKWTT with 18 attendance days should receive zero", () => {
    expect(calculate(12, 18).nominal).toBe(0);
  });

  it("PKWTT with 19 attendance days should be eligible", () => {
    expect(calculate(12, 19).nominal).toBe(456000);
  });

  it("zero attendance should produce zero", () => {
    expect(calculate(12, 0).nominal).toBe(0);
  });

  it("invalid contract status should receive zero", () => {
    expect(calculate(12, 22, "UNKNOWN").nominal).toBe(0);
  });

  it("negative distance should be rejected", () => {
    expect(() => calculate(-1, 22)).toThrow();
  });
});
