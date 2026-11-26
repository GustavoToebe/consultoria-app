import { Users } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { listarColegasDaComunidade } from '../api/comunidade';
import { dividirEmColunas, quantasColunasNaLista } from '../dominio/listaEmColunas';
import { molduraDoPerfil } from '../dominio/perfilDaComunidade';
import {
  colegasDaPrimeiraPagina, erroDaLeitura, haMaisColegas, juntarPaginaDeColegas, proximaPaginaDeColegas, rotuloDoColega, TEXTO_LIMITE_DE_LEITURA, textoDoNivel,
  type ColegasLidos,
} from '../dominio/perfilDoColega';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../ui/Estados';
import { LinhaDaLista, ListaDeLinhas } from '../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';
import { useFaixaDeLargura } from '../ui/useFaixaDeLargura';
import { FotoDoColega } from './FotoDoColega';

const FOTO = 40;
const CHAVE = 'colegas-da-comunidade';
/**
 * Coluna mínima da lista (foto, nome, nível e "Ver perfil"): no bloco de 1092 da web cabem duas, e o nome fica perto do botão
 * em vez de cruzar a tela (4.10: espaço extra vira coluna, nunca linha esticada). Celular e tela estreita: uma coluna.
 */
const MINIMO_DA_COLUNA = 400;
const VAO_DAS_COLUNAS = espaco(3);

/** Erro de uma leitura da lista: 429 com o texto fixo (pede espera, não é falha), o resto como erro com "Tentar de novo". */
function ErroDaLista({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo: () => void }) {
  if (erroDaLeitura(erro) === 'limite') {
    return (
      <Alerta tom="atencao" texto={TEXTO_LIMITE_DE_LEITURA}>
        <LinhaDeAcoes><Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={tentarDeNovo} /></LinhaDeAcoes>
      </Alerta>
    );
  }
  return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={tentarDeNovo} />;
}

/**
 * Colegas da consultoria com o perfil visível (decisão 12: quem reservou não aparece), por nome, 30 por vez com "Ver mais".
 * Cada linha: foto na moldura simples em tom neutro (a lista não traz a cor nem a moldura de cada um, e pintar todos de azul
 * diria uma escolha que não é deles), nome (já montado pelo servidor pela escolha do colega) e nível; "Ver perfil" (ou tocar no nome) abre a folha do perfil. O total
 * da API só decide se há mais: nunca aparece escrito nem é comparado com nada. Montada só com internet (a tela da Comunidade
 * já troca tudo pelo aviso de sem conexão).
 */
export function ListaDeColegas({ aoAbrir }: { aoAbrir: (autorId: string) => void }) {
  const { cores } = useTema();
  const lista = useCarregar<ColegasLidos>(CHAVE, () => listarColegasDaComunidade(0).then(colegasDaPrimeiraPagina));
  const dados = lista.dados;
  const atual = useRef(dados);
  useEffect(() => { atual.current = dados; });
  const [mais, setMais] = useState<{ carregando: boolean; erro?: unknown } | null>(null);
  const moldura = molduraDoPerfil(null).valor;
  const { largura, aoMedir } = useFaixaDeLargura();
  const colunas = quantasColunasNaLista(largura, MINIMO_DA_COLUNA, VAO_DAS_COLUNAS);
  // A largura sai das colunas que cabem, não das que têm colega: com poucos, a vaga fica vazia à direita (a linha não estica).
  const larguraDaColuna = (largura - VAO_DAS_COLUNAS * (colunas - 1)) / colunas;

  const verMais = () => {
    if (!dados || mais?.carregando) return;
    setMais({ carregando: true });
    listarColegasDaComunidade(proximaPaginaDeColegas(dados)).then(
      (pagina) => {
        setMais(null);
        const antes = atual.current;
        if (!antes) return;
        const depois = juntarPaginaDeColegas(antes, pagina);
        lista.definir(depois, CHAVE);
        const chegaram = depois.itens.length - antes.itens.length;
        AccessibilityInfo.announceForAccessibility(chegaram === 1 ? '1 colega carregado.' : `${chegaram} colegas carregados.`);
      },
      (erro: unknown) => setMais({ carregando: false, erro }),
    );
  };

  return (
    <Cartao titulo="Colegas" descricao="Quem deixou o perfil visível na Comunidade. Abra para ver nível, insígnias e recordes.">
      {lista.erro ? (
        <ErroDaLista erro={lista.erro} tentarDeNovo={lista.recarregar} />
      ) : !dados ? (
        <Esqueleto cartoes={2} texto="Carregando os colegas" />
      ) : !dados.itens.length ? (
        <Vazio Icone={Users} texto="Ainda não há colegas com perfil visível." />
      ) : (
        <View style={estilos.lista}>
          {/* De cima para baixo (a coluna 1 inteira, depois a 2): a ordem de leitura e a do Tab são as de uma coluna só. */}
          <View onLayout={aoMedir} style={colunas > 1 ? estilos.colunas : null}>
            {dividirEmColunas(dados.itens, colunas).map((grupo, i) => (
              <View key={i} style={colunas > 1 ? { width: larguraDaColuna } : null}>
                <ListaDeLinhas>
                  {grupo.map((c) => (
                    <LinhaDaLista
                      key={c.autorId}
                      titulo={c.nome}
                      metadados={textoDoNivel(c.nivel)}
                      rotulo={rotuloDoColega(c)}
                      inicio={<FotoDoColega autorId={c.autorId} nome={c.nome} temFoto={c.temFoto} tamanho={FOTO} cor={cores.bordaCampo} moldura={moldura} />}
                      aoTocarTextos={() => aoAbrir(c.autorId)}
                      acoesAoLado
                      acoes={<Botao rotulo="Ver perfil" rotuloAcessivel={`Ver perfil de ${c.nome}`} tipo="secundario" aoTocar={() => aoAbrir(c.autorId)} />}
                    />
                  ))}
                </ListaDeLinhas>
              </View>
            ))}
          </View>
          {haMaisColegas(dados) ? (
            mais?.erro ? (
              <ErroDaLista erro={mais.erro} tentarDeNovo={verMais} />
            ) : (
              <LinhaDeAcoes>
                <Botao rotulo="Ver mais colegas" tipo="secundario" carregando={!!mais?.carregando} aoTocar={verMais} />
              </LinhaDeAcoes>
            )
          ) : null}
        </View>
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(2) },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DAS_COLUNAS },
});
