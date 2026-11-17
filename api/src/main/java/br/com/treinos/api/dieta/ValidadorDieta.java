package br.com.treinos.api.dieta;

import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.dieta.ConteudoDieta.Variacao;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.web.CupomDeSuplemento;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.LinksExternos;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/**
 * Regras de publicação da dieta. Confere só a forma do plano; nunca avalia se a dieta é adequada.
 * O total do dia considera a primeira opção de cada refeição (opção A), nunca a soma das alternativas.
 */
@Component
public class ValidadorDieta {

    private static final BigDecimal MAXIMO = new BigDecimal("99999");
    private static final BigDecimal AGUA_MINIMA = new BigDecimal("0.1");
    private static final BigDecimal AGUA_MAXIMA = new BigDecimal("20");
    private static final int ROTULO_MAXIMO = 40;
    /** Índice = número do dia (1 = segunda ... 7 = domingo, o mesmo do treino); o 0 não existe. */
    private static final List<String> NOMES_DOS_DIAS = List.of("", "segunda", "terça", "quarta", "quinta", "sexta",
            "sábado", "domingo");

    public ResultadoValidacao validar(ConteudoDieta conteudo, LocalDate inicio, LocalDate fim) {
        return validar(conteudo, inicio, fim, FaixaDeData.hoje());
    }

