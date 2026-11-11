import type { LucideIcon } from 'lucide-react-native';

import { Badge } from '../components/ui/badge';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Texto } from './Texto';

export type TipoSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

const FUNDO_DO_SELO = { sucesso: 'sucessoSuave', atencao: 'atencaoSuave', perigo: 'perigoSuave' } as const;

/**
 * Situação sempre com texto, nunca na cor da marca (11/11, guia pág. 4). O estado normal (`neutro`: em dia, inativo,
 * encerrado, código "3× WS") não ganha selo colorido: é só o texto secundário. O que pede ação ou confirma (`atencao`,
 * `perigo`, `sucesso`) vira pílula com o ponto e o texto na cor da situação sobre o fundo `*Suave` dela (≥ 4,5:1 e ponto
 * ≥ 3:1, `tema/tokens.test.ts`; fundo opaco, então vale sobre qualquer faixa). Com `Icone`, o ícone ocupa o lugar do ponto.
 *
 * `categoria` (tipo de série, divisão, refeição: `useTema().identificacao[chave]`) é a terceira família: pílula escura
 * tingida com o texto na cor da categoria, sem ponto (guia pág. 17); vale mais que o `tipo`.
 */
export function Selo({ texto, tipo = 'neutro', categoria, larguraMinima, Icone }: {
  texto: string; tipo?: TipoSelo; categoria?: { cor: string; fundo: string }; larguraMinima?: number; Icone?: LucideIcon;
}) {
  const { cores } = useTema();
  const normal = tipo === 'neutro' && !categoria;
  const cor = categoria ? categoria.cor : normal ? cores.textoSuave : cores[tipo];
  const fundo = categoria ? categoria.fundo : normal ? 'transparent' : cores[FUNDO_DO_SELO[tipo as Exclude<TipoSelo, 'neutro'>]];
  return (
    <Badge variant="outline"
      accessibilityRole="text"
      style={[
        estilos.selo,
        larguraMinima ? { minWidth: larguraMinima, justifyContent: 'center' } : null,
        normal ? estilos.semPilula : { borderColor: 'transparent', backgroundColor: fundo },
      ]}>
      {Icone ? <Icone size={12} color={cor} strokeWidth={2.5} /> : normal || categoria ? null : <View aria-hidden style={[estilos.ponto, { backgroundColor: cor }]} />}
      <Texto style={[estilos.texto, { color: cor }]}>{texto}</Texto>
    </Badge>
  );
}

const estilos = StyleSheet.create({
  selo: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 22,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: espaco(1),
    paddingVertical: 1,
  },
  semPilula: { borderColor: 'transparent', backgroundColor: 'transparent', paddingHorizontal: 0 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  texto: { fontFamily: fontes.medio, fontSize: 12, lineHeight: 16 },
});
