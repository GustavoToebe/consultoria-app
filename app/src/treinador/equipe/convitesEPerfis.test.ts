import type { PerfilEquipe } from '../../api/equipeTipos';
import { contagemPorPerfil, semConvites, textoDoEnvio } from './convitesEPerfis';

// Hora local ao meio-dia: o dia de calendário não muda com o fuso de quem roda o teste.
const agora = new Date(2026, 9, 19, 12, 0);
const expiraEm = (ano: number, mes: number, dia: number) => new Date(ano, mes - 1, dia, 12, 0).toISOString();

test('o envio é a validade menos 7 dias, em texto relativo', () => {
  expect(textoDoEnvio(expiraEm(2026, 10, 26), agora)).toBe('Enviado hoje');
  expect(textoDoEnvio(expiraEm(2026, 10, 25), agora)).toBe('Enviado ontem');
  expect(textoDoEnvio(expiraEm(2026, 10, 23), agora)).toBe('Enviado há 3 dias');
});

test('convite vencido diz a data do envio e que venceu; sem validade, "—"', () => {
  expect(textoDoEnvio(expiraEm(2026, 10, 10), agora)).toBe('Enviado em 03/10 · vencido');
  expect(textoDoEnvio(null, agora)).toBe('—');
  expect(textoDoEnvio('não é data', agora)).toBe('—');
});

const perfil = (id: string, nome: string): PerfilEquipe => ({ id, nome, descricao: null, acessoTotal: false, sistema: true, ativo: true, permissoes: [], usuarios: 0, versao: 1 });

test('a contagem por perfil não conta convite pendente e mostra o perfil vazio com zero', () => {
  const membros = [
    { perfilId: 'a', convitePendente: false }, { perfilId: 'a', convitePendente: false },
    { perfilId: 'a', convitePendente: true }, { perfilId: 'b', convitePendente: true },
  ];
  expect(contagemPorPerfil([perfil('a', 'Administrador'), perfil('b', 'Treinador')], membros).map((c) => [c.perfil.nome, c.total]))
    .toEqual([['Administrador', 2], ['Treinador', 0]]);
  expect(semConvites(membros)).toHaveLength(2);
});
