import { Droplet, Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  diasDaAgua,
  maisUmCopo,
  menosUmCopo,
  metaEmMl,
  textoDaAguaDoDia,
  textoDosCopos,
} from '../dominio/aguaDoDia';
import { hojeDoCiclo } from '../dominio/cicloMenstrual';
import { dataCurta } from '../dominio/formatos';
import { useAluno } from '../offline/AlunoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Texto } from '../ui/Texto';
import { DatasDaMobilidade } from './DatasDaMobilidade';

/**
 * Água do dia (docs/planos/agua-do-aluno.md): o aluno marca copos de 250 ml (−/+) e vê "1,5 L de 3,0 L" contra a "Água
 * por dia" da dieta. Grava no aparelho na hora e vai na mesma fila de envio das séries, inclusive sem internet. Só aparece
 * com meta na dieta (quem chama confere). Hoje e os 6 dias anteriores, no "hoje" de Brasília (o do servidor). A gota, a barra e o contorno e ícone dos −/+ usam
 * a cor da água (`identificacao.AGUA`, 27/11, a mesma do gráfico da ficha): categoria, sem cor de alerta nem comemoração, o
 * app não julga quanto o aluno tomou. Em todas as larguras o cartão é
 * uma pilha só (título, números, barra e botões embaixo, que quebram se não couberem). `compacto` (o Início, onde o
 * "Ver meu treino" precisa caber na primeira tela do celular) mostra só hoje, sem a explicação nem os outros dias; a aba
 * Dieta tem o cartão inteiro.
 */
export function CartaoAguaDoDia({ metaLitros, compacto = false, botoesCheios = false }: {
  metaLitros: number;
  compacto?: boolean;
  /** Web larga do Início (27/11): "−1 copo" e "+1 copo" dividem a largura do cartão em vez de ficarem do tamanho do rótulo. */
  botoesCheios?: boolean;
}) {
  const { identificacao } = useTema();
  const agua = identificacao.AGUA.cor;
  const { aguaPorDia, marcarAgua } = useAluno();
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const hoje = hojeDoCiclo();
  const dias = diasDaAgua(hoje);
  const dia = !compacto && diaEscolhido && dias.includes(diaEscolhido) ? diaEscolhido : hoje;
  const registrado = aguaPorDia.get(dia);
  const ml = registrado ?? 0;
  const meta = metaEmMl(metaLitros) ?? 0;
  const ehHoje = dia === hoje;

  const mudar = (novo: number) => {
    if (novo === ml && registrado !== undefined) return;
    setGravando(true);
    void marcarAgua({ data: dia, aguaMl: novo }).finally(() => setGravando(false));
  };

  const semCopo = ml <= 0 ? 'Nenhum copo marcado neste dia.' : undefined;
  const podeTirar = !(ml <= 0 || gravando);
  // Botões cheios: o motivo do "−" desabilitado vai numa linha embaixo dos dois (dentro do botão ele encolhia só o "−").
  const botoes = (
    <View style={botoesCheios ? estilos.blocoCheio : undefined}>
      <View style={[estilos.botoes, botoesCheios && estilos.botoesCheios]}>
        <Botao
          rotulo="1 copo"
          // Com o motivo fora do botão, ele vai no nome acessível (o `Botao` só o põe no hint quando o desenha).
          rotuloAcessivel={botoesCheios && semCopo ? `Tirar um copo. ${semCopo}` : 'Tirar um copo'}
          tipo="secundario"
          Icone={podeTirar ? MenosNaCorDaAgua : Minus}
          desabilitado={!podeTirar}
          motivo={botoesCheios ? undefined : semCopo}
          aoTocar={() => mudar(menosUmCopo(ml))}
          style={[botoesCheios && estilos.metade, podeTirar && { borderColor: agua }]}
        />
        <Botao rotulo="1 copo" rotuloAcessivel="Mais um copo" tipo="secundario" Icone={gravando ? Plus : MaisNaCorDaAgua} desabilitado={gravando} aoTocar={() => mudar(maisUmCopo(ml))}
          style={[botoesCheios && estilos.metade, !gravando && { borderColor: agua }]} />
      </View>
      {botoesCheios && semCopo ? <Texto variante="pequeno">{semCopo}</Texto> : null}
    </View>
  );

  return (
    <Cartao
      titulo={ehHoje ? 'Água de hoje' : `Água em ${dataCurta(dia)}`}
      descricao={compacto ? undefined : 'Toque em + a cada copo de 250 ml que tomar.'}>
      <View style={estilos.topo}>
        <Droplet size={22} color={agua} aria-hidden />
        <View style={estilos.numeros} accessibilityLiveRegion="polite">
          <Texto numerico style={estilos.litros}>{textoDaAguaDoDia(ml, metaLitros)}</Texto>
          <Texto variante="suave" numerico>{registrado === undefined ? 'Nada marcado neste dia' : textoDosCopos(ml)}</Texto>
        </View>
      </View>
      <BarraProgresso feitas={ml} total={meta} cor={agua} />
      {botoes}
      {compacto ? null : (
        <DatasDaMobilidade
          datas={dias}
          hoje={hoje}
          atual={dia}
          comAlgoFeito={(d) => aguaPorDia.has(d)}
          aoAbrir={setDiaEscolhido}
          assunto="Água"
          textoDoMarcado="com registro"
        />
      )}
    </Cartao>
  );
}

interface PropsDoIcone { size?: number; strokeWidth?: number }

/**
 * Ícone do −/+ na cor da água (27/11): o `Botao` pinta o ícone com a cor do rótulo, então a cor vem por aqui. Desabilitado
 * fica o ícone comum (o cinza do botão). Sobre o poço do secundário (`superficie2`, também ao passar o mouse) a água passa
 * 4,5:1 em todas as paletas (`tokens.test.ts`, "cor da água").
 */
function IconeNaCorDaAgua({ Icone, size, strokeWidth }: PropsDoIcone & { Icone: LucideIcon }) {
  const { identificacao } = useTema();
  return <Icone size={size} strokeWidth={strokeWidth} color={identificacao.AGUA.cor} />;
}
const MenosNaCorDaAgua = ((p: PropsDoIcone) => <IconeNaCorDaAgua Icone={Minus} {...p} />) as unknown as LucideIcon;
const MaisNaCorDaAgua = ((p: PropsDoIcone) => <IconeNaCorDaAgua Icone={Plus} {...p} />) as unknown as LucideIcon;

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  numeros: { flex: 1, gap: espaco(0.25) },
  litros: { fontFamily: fontes.semi, fontSize: 20 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  blocoCheio: { gap: espaco(0.5) },
  botoesCheios: { flexWrap: 'nowrap' },
  metade: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
});
