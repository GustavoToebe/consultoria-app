import { iniciarDescanso, restante, terminado, ajustarDescanso, semDescansoDe, criarPedidosDeDescanso, descansoAoIniciar, segundosDigitados, rotuloDescanso, DESCANSO_MAXIMO } from './descanso';
it('acompanha o relógio mesmo após longo tempo em segundo plano', () => {
 const d = iniciarDescanso(90, 1000);
 expect(restante(d, 31000)).toBe(60000);
 expect(restante(d, 92000)).toBe(0);
 expect(terminado(d, 92000)).toBe(true);
});
it('ajusta quinze segundos sem ficar negativo e pode reiniciar terminado', () => {
 const d = iniciarDescanso(10, 1000);
 expect(ajustarDescanso(d, -15, 2000).terminaEm).toBe(2000);
 expect(restante(ajustarDescanso(d, 15, 12000), 12000)).toBe(15000);
 expect(ajustarDescanso(d, 15, 2000).duracaoMs).toBe(24000);
});
it('converte minutos e segundos digitados e limita o máximo', () => {
 expect(segundosDigitados('1', '30')).toBe(90);
 expect(segundosDigitados('', '45')).toBe(45);
 expect(segundosDigitados('2', '')).toBe(120);
 expect(segundosDigitados('0', '0')).toBeNull();
 expect(segundosDigitados('', '')).toBeNull();
 expect(segundosDigitados('1a', ',5')).toBe(65);
 expect(segundosDigitados('99', '99')).toBe(DESCANSO_MAXIMO);
});
it('escreve o tempo por extenso curto', () => {
 expect(rotuloDescanso(30)).toBe('30 s');
 expect(rotuloDescanso(60)).toBe('1 min');
 expect(rotuloDescanso(90)).toBe('1 min 30 s');
 expect(rotuloDescanso(300)).toBe('5 min');
});
it('guarda a origem da pausa e a mantém ao ajustar o tempo', () => {
 const d = iniciarDescanso(20, 1000, 'Pausa entre blocos', 'etapa:v1|s1|2026-10-19|1');
 expect(d.origem).toBe('etapa:v1|s1|2026-10-19|1');
 expect(ajustarDescanso(d, 15, 2000).origem).toBe('etapa:v1|s1|2026-10-19|1');
 expect(iniciarDescanso(20, 1000)).toEqual({ terminaEm: 21000, duracaoMs: 20000 });
});
it('encerra só o cronômetro que nasceu da origem pedida', () => {
 const daEtapa = iniciarDescanso(20, 0, 'Pausa', 'etapa:v1|s1|d|1');
 expect(semDescansoDe(daEtapa, 'etapa:v1|s1|d|1')).toBeNull();
 expect(semDescansoDe(daEtapa, 'etapa:v1|s1|d|2')).toBe(daEtapa);
 expect(semDescansoDe(daEtapa, 'etapa:v2|s1|d|1')).toBe(daEtapa);
 const manual = iniciarDescanso(60, 0);
 expect(semDescansoDe(manual, 'etapa:v1|s1|d|1')).toBe(manual);
 expect(semDescansoDe(null, 'etapa:v1|s1|d|1')).toBeNull();
});
it('um descanso reservado antes perde para um cronômetro que começou depois (gravação antiga não pisa em pausa nova)', () => {
 const pedidos = criarPedidosDeDescanso();
 const reserva = pedidos.reservar();
 expect(pedidos.admitir()).toBe(true); // pausa de etapa marcada enquanto a série ainda gravava
 expect(pedidos.admitir(reserva)).toBe(false); // o descanso da série, atrasado, é descartado
});
it('um descanso reservado vale se nada começou depois; cancelar e pular não contam como início', () => {
 const pedidos = criarPedidosDeDescanso();
 const reserva = pedidos.reservar();
 // cancelar ou pular não passam por `admitir`, então a reserva segue de pé
 expect(pedidos.admitir(reserva)).toBe(true);
 const primeira = pedidos.reservar();
 const segunda = pedidos.reservar();
 expect(pedidos.admitir(primeira)).toBe(false);
 expect(pedidos.admitir(segunda)).toBe(true);
});
it('o início automático da mesma origem não reinicia a pausa; o pedido explícito e outra origem sim', () => {
 const ativa = iniciarDescanso(20, 0, 'Pausa', 'etapa:v1|s1|d|1');
 const novoDaMesma = iniciarDescanso(20, 5000, 'Pausa', 'etapa:v1|s1|d|1');
 expect(descansoAoIniciar(ativa, novoDaMesma, true)).toBe(ativa); // segundo toque antes do registro recarregar
 expect(descansoAoIniciar(ativa, novoDaMesma, false)).toBe(novoDaMesma); // botão "Pausa": reinicia
 const deOutra = iniciarDescanso(20, 5000, 'Pausa', 'etapa:v1|s1|d|2');
 expect(descansoAoIniciar(ativa, deOutra, true)).toBe(deOutra); // a pausa da etapa seguinte substitui a anterior
 expect(descansoAoIniciar(null, novoDaMesma, true)).toBe(novoDaMesma);
 const manual = iniciarDescanso(60, 0);
 expect(descansoAoIniciar(manual, novoDaMesma, true)).toBe(novoDaMesma);
 expect(descansoAoIniciar(ativa, iniciarDescanso(90, 5000), true).origem).toBeUndefined(); // descanso sem origem substitui
});
