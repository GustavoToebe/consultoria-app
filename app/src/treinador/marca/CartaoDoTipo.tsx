import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { Configuracao, ModalidadeComPadrao, PadraoPorModalidade } from '../../api/tipos';
import type { TipoEmEdicao } from '../../dominio/edicaoMetodologia';
import { cargaDoModo } from '../../dominio/editorTreino';
import { copiarCarga, copiarEsforco, PAPEIS, rotuloDoPapel } from '../../dominio/metodologia';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { CamposDoEsforco, EscolhaDeCarga, ErroDoCampo, FaixaDeCarga } from '../treino/CamposDaPrescricao';
import { subProblemas } from '../treino/opcoesDoEditor';

const MODALIDADES: { valor: ModalidadeComPadrao; rotulo: string }[] = [
  { valor: 'LIVRE', rotulo: 'Peso livre' },
  { valor: 'MAQUINA', rotulo: 'Máquina' },
];
const USO = [{ valor: 'PADRAO', rotulo: 'Usar o padrão' }, { valor: 'PROPRIA', rotulo: 'Personalizar' }];
const LIMITE_EXPLICACAO = 500;

interface Props {
  tipo: TipoEmEdicao;
  config: Configuracao;
  /** Problemas deste tipo, com a chave relativa a ele (`nome`, `cargaPadrao.percentualMin`...). */
  problemas: Problemas;
  posicao: number;
  total: number;
  aberto: boolean;
  aoAlternar: () => void;
  aoMover: (delta: -1 | 1) => void;
  aoRemover: () => void;
  aoMudar: (parte: Partial<TipoEmEdicao>) => void;
}