    public ResultadoValidacao validar(ConteudoDieta conteudo, LocalDate inicio, LocalDate fim, LocalDate hoje) {
        ResultadoValidacao.Coletor c = new ResultadoValidacao.Coletor();
        Set<UUID> uids = new HashSet<>();
        List<Refeicao> refeicoes = conteudo.refeicoesOuVazio();
        if (conteudo.variacoes().isEmpty()) {
            if (refeicoes.isEmpty()) {
                c.erro("refeicoes", "A dieta não tem nenhuma refeição.");
            }
            BigDecimal kcalDoDia = refeicoes(c, uids, refeicoes, "refeicoes");
            if (!refeicoes.isEmpty() && kcalDoDia.signum() == 0) {
                c.aviso("refeicoes", "O total do dia (opção A de cada refeição) está com 0 kcal.");
            }
        } else {
            variacoes(c, uids, refeicoes, conteudo.variacoes());
        }
        for (int s = 0; s < conteudo.suplementacaoOuVazio().size(); s++) {
            ConteudoDieta.Suplemento sup = conteudo.suplementacaoOuVazio().get(s);
            uid(c, uids, sup.uid(), "suplementacao[" + s + "]");
            if (sup.link() != null && !sup.link().isBlank() && !LinksExternos.valido(sup.link())) {
                c.erro("suplementacao[" + s + "].link", LinksExternos.MENSAGEM);
            }
            if (!CupomDeSuplemento.valido(sup.cupom())) {
                c.erro("suplementacao[" + s + "].cupom", CupomDeSuplemento.MENSAGEM);
            }
        }
        List<ConteudoDieta.Ergogenico> ergogenicos = conteudo.ergogenicos() == null ? List.of() : conteudo.ergogenicos();
        for (int e = 0; e < ergogenicos.size(); e++) {
            // Linha toda em branco ("Adicionar linha" sem preencher) não trava a publicação: o PDF e o app a ignoram, e
            // quem publica sem ERGOGENICO_LER nem veria o que corrigir.
            if (emBranco(ergogenicos.get(e))) {
                continue;
            }
            String ce = "ergogenicos[" + e + "]";
            uid(c, uids, ergogenicos.get(e).uid(), ce);
            if (ergogenicos.get(e).nome() == null || ergogenicos.get(e).nome().isBlank()) {
                c.erro(ce + ".nome", "Item de medicação sem nome.");
            }
        }
        BigDecimal agua = conteudo.aguaLitros();
        if (agua != null && (agua.compareTo(AGUA_MINIMA) < 0 || agua.compareTo(AGUA_MAXIMA) > 0
                || agua.stripTrailingZeros().scale() > 1)) {
            c.erro("aguaLitros", "Água por dia entre 0,1 e 20 litros, com no máximo uma casa decimal.");
        }
        dataDeInicio(c, conteudo.dataInicio(), hoje);
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            c.aviso("fim", "O fim do período é antes do início.");
        }
        return c.resultado();
    }

    /**
     * Dieta por dia da semana: a raiz fica sem refeição, cada variação tem rótulo, dia(s) e refeição(ões), e os sete dias
     * ficam cobertos sem repetir. As mensagens são fixas: nunca levam o rótulo nem o conteúdo (só o nome do dia).
     */
    private static void variacoes(ResultadoValidacao.Coletor c, Set<UUID> uids, List<Refeicao> raiz,
                                  List<Variacao> variacoes) {
        if (!raiz.isEmpty()) {
            c.erro("refeicoes", "Com variações, as refeições ficam dentro de cada variação.");
        }
        Set<Integer> cobertos = new HashSet<>();
        for (int i = 0; i < variacoes.size(); i++) {
            Variacao v = variacoes.get(i);
            String cv = "variacoes[" + i + "]";
            uid(c, uids, v.uid(), cv);
            if (v.rotulo() == null || v.rotulo().isBlank()) {
                c.erro(cv + ".rotulo", "Variação sem nome.");
            } else if (v.rotulo().length() > ROTULO_MAXIMO) {
                c.erro(cv + ".rotulo", "Nome da variação com até " + ROTULO_MAXIMO + " caracteres.");
            }
            dias(c, v.diasOuVazio(), cobertos, cv + ".dias");
            List<Refeicao> refeicoes = v.refeicoesOuVazio();
            if (refeicoes.isEmpty()) {
                c.erro(cv + ".refeicoes", "Variação sem refeição.");
            }
            BigDecimal kcalDoDia = refeicoes(c, uids, refeicoes, cv + ".refeicoes");
            if (!refeicoes.isEmpty() && kcalDoDia.signum() == 0) {
                c.aviso(cv + ".refeicoes", "O total do dia (opção A de cada refeição) da variação está com 0 kcal.");
            }
        }
        List<String> sobram = IntStream.rangeClosed(1, 7).filter(d -> !cobertos.contains(d))
                .mapToObj(NOMES_DOS_DIAS::get).toList();
        if (!sobram.isEmpty()) {
            c.erro("variacoes", "Dia sem variação: " + String.join(", ", sobram) + ".");
        }
    }

    /** Dias de uma variação: de 1 a 7, sem repetir nela nem em outra (o dia repetido entra na mensagem só pelo nome). */
    private static void dias(ResultadoValidacao.Coletor c, List<Integer> dias, Set<Integer> cobertos, String caminho) {
        if (dias.isEmpty()) {
            c.erro(caminho, "Variação sem dia marcado.");
            return;
        }
        boolean foraDaFaixa = false;
        Set<Integer> repetidos = new TreeSet<>();
        for (Integer dia : dias) {
            if (dia == null || dia < 1 || dia > 7) {
                foraDaFaixa = true;
            } else if (!cobertos.add(dia)) {
                repetidos.add(dia);
            }
        }
        if (foraDaFaixa) {
            c.erro(caminho, "Dia precisa ser de 1 (segunda) a 7 (domingo).");
        }
        if (!repetidos.isEmpty()) {
            c.erro(caminho, "Dia em mais de uma variação ou repetido: "
                    + repetidos.stream().map(NOMES_DOS_DIAS::get).collect(Collectors.joining(", ")) + ".");
        }
    }

    /** Refeições de uma lista (a raiz ou uma variação); devolve o kcal do dia, a opção A de cada refeição. */
    private static BigDecimal refeicoes(ResultadoValidacao.Coletor c, Set<UUID> uids, List<Refeicao> refeicoes,
                                        String prefixo) {
        Set<String> nomes = new HashSet<>();
        BigDecimal kcalDoDia = BigDecimal.ZERO;
        for (int i = 0; i < refeicoes.size(); i++) {
            Refeicao r = refeicoes.get(i);
            String cr = prefixo + "[" + i + "]";
            uid(c, uids, r.uid(), cr);
            if (r.nome() == null || r.nome().isBlank()) {
                c.erro(cr + ".nome", "Refeição sem nome.");
            } else if (!nomes.add(r.nome().trim().toLowerCase(Locale.ROOT))) {
                c.aviso(cr + ".nome", "Nome de refeição repetido.");
            }
            if (r.horario() != null && !r.horario().isBlank() && !r.horario().matches("([01]\\d|2[0-3]):[0-5]\\d")) {
                c.erro(cr + ".horario", "Horário no formato HH:MM.");
            }
            // Só o tamanho: o texto é do treinador e nunca vai a log nem à auditoria (nem na mensagem de erro).
            if (r.modoDePreparo() != null && r.modoDePreparo().length() > ConteudoDieta.MODO_DE_PREPARO_MAXIMO) {
                c.erro(cr + ".modoDePreparo", "Modo de preparo com até " + ConteudoDieta.MODO_DE_PREPARO_MAXIMO
                        + " caracteres.");
            }
            List<Opcao> opcoes = r.opcoesOuVazio();
            if (opcoes.isEmpty()) {
                c.erro(cr + ".opcoes", "Refeição sem opção.");
            }
            for (int j = 0; j < opcoes.size(); j++) {
                Opcao o = opcoes.get(j);
                String co = cr + ".opcoes[" + j + "]";
                uid(c, uids, o.uid(), co);
                if (o.itensOuVazio().isEmpty()) {
                    c.erro(co + ".itens", "Opção sem item.");
                }
                for (int k = 0; k < o.itensOuVazio().size(); k++) {
                    Item item = o.itensOuVazio().get(k);
                    item(c, uids, item, co + ".itens[" + k + "]");
                    if (j == 0 && item.kcal() != null) {
                        kcalDoDia = kcalDoDia.add(item.kcal());
                    }
                }
            }
        }
        return kcalDoDia;
    }

    /** Data de início da dieta (texto AAAA-MM-DD, opcional): faixa de planejamento, sem repetir o valor na mensagem. */
    private static void dataDeInicio(ResultadoValidacao.Coletor c, String texto, LocalDate hoje) {
        if (texto == null || texto.isBlank()) {
            return;
        }
        try {
            if (!FaixaDeData.PLANEJAMENTO.aceita(LocalDate.parse(texto.strip()), hoje)) {
                c.erro("dataInicio", FaixaDeData.PLANEJAMENTO.mensagem("Data de início da dieta", hoje));
            }
        } catch (DateTimeParseException invalida) {
            c.erro("dataInicio", "Data de início da dieta: use uma data válida (AAAA-MM-DD).");
        }
    }

    private static boolean emBranco(ConteudoDieta.Ergogenico e) {
        return Stream.of(e.nome(), e.principioAtivo(), e.concentracao(), e.dose(), e.horario(),
                e.observacao(), e.prescricao()).allMatch(t -> t == null || t.isBlank());
    }

    private static void item(ResultadoValidacao.Coletor c, Set<UUID> uids, Item item, String ci) {
        uid(c, uids, item.uid(), ci);
        if (item.nome() == null || item.nome().isBlank()) {
            c.erro(ci + ".nome", "Item sem nome.");
        }
        if (item.quantidade() == null || item.quantidade().signum() <= 0) {
            c.erro(ci + ".quantidade", "Quantidade precisa ser maior que zero.");
        }
        if (item.unidade() != null && !List.of("g", "ml", "un").contains(item.unidade())) {
            c.erro(ci + ".unidade", "Unidade precisa ser g, ml ou un.");
        }
        if (Boolean.TRUE.equals(item.manual()) && item.kcal() == null) {
            c.erro(ci + ".kcal", "Item manual sem kcal.");
        }
        for (BigDecimal valor : new BigDecimal[] {item.kcal(), item.proteina(), item.carboidrato(), item.gordura()}) {
            if (valor != null && (valor.signum() < 0 || valor.compareTo(MAXIMO) > 0)) {
                c.erro(ci, "Valores nutricionais precisam ficar entre 0 e 99999.");
                break;
            }
        }
    }

    private static void uid(ResultadoValidacao.Coletor c, Set<UUID> uids, UUID uid, String caminho) {
        if (uid == null) {
            c.erro(caminho + ".uid", "Item sem identificador.");
        } else if (!uids.add(uid)) {
            c.erro(caminho + ".uid", "Identificador repetido.");
        }
    }
}
