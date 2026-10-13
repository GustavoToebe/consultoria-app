package br.com.treinos.api.dieta;

import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.web.LinksExternos;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Regras de publicação da dieta. Confere só a forma do plano; nunca avalia se a dieta é adequada.
 * O total do dia considera a primeira opção de cada refeição (opção A), nunca a soma das alternativas.
 */
@Component
public class ValidadorDieta {

    private static final BigDecimal MAXIMO = new BigDecimal("99999");

    public ResultadoValidacao validar(ConteudoDieta conteudo, LocalDate inicio, LocalDate fim) {
        ResultadoValidacao.Coletor c = new ResultadoValidacao.Coletor();
        Set<UUID> uids = new HashSet<>();
        Set<String> nomes = new HashSet<>();
        BigDecimal kcalDoDia = BigDecimal.ZERO;
        List<Refeicao> refeicoes = conteudo.refeicoesOuVazio();
        if (refeicoes.isEmpty()) {
            c.erro("refeicoes", "A dieta não tem nenhuma refeição.");
        }
        for (int i = 0; i < refeicoes.size(); i++) {
            Refeicao r = refeicoes.get(i);
            String cr = "refeicoes[" + i + "]";
            uid(c, uids, r.uid(), cr);
            if (r.nome() == null || r.nome().isBlank()) {
                c.erro(cr + ".nome", "Refeição sem nome.");
            } else if (!nomes.add(r.nome().trim().toLowerCase(Locale.ROOT))) {
                c.aviso(cr + ".nome", "Nome de refeição repetido.");
            }
            if (r.horario() != null && !r.horario().isBlank() && !r.horario().matches("([01]\\d|2[0-3]):[0-5]\\d")) {
                c.erro(cr + ".horario", "Horário no formato HH:MM.");
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
        for (int s = 0; s < conteudo.suplementacaoOuVazio().size(); s++) {
            ConteudoDieta.Suplemento sup = conteudo.suplementacaoOuVazio().get(s);
            uid(c, uids, sup.uid(), "suplementacao[" + s + "]");
            if (sup.link() != null && !sup.link().isBlank() && !LinksExternos.valido(sup.link())) {
                c.erro("suplementacao[" + s + "].link", LinksExternos.MENSAGEM);
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
        if (!refeicoes.isEmpty() && kcalDoDia.signum() == 0) {
            c.aviso("refeicoes", "O total do dia (opção A de cada refeição) está com 0 kcal.");
        }
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            c.aviso("fim", "O fim do período é antes do início.");
        }
        return c.resultado();
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