/** Um tipo de série: identificação, prescrição padrão (repetições, carga, esforço, variação por modalidade, regra) e explicação. */
export function CartaoDoTipo({ tipo: t, config, problemas: p, posicao, total, aberto, aoAlternar, aoMover, aoRemover, aoMudar }: Props) {
  const { cores } = useTema();
  const nome = t.nome.trim() || 'Novo tipo';
  const quantos = Object.keys(p).length;
  const mudarPadraoDaModalidade = (m: ModalidadeComPadrao, parte: Partial<PadraoPorModalidade>) => {
    const atual = t.porModalidade?.[m] ?? { carga: null, esforco: null };
    aoMudar({ porModalidade: { ...t.porModalidade, [m]: { ...atual, ...parte } } });
  };
  const aoUsoDaModalidade = (m: ModalidadeComPadrao, uso: string) => {
    if (uso === 'PROPRIA') {
      aoMudar({ porModalidade: { ...t.porModalidade, [m]: { carga: copiarCarga(t.cargaPadrao), esforco: copiarEsforco(t.esforcoPadrao) } } });
    } else {
      const variacoes = { ...t.porModalidade };
      delete variacoes[m];
      aoMudar({ porModalidade: Object.keys(variacoes).length ? variacoes : null });
    }
  };
  return <Cartao cabecalho={<CabecalhoDeGrupo titulo={nome} resumo={rotuloDoPapel(t.papel)} selo={quantos > 0 ? { texto: `${quantos} ${quantos === 1 ? 'problema' : 'problemas'}`, tipo: 'perigo' } : undefined}
    aberto={aberto} aoAlternar={aoAlternar} acoes={<>
      <IconeBotao Icone={ArrowUp} rotulo={`Subir o tipo ${nome}`} desabilitado={posicao === 0} aoTocar={() => aoMover(-1)} />
      <IconeBotao Icone={ArrowDown} rotulo={`Descer o tipo ${nome}`} desabilitado={posicao === total - 1} aoTocar={() => aoMover(1)} />
      <IconeBotao Icone={Trash2} rotulo={`Remover o tipo ${nome}`} cor={cores.perigo} aoTocar={aoRemover} />
    </>} />}>
    {aberto ? <>
      <View style={estilos.secao}>
        <Texto variante="secao">Identificação</Texto>
        <Campo rotulo="Nome do tipo" valor={t.nome} aoMudar={(n) => aoMudar({ nome: n })} maxLength={30} erro={p.nome} ajuda="É o que o treinador e o aluno leem. Pode mudar quando quiser." />
        <CampoLeitura rotulo="Código" valor={t.codigo} />
        <Texto variante="pequeno">O código é gerado quando o tipo é criado e não muda mais: é ele que as séries gravam.</Texto>
        <ErroDoCampo mensagem={p.codigo} />
        <Escolha rotulo="Papel" valor={t.papel} opcoes={PAPEIS} aoMudar={(papel) => aoMudar({ papel, regraPercentuais: papel === 'PREPARACAO' ? t.regraPercentuais : null })} />
        <Texto variante="pequeno">O papel diz para que a série serve. O primeiro tipo de trabalho dá nome ao percentual da carga.</Texto>
        <ErroDoCampo mensagem={p.papel} />
      </View>

      <View style={estilos.secao}>
        <Texto variante="secao">Prescrição padrão</Texto>
        <Texto variante="pequeno">Preenche as séries novas desse tipo. Mudar aqui não altera séries já gravadas.</Texto>
        <View style={estilos.linha}>
          <View style={estilos.campo}><CampoNumerico rotulo="Reps mín." inteiro valor={t.repeticoes?.min ?? null} aoMudar={(min) => aoMudar({ repeticoes: { min, max: t.repeticoes?.max ?? null } })} /></View>
          <View style={estilos.campo}><CampoNumerico rotulo="Reps máx." inteiro valor={t.repeticoes?.max ?? null} aoMudar={(max) => aoMudar({ repeticoes: { min: t.repeticoes?.min ?? null, max } })} /></View>
        </View>
        <ErroDoCampo mensagem={p.repeticoes} />

        <Texto variante="rotulo">Carga padrão</Texto>
        <PadraoDeCarga carga={t.cargaPadrao} config={config} papel={t.papel} aoMudar={(cargaPadrao) => aoMudar({ cargaPadrao })} erros={subProblemas(p, 'cargaPadrao')} />

        <Texto variante="rotulo">Esforço padrão</Texto>
        <CamposDoEsforco esforco={t.esforcoPadrao} aoMudar={(esforcoPadrao) => aoMudar({ esforcoPadrao })} erros={subProblemas(p, 'esforcoPadrao')} rotulo="Esforço" />
      </View>

      <View style={estilos.secao}>
        <Texto variante="secao">Variação por modalidade</Texto>
        <Texto variante="pequeno">Só peso livre e máquina têm variação; as outras modalidades usam o padrão. A variação troca carga e esforço juntos.</Texto>
        {MODALIDADES.map((m) => {
          const propria = t.porModalidade?.[m.valor];
          const erros = subProblemas(p, `porModalidade.${m.valor}`);
          return <View key={m.valor} style={estilos.secao}>
            <Escolha rotulo={m.rotulo} valor={propria ? 'PROPRIA' : 'PADRAO'} opcoes={USO} aoMudar={(uso) => aoUsoDaModalidade(m.valor, uso)} />
            {propria ? <View style={estilos.variacao}>
              <PadraoDeCarga carga={propria.carga} config={config} papel={t.papel} aoMudar={(carga) => mudarPadraoDaModalidade(m.valor, { carga })} erros={subProblemas(erros, 'carga')} rotulo={`Carga em ${m.rotulo.toLowerCase()}`} />
              <CamposDoEsforco esforco={propria.esforco} aoMudar={(esforco) => mudarPadraoDaModalidade(m.valor, { esforco })} erros={subProblemas(erros, 'esforco')} rotulo={`Esforço em ${m.rotulo.toLowerCase()}`} />
            </View> : null}
          </View>;
        })}
        <ErroDoCampo mensagem={p.porModalidade} />
      </View>

      {t.papel === 'PREPARACAO' ? <RegraDePercentuais tipo={t} erros={p} aoMudar={(regraPercentuais) => aoMudar({ regraPercentuais })} /> : null}

      <View style={estilos.secao}>
        <Texto variante="secao">Explicação</Texto>
        <Campo rotulo="Explicação para o aluno" valor={t.explicacao ?? ''} aoMudar={(explicacao) => aoMudar({ explicacao })} linhas={3} maxLength={LIMITE_EXPLICACAO}
          ajuda={`O aluno lê ao tocar no tipo. ${(t.explicacao ?? '').length}/${LIMITE_EXPLICACAO}.`} erro={p.explicacao} />
      </View>
    </> : null}
  </Cartao>;
}

