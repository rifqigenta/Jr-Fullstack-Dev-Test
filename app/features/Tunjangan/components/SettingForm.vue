<script setup>
import { jakartaToday } from "~/utils/employeeDate.js";

const props = defineProps({
  setting: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["submit", "cancel"]);

const amount = ref(2000);
const amountText = ref("");
const effectiveDate = ref(jakartaToday());

const minimumKm = ref(5);
const maximumKm = ref(25);
const error = ref("");

function formatAmount(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

watch(
  () => props.setting,
  (setting) => {
    amount.value = Number(setting?.base_fare ?? 2000);
    amountText.value = formatAmount(amount.value);

    effectiveDate.value = setting?.berlaku_mulai?.slice(0, 10) || jakartaToday();

    minimumKm.value = Number(setting?.minimum_km ?? 5);
    maximumKm.value = Number(setting?.maximum_km ?? 25);
    error.value = "";
  },
  { immediate: true },
);

function inputAmount(event) {
  const raw = event.target.value.replace(/[^\d,]/g, "");
  const [whole = "", fraction] = raw.split(",");

  const integer = whole.replace(/^0+(?=\d)/, "");
  const decimals = fraction?.slice(0, 2);

  amount.value = integer ? Number(`${integer}.${decimals || "0"}`) : 0;

  amountText.value = integer ? `Rp ${Number(integer).toLocaleString("id-ID")}` + (fraction !== undefined ? `,${decimals}` : "") : "";

  event.target.value = amountText.value;
}

function submit() {
  error.value = "";

  if (!Number.isFinite(amount.value) || amount.value <= 0 || amount.value > 1_000_000) {
    error.value = "Tarif harus lebih dari nol dan maksimal Rp1.000.000.";
    return;
  }

  if (Number(minimumKm.value) !== 5 || Number(maximumKm.value) !== 25) {
    error.value = "Sesuai aturan tes, minimum harus 5 km dan maksimum 25 km.";
    return;
  }

  emit("submit", {
    base_fare: amount.value,
    berlaku_mulai: effectiveDate.value,
    minimum_km: 5,
    maximum_km: 25,
  });
}
</script>

<template>
  <form @submit.prevent="submit">
    <div class="card-body">
      <div v-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <fieldset :disabled="disabled">
        <div class="row g-3">
          <div class="col-md-6">
            <label for="fare-amount" class="form-label required"> Tarif Dasar </label>

            <div class="input-group">
              <input
                id="fare-amount"
                :value="amountText"
                type="text"
                inputmode="decimal"
                maxlength="25"
                class="form-control"
                placeholder="Rp 5.000"
                required
                @input="inputAmount"
                @blur="amountText = amount > 0 ? formatAmount(amount) : ''"
              />

              <span class="input-group-text">/ km</span>
            </div>
          </div>

          <div class="col-md-6">
            <label for="fare-effective" class="form-label required"> Berlaku Mulai </label>

            <input id="fare-effective" v-model="effectiveDate" type="date" min="2000-01-01" max="2100-12-31" class="form-control" required />
          </div>

          <div class="col-md-6">
            <label for="fare-minimum" class="form-label required"> Minimum Kilometer </label>

            <input id="fare-minimum" v-model="minimumKm" type="number" min="5" max="5" step="1" class="form-control" required disabled />
          </div>

          <div class="col-md-6">
            <label for="fare-maximum" class="form-label required"> Maksimum Kilometer </label>

            <input id="fare-maximum" v-model="maximumKm" type="number" min="25" max="25" step="1" class="form-control" required disabled />
          </div>
        </div>
      </fieldset>
    </div>

    <div class="card-footer d-flex justify-content-end gap-2">
      <button v-if="setting" type="button" class="btn" :disabled="disabled" @click="emit('cancel')">Batal Edit</button>

      <button type="submit" class="btn btn-primary" :disabled="disabled">
        {{ disabled ? "Memproses..." : "Simpan Tarif" }}
      </button>
    </div>
  </form>
</template>
