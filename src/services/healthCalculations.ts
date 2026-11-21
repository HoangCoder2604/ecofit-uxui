/** Fitness indicators are estimates, not medical measurements. */
export type BiologicalSex = 'male' | 'female';
export type HealthInput = {
  sex: BiologicalSex | null;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  activityFactor?: number;
};

export function parseBirthday(input: string): string | null {
  const v = input.trim();
  const match = /^(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{4})$/.exec(v);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : match ? `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}` : null;
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== iso) return null;
  if (d.getTime() > Date.now()) return null;
  return iso;
}
export function formatBirthday(iso: string): string {
  const d = parseBirthday(iso);
  if (!d) return iso;
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}
export function getAge(iso: string, today = new Date()): number | null {
  const date = parseBirthday(iso);
  if (!date) return null;
  const [y,m,d] = date.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth()+1 < m || (today.getMonth()+1 === m && today.getDate() < d)) age--;
  return age;
}
export function calculateHealth(input: HealthInput) {
  const {sex, birthDate, heightCm, weightKg} = input;
  const age = getAge(birthDate);
  if (!sex || age == null || age < 18 || age > 110 || !Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm < 80 || heightCm > 250 || weightKg < 20 || weightKg > 350) return null;
  const bmiRaw = weightKg / (heightCm/100)**2;
  // Mifflin-St Jeor resting metabolic rate for adults; estimate only.
  const bmrKcal = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161));
  // Default sedentary factor until user activity choice is explicitly mapped.
  const activityFactor = input.activityFactor ?? 1.2;
  const tdeeKcal = Math.round(bmrKcal * activityFactor);
  const targetKcal = tdeeKcal;
  // Deurenberg et al. population BMI/age/sex estimate; NOT measured fat percentage.
  const estimated = 1.2*bmiRaw + 0.23*age - 10.8*(sex === 'male'?1:0) - 5.4;
  return {
    age, sexLabel: sex === 'male' ? 'Nam' : 'Nữ', heightCm, weightKg,
    bmi: Number(bmiRaw.toFixed(1)), bmrKcal, tdeeKcal, targetKcal,
    bodyFatEstimatePercent: estimated > 0 && estimated < 75 ? Number(estimated.toFixed(1)) : null,
    activityFactor,
  };
}