/** Carga padrão: a forma e, nas formas com percentual, a faixa. A série de referência do "abaixo da referência" nasce na série. */
function PadraoDeCarga({ carga, config, papel, aoMudar, erros, rotulo = 'Forma de carga' }: {
  carga: TipoEmEdicao['cargaPadrao']; config: Configuracao; papel: TipoEmEdicao['papel']; aoMudar: (c: TipoEmEdicao['cargaPadrao']) => void; erros: Problemas; rotulo?: string;
}) {
  return <View style={estilos.secao}>
    <EscolhaDeCarga carga={carga} config={config} papel={papel} rotulo={rotulo} erro={erros.modo} aoMudarModo={(modo) => aoMudar(cargaDoModo(modo))} />
    <FaixaDeCarga carga={carga} config={config} erros={erros} aoMudar={(percentualMin, percentualMax) => aoMudar({ ...(carga ?? { modo: 'NENHUMA' }), percentualMin, percentualMax })} />
    {carga?.modo === 'ABAIXO_DA_REFERENCIA' ? <Texto variante="pequeno">A série de referência é escolhida em cada série; ela nasce apontando a última série de trabalho antes.</Texto> : null}
  </View>;
}

function RegraDePercentuais({ tipo: t, erros, aoMudar }: { tipo: TipoEmEdicao; erros: Problemas; aoMudar: (r: TipoEmEdicao['regraPercentuais']) => void }) {
  const regra = t.regraPercentuais ?? {};
  const chaves = Object.keys(regra).sort((a, b) => Number(a) - Number(b));
  const proxima = Array.from({ length: 10 }, (_, i) => i + 1).find((n) => !chaves.includes(String(n)));
  return <View style={estilos.secao}>
    <Texto variante="secao">Regra de percentuais por quantidade</Texto>
    <Texto variante="pequeno">Cada série recebe a sua faixa da carga de trabalho. Máximo vazio = percentual único. Vale quando a série está em percentual.</Texto>
    <ErroDoCampo mensagem={erros.regraPercentuais} />
    {chaves.map((chave) => <View key={chave} style={estilos.secao}>
      <Texto variante="rotulo">{chave} {chave === '1' ? 'série' : 'séries'}</Texto>
      <View style={estilos.linha}>{regra[chave].map((f, i) => <View key={i} style={estilos.faixa}>
        <CampoNumerico rotulo={`${i + 1}ª mín.`} sufixo="%" valor={f.min} aoMudar={(min) => aoMudar({ ...regra, [chave]: regra[chave].map((x, j) => (i === j ? { ...x, min } : x)) })} />
        <CampoNumerico rotulo={`${i + 1}ª máx.`} sufixo="%" valor={f.max} aoMudar={(max) => aoMudar({ ...regra, [chave]: regra[chave].map((x, j) => (i === j ? { ...x, max } : x)) })} />
      </View>)}</View>
      <ErroDoCampo mensagem={erros[`regraPercentuais.${chave}`]} />
      <Botao rotulo={`Remover a regra de ${chave} ${chave === '1' ? 'série' : 'séries'}`} tipo="fantasma" Icone={Trash2} aoTocar={() => { const nova = { ...regra }; delete nova[chave]; aoMudar(Object.keys(nova).length ? nova : null); }} />
    </View>)}
    {proxima ? <Botao rotulo={`Regra para ${proxima} ${proxima === 1 ? 'série' : 'séries'}`} tipo="secundario" Icone={Plus}
      aoTocar={() => aoMudar({ ...regra, [String(proxima)]: Array.from({ length: proxima }, () => ({ min: null, max: null })) })} /> : null}
  </View>;
}

const estilos = StyleSheet.create({
  secao: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  faixa: { width: 130, gap: espaco(1) },
  variacao: { gap: espaco(1), paddingLeft: espaco(1.5) },
});
