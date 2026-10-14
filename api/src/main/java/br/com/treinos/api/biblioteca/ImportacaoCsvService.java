package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ErroLinha;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ImportacaoResultado;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.PreviaCsv;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Importação CSV da biblioteca, como a do Servirea: prévia (o que entra e os erros por linha, mais um hash), depois
 * confirmação com o mesmo hash, gravando todas as linhas válidas numa transação. Nome que já existe na biblioteca ou
 * repetido no arquivo vira erro da linha, nunca sobrescreve.
 */
@Service
public class ImportacaoCsvService {

    static final List<String> CABECALHO_EXERCICIOS = List.of("nome", "grupo", "equipamento", "modalidade", "video");
    static final List<String> CABECALHO_ALIMENTOS = List.of("nome", "quantidade_base", "unidade", "kcal", "proteina",
            "carboidrato", "gordura", "fonte");

    public record ExercicioCsv(int linha, String nome, String grupo, String equipamento, String modalidade,
                               String video) {
    }

    public record AlimentoCsv(int linha, String nome, BigDecimal quantidadeBase, String unidade, BigDecimal kcal,
                              BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura, String fonte) {
    }

    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;
    private final VideoUrls videoUrls;

    public ImportacaoCsvService(ExercicioRepository exercicios, AlimentoRepository alimentos, VideoUrls videoUrls) {
        this.exercicios = exercicios;
        this.alimentos = alimentos;
        this.videoUrls = videoUrls;
    }

    @Transactional(readOnly = true)
    public PreviaCsv<ExercicioCsv> previaExercicios(String texto) {
        return lerExercicios(texto);
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="CSV_EXERCICIOS_IMPORTADO",entidade="BIBLIOTECA",resumo="Importou exercícios por CSV.")
    public ImportacaoResultado confirmarExercicios(String texto, String hash) {
        PreviaCsv<ExercicioCsv> previa = lerExercicios(texto);
        exigirMesmoHash(previa.hash(), hash);
        for (ExercicioCsv e : previa.validas()) {
            exercicios.save(new Exercicio(e.nome(), e.grupo(), e.equipamento(),
                    Exercicio.Modalidade.valueOf(e.modalidade()), e.video(), null, Exercicio.Origem.IMPORTACAO));
        }
        return new ImportacaoResultado(previa.validas().size(), previa.erros().size());
    }

    @Transactional(readOnly = true)
    public PreviaCsv<AlimentoCsv> previaAlimentos(String texto) {
        return lerAlimentos(texto);
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="CSV_ALIMENTOS_IMPORTADO",entidade="BIBLIOTECA",resumo="Importou alimentos por CSV.")
    public ImportacaoResultado confirmarAlimentos(String texto, String hash) {
        PreviaCsv<AlimentoCsv> previa = lerAlimentos(texto);
        exigirMesmoHash(previa.hash(), hash);
        for (AlimentoCsv a : previa.validas()) {
            alimentos.save(new Alimento(new Alimento.Valores(a.nome(), a.quantidadeBase(), a.unidade(), a.kcal(),
                    a.proteina(), a.carboidrato(), a.gordura(), null, a.fonte()), Exercicio.Origem.IMPORTACAO));
        }
        return new ImportacaoResultado(previa.validas().size(), previa.erros().size());
    }

    private PreviaCsv<ExercicioCsv> lerExercicios(String texto) {
        LeitorCsv.Tabela tabela = LeitorCsv.ler(texto, CABECALHO_EXERCICIOS);
        Set<String> usados = new HashSet<>(exercicios.nomesAtivos());
        List<ExercicioCsv> validas = new ArrayList<>();
        List<ErroLinha> erros = new ArrayList<>();
        for (LeitorCsv.Linha l : tabela.linhas()) {
            String nome = l.campo(0);
            String grupo = l.campo(1);
            String equipamento = l.campo(2);
            String modalidade = modalidade(l.campo(3));
            String video = l.campo(4);
            String motivo = null;
            if (nome.isEmpty() || nome.length() > 120) {
                motivo = "Nome vazio ou com mais de 120 caracteres.";
            } else if (grupo.length() > 60 || equipamento.length() > 60) {
                motivo = "Grupo e equipamento têm no máximo 60 caracteres.";
            } else if (modalidade == null) {
                motivo = "Modalidade inválida (use livre, máquina, elástico, peso corporal, cardio ou outro).";
            } else if (!video.isEmpty() && !videoUrls.valida(video)) {
                motivo = "Link de vídeo não aceito (só https do YouTube).";
            } else if (!usados.add(nome.toLowerCase(Locale.ROOT))) {
                motivo = "Já existe na biblioteca ou repetido no arquivo.";
            }
            if (motivo != null) {
                erros.add(new ErroLinha(l.numero(), motivo));
            } else {
                validas.add(new ExercicioCsv(l.numero(), nome, vazioNulo(grupo), vazioNulo(equipamento), modalidade,
                        vazioNulo(video)));
            }
        }
        return new PreviaCsv<>(validas, erros, tabela.hash());
    }

