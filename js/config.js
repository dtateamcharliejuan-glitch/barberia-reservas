// Todo lo que cambia de una barbería a otra está aquí.
// Si usas el modo real, copia también servicios y horario arriba de apps-script/Code.gs.
export const config = {
  name: 'Alex Barber',
  initials: 'AB', // se ve mientras no haya logo
  logo: '', // ruta del logo cuando lo tengamos, por ejemplo 'img/logo.png'
  district: 'Floralia',

  // Días: 0 = domingo, 1 = lunes … 6 = sábado.
  openDays: [1, 2, 3, 4, 5, 6],
  open: '09:00',
  close: '19:00',
  slotMinutes: 30,
  daysAhead: 14,

  // Precios en pesos colombianos. Todos duran 30 min (barba: por confirmar).
  // Fotos provisionales de Unsplash: cambiar por fotos de Alex.
  services: [
    { id: 'corte', name: 'Corte', price: 18000, includes: 'Corte de cabello', photo: 'photo-1622286342621-4bd786c2447c' },
    { id: 'cejas', name: 'Corte + cejas', price: 20000, includes: 'Corte de cabello y arreglo de cejas', photo: 'photo-1599351431202-1e0f0137899a' },
    { id: 'barba', name: 'Corte + barba', price: 23000, includes: 'Corte de cabello y arreglo de barba', photo: 'photo-1503951914875-452162b0f3f1' },
  ],
  heroPhoto: 'photo-1585747860715-2ba37e788b70',

  // Vacío = modo demo (las citas se guardan solo en este navegador).
  // Pega aquí la URL de la Web App de Google Apps Script para el modo real.
  sheetsUrl: '',
};

export const money = n => `$${n.toLocaleString('es-CO')}`;
export const photo = (id, w, h) => `https://images.unsplash.com/${id}?w=${w}${h ? `&h=${h}` : ''}&fit=crop&auto=format&q=70`;
