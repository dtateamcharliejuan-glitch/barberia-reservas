// Todo lo que cambia de una barbería a otra está aquí.
export const config = {
  name: 'Barbería Navaja',
  district: 'Centro',

  // Horario. Días: 0 = domingo, 1 = lunes … 6 = sábado.
  openDays: [1, 2, 3, 4, 5, 6],
  open: '09:00',
  close: '19:00',
  slotMinutes: 30,
  daysAhead: 14,

  services: [
    { id: 'corte', name: 'Corte', price: 150, includes: 'Lavado, corte a tijera o máquina y peinado' },
    { id: 'barba', name: 'Barba', price: 100, includes: 'Perfilado con navaja, toalla caliente y aceite' },
    { id: 'combo', name: 'Corte + barba', price: 220, includes: 'Todo lo del corte y la barba en una cita' },
    { id: 'nino', name: 'Corte niño', price: 120, includes: 'Hasta 12 años, corte y peinado' },
  ],
  currency: '$',

  // Vacío = modo demo (las citas se guardan solo en este navegador).
  // Pega aquí la URL de la Web App de Google Apps Script para el modo real.
  sheetsUrl: '',
};
