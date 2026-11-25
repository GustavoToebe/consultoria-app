import { iniciarDescanso, restante, terminado, ajustarDescanso, semDescansoDe, criarPedidosDeDescanso, descansoAoIniciar, segundosDigitados, rotuloDescanso, DESCANSO_MAXIMO, relogioDoDescanso, AJUSTE_DO_DESCANSO_SEGUNDOS, textoDoTempo } from './descanso';
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
it('o relógio do descanso diz a fase, o tempo e a proporção com o relógio injetado', () => {
 const d = iniciarDescanso(90, 1000);
 expect(relogioDoDescanso(null, 1000)).toMatchObject({ fase: 'NENHUM', proporcao: 0 });
 expect(relogioDoDescanso(d, 1000)).toEqual({ fase: 'CONTANDO', restanteMs: 90000, segundos: 90, texto: '1:30', proporcao: 1 });
 expect(relogioDoDescanso(d, 46000)).toMatchObject({ fase: 'CONTANDO', segundos: 45, texto: '0:45', proporcao: 0.5 });
 // Arredonda para cima: com 400 ms para o fim ainda mostra 0:01.
 expect(relogioDoDescanso(d, 90600)).toMatchObject({ fase: 'CONTANDO', texto: '0:01' });
 expect(relogioDoDescanso(d, 91000)).toMatchObject({ fase: 'TERMINADO', texto: '0:00', proporcao: 0 });
 expect(relogioDoDescanso(d, 500000).fase).toBe('TERMINADO');
});
it('−15 s tem piso em zero e termina; +15 s depois de terminado recomeça', () => {
 const d = iniciarDescanso(10, 0);
 const menos = ajustarDescanso(d, -AJUSTE_DO_DESCANSO_SEGUNDOS, 2000);
 expect(relogioDoDescanso(menos, 2000).fase).toBe('TERMINADO');
 const mais = ajustarDescanso(menos, AJUSTE_DO_DESCANSO_SEGUNDOS, 3000);
 expect(relogioDoDescanso(mais, 3000)).toMatchObject({ fase: 'CONTANDO', segundos: 15, proporcao: 1 });
 // +15 s num descanso em curso: a duração só cresce se o restante passar dela, e a barra nunca passa de 1.
 expect(relogioDoDescanso(ajustarDescanso(iniciarDescanso(60, 0), 15, 30000), 30000)).toMatchObject({ segundos: 45, proporcao: 0.75 });
});
it('o tempo em m:ss do botão "Descanso 1:30" e do relógio', () => {
 expect([textoDoTempo(90), textoDoTempo(45), textoDoTempo(0), textoDoTempo(600), textoDoTempo(-3)]).toEqual(['1:30', '0:45', '0:00', '10:00', '0:00']);
});