    private PreviaCsv<AlimentoCsv> lerAlimentos(String texto) {
        LeitorCsv.Tabela tabela = LeitorCsv.ler(texto, CABECALHO_ALIMENTOS);
        Set<String> usados = new HashSet<>(alimentos.nomesAtivos());
        List<AlimentoCsv> validas = new ArrayList<>();
        List<ErroLinha> erros = new ArrayList<>();
        for (LeitorCsv.Linha l : tabela.linhas()) {
            String nome = l.campo(0);
            String unidade = l.campo(2).toLowerCase(Locale.ROOT);
            String fonte = l.campo(7);
            BigDecimal base = numero(l.campo(1), tabela.separador());
            BigDecimal kcal = numero(l.campo(3), tabela.separador());
            BigDecimal proteina = numero(l.campo(4), tabela.separador());
            BigDecimal carboidrato = numero(l.campo(5), tabela.separador());
            BigDecimal gordura = numero(l.campo(6), tabela.separador());
            String motivo = null;
            if (nome.isEmpty() || nome.length() > 160) {
                motivo = "Nome vazio ou com mais de 160 caracteres.";
            } else if (!List.of("g", "ml", "un").contains(unidade)) {
                motivo = "Unidade inválida (use g, ml ou un).";
            } else if (base == null || base.signum() <= 0) {
                motivo = "Quantidade base precisa ser um número maior que zero.";
            } else if (kcal == null || proteina == null || carboidrato == null || gordura == null) {
                motivo = "Kcal, proteína, carboidrato e gordura precisam ser números de 0 a 99999.";
            } else if (fonte.length() > 200) {
                motivo = "Fonte com mais de 200 caracteres.";
            } else if (!usados.add(nome.toLowerCase(Locale.ROOT))) {
                motivo = "Já existe na biblioteca ou repetido no arquivo.";
            }
            if (motivo != null) {
                erros.add(new ErroLinha(l.numero(), motivo));
            } else {
                validas.add(new AlimentoCsv(l.numero(), nome, base, unidade, kcal, proteina, carboidrato, gordura,
                        vazioNulo(fonte)));
            }
        }
        return new PreviaCsv<>(validas, erros, tabela.hash());
    }

    private static void exigirMesmoHash(String atual, String informado) {
        if (informado == null || !informado.equals(atual)) {
            throw new ConflictException("O arquivo mudou depois da prévia. Gere a prévia de novo.", "PREVIA_DIFERENTE");
        }
    }

    /** "máquina", "Peso corporal", "LIVRE"... viram o valor do enum; vazio = máquina. */
    private static String modalidade(String texto) {
        if (texto.isEmpty()) {
            return Exercicio.Modalidade.MAQUINA.name();
        }
        String chave = Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        for (Exercicio.Modalidade m : Exercicio.Modalidade.values()) {
            if (m.name().equals(chave)) {
                return m.name();
            }
        }
        return null;
    }

    /** Com {@code ;} a vírgula é decimal (planilha brasileira); com {@code ,} o decimal é ponto. */
    private static BigDecimal numero(String texto, char separador) {
        if (texto.isEmpty()) {
            return null;
        }
        try {
            BigDecimal n = new BigDecimal(separador == ';' ? texto.replace(',', '.') : texto);
            return n.signum() < 0 || n.compareTo(new BigDecimal("99999")) > 0 || n.scale() > 2 ? null : n;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String vazioNulo(String texto) {
        return texto.isEmpty() ? null : texto;
    }
}
