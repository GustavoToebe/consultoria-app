import { Permitido } from '../../ui/Permitido';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarAlimento, criarAlimento, gruposDoCatalogo, inativarAlimento, listarAlimentos } from '../../api/rotas';
import type { Alimento, AlimentoRequest, UnidadeAlimento } from '../../api/tipos';
import { AJUDA_FC, AJUDA_FCC, erroDoFatorCoccao, erroDoFatorCorrecao, textoDosFatores } from '../../dominio/fatoresDoAlimento';
import { numeroParaTela } from '../../dominio/formatos';
import { sugerirGrupos } from '../../dominio/gruposDaLista';
import { espaco } from '../../tema/tokens';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { BarraDaBiblioteca } from './BarraDaBiblioteca';
import { useCarregar } from '../../ui/useCarregar';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { normalizar } from '../treino/FolhaBiblioteca';

export const UNIDADES: { valor: UnidadeAlimento; rotulo: string }[] = [
  { valor: 'g', rotulo: 'g' },
  { valor: 'ml', rotulo: 'ml' },
  { valor: 'un', rotulo: 'un' },
];

/** "100 g · 266 kcal · P 8,4 · C 49,6 · G 3,2" */
export function resumoAlimento(a: Pick<Alimento, 'baseQuantidade' | 'baseUnidade' | 'kcal' | 'proteina' | 'carboidrato' | 'gordura'>) {
  return `${numeroParaTela(a.baseQuantidade)} ${a.baseUnidade} · ${numeroParaTela(a.kcal, 0)} kcal · P ${numeroParaTela(a.proteina, 1)} · C ${numeroParaTela(a.carboidrato, 1)} · G ${numeroParaTela(a.gordura, 1)}`;
}

/** Tamanho do grupo do alimento (`GrupoDoAlimento.MAXIMO` na API). */
export const LIMITE_GRUPO_DO_ALIMENTO = 60;
/** Quantas sugestões de grupo aparecem de uma vez embaixo do campo. */
const SUGESTOES_DE_GRUPO = 8;

/** "Cereais e derivados · FC 1,75 · FCc 2,5" na linha da biblioteca; sem grupo nem fator, nada. */
export function descricaoDoAlimento(a: Pick<Alimento, 'grupo' | 'fatorCorrecao' | 'fatorCoccao'>): string | null {
  return [a.grupo?.trim() || null, textoDosFatores(a)].filter(Boolean).join(' · ') || null;
}

