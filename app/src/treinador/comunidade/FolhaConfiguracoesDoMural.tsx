import { Pencil, Plus, TriangleAlert } from 'lucide-react-native';
import { codigoApi } from '@plataforma/web';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { criarPod, obterConfiguracaoDaComunidade, renomearPod, salvarConfiguracaoDaComunidade } from '../../api/comunidade';
import type { ConfiguracaoDaComunidade, PodResumo } from '../../api/comunidadeTipos';
import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import {
  avisoDoPod, erroDoNomeDoPod, nomeDoPodParaEnviar, POD_NOME_MAXIMO, POD_NOME_MINIMO, POD_TETO, traduzirErroDoPod,
} from '../../dominio/comunidade';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/** Por onde a folha abre: "Configurações do mural" (topo) ou "Gerenciar grupos" do seletor (já na seção Grupos). */
export type SecaoDasConfiguracoes = 'quemPublica' | 'grupos';

/** A lista que a tela carregou (`listarPods`): a folha só mostra e, depois de criar ou renomear, pede para recarregar. */
export interface GruposCarregados {
  dados: PodResumo[] | undefined;
  erro: unknown;
  recarregar: () => void;
}

const AJUDA_DO_NOME = `De ${POD_NOME_MINIMO} a ${POD_NOME_MAXIMO} caracteres.`;
const ALVO_DOS_GRUPOS = 'configuracoes-do-mural:grupos';

/** O nome repetido também é do campo: a pessoa corrige ali mesmo. */
function erroNoCampo(e: unknown): { mensagem: string; noCampo: boolean } {
  const { mensagem, noCampoNome } = traduzirErroDoPod(e);
  return { mensagem, noCampo: noCampoNome || codigoApi(e) === 'POD_NOME_EM_USO' };
}

/**
 * "Configurações do mural" (D5 de 19/11, `COMUNIDADE_MODERAR`): uma folha só, com "Quem publica" (as duas chaves) e
 * "Grupos" (criar e renomear). Não há excluir grupo: a API não tem a rota (o post do grupo é `ON DELETE NO ACTION`).
 * A tela só monta a folha aberta, então cada abertura nasce do zero; com `secao="grupos"` ela rola até a seção e põe o
 * foco no título dela. Sem rodapé: as chaves salvam na hora e os grupos têm os próprios botões. Fechar com um nome de
 * grupo digitado (novo ou renomeação aberta) pergunta "Sair sem salvar?". As recusas ficam dentro da folha, porque o
 * aviso de rodapé (`useAviso`) fica atrás do véu do Modal.
 */
export function FolhaConfiguracoesDoMural({ grupos, secao = 'quemPublica', aoFechar }: {
  grupos: GruposCarregados;
  secao?: SecaoDasConfiguracoes;
  aoFechar: () => void;
}) {
  const [novo, setNovo] = useState('');
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  // O que se perde ao fechar: o nome do novo grupo digitado e o novo nome de uma renomeação aberta.
  const alterado = novo !== '' || (!!editando && editando.nome !== grupos.dados?.find((p) => p.id === editando.id)?.nome);
  const { fechar, aviso } = useFecharComAviso(true, alterado, aoFechar);
  return (
    <Folha visivel titulo="Configurações do mural" aoFechar={fechar}>
      <View style={estilos.secao}>
        <Texto variante="secao" nivel={3}>Quem publica</Texto>
        <Texto variante="suave">A equipe sempre publica; comentar e curtir continuam liberados para os alunos.</Texto>
        <ChavesDoMural />
      </View>
      <AlvoDeRolagem chave={ALVO_DOS_GRUPOS}>
        <SecaoDosGrupos grupos={grupos} novo={novo} setNovo={setNovo} editando={editando} setEditando={setEditando} focar={secao === 'grupos'} />
      </AlvoDeRolagem>
      {aviso}
    </Folha>
  );
}

/**
 * As duas chaves do mural (C9). Muda na hora e volta se a API recusar; o PUT manda sempre os dois campos. Uma mudança por
 * vez: enquanto uma salva, a outra espera.
 */
