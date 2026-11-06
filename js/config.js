// Todo lo que cambia de una barbería a otra está aquí.
// Si usas el modo real, copia también servicios y horario arriba de apps-script/Code.gs.
export const config = {
  name: 'Alex Studios',
  initials: 'AS', // se ve mientras no haya logo
  logo: '', // ruta del logo cuando lo tengamos, por ejemplo 'img/logo.png'
  district: 'Floralia',
  city: 'Cali',
  // Dirección para el mapa y "Cómo llegar", por ejemplo 'Calle 00 # 00-00'. Vacío = el mapa muestra el barrio.
  address: 'Calle 72C Norte # 5N-45',
  timeZone: 'America/Bogota', // el calendario usa la hora de Colombia

  // Días: 0 = domingo, 1 = lunes … 6 = sábado.
  openDays: [1, 2, 3, 4, 5, 6],
  open: '09:00',
  close: '19:00',
  slotMinutes: 30,
  breaks: [['12:00', '13:00']], // almuerzo de Alex: esas horas no se ofrecen
  daysAhead: 14,

  // Precios en pesos colombianos. Todos duran 30 min (barba: por confirmar).
  services: [
    { id: 'corte', name: 'Corte', price: 18000, includes: 'Corte de cabello', icon: 'scissors' },
    { id: 'cejas', name: 'Corte + cejas', price: 20000, includes: 'Corte de cabello y arreglo de cejas', icon: 'brow' },
    { id: 'barba', name: 'Corte + barba', price: 25000, includes: 'Corte de cabello y arreglo de barba', icon: 'beard' },
  ],

  // Vacío = modo demo (las citas se guardan solo en este navegador).
  // Pega aquí la URL de la Web App de Google Apps Script para el modo real.
  sheetsUrl: '',
};

export const money = n => `$${n.toLocaleString('es-CO')}`;
