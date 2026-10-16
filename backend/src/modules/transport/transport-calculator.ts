export type TransportCalculationInput = {
  distanceKm: number;
  attendanceDays: number;
  baseFare: number;
  contractStatus: string | null;
};

export function calculateTransportAmount(input: TransportCalculationInput) {
  const { distanceKm, attendanceDays, baseFare, contractStatus } = input;

  if (!Number.isFinite(distanceKm) || !Number.isFinite(attendanceDays) || !Number.isFinite(baseFare) || distanceKm < 0 || attendanceDays < 0 || baseFare < 0) {
    throw new Error("Nilai perhitungan transport tidak valid.");
  }

  const roundedDistance = Math.floor(Math.min(distanceKm, 25) + 0.5);

  const eligibleDistance = distanceKm > 5;

  const eligibleAttendance = contractStatus !== "PKWTT" || attendanceDays >= 19;

  const eligibleContract = ["PKWTT", "PKWT", "Magang"].includes(contractStatus ?? "");

  const countedDistance = eligibleDistance ? roundedDistance : 0;

  const nominal = eligibleDistance && eligibleAttendance && eligibleContract ? Math.round(baseFare * countedDistance * attendanceDays * 100) / 100 : 0;

  return {
    jarak_asli_km: distanceKm,
    jarak_dihitung_km: countedDistance,
    jumlah_hari_masuk: attendanceDays,
    base_fare: baseFare,
    nominal,
  };
}