function ChavesDoMural() {
  const config = useCarregar('treinador-comunidade-configuracao', () => obterConfiguracaoDaComunidade());
  const [salvando, setSalvando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);
  const mudar = async (parte: Partial<ConfiguracaoDaComunidade>) => {
    const antes = config.dados;
    if (!antes || salvando) return;
    const depois = { alunosPublicam: antes.alunosPublicam, alunosAnexamFotos: antes.alunosAnexamFotos, ...parte };
    config.definir(depois);
    setSalvando(true);
    setRecusa(null);
    try {
      config.definir(await salvarConfiguracaoDaComunidade(depois));
    } catch (e) {
      config.definir(antes);
      setRecusa(textoDoErro(e));
    } finally {
      setSalvando(false);
    }
  };
  if (config.erro) return <MensagemErro texto={textoDoErro(config.erro)} erro={config.erro} tentarDeNovo={config.recarregar} />;
  if (!config.dados) return <Esqueleto cartoes={1} texto="Carregando as chaves do mural" />;
  return (
    <>
      {recusa ? <Alerta tom="perigo" texto={recusa} /> : null}
      <Interruptor rotulo="Alunos podem publicar" valor={config.dados.alunosPublicam}
        aoMudar={(v) => void mudar({ alunosPublicam: v })} ajuda="Conversa, dúvida e resultado." />
      <Interruptor rotulo="Alunos podem anexar fotos" valor={config.dados.alunosAnexamFotos}
        aoMudar={(v) => void mudar({ alunosAnexamFotos: v })} ajuda="Até 4 por publicação; vale só com a de cima ligada." />
    </>
  );
}

/** O aviso fixo do grupo com menor, na cor de atenção (pede cuidado, não impede). */
function AvisoDeMenor({ texto }: { texto: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.aviso}>
      <TriangleAlert size={16} color={cores.atencao} strokeWidth={2.25} aria-hidden />
      <Texto variante="pequeno" cor={cores.atencao} style={estilos.encolher}>{texto}</Texto>
    </View>
  );
}

/**
 * Grupos (pods): criar e renomear, com "N de 12" e o aviso de menor de cada um. Sem lista de membros (decisão 8 do plano
 * dos pods). O erro do nome vai para o campo (`traduzirErroDoPod`, `noCampoNome`); os outros num `Alerta` no topo da seção.
 * O rascunho (`novo`, `editando`) mora na folha, que decide o "Sair sem salvar?".
 */
