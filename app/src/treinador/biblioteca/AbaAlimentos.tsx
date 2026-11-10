import { Permitido } from '../../ui/Permitido';
import { Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarAlimento, criarAlimento, gruposDoCatalogo, inativarAlimento, listarAlimentos } from '../../api/rotas';
import type { Alimento, AlimentoRequest, UnidadeAlimento } from '../../api/tipos';
import {
  AJUDA_FC,
  AJUDA_FCC,
  descricaoDosFatores,
  erroDoFatorCoccao,
  erroDoFatorCorrecao,
  estimarFatoresDoAlimento,
  PERFIS_FC,
  PERFIS_FCC,
  perfilFcDoValor,
  perfilFccDoValor,
  previaDeConversao,
} from '../../dominio/fatoresDoAlimento';
import { numeroParaTela } from '../../dominio/formatos';
import { chipDeVarias } from '../../dominio/filtrosDaBiblioteca';
import { sugerirGrupos } from '../../dominio/gruposDaLista';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
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
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { CelulaDoFiltro } from '../SeletoresDeFiltro';
import { normalizar } from '../treino/FolhaBiblioteca';

export const UNIDADES: { valor: UnidadeAlimento; rotulo: string }[] = [
  { valor: 'g', rotulo: 'g' },
  { valor: 'ml', rotulo: 'ml' },
  { valor: 'un', rotulo: 'un' },
];

const OPCOES_UNIDADE: { valor: UnidadeAlimento; rotulo: string }[] = [
  { valor: 'g', rotulo: 'Gramas (g)' },
  { valor: 'ml', rotulo: 'Mililitros (ml)' },
  { valor: 'un', rotulo: 'Unidade (un)' },
];

export const GRUPOS_PADRAO_ALIMENTOS: readonly string[] = [
  'Carnes e derivados',
  'Cereais e derivados',
  'Frutas e derivados',
  'Leite e derivados',
  'Leguminosas e derivados',
  'Gorduras e óleos',
  'Outros / Sem grupo',
];

interface FiltrosDeAlimentos {
  grupos: ReadonlySet<string>;
  unidades: ReadonlySet<string>;
  fontes: ReadonlySet<string>;
  coccao: ReadonlySet<string>;
}
const SEM_FILTROS: FiltrosDeAlimentos = { grupos: new Set(), unidades: new Set(), fontes: new Set(), coccao: new Set() };

