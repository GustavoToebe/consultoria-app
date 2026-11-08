import { Permitido } from '../../ui/Permitido';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarAlimento, criarAlimento, gruposDoCatalogo, inativarAlimento, listarAlimentos } from '../../api/rotas';
import type { Alimento, AlimentoRequest, UnidadeAlimento } from '../../api/tipos';
import { AJUDA_FC, AJUDA_FCC, descricaoDosFatores, erroDoFatorCoccao, erroDoFatorCorrecao, estimarFatoresDoAlimento, PERFIS_FC, PERFIS_FCC, perfilFcDoValor, perfilFccDoValor, previaDeConversao } from '../../dominio/fatoresDoAlimento';
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
import { FaixaDeChips } from '../../ui/FaixaDeChips';
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
export function resumoAlimento(a: Pick<Alimento, 'baseQuantidade' | 'baseUnidade' | 'kcal' | 'proteina' | 'carboidrato' | 'gordura' | 'porcao'>) {
  if (a.kcal == null) return a.porcao?.trim() || '—';
  return `${numeroParaTela(a.baseQuantidade)} ${a.baseUnidade} · ${numeroParaTela(a.kcal, 0)} kcal · P ${numeroParaTela(a.proteina, 1)} · C ${numeroParaTela(a.carboidrato, 1)} · G ${numeroParaTela(a.gordura, 1)}`;
}

/** Tamanho do grupo do alimento (`GrupoDoAlimento.MAXIMO` na API). */
export const LIMITE_GRUPO_DO_ALIMENTO = 60;
/** Quantas sugestões de grupo aparecem de uma vez embaixo do campo. */
const SUGESTOES_DE_GRUPO = 8;

/** Grupo e a conversão de 100 g, ou "Peso direto" quando FC e FCc são 1. */
export function descricaoDoAlimento(a: Pick<Alimento, 'grupo' | 'fatorCorrecao' | 'fatorCoccao'>): string | null {
  return descricaoDosFatores(a);
}

/** Alimentos da consultoria com os valores por quantidade-base (digitados pelo treinador ou importados). */
export function AbaAlimentos() {
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar('biblioteca-alimentos', () => listarAlimentos());
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Alimento | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Alimento | null>(null);
  const termo = normalizar(busca.trim());
  const lista = (dados ?? []).filter((a) => !termo || normalizar(a.nome).includes(termo));

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
      <BarraDaBiblioteca rotulo="Buscar alimento" placeholder="Nome do alimento" valor={busca} aoMudar={setBusca} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && lista.length === 0 ? (
        <Vazio titulo={dados.length ? 'Nenhum alimento encontrado' : 'Biblioteca de alimentos vazia'} texto={dados.length ? 'Tente outro termo de busca.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um alimento.' : 'Ainda não há itens cadastrados.'} acao={dados.length ? { rotulo: 'Limpar busca', aoTocar: () => setBusca('') } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar alimento', aoTocar: () => setEditando('novo') } : undefined} />
      ) : null}
      {lista.length ? <ListaDeLinhas>{lista.map((a) => {
        return <LinhaDaLista key={a.id} titulo={a.nome} metadados={resumoAlimento(a)} descricao={descricaoDoAlimento(a) ?? undefined}
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
  // No alimento novo a sugestão acompanha o nome. Na edição, só depois de "Sugerir pelo nome", até a pessoa tocar num chip ou no número.
  const [tocouFatores, setTocouFatores] = useState(inicial !== null);
  // Grupos do catálogo público como sugestão; sem eles (erro ou sem rede), sugere só os da consultoria.
  const doCatalogo = useCarregar('grupos-catalogo-alimentos', () => gruposDoCatalogo('alimentos'));
  const sugestoes = sugerirGrupos(gruposDaConsultoria, doCatalogo.dados ?? [], grupo).slice(0, SUGESTOES_DE_GRUPO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  const sugerido = estimarFatoresDoAlimento(nome, grupo, kcal, base, unidade);
  const fcMostrado = tocouFatores ? fc : sugerido.fatorCorrecao;
  const fccMostrado = tocouFatores ? fcc : sugerido.fatorCoccao;
  const erroFc = erroDoFatorCorrecao(fcMostrado);
  const erroFcc = erroDoFatorCoccao(fccMostrado);
  const completo = nome.trim() && base && kcal !== null && proteina !== null && carboidrato !== null && gordura !== null && !erroFc && !erroFcc;

  const sugerirPeloNome = () => setTocouFatores(false);
  const travarFatores = () => { setFc(fcMostrado); setFcc(fccMostrado); setTocouFatores(true); };
  const escolherFc = (valor: number) => { setFc(valor); setFcc(fccMostrado); setTocouFatores(true); };
  const escolherFcc = (valor: number) => { setFc(fcMostrado); setFcc(valor); setTocouFatores(true); };

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
      fatorCorrecao: fcMostrado,
      fatorCoccao: fccMostrado,
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
      <Texto variante="secao">Lista de compras (estimativa automática)</Texto>
      <Texto variante="suave">O nome sugere o descarte e a cocção. Escolha um perfil ou digite o número que você usa.</Texto>
      {inicial ? <Botao rotulo="Sugerir pelo nome" tipo="secundario" aoTocar={sugerirPeloNome} /> : null}
      <Texto variante="rotulo">Descarte / limpeza antes do preparo (FC)</Texto>
      <FaixaDeChips quebrar accessibilityLabel="Descarte e limpeza">
        {PERFIS_FC.map((p) => (
          <Botao key={p.codigo} rotulo={p.rotulo} tipo={perfilFcDoValor(fcMostrado) === p.codigo ? 'primario' : 'secundario'} aoTocar={() => escolherFc(p.valor)} />
        ))}
        <Botao rotulo="Personalizado" tipo={perfilFcDoValor(fcMostrado) === 'PERSONALIZADO' ? 'primario' : 'secundario'} aoTocar={travarFatores} />
      </FaixaDeChips>
      <Texto variante="rotulo">Estado do alimento na dieta / cocção (FCc)</Texto>
      <FaixaDeChips quebrar accessibilityLabel="Cocção">
        {PERFIS_FCC.map((p) => (
          <Botao key={p.codigo} rotulo={p.rotulo} tipo={perfilFccDoValor(fccMostrado) === p.codigo ? 'primario' : 'secundario'} aoTocar={() => escolherFcc(p.valor)} />
        ))}
        <Botao rotulo="Personalizado" tipo={perfilFccDoValor(fccMostrado) === 'PERSONALIZADO' ? 'primario' : 'secundario'} aoTocar={travarFatores} />
      </FaixaDeChips>
      <View style={estilos.grade}>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Fator de correção (FC)" valor={fcMostrado} aoMudar={(v) => { setFc(v); setFcc(fccMostrado); setTocouFatores(true); }} ajuda={AJUDA_FC} erro={campos.fatorCorrecao ?? erroFc} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Fator de cocção (FCc)" valor={fccMostrado} aoMudar={(v) => { setFc(fcMostrado); setFcc(v); setTocouFatores(true); }} ajuda={AJUDA_FCC} erro={campos.fatorCoccao ?? erroFcc} />
        </View>
      </View>
      {fcMostrado !== null && fccMostrado !== null && fccMostrado !== 0 ? <Texto variante="suave">{previaDeConversao(fcMostrado, fccMostrado)}</Texto> : null}
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {inicial && aoTirar ? <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-end' },
  campo: { minWidth: 140, flex: 1 },
});