function SecaoDosGrupos({ grupos, novo, setNovo, editando, setEditando, focar }: {
  grupos: GruposCarregados;
  novo: string;
  setNovo: (t: string) => void;
  editando: { id: string; nome: string } | null;
  setEditando: (e: { id: string; nome: string } | null) => void;
  focar: boolean;
}) {
  const { cores } = useTema();
  const { rolarAte } = useRolagem();
  const titulo = useRef<View>(null);
  const [erroDoNovo, setErroDoNovo] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);

  // "Gerenciar grupos": a folha abre já aqui. Rola (a rolagem da folha) e, na web, o foco vai ao título da seção.
  useEffect(() => {
    if (!focar) return;
    rolarAte([ALVO_DOS_GRUPOS]);
    if (Platform.OS !== 'web') return;
    const relogio = setTimeout(() => (titulo.current as unknown as HTMLElement | null)?.focus?.({ preventScroll: true }), 200);
    return () => clearTimeout(relogio);
  }, [focar, rolarAte]);

  const criar = async () => {
    setRecusa(null);
    const erro = erroDoNomeDoPod(novo);
    setErroDoNovo(erro);
    if (erro || criando) return;
    setCriando(true);
    try {
      await criarPod(nomeDoPodParaEnviar(novo));
      setNovo('');
      grupos.recarregar();
    } catch (e) {
      const { mensagem, noCampo } = erroNoCampo(e);
      if (noCampo) setErroDoNovo(mensagem);
      else setRecusa(mensagem);
    } finally {
      setCriando(false);
    }
  };

  const salvarNome = async () => {
    if (!editando || salvando) return;
    setRecusa(null);
    const erro = erroDoNomeDoPod(editando.nome);
    setErroDoNome(erro);
    if (erro) return;
    setSalvando(true);
    try {
      await renomearPod(editando.id, nomeDoPodParaEnviar(editando.nome));
      setEditando(null);
      grupos.recarregar();
    } catch (e) {
      const { mensagem, noCampo } = erroNoCampo(e);
      if (noCampo) setErroDoNome(mensagem);
      else setRecusa(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const lista = grupos.dados;
  return (
    <View style={[estilos.secao, estilos.secaoSeguinte, { borderTopColor: cores.divisor }]}>
      {/* `tabIndex` -1: o título recebe o foco ao abrir pelo "Gerenciar grupos", sem entrar na ordem do Tab. */}
      <View ref={titulo} tabIndex={-1}>
        <Texto variante="secao" nivel={3}>Grupos</Texto>
      </View>
      <Texto variante="suave">
        {`Cada grupo tem um mural próprio, que só os alunos dele veem. Até ${POD_TETO} alunos por grupo; o aluno entra pela ficha dele, em Dados.`}
      </Texto>
      {recusa ? <Alerta tom="perigo" texto={recusa} /> : null}

      <View style={estilos.novo}>
        <Campo rotulo="Nome do novo grupo" valor={novo} maxLength={POD_NOME_MAXIMO} ajuda={AJUDA_DO_NOME} erro={erroDoNovo}
          aoMudar={(t) => { setNovo(t); if (erroDoNovo) setErroDoNovo(null); }} onSubmitEditing={() => void criar()} />
        <LinhaDeAcoes>
          <Botao rotulo="Criar grupo" tipo="primario" Icone={Plus} carregando={criando} aoTocar={() => void criar()} />
        </LinhaDeAcoes>
      </View>

      {grupos.erro ? (
        <MensagemErro texto={textoDoErro(grupos.erro)} erro={grupos.erro} tentarDeNovo={grupos.recarregar} />
      ) : !lista ? (
        <Esqueleto cartoes={2} texto="Carregando os grupos" />
      ) : !lista.length ? (
        <Vazio texto="Nenhum grupo ainda. Dê um nome acima para criar o primeiro." />
      ) : (
        <ListaDeLinhas>
          {lista.map((p) => {
            const avisoDoGrupo = avisoDoPod(p);
            const aberto = editando?.id === p.id;
            return (
              // A contagem é frase: vai em `valores` (texto comum), não em `metadados`, que a peça desenha na fonte numérica (D5).
              <LinhaDaLista key={p.id} titulo={p.nome} acoesAoLado
                valores={<Texto variante="pequeno">{`${p.membros} de ${POD_TETO} alunos${p.membros >= POD_TETO ? ' (cheio)' : ''}`}</Texto>}
                acoes={aberto ? undefined : (
                  <IconeBotao Icone={Pencil} rotulo={`Renomear o grupo ${p.nome}`} moldura
                    aoTocar={() => { setRecusa(null); setErroDoNome(null); setEditando({ id: p.id, nome: p.nome }); }} />
                )}>
                {avisoDoGrupo ? <AvisoDeMenor texto={avisoDoGrupo} /> : null}
                {aberto ? (
                  <View style={estilos.novo}>
                    <Campo rotulo={`Novo nome de ${p.nome}`} valor={editando.nome} maxLength={POD_NOME_MAXIMO} ajuda={AJUDA_DO_NOME}
                      erro={erroDoNome} autoFocus onSubmitEditing={() => void salvarNome()}
                      aoMudar={(nome) => { setEditando({ id: p.id, nome }); if (erroDoNome) setErroDoNome(null); }} />
                    <LinhaDeAcoes alinhar="fim">
                      <Botao rotulo="Cancelar" tipo="secundario" aoTocar={() => { setEditando(null); setErroDoNome(null); }} />
                      <Botao rotulo="Salvar nome" tipo="primario" carregando={salvando} aoTocar={() => void salvarNome()} />
                    </LinhaDeAcoes>
                  </View>
                ) : null}
              </LinhaDaLista>
            );
          })}
        </ListaDeLinhas>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Dentro da seção 16 px; entre as duas, o divisor e 24 px (o dobro), como os grupos do painel de filtros.
  secao: { gap: espaco(2) },
  secaoSeguinte: { borderTopWidth: 1, paddingTop: espaco(3), marginTop: espaco(1) },
  novo: { gap: espaco(1.5) },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.75) },
  encolher: { flex: 1, minWidth: 0 },
});
