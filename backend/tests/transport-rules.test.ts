import { describe, expect, it } from "vitest";

import { calculateTransportAmount } from "../src/modules/transport/transport-calculator.js";

const calculate = (distanceKm: number, attendanceDays: number, contractStatus: string | null = "PKWTT") =>
  calculateTransportAmount({
    distanceKm,
    attendanceDays,
    baseFare: 2000,
    contractStatus,
  });

describe("Aturan tunjangan transport", () => {
  it.each([0, 4, 5])("jarak %s km tidak mendapat tunjangan", (distance) => {
    expect(calculate(distance, 22).nominal).toBe(0);
  });

  it("5.5 km dibulatkan menjadi 6 km", () => {
    const result = calculate(5.5, 22);

    expect(result.jarak_dihitung_km).toBe(6);
    expect(result.nominal).toBe(264000);
  });

  it("12.4 km dibulatkan menjadi 12 km", () => {
    const result = calculate(12.4, 20);

    expect(result.jarak_dihitung_km).toBe(12);
    expect(result.nominal).toBe(480000);
  });

  it("12.5 km dibulatkan menjadi 13 km", () => {
    const result = calculate(12.5, 20);

    expect(result.jarak_dihitung_km).toBe(13);
    expect(result.nominal).toBe(520000);
  });

  it("jarak di atas 25 km dibatasi menjadi 25 km", () => {
    const result = calculate(30, 22);

    expect(result.jarak_dihitung_km).toBe(25);
    expect(result.nominal).toBe(1100000);
  });

  it("18 hari kerja tidak memenuhi syarat", () => {
    expect(calculate(12, 18).nominal).toBe(0);
  });

  it("19 hari kerja memenuhi syarat untuk PKWTT", () => {
    expect(calculate(12, 19).nominal).toBe(456000);
  });

  it("kehadiran nol tidak mendapat tunjangan", () => {
    expect(calculate(12, 0).nominal).toBe(0);
  });

  it.each(["PKWT", "Magang", "UNKNOWN", null])("status kontrak %s tidak mendapat tunjangan", (contract) => {
    expect(calculate(12, 22, contract).nominal).toBe(0);
  });

  it.each([
    [-1, 22],
    [12, -1],
    [12, 19.5],
    [12, 32],
    [Number.NaN, 22],
    [Number.POSITIVE_INFINITY, 22],
  ])("menolak jarak/hari tidak valid: %s, %s", (distance, days) => {
    expect(() => calculate(distance, days)).toThrow();
  });

  it("menolak tarif negatif", () => {
    expect(() =>
      calculateTransportAmount({
        distanceKm: 12,
        attendanceDays: 22,
        baseFare: -1,
        contractStatus: "PKWTT",
      }),
    ).toThrow();
  });

  it("tarif nol menghasilkan nominal nol", () => {
    const result = calculateTransportAmount({
      distanceKm: 12,
      attendanceDays: 22,
      baseFare: 0,
      contractStatus: "PKWTT",
    });

    expect(result.nominal).toBe(0);
  });
});
