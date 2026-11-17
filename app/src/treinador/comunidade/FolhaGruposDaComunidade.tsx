import { Pencil, Plus, TriangleAlert } from 'lucide-react-native';
import { codigoApi } from '@plataforma/web';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { criarPod, renomearPod } from '../../api/comunidade';
import type { PodResumo } from '../../api/comunidadeTipos';
import { POD_TETO } from '../../comunidade/EscolhaDoGrupo';
import {
  avisoDoPod, erroDoNomeDoPod, nomeDoPodParaEnviar, POD_NOME_MAXIMO, POD_NOME_MINIMO, traduzirErroDoPod,
} from '../../dominio/comunidade';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';

const AJUDA_DO_NOME = `De ${POD_NOME_MINIMO} a ${POD_NOME_MAXIMO} caracteres.`;

/** O nome repetido também é do campo: a pessoa corrige ali mesmo. */
function erroNoCampo(e: unknown): { mensagem: string; noCampo: boolean } {
  const { mensagem, noCampoNome } = traduzirErroDoPod(e);
  return { mensagem, noCampo: noCampoNome || codigoApi(e) === 'POD_NOME_EM_USO' };
}

/** A lista que a tela carregou (`listarPods`): a folha só mostra e, depois de criar ou renomear, pede para recarregar. */
export interface GruposCarregados {
  dados: PodResumo[] | undefined;
  erro: unknown;
  recarregar: () => void;
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
 * Grupos (pods) da comunidade, só com `COMUNIDADE_MODERAR`: criar e renomear, com "N de 12" e o aviso de menor de cada
 * um. Sem lista de membros (decisão 8 do plano) e sem excluir. O erro do nome vai para o campo (`traduzirErroDoPod`,
 * `noCampoNome`); os outros num `Alerta` no topo, dentro da folha, porque o aviso de rodapé fica atrás do véu do Modal.
 */
export function FolhaGruposDaComunidade({ visivel, grupos, aoFechar }: { visivel: boolean; grupos: GruposCarregados; aoFechar: () => void }) {
  const [novo, setNovo] = useState('');
  const [erroDoNovo, setErroDoNovo] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);

  const fechar = () => { setRecusa(null); setErroDoNovo(null); setEditando(null); setErroDoNome(null); aoFechar(); };

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
    <Folha visivel={visivel} titulo="Grupos da comunidade" aoFechar={fechar}>
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
            const aviso = avisoDoPod(p);
            const aberto = editando?.id === p.id;
            return (
              <LinhaDaLista key={p.id} titulo={p.nome} acoesAoLado
                metadados={`${p.membros} de ${POD_TETO} alunos${p.membros >= POD_TETO ? ' (cheio)' : ''}`}
                acoes={aberto ? undefined : (
                  <IconeBotao Icone={Pencil} rotulo={`Renomear o grupo ${p.nome}`} moldura
                    aoTocar={() => { setRecusa(null); setErroDoNome(null); setEditando({ id: p.id, nome: p.nome }); }} />
                )}>
                {aviso ? <AvisoDeMenor texto={aviso} /> : null}
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
    </Folha>
  );
}

const estilos = StyleSheet.create({
  novo: { gap: espaco(1.5) },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(0.75) },
  encolher: { flex: 1, minWidth: 0 },
});
