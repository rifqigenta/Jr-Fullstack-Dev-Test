export type TransportCalculationInput = {
  distanceKm: number;
  attendanceDays: number;
  baseFare: number;
  contractStatus: string | null;
};

export function calculateTransportAmount(input: TransportCalculationInput) {
  const { distanceKm, attendanceDays, baseFare, contractStatus } = input;

  if (
    !Number.isFinite(distanceKm) ||
    distanceKm < 0 ||
    !Number.isInteger(attendanceDays) ||
    attendanceDays < 0 ||
    attendanceDays > 31 ||
    !Number.isFinite(baseFare) ||
    baseFare < 0 ||
    baseFare > 1_000_000
  ) {
    throw new Error("Nilai perhitungan transport tidak valid.");
  }

  const countedDistance = distanceKm > 5 ? Math.min(25, Math.floor(distanceKm + 0.5)) : 0;

  const eligible = contractStatus === "PKWTT" && attendanceDays >= 19 && countedDistance > 0;

  const nominal = eligible ? Math.round(baseFare * countedDistance * attendanceDays * 100) / 100 : 0;

  return {
    jarak_asli_km: distanceKm,
    jarak_dihitung_km: countedDistance,
    jumlah_hari_masuk: attendanceDays,
    base_fare: baseFare,
    nominal,
  };
}
