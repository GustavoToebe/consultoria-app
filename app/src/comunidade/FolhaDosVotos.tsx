import { BarChart3, Vote } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { baixarFotoDoColega, baixarFotoDoVotanteDaEquipe, listarVotosDaEquipe, listarVotosDoAluno } from '../api/comunidade';
import type { VotanteDaEnquete, VotosDaEnquete } from '../api/comunidadeTipos';
import { nomeDoVotante, textoDosParticipantes } from '../dominio/comunidade';
import { dataHoraParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { Folha } from '../ui/Folha';
import { FotoDePerfil, IniciaisDePerfil } from '../ui/FotoDePerfil';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';

export type AlvoDosVotos = { postId: string } | null;

interface Lidos { resumo: VotosDaEnquete; itens: VotanteDaEnquete[]; paginas: number }

const TAMANHO_DA_FOTO = 36;

/**
 * "Mostrar votos" de uma enquete (D9): painel lateral no PC, folha de baixo no celular (`Folha lateral`). Quem votou, em
 * quê e quando, 30 por vez, mais recentes primeiro (a ordem é da API); a pessoa se vê como "Você". O filtro por opção traz
 * a contagem da opção; sem total de elegíveis. Nada fica no aparelho.
 */
export function FolhaDosVotos({ alvo, papel, aoFechar }: { alvo: AlvoDosVotos; papel: 'aluno' | 'equipe'; aoFechar: () => void }) {
  const { cores } = useTema();
  const [opcaoId, setOpcaoId] = useState<string | null>(null);
  const listar = papel === 'aluno' ? listarVotosDoAluno : listarVotosDaEquipe;
  const baixarFoto = papel === 'aluno' ? baixarFotoDoColega : baixarFotoDoVotanteDaEquipe;
  // `postId` local: o React Compiler lê as dependências da função na renderização, e `alvo!.postId` quebrava com a folha fechada.
  const postId = alvo?.postId ?? '';
  const chave = alvo ? `votos:${postId}:${opcaoId ?? ''}` : null;
  const lista = useCarregar<Lidos>(chave, () =>
    listar(postId, opcaoId, 0).then((r) => ({ resumo: r, itens: r.votantes.itens, paginas: 1 })));
  const dados = lista.dadosDeOutraChave ? undefined : lista.dados;
  const atual = useRef(dados);
  useEffect(() => { atual.current = dados; });
  const [mais, setMais] = useState<{ chave: string; carregando: boolean; erro?: unknown } | null>(null);
  const maisAqui = mais && mais.chave === chave ? mais : null;

  // Outra enquete começa sem filtro (a opção escolhida antes não existe nela).
  const [postDoFiltro, setPostDoFiltro] = useState<string | null>(null);
  if (alvo && alvo.postId !== postDoFiltro) {
    setPostDoFiltro(alvo.postId);
    if (opcaoId !== null) setOpcaoId(null);
  }

  const carregarMais = () => {
    const k = chave;
    if (!alvo || !k || !dados || maisAqui?.carregando) return;
    setMais({ chave: k, carregando: true });
    listar(postId, opcaoId, dados.paginas).then(
      (r) => {
        setMais(null);
        const antes = atual.current;
        if (!antes) return;
        const vistos = new Set(antes.itens.map(idDoVoto));
        const novos = r.votantes.itens.filter((v) => !vistos.has(idDoVoto(v)));
        lista.definir({ resumo: r, itens: [...antes.itens, ...novos], paginas: antes.paginas + 1 }, k);
        AccessibilityInfo.announceForAccessibility(novos.length === 1 ? '1 voto carregado.' : `${novos.length} votos carregados.`);
      },
      (erro: unknown) => setMais({ chave: k, carregando: false, erro }),
    );
  };

  const saiu = lista.erro instanceof ErroApi && lista.erro.status === 404;
  const resumo = dados?.resumo;
  const faltam = dados ? dados.resumo.votantes.total - dados.itens.length : 0;
  const textoDaOpcao = new Map(resumo?.opcoes.map((o) => [o.opcaoId, o.texto]) ?? []);

  return (
    <Folha visivel={!!alvo} titulo="Votos da enquete" aoFechar={aoFechar} lateral>
      {saiu ? (
        <Vazio Icone={BarChart3} titulo="Enquete não disponível" texto="Esta enquete saiu do mural." />
      ) : lista.erro && !dados ? (
        <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} />
      ) : !resumo ? (
        <Esqueleto cartoes={2} texto="Carregando os votos" />
      ) : (
        <View style={estilos.conteudo}>
          <View style={estilos.cabeca}>
            <Texto variante="bloco" nivel={3}>{resumo.pergunta}</Texto>
            <Texto variante="suave">{textoDosParticipantes(resumo.participantes)}</Texto>
          </View>
          {resumo.opcoes.length > 1 ? (
            <Escolha chips rotulo="Mostrar" valor={opcaoId} aoMudar={setOpcaoId}
              opcoes={[{ valor: null, rotulo: 'Todas' }, ...resumo.opcoes.map((o) => ({ valor: o.opcaoId, rotulo: o.texto, contagem: o.votos }))]} />
          ) : null}
          {dados.itens.length === 0 ? (
            <Vazio Icone={Vote} texto={opcaoId ? 'Ninguém votou nesta opção.' : 'Ninguém votou ainda.'} />
          ) : (
            <View accessibilityRole="list" role="list" style={estilos.lista}>
              {dados.itens.map((v, i) => (
                <View key={idDoVoto(v)} role="listitem" style={[estilos.linha, i > 0 && [estilos.separado, { borderTopColor: cores.divisor }]]}>
                  {v.temFoto
                    ? <FotoDePerfil chave={`votante:${v.autorId}`} carregar={() => baixarFoto(v.autorId)} nome={v.nome} tamanho={TAMANHO_DA_FOTO} />
                    : <IniciaisDePerfil nome={v.nome} tamanho={TAMANHO_DA_FOTO} />}
                  <View style={estilos.texto}>
                    <Texto cor={cores.texto} style={v.ehVoce ? estilos.voce : undefined}>{nomeDoVotante(v)}</Texto>
                    <Texto variante="suave">{`${textoDaOpcao.get(v.opcaoId) ?? '—'} · ${dataHoraParaTela(v.votadoEm)}`}</Texto>
                  </View>
                </View>
              ))}
            </View>
          )}
          {faltam > 0 ? (
            <View style={[estilos.mais, { borderTopColor: cores.divisor }]}>
              <Texto variante="suave" numerico>{`Mostrando ${dados.itens.length} de ${dados.resumo.votantes.total} votos.`}</Texto>
              {maisAqui?.erro ? (
                <MensagemErro texto={textoDoErro(maisAqui.erro)} erro={maisAqui.erro} tentarDeNovo={carregarMais} />
              ) : (
                <LinhaDeAcoes>
                  <Botao rotulo="Carregar mais votos" tipo="secundario" carregando={!!maisAqui?.carregando} aoTocar={carregarMais} />
                </LinhaDeAcoes>
              )}
            </View>
          ) : null}
        </View>
      )}
    </Folha>
  );
}

// Um votante aparece uma vez por opção em que votou.
// shortcut: a página seguinte vem pelo número (base 0); voto novo no meio pode repetir um item (o Set tira) ou pular um; fechar e abrir de novo resolve.
const idDoVoto = (v: VotanteDaEnquete) => `${v.autorId}:${v.opcaoId}`;

const estilos = StyleSheet.create({
  conteudo: { gap: espaco(2) },
  cabeca: { gap: espaco(0.5) },
  lista: { gap: espaco(1.25) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25) },
  separado: { borderTopWidth: 1, paddingTop: espaco(1.25) },
  texto: { flex: 1, minWidth: 0, gap: 2 },
  voce: { fontFamily: fontes.semi },
  mais: { borderTopWidth: 1, paddingTop: espaco(1.5), gap: espaco(1) },
});
