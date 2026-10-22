import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Configuracao, Intensidade, TecnicaDaMetodologia } from '../../api/tipos';
import { mover, tecnicaVazia } from '../../dominio/editorTreino';
import { metodologiaParaSalvar, problemaDaMetodologia, type MetodologiaEmEdicao, type TipoEmEdicao } from '../../dominio/edicaoMetodologia';
import { PAPEIS, rotuloDoPapel } from '../../dominio/metodologia';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { CamposDaIntensidade, CamposDaTecnica } from '../treino/CamposDaPrescricao';

export { metodologiaParaSalvar, problemaDaMetodologia, type MetodologiaEmEdicao };
const ARREDONDAMENTOS = [0.25, 0.5, 1, 2.5].map((valor) => ({ valor, rotulo: `${String(valor).replace('.', ',')} kg` }));

/** Um cartão por tipo e técnica. Tudo é salvo pela barra do modelo. */
export function CartaoMetodologia({ configuracao: c, aoMudar }: { configuracao: MetodologiaEmEdicao; aoMudar: (c: MetodologiaEmEdicao) => void }) {
  const { cores } = useTema();
  const [abertos, setAbertos] = useState<ReadonlySet<number>>(new Set());
  const alternar = (i: number) => setAbertos((a) => { const novo = new Set(a); if (novo.has(i)) novo.delete(i); else novo.add(i); return novo; });
  const mudarTipo = (i: number, parte: Partial<TipoEmEdicao>) => aoMudar({ ...c, tipos: c.tipos.map((t, n) => n === i ? { ...t, ...parte } : t) });
  // Os campos de intensidade não dependem das faixas ainda incompletas em edição.
  const config = c as Configuracao;
  const adicionar = () => {
    const i = c.tipos.length;
    aoMudar({ ...c, tipos: [...c.tipos, { nome: '', papel: 'OUTRO', repeticoes: null, intensidadePadrao: null, intensidadePorModalidade: null, regraPercentuais: null, explicacao: null }] });
    setAbertos((a) => new Set(a).add(i));
  };
  return <View style={estilos.lista}>
    <Texto variante="secao">Tipos de série</Texto>
    <Texto variante="pequeno">O papel diz para que a série serve. O primeiro tipo de trabalho dá nome ao percentual da carga. Os padrões preenchem séries novas; mudar aqui não altera séries já gravadas.</Texto>
    {c.tipos.map((t, i) => <Cartao key={i} cabecalho={<CabecalhoDeGrupo titulo={t.nome || 'Novo tipo'} resumo={rotuloDoPapel(t.papel)} aberto={abertos.has(i)} aoAlternar={() => alternar(i)} acoesJuntas acoes={<>
      <IconeBotao Icone={ArrowUp} rotulo={`Subir tipo ${t.nome || i + 1}`} desabilitado={i === 0} aoTocar={() => { aoMudar({ ...c, tipos: mover(c.tipos, i, -1) }); setAbertos(new Set()); }} />
      <IconeBotao Icone={ArrowDown} rotulo={`Descer tipo ${t.nome || i + 1}`} desabilitado={i === c.tipos.length - 1} aoTocar={() => { aoMudar({ ...c, tipos: mover(c.tipos, i, 1) }); setAbertos(new Set()); }} />
      <IconeBotao Icone={Trash2} rotulo={`Remover tipo ${t.nome || i + 1}`} cor={cores.perigo} aoTocar={() => { aoMudar({ ...c, tipos: c.tipos.filter((_, n) => n !== i) }); setAbertos(new Set()); }} />
    </>} />}>
      {abertos.has(i) ? <>
        <Campo rotulo="Nome do tipo" valor={t.nome} aoMudar={(nome) => mudarTipo(i, { nome })} maxLength={30} />
        <Escolha rotulo="Papel" valor={t.papel} opcoes={PAPEIS} aoMudar={(papel) => mudarTipo(i, { papel, regraPercentuais: papel === 'PREPARACAO' ? t.regraPercentuais : null })} />
        <View style={estilos.linha}>
          <CampoNumerico rotulo="Reps mín." inteiro valor={t.repeticoes?.min ?? null} aoMudar={(min) => mudarTipo(i, { repeticoes: { min, max: t.repeticoes?.max ?? null } })} />
          <CampoNumerico rotulo="Reps máx." inteiro valor={t.repeticoes?.max ?? null} aoMudar={(max) => mudarTipo(i, { repeticoes: { min: t.repeticoes?.min ?? null, max } })} />
        </View>
        <CamposDaIntensidade rotulo="Intensidade padrão" valor={t.intensidadePadrao} config={config} papel={t.papel} aoMudar={(intensidadePadrao) => mudarTipo(i, { intensidadePadrao })} />
        {(['LIVRE', 'MAQUINA'] as const).map((m) => {
          const personalizado = t.intensidadePorModalidade?.[m];
          const definir = (intensidade: Intensidade | null) => mudarTipo(i, { intensidadePorModalidade: { ...t.intensidadePorModalidade, [m]: intensidade ?? { modo: 'NENHUMA' } } });
          return <View key={m} style={estilos.lista}>
            <Escolha rotulo={m === 'LIVRE' ? 'Peso livre' : 'Máquina'} valor={personalizado ? 'PROPRIA' : 'PADRAO'} opcoes={[{ valor: 'PADRAO', rotulo: 'Usar padrão' }, { valor: 'PROPRIA', rotulo: 'Personalizar' }]} aoMudar={(v) => {
              if (v === 'PROPRIA') definir(t.intensidadePadrao ? { ...t.intensidadePadrao } : null);
              else { const variacoes = { ...t.intensidadePorModalidade }; delete variacoes[m]; mudarTipo(i, { intensidadePorModalidade: Object.keys(variacoes).length ? variacoes : null }); }
            }} />
            {personalizado ? <CamposDaIntensidade valor={personalizado} config={config} papel={t.papel} aoMudar={definir} /> : null}
          </View>;
        })}
        {t.papel === 'PREPARACAO' ? <Regras tipo={t} aoMudar={(regraPercentuais) => mudarTipo(i, { regraPercentuais })} /> : null}
        <Campo rotulo="Explicação para o aluno" valor={t.explicacao ?? ''} aoMudar={(explicacao) => mudarTipo(i, { explicacao })} linhas={3} maxLength={500} />
      </> : null}
    </Cartao>)}
    <Botao rotulo="Adicionar tipo" tipo="secundario" Icone={Plus} aoTocar={adicionar} desabilitado={c.tipos.length >= 20} motivo={c.tipos.length >= 20 ? 'O máximo é 20 tipos.' : undefined} />
    <Texto variante="secao">Técnicas</Texto>
    {c.tecnicas.map((t, i) => <CartaoTecnica key={t.tipo} tecnica={t} aoMudar={(nova) => aoMudar({ ...c, tecnicas: c.tecnicas.map((x, n) => n === i ? nova : x) })} />)}
    <Cartao titulo="Geral">
      <Escolha rotulo="Arredondar a sugestão de carga do aluno para" opcoes={ARREDONDAMENTOS} valor={c.arredondamentoKg} aoMudar={(arredondamentoKg) => aoMudar({ ...c, arredondamentoKg })} />
      <Campo rotulo="Instruções do treino (vão no fim do PDF)" valor={c.instrucoesTreino ?? ''} aoMudar={(instrucoesTreino) => aoMudar({ ...c, instrucoesTreino })} linhas={6} maxLength={20000} />
      <Campo rotulo="Rodapé do PDF (opcional)" valor={c.rodapePdf ?? ''} aoMudar={(rodapePdf) => aoMudar({ ...c, rodapePdf })} maxLength={500} />
    </Cartao>
  </View>;
}

