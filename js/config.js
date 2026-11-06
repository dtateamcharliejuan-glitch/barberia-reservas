// Todo lo que cambia de una barbería a otra está aquí.
export const config = {
  name: 'Alex Barber',
  district: 'Floralia',

  // Horario (PROVISIONAL: confirmar con Alex). Días: 0 = domingo, 1 = lunes … 6 = sábado.
  openDays: [1, 2, 3, 4, 5, 6],
  open: '09:00',
  close: '19:00',
  slotMinutes: 30,
  daysAhead: 14,

  // Precios en pesos colombianos. Todos duran 30 min (barba: por confirmar).
  services: [
    { id: 'corte', name: 'Corte', price: 18000, includes: 'Corte de cabello' },
    { id: 'cejas', name: 'Corte + cejas', price: 20000, includes: 'Corte de cabello y arreglo de cejas' },
    { id: 'barba', name: 'Corte + barba', price: 23000, includes: 'Corte de cabello y arreglo de barba' },
  ],

  // Vacío = modo demo (las citas se guardan solo en este navegador).
  // Pega aquí la URL de la Web App de Google Apps Script para el modo real.
  sheetsUrl: '',
};

export const money = n => `$${n.toLocaleString('es-CO')}`;
