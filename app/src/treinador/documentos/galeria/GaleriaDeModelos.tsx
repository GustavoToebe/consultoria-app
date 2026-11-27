import { useMemo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { Marca } from '../../../api/tipos';
import { colunasDaGaleria, larguraMaximaDaGaleria, MODELOS_PDF, type ModeloPdf } from '../../../dominio/configuracaoPdf';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../../tema/tokens';
import { Grade } from '../../../ui/Grade';
import { OpcaoCartao } from '../../../ui/OpcaoCartao';
import { Selo } from '../../../ui/Selo';
import { sobre } from '../../../ui/sobre';
import { Texto } from '../../../ui/Texto';
import { useFaixaDeLargura } from '../../../ui/useFaixaDeLargura';
import { PreviaDoDocumento } from '../PreviaDoDocumento';
import { documentoDaMiniatura } from './documentoDaMiniatura';

type Modelo = (typeof MODELOS_PDF)[number];

interface Props {
  marca: Marca;
  emUso: ModeloPdf;
  logo: string | null;
  emitidoEm: Date;
  /** O modelo em uso não responde ao toque (nada a gravar), só quando a escolha grava aqui. */
  emUsoInerte: boolean;
  aoEscolher: (modelo: ModeloPdf) => void;
}

const VAO = espaco(2);

/**
 * Os seis modelos (seção 3.1 de `orientacoes-de-design-26-11.md`). Web: grade de 6, 3, 2 ou 1 por linha com a miniatura
 * do topo da página, e o cartão inteiro é o botão "Usar este modelo". Nativo (D-F4): sem miniatura (seriam seis WebViews),
 * uma lista de `OpcaoCartao` radio com o modelo em uso marcado.
 */
export function GaleriaDeModelos(props: Props) {
  return Platform.OS === 'web' ? <GradeDosModelos {...props} /> : <ListaDosModelos {...props} />;
}

function ListaDosModelos({ emUso, aoEscolher }: Props) {
  return (
    <View role="radiogroup" aria-label="Modelo dos PDFs" style={estilos.lista}>
      {MODELOS_PDF.map((m) => (
        <OpcaoCartao key={m.id} titulo={m.nome} descricao={m.id === emUso ? `Em uso. ${m.descricao}` : m.descricao}
          selecionada={m.id === emUso} aoEscolher={() => { if (m.id !== emUso) aoEscolher(m.id); }} />
      ))}
    </View>
  );
}

function GradeDosModelos({ marca, emUso, logo, emitidoEm, emUsoInerte, aoEscolher }: Props) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const colunas = largura > 0 ? colunasDaGaleria(largura, VAO) : 1;
  // Uma geração por marca e logo (não a cada render): seis documentos curtos, o mesmo gerador do PDF.
  const documentos = useMemo(
    () => new Map(MODELOS_PDF.map((m) => [m.id, documentoDaMiniatura(marca, m.id, emitidoEm, logo)])),
    [marca, emitidoEm, logo],
  );
  return (
    <View onLayout={aoMedir}>
      <View role="list" aria-label="Modelos dos PDFs" style={{ maxWidth: larguraMaximaDaGaleria(colunas, VAO) }}>
        <Grade gap={VAO} colunas={() => colunas}>
          {MODELOS_PDF.map((m) => {
            const documento = documentos.get(m.id);
            return documento ? (
              <View key={m.id} role="listitem" style={estilos.celula}>
                <CartaoDoModelo modelo={m} emUso={m.id === emUso} inerte={emUsoInerte && m.id === emUso} aoTocar={() => aoEscolher(m.id)}>
                  <PreviaDoDocumento documento={documento} chave={`miniatura-${m.id.toLowerCase()}`} rotulo={`Miniatura do modelo ${m.nome}`} />
                </CartaoDoModelo>
              </View>
            ) : null;
          })}
        </Grade>
      </View>
    </View>
  );
}

function CartaoDoModelo({ modelo, emUso, inerte, aoTocar, children }: { modelo: Modelo; emUso: boolean; inerte: boolean; aoTocar: () => void; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Usar o modelo ${modelo.nome}${emUso ? ', em uso' : ''}. ${modelo.descricao}`}
      disabled={inerte}
      onPress={aoTocar}
      style={(estado) => {
        const realce = !inerte && sobre(estado);
        return [
          estilos.cartao,
          {
            backgroundColor: realce ? cores.superficie2 : cores.superficie,
            // Em uso: contorno forte de 2 px (a seleção neutra de `OpcaoCartao`); a margem de 1 px dos outros mantém o tamanho.
            borderColor: emUso || realce ? cores.bordaCampo : cores.divisor,
            borderWidth: emUso ? 2 : 1,
            margin: emUso ? 0 : 1,
          },
        ];
      }}>
      {/* Decorativa: o nome e a descrição dizem o que é; o toque passa por ela até o cartão (a prévia já é `inert`). */}
      <View aria-hidden pointerEvents="none" style={[estilos.miniatura, { backgroundColor: cores.superficie2, borderBottomColor: cores.divisor }]}>{children}</View>
      <View style={estilos.textos}>
        <View style={estilos.linhaDoNome}>
          <Texto style={estilos.nome}>{modelo.nome}</Texto>
          {emUso ? <Selo texto="Em uso" tipo="sucesso" /> : null}
        </View>
        <Texto variante="suave">{modelo.descricao}</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  celula: { flex: 1 },
  cartao: { flex: 1, borderRadius: RAIO, overflow: 'hidden' },
  // Recorte do topo da página (cabeçalho e a tabela da semana) em 4:3; o papel (branco, do CSS da prévia) cobre o fundo.
  miniatura: { aspectRatio: 4 / 3, overflow: 'hidden', borderBottomWidth: 1 },
  textos: { padding: espaco(1.5), gap: espaco(0.5) },
  linhaDoNome: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  nome: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 21 },
});