function CartaoTecnica({ tecnica: t, aoMudar }: { tecnica: TecnicaDaMetodologia; aoMudar: (t: TecnicaDaMetodologia) => void }) {
  const [aberto, setAberto] = useState(false);
  return <Cartao cabecalho={<CabecalhoDeGrupo titulo={t.nome} resumo="Técnica" aberto={aberto} aoAlternar={() => setAberto((a) => !a)} />}>
    {aberto ? <>
      <Campo rotulo="Nome exibido da técnica" valor={t.nome} aoMudar={(nome) => aoMudar({ ...t, nome })} maxLength={30} />
      <Campo rotulo="Explicação para o aluno" valor={t.explicacao ?? ''} aoMudar={(explicacao) => aoMudar({ ...t, explicacao })} linhas={3} maxLength={500} />
      <Texto variante="pequeno">Padrões opcionais: campos vazios serão preenchidos em cada série.</Texto>
      <CamposDaTecnica tecnica={t.padrao ?? tecnicaVazia(t.tipo)} parcial comPausas aoMudar={(padrao) => aoMudar({ ...t, padrao })} />
    </> : null}
  </Cartao>;
}

function Regras({ tipo: t, aoMudar }: { tipo: TipoEmEdicao; aoMudar: (r: TipoEmEdicao['regraPercentuais']) => void }) {
  const regra = t.regraPercentuais ?? {};
  const chaves = Object.keys(regra).sort((a, b) => Number(a) - Number(b));
  const proxima = Array.from({ length: 10 }, (_, i) => i + 1).find((n) => !chaves.includes(String(n)));
  return <>
    <Texto variante="secao">Regra de percentuais por quantidade</Texto>
    <Texto variante="pequeno">Cada série recebe sua faixa da carga de trabalho. Máximo vazio = percentual único.</Texto>
    {chaves.map((chave) => <View key={chave} style={estilos.lista}>
      <Texto variante="rotulo">{chave} {chave === '1' ? 'série' : 'séries'}</Texto>
      <View style={estilos.linha}>{regra[chave].map((f, i) => <View key={i} style={estilos.faixa}>
        <CampoNumerico rotulo={`${i + 1}ª mín.`} inteiro sufixo="%" valor={f.min} aoMudar={(min) => aoMudar({ ...regra, [chave]: regra[chave].map((x, j) => i === j ? { ...x, min } : x) })} />
        <CampoNumerico rotulo={`${i + 1}ª máx.`} inteiro sufixo="%" valor={f.max} aoMudar={(max) => aoMudar({ ...regra, [chave]: regra[chave].map((x, j) => i === j ? { ...x, max } : x) })} />
      </View>)}</View>
      <Botao rotulo={`Remover regra de ${chave} séries`} tipo="fantasma" Icone={Trash2} aoTocar={() => { const nova = { ...regra }; delete nova[chave]; aoMudar(nova); }} />
    </View>)}
    {proxima ? <Botao rotulo={`Regra para ${proxima} séries`} tipo="secundario" Icone={Plus} aoTocar={() => aoMudar({ ...regra, [String(proxima)]: Array.from({ length: proxima }, () => ({ min: null, max: null })) })} /> : null}
  </>;
}
const estilos = StyleSheet.create({ lista: { gap: espaco(1.5) }, linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) }, faixa: { width: 125, gap: espaco(1) } });
