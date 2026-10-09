package br.com.treinos.api.mobilidade;

import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ConteudoMobilidade;
import br.com.treinos.api.receitas.ConteudoMobilidade.Item;
import br.com.treinos.api.receitas.ConteudoMobilidade.Secao;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Regras de publicação da mobilidade. Confere só a forma do plano; nunca avalia se a prescrição é adequada. Os
 * identificadores valem para seções e itens juntos, como na dieta.
 */
@Component
public class ValidadorMobilidade {

    private final VideoUrls videoUrls;

    public ValidadorMobilidade(VideoUrls videoUrls) {
        this.videoUrls = videoUrls;
    }

    public ResultadoValidacao validar(ConteudoMobilidade conteudo, LocalDate inicio, LocalDate fim) {
        ResultadoValidacao.Coletor c = new ResultadoValidacao.Coletor();
        Set<UUID> uids = new HashSet<>();
        List<Secao> secoes = conteudo.secoes() == null ? List.of() : conteudo.secoes();
        if (secoes.isEmpty()) {
            c.erro("secoes", "A mobilidade não tem nenhuma seção.");
        }
        for (int i = 0; i < secoes.size(); i++) {
            Secao s = secoes.get(i);
            String cs = "secoes[" + i + "]";
            uid(c, uids, s.uid(), cs);
            if (s.titulo() == null || s.titulo().isBlank()) {
                c.aviso(cs + ".titulo", "Seção sem título.");
            }
            List<Item> itens = s.itens() == null ? List.of() : s.itens();
            if (itens.isEmpty()) {
                c.erro(cs + ".itens", "Seção sem item.");
            }
            for (int j = 0; j < itens.size(); j++) {
                Item item = itens.get(j);
                String ci = cs + ".itens[" + j + "]";
                uid(c, uids, item.uid(), ci);
                if (item.nome() == null || item.nome().isBlank()) {
                    c.erro(ci + ".nome", "Item sem nome.");
                }
                if (item.videoUrl() != null && !item.videoUrl().isBlank() && !videoUrls.valida(item.videoUrl())) {
                    c.erro(ci + ".videoUrl", "Link de vídeo não aceito. Use um link https do YouTube.");
                }
            }
        }
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            c.aviso("fim", "O fim do período é antes do início.");
        }
        return c.resultado();
    }

    private static void uid(ResultadoValidacao.Coletor c, Set<UUID> uids, UUID uid, String caminho) {
        if (uid == null) {
            c.erro(caminho + ".uid", "Falta o identificador.");
        } else if (!uids.add(uid)) {
            c.erro(caminho + ".uid", "Identificador repetido.");
        }
    }
}