/** Alimentos da consultoria com os valores por quantidade-base (digitados pelo treinador ou importados). */
export function AbaAlimentos() {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar('biblioteca-alimentos', () => listarAlimentos());
  const [busca, setBusca] = useState('');
  // Filtro da lista de compras: quem ainda não tem FC/FCc aparece com o selo "Sem fatores" e dá para listar só eles.
  const [fatores, setFatores] = useState<'todos' | 'com' | 'sem'>('todos');
  const [editando, setEditando] = useState<Alimento | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Alimento | null>(null);
  const termo = normalizar(busca.trim());
  const semFatores = (a: Alimento) => a.fatorCorrecao === null && a.fatorCoccao === null;
  const lista = (dados ?? []).filter((a) => (!termo || normalizar(a.nome).includes(termo))
    && (fatores === 'todos' || (fatores === 'sem') === semFatores(a)));

  const confirmarInativar = () => {
    const alvo = inativar;
    setInativar(null);
    if (!alvo) return;
    inativarAlimento(alvo.id).then(
      () => {
        avisar(`“${alvo.nome}” saiu da biblioteca.`, 'sucesso');
        recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  return (
    <Cartao
      titulo="Alimentos da biblioteca"
      descricao="Os alimentos que você escolhe ao montar a dieta, com os valores por quantidade-base."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao rotulo="Novo alimento" Icone={Plus} aoTocar={() => setEditando('novo')} /></Permitido>}>
      <BarraDaBiblioteca rotulo="Buscar alimento" placeholder="Nome do alimento" valor={busca} aoMudar={setBusca}
        filtro={{ tipo: 'uma', rotulo: 'Fatores da lista de compras', valor: fatores, todos: 'todos', aoMudar: setFatores,
          opcoes: [{ valor: 'todos', rotulo: 'Todos' }, { valor: 'com', rotulo: 'Com fatores' }, { valor: 'sem', rotulo: 'Sem fatores' }] }} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && lista.length === 0 ? (
        <Vazio titulo={dados.length ? 'Nenhum alimento encontrado' : 'Biblioteca de alimentos vazia'} texto={dados.length ? 'Tente outro termo de busca ou filtro.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um alimento.' : 'Ainda não há itens cadastrados.'} acao={dados.length ? { rotulo: 'Limpar busca', aoTocar: () => { setBusca(''); setFatores('todos'); } } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar alimento', aoTocar: () => setEditando('novo') } : undefined} />
      ) : null}
      {lista.length ? <ListaDeLinhas>{lista.map((a) => {
        const fatoresDoAlimento = textoDosFatores(a);
        return <LinhaDaLista key={a.id} titulo={a.nome} metadados={resumoAlimento(a)} descricao={descricaoDoAlimento(a) ?? undefined}
          selos={fatoresDoAlimento ? undefined : [{ texto: 'Sem fatores', tipo: 'neutro' }]}
          acoesAoLado
          acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} rotulo={`Editar ${a.nome}`} aoTocar={() => setEditando(a)} /></Permitido>} />;
      })}</ListaDeLinhas> : null}
      {editando ? (
        <FolhaAlimento
          inicial={editando === 'novo' ? null : editando}
          gruposDaConsultoria={(dados ?? []).map((a) => a.grupo)}
          aoTirar={editando === 'novo' ? undefined : () => { const alvo = editando; setEditando(null); setInativar(alvo); }}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
            avisar('Alimento salvo.', 'sucesso');
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={inativar !== null}
        titulo={`Tirar “${inativar?.nome ?? ''}” da biblioteca?`}
        mensagem="As dietas que já usam este alimento continuam com os valores gravados."
        rotuloConfirmar="Tirar da biblioteca"
        perigo
        aoConfirmar={confirmarInativar}
        aoCancelar={() => setInativar(null)}
      />
    </Cartao>
  );
}

function FolhaAlimento({ inicial, gruposDaConsultoria, aoFechar, aoSalvar, aoTirar }: {
  aoTirar?: () => void;
  inicial: Alimento | null;
  /** Grupos já usados na biblioteca, para as sugestões do campo Grupo. */
  gruposDaConsultoria: (string | null)[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [base, setBase] = useState<number | null>(inicial?.baseQuantidade ?? 100);
  const [unidade, setUnidade] = useState<UnidadeAlimento>(inicial?.baseUnidade ?? 'g');
  const [kcal, setKcal] = useState<number | null>(inicial?.kcal ?? null);
  const [proteina, setProteina] = useState<number | null>(inicial?.proteina ?? null);
  const [carboidrato, setCarboidrato] = useState<number | null>(inicial?.carboidrato ?? null);
  const [gordura, setGordura] = useState<number | null>(inicial?.gordura ?? null);
  const [gramas, setGramas] = useState<number | null>(inicial?.gramasPorUnidade ?? null);
  const [fonte, setFonte] = useState(inicial?.fonte ?? '');
  const [fc, setFc] = useState<number | null>(inicial?.fatorCorrecao ?? null);
  const [fcc, setFcc] = useState<number | null>(inicial?.fatorCoccao ?? null);
  const [grupo, setGrupo] = useState(inicial?.grupo ?? '');
  // Grupos do catálogo público como sugestão; sem eles (erro ou sem rede), sugere só os da consultoria.
  const doCatalogo = useCarregar('grupos-catalogo-alimentos', () => gruposDoCatalogo('alimentos'));
  const sugestoes = sugerirGrupos(gruposDaConsultoria, doCatalogo.dados ?? [], grupo).slice(0, SUGESTOES_DE_GRUPO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  const erroFc = erroDoFatorCorrecao(fc);
  const erroFcc = erroDoFatorCoccao(fcc);
  const completo = nome.trim() && base && kcal !== null && proteina !== null && carboidrato !== null && gordura !== null && !erroFc && !erroFcc;

  const salvar = () => {
    if (!completo) return;
    const dados: AlimentoRequest = {
      nome: nome.trim(),
      baseQuantidade: base,
      baseUnidade: unidade,
      kcal,
      proteina,
      carboidrato,
      gordura,
      gramasPorUnidade: gramas,
      fonte: fonte.trim() || null,
      fatorCorrecao: fc,
      fatorCoccao: fcc,
      grupo: grupo.replace(/\s+/g, ' ').trim() || null,
    };
    setSalvando(true);
    setErro(null);
    (inicial ? alterarAlimento(inicial.id, dados) : criarAlimento(dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={inicial ? 'Editar alimento' : 'Novo alimento'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!completo} motivo={erroFc || erroFcc ? 'Confira os fatores do alimento.' : undefined} />
        </>
      }>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={160} />
      <Campo
        rotulo="Grupo (opcional)"
        valor={grupo}
        aoMudar={setGrupo}
        erro={campos.grupo}
        maxLength={LIMITE_GRUPO_DO_ALIMENTO}
        ajuda="Agrupa a lista de compras do aluno (ex.: Carnes e derivados). Escreva ou toque numa sugestão. Vazio fica em “Outros itens”."
      />
      {sugestoes.length ? (
        <LinhaDeAcoes>
          {sugestoes.map((g) => (
            <Botao key={g} rotulo={g} tipo="secundario" aoTocar={() => setGrupo(g)} />
          ))}
        </LinhaDeAcoes>
      ) : null}
      <View style={estilos.grade}>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Quantidade-base" valor={base} aoMudar={setBase} erro={campos.baseQuantidade} />
        </View>
        <Escolha rotulo="Unidade" opcoes={UNIDADES} valor={unidade} aoMudar={setUnidade} />
      </View>
      <Texto variante="suave">Valores para a quantidade-base, como no rótulo ou na tabela que você usa.</Texto>
      <View style={estilos.grade}>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Kcal" valor={kcal} aoMudar={setKcal} erro={campos.kcal} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Proteína" sufixo="g" valor={proteina} aoMudar={setProteina} erro={campos.proteina} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Carboidrato" sufixo="g" valor={carboidrato} aoMudar={setCarboidrato} erro={campos.carboidrato} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Gordura" sufixo="g" valor={gordura} aoMudar={setGordura} erro={campos.gordura} />
        </View>
      </View>
      <View style={estilos.campo}>
        <CampoNumerico
          rotulo="Gramas por unidade (opcional)"
          valor={gramas}
          aoMudar={setGramas}
          ajuda="Permite usar o alimento em unidades (ex.: 1 fatia = 25 g)."
          erro={campos.gramasPorUnidade}
        />
      </View>
      <Campo rotulo="Fonte dos valores (opcional)" valor={fonte} aoMudar={setFonte} maxLength={200} />
      <Texto variante="secao">Lista de compras (opcional)</Texto>
      <Texto variante="suave">Use os fatores que você adota. Vazio = a lista do aluno usa a quantidade da dieta, como está.</Texto>
      <View style={estilos.grade}>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Fator de correção (FC)" valor={fc} aoMudar={setFc} ajuda={AJUDA_FC} erro={campos.fatorCorrecao ?? erroFc} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Fator de cocção (FCc)" valor={fcc} aoMudar={setFcc} ajuda={AJUDA_FCC} erro={campos.fatorCoccao ?? erroFcc} />
        </View>
      </View>
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {inicial && aoTirar ? <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-end' },
  campo: { minWidth: 140, flex: 1 },
});