const OPCOES_PREPARO = [
  { valor: 'DIRETO', rotulo: 'Direto / Cru (FCc = 1)' },
  { valor: 'HIDRATA', rotulo: 'Hidrata no cozimento (FCc > 1)' },
  { valor: 'REDUZ', rotulo: 'Reduz no preparo (FCc < 1)' },
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
  const [filtros, setFiltros] = useState<FiltrosDeAlimentos>(SEM_FILTROS);
  const [editando, setEditando] = useState<Alimento | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Alimento | null>(null);

  // Lista de grupos: padrão + grupos presentes na base da consultoria
  const gruposDosDados = (dados ?? [])
    .map((a) => a.grupo?.trim())
    .filter((g): g is string => !!g && g !== 'Outros itens' && g !== 'Outros / Sem grupo');
  const todosOsGrupos = Array.from(new Set([...GRUPOS_PADRAO_ALIMENTOS.filter((g) => g !== 'Outros / Sem grupo'), ...gruposDosDados]))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  todosOsGrupos.push('Outros / Sem grupo');
  const opcoesGrupos = todosOsGrupos.map((g) => ({ valor: g, rotulo: g }));

  // Lista de fontes presentes nos alimentos
  const temSemFonte = (dados ?? []).some((a) => !a.fonte || !a.fonte.trim());
  const fontesDosDados = Array.from(
    new Set((dados ?? []).map((a) => a.fonte?.trim()).filter((f): f is string => !!f))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const opcoesFontes = [
    ...fontesDosDados.map((f) => ({ valor: f, rotulo: f })),
    ...(temSemFonte || fontesDosDados.length === 0 ? [{ valor: '__SEM_FONTE__', rotulo: 'Sem fonte' }] : []),
  ];

  const classificarCoccao = (fcc: number | null | undefined): 'DIRETO' | 'HIDRATA' | 'REDUZ' => {
    const v = fcc ?? 1;
    if (Math.abs(v - 1) < 0.001) return 'DIRETO';
    return v > 1 ? 'HIDRATA' : 'REDUZ';
  };

  const termo = normalizar(busca.trim());
  const { grupos: gruposMarcados, unidades: unidadesMarcadas, fontes: fontesMarcadas, coccao: coccaoMarcadas } = filtros;
  const limparFiltros = () => { setBusca(''); setFiltros(SEM_FILTROS); };
  // Um chip por filtro, com a chave do filtro (o ✕ tira só aquele).
  const chips = [
    ...chipDeVarias('Grupo', gruposMarcados, opcoesGrupos).map((c) => ({ ...c, chave: 'grupos' })),
    ...chipDeVarias('Unidade', unidadesMarcadas, OPCOES_UNIDADE).map((c) => ({ ...c, chave: 'unidades' })),
    ...chipDeVarias('Fonte', fontesMarcadas, opcoesFontes).map((c) => ({ ...c, chave: 'fontes' })),
    ...chipDeVarias('Preparo', coccaoMarcadas, OPCOES_PREPARO).map((c) => ({ ...c, chave: 'coccao' })),
  ];

  const lista = (dados ?? []).filter((a) => {
    if (termo && !normalizar(a.nome).includes(termo)) return false;
    if (gruposMarcados.size > 0) {
      const g = a.grupo?.trim();
      const semGrupo = !g || g === 'Outros itens' || g === 'Outros / Sem grupo';
      if (semGrupo ? !gruposMarcados.has('Outros / Sem grupo') : !gruposMarcados.has(g)) return false;
    }
    if (unidadesMarcadas.size > 0 && (!a.baseUnidade || !unidadesMarcadas.has(a.baseUnidade))) return false;
    if (fontesMarcadas.size > 0) {
      const f = a.fonte?.trim();
      if (!f ? !fontesMarcadas.has('__SEM_FONTE__') : !fontesMarcadas.has(f)) return false;
    }
    if (coccaoMarcadas.size > 0 && !coccaoMarcadas.has(classificarCoccao(a.fatorCoccao))) return false;
    return true;
  });

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
      <BarraDeFiltros busca={{ rotulo: 'Buscar alimento', placeholder: 'Nome do alimento', valor: busca, aoMudar: setBusca }}
        valor={filtros} aoAplicar={setFiltros} limpo={SEM_FILTROS} chips={chips}
        aoTirar={(chave) => setFiltros((f) => ({ ...f, [chave]: new Set<string>() }))}
        seletores={(atual, mudar) => (
          <>
            <CelulaDoFiltro>
              <SelecaoMultiplaSuspensa rotulo="Grupo" rotuloDeTodos="Todos os grupos" opcoes={opcoesGrupos} marcados={atual.grupos}
                aoMudar={(m) => mudar({ ...atual, grupos: m })} />
            </CelulaDoFiltro>
            <CelulaDoFiltro>
              <SelecaoMultiplaSuspensa rotulo="Unidade" rotuloDeTodos="Todas as unidades" opcoes={OPCOES_UNIDADE} marcados={atual.unidades}
                aoMudar={(m) => mudar({ ...atual, unidades: m })} />
            </CelulaDoFiltro>
            <CelulaDoFiltro>
              <SelecaoMultiplaSuspensa rotulo="Fonte" rotuloDeTodos="Todas as fontes" opcoes={opcoesFontes} marcados={atual.fontes}
                aoMudar={(m) => mudar({ ...atual, fontes: m })} />
            </CelulaDoFiltro>
            <CelulaDoFiltro>
              <SelecaoMultiplaSuspensa rotulo="Preparo" rotuloDeTodos="Todos os preparos" opcoes={OPCOES_PREPARO} marcados={atual.coccao}
                aoMudar={(m) => mudar({ ...atual, coccao: m })} />
            </CelulaDoFiltro>
          </>
        )} />
      {dados && lista.length && lista.length !== dados.length ? (
        <Texto variante="suave" numerico>{`${lista.length} de ${dados.length} alimentos`}</Texto>
      ) : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && lista.length === 0 ? (
        <Vazio
          titulo={dados.length ? 'Nenhum alimento encontrado' : 'Biblioteca de alimentos vazia'}
          texto={dados.length ? 'Tente outros termos de busca ou filtros.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um alimento.' : 'Ainda não há itens cadastrados.'}
          acao={dados.length ? { rotulo: 'Limpar filtros', aoTocar: limparFiltros } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar alimento', aoTocar: () => setEditando('novo') } : undefined}
        />
      ) : null}
      {lista.length ? <ListaDeLinhas>{lista.map((a) => (
        <LinhaDaLista key={a.id} titulo={a.nome} metadados={resumoAlimento(a)} descricao={descricaoDoAlimento(a) ?? undefined}
          acoesAoLado
          acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} rotulo={`Editar ${a.nome}`} aoTocar={() => setEditando(a)} /></Permitido>} />
      ))}</ListaDeLinhas> : null}
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
  const { cores } = useTema();
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
  const pendencia = !nome.trim() ? 'Informe o nome do alimento.'
    : !base ? 'Informe a quantidade-base.'
      : kcal === null || proteina === null || carboidrato === null || gordura === null ? 'Preencha kcal, proteína, carboidrato e gordura.'
        : erroFc || erroFcc ? 'Confira os fatores do alimento.' : null;

  const sugerirPeloNome = () => setTocouFatores(false);
  const perfilFc = perfilFcDoValor(fcMostrado);
  const perfilFcc = perfilFccDoValor(fccMostrado);
  const travarFatores = () => { setFc(fcMostrado); setFcc(fccMostrado); setTocouFatores(true); };
  const escolherFc = (valor: number) => { setFc(valor); setFcc(fccMostrado); setTocouFatores(true); };
  const escolherFcc = (valor: number) => { setFc(fcMostrado); setFcc(valor); setTocouFatores(true); };

  const salvar = () => {
    if (pendencia || !base) return;
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
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!!pendencia} motivo={pendencia ?? undefined} />
        </>
      }>
      {/* Cada parte é um cartão com faixa de título (padrão da Folha da inscrição): onde começa e onde termina, sem
          depender da cor. 24 px entre os blocos. As escolhas vão direto, sem `FaixaDeChips`: a `Escolha` já quebra
          linha, e dentro da faixa ela ficava numa fileira só, cortada na borda da folha. */}
      <View style={estilos.partes}>
        <Cartao titulo="Identificação" nivel={3}>
          <View style={estilos.linhaDeCampos}>
            <View style={estilos.campoNome}>
              <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={160} />
            </View>
            <View style={estilos.campoLargo}>
              <Campo rotulo="Fonte dos valores (opcional)" valor={fonte} aoMudar={setFonte} maxLength={200} placeholder="ex.: TACO, rótulo" />
            </View>
          </View>
          <View style={estilos.grupo}>
            <Campo
              rotulo="Grupo (opcional)"
              valor={grupo}
              aoMudar={setGrupo}
              erro={campos.grupo}
              maxLength={LIMITE_GRUPO_DO_ALIMENTO}
              ajuda="Agrupa a lista de compras do aluno. Vazio fica em “Outros itens”."
            />
            {sugestoes.length ? (
              <Escolha<string | null> descricao="Sugestões de grupo" valor={sugestoes.includes(grupo) ? grupo : null}
                aoMudar={(g) => { if (g) setGrupo(g); }} opcoes={sugestoes.map((g) => ({ valor: g, rotulo: g }))} />
            ) : null}
          </View>
        </Cartao>

        <Cartao titulo="Porção e macronutrientes" descricao="Como no rótulo ou na tabela nutricional." nivel={3}>
          <View style={estilos.linhaDeCampos}>
            <View style={estilos.campoCurto}>
              <CampoNumerico rotulo="Quantidade-base" valor={base} aoMudar={setBase} erro={campos.baseQuantidade} />
            </View>
            <View style={estilos.campoUnidade}>
              <Escolha rotulo="Unidade" opcoes={UNIDADES} valor={unidade} aoMudar={setUnidade} />
            </View>
            <View style={estilos.campoLargo}>
              <CampoNumerico
                rotulo="Gramas por unidade (opcional)"
                valor={gramas}
                aoMudar={setGramas}
                ajuda={'Para usar em unidades (1 fatia = 25 g).'}
                erro={campos.gramasPorUnidade}
              />
            </View>
          </View>
          {/* Os macros dizem a que quantidade se referem: a ligação com a quantidade-base fica escrita. */}
          <View style={[estilos.macros, { borderTopColor: cores.borda }]}>
            <Texto variante="secao" numerico>{base ? `Valores por ${numeroParaTela(base)} ${unidade}` : 'Valores pela quantidade-base'}</Texto>
            <View style={estilos.linhaDeCampos}>
              <View style={estilos.campoMacro}>
                <CampoNumerico rotulo="Kcal" valor={kcal} aoMudar={setKcal} erro={campos.kcal} />
              </View>
              <View style={estilos.campoMacro}>
                <CampoNumerico rotulo="Proteína" sufixo="g" valor={proteina} aoMudar={setProteina} erro={campos.proteina} />
              </View>
              <View style={estilos.campoMacro}>
                <CampoNumerico rotulo="Carboidrato" sufixo="g" valor={carboidrato} aoMudar={setCarboidrato} erro={campos.carboidrato} />
              </View>
              <View style={estilos.campoMacro}>
                <CampoNumerico rotulo="Gordura" sufixo="g" valor={gordura} aoMudar={setGordura} erro={campos.gordura} />
              </View>
            </View>
          </View>
        </Cartao>

        <Cartao titulo="Lista de compras" descricao="O nome sugere os fatores. Escolha um perfil ou digite o número." nivel={3}
          acoes={inicial ? <Botao rotulo="Sugerir pelo nome" tipo="secundario" aoTocar={sugerirPeloNome} /> : null}>
          {/* Perfil e número com o mesmo código (FC, FCc) e na mesma ordem: tocar no perfil preenche o campo logo abaixo. */}
          <Escolha<string> rotulo="Descarte e limpeza antes do preparo (FC)" valor={perfilFc}
            opcoes={[...PERFIS_FC.map((p) => ({ valor: p.codigo as string, rotulo: p.rotulo })), { valor: 'PERSONALIZADO', rotulo: 'Personalizado' }]}
            aoMudar={(c) => { const perfil = PERFIS_FC.find((p) => p.codigo === c); if (perfil) escolherFc(perfil.valor); else travarFatores(); }} />
          <Escolha<string> rotulo="Estado na dieta e cocção (FCc)" valor={perfilFcc}
            opcoes={[...PERFIS_FCC.map((p) => ({ valor: p.codigo as string, rotulo: p.rotulo })), { valor: 'PERSONALIZADO', rotulo: 'Personalizado' }]}
            aoMudar={(c) => { const perfil = PERFIS_FCC.find((p) => p.codigo === c); if (perfil) escolherFcc(perfil.valor); else travarFatores(); }} />
          <View style={estilos.linhaDeCampos}>
            <View style={estilos.campoLargo}>
              <CampoNumerico rotulo="Fator de correção (FC)" valor={fcMostrado} aoMudar={(v) => { setFc(v); setFcc(fccMostrado); setTocouFatores(true); }} ajuda={AJUDA_FC} erro={campos.fatorCorrecao ?? erroFc} />
            </View>
            <View style={estilos.campoLargo}>
              <CampoNumerico rotulo="Fator de cocção (FCc)" valor={fccMostrado} aoMudar={(v) => { setFc(fcMostrado); setFcc(v); setTocouFatores(true); }} ajuda={AJUDA_FCC} erro={campos.fatorCoccao ?? erroFcc} />
            </View>
          </View>
          {fcMostrado !== null && fccMostrado !== null && fccMostrado !== 0 ? (
            <View style={[estilos.exemplo, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
              <View style={estilos.iconeDoExemplo} aria-hidden><ShoppingCart size={18} color={cores.textoSuave} /></View>
              <Texto numerico style={estilos.textoDoExemplo}>{previaDeConversao(fcMostrado, fccMostrado)}</Texto>
            </View>
          ) : null}
        </Cartao>

        {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}

        {inicial && aoTirar ? (
          <Cartao>
            <View style={estilos.tirar}>
              <Texto variante="suave" style={estilos.textoDoTirar}>As dietas que já usam este alimento continuam com os valores gravados.</Texto>
              <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} />
            </View>
          </Cartao>
        ) : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre os cartões da folha (seção 4.3 do design); dentro de cada cartão, os 16 px do próprio `Cartao`.
  partes: { gap: espaco(3) },
  linhaDeCampos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(2) },
  campoNome: { flexGrow: 2, flexBasis: 240 },
  campoCurto: { flexGrow: 1, flexBasis: 120 },
  // 180 px: FC e FCc lado a lado na folha do PC (600) e um embaixo do outro no celular.
  campoLargo: { flexGrow: 1, flexBasis: 180 },
  campoMacro: { flexGrow: 1, flexBasis: 100 },
  // Sugestões coladas no campo Grupo (8 px), não soltas no cartão.
  grupo: { gap: espaco(1) },
  // Nível de dentro do cartão: divisor, não outro contorno (seção 5.1).
  macros: { gap: espaco(1.5), borderTopWidth: 1, paddingTop: espaco(2) },
  exemplo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
  iconeDoExemplo: { flexShrink: 0, paddingTop: 2 },
  textoDoExemplo: { flexShrink: 1 },
  // As três unidades numa linha só, sem o "un" cair embaixo.
  campoUnidade: { flexShrink: 0 },
  tirar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  textoDoTirar: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
});
