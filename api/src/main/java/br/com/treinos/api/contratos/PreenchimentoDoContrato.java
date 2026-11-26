package br.com.treinos.api.contratos;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import br.com.treinos.api.contratos.CamposDoContrato.Campo;
import br.com.treinos.api.contratos.ContratoDtos.Falta;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.pagamentos.PagamentosDoAluno;
import br.com.treinos.api.pagamentos.PagamentosDoAluno.DadosParaContrato;
import br.com.treinos.api.pagamentos.PagamentosDoAluno.ParcelaDoContrato;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Os valores dos campos de um modelo para um aluno (D9, D10). Campo usado e sem valor entra em {@code faltas}, com frase fixa (nunca o
 * valor): texto jurídico não sai com "—". Os campos financeiros (plano, valor total, parcelas, vigência) vêm da contratação por
 * {@link PagamentosDoAluno}, que é a única que lê o financeiro, e só com {@code FINANCEIRO_LER} e o financeiro ligado; o responsável
 * financeiro também (D12). Nada daqui vai a log.
 */
@Service
class PreenchimentoDoContrato {

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.of("pt", "BR"));

    private final PagamentosDoAluno pagamentos;

    PreenchimentoDoContrato(PagamentosDoAluno pagamentos) {
        this.pagamentos = pagamentos;
    }

    record Resultado(Map<Campo, String> valores, List<Falta> faltas) { }

    /**
     * {@code contratacaoId} nulo = contrato sem plano. Informado, exige {@code FINANCEIRO_LER} (403), o financeiro ligado (503) e que a
     * contratação seja do aluno (404), mesmo que nenhum campo financeiro seja usado: o vínculo também é dado do financeiro.
     */
    Resultado montar(Aluno aluno, Set<Campo> usados, UUID contratacaoId, String nomeDaConsultoria) {
        DadosParaContrato financeiro = null;
        if (contratacaoId != null) {
            AcessoAtual.exigir("FINANCEIRO_LER");
            financeiro = pagamentos.dadosParaContrato(aluno.getId(), contratacaoId);
        }
        Map<Campo, String> valores = new EnumMap<>(Campo.class);
        List<Falta> faltas = new ArrayList<>();
        Optional<PagamentosDoAluno.ResponsavelParaContrato> responsavel = Optional.empty();
        if (usados.contains(Campo.RESPONSAVEL_NOME) || usados.contains(Campo.RESPONSAVEL_CPF)) {
            responsavel = AcessoAtual.pode("FINANCEIRO_LER") ? pagamentos.responsavelParaContrato(aluno.getId()) : Optional.empty();
        }
        // Percorre o enum, não o conjunto: as faltas saem sempre na ordem da lista.
        for (Campo campo : Campo.values()) {
            if (!usados.contains(campo)) {
                continue;
            }
            switch (campo) {
                case ALUNO_NOME -> valores.put(campo, aluno.getNome());
                case CONSULTORIA -> valores.put(campo, nomeDaConsultoria);
                case DATA -> valores.put(campo, LocalDate.now(Fuso.BRASILIA).format(DATA));
                case ALUNO_CPF -> por(valores, faltas, campo, aluno.getCpf(), "Falta o CPF do aluno.");
                case ALUNO_ENDERECO -> por(valores, faltas, campo, endereco(aluno.endereco()), "Falta o endereço do aluno.");
                case RESPONSAVEL_NOME -> por(valores, faltas, campo, responsavel.map(r -> r.nome()).orElse(null),
                        "Falta o responsável financeiro do aluno.");
                case RESPONSAVEL_CPF -> por(valores, faltas, campo, responsavel.map(r -> r.cpf()).orElse(null),
                        "Falta o CPF do responsável financeiro.");
                case PLANO -> por(valores, faltas, campo, financeiro == null ? null : financeiro.plano(),
                        "Falta o plano: escolha uma contratação.");
                case VALOR_TOTAL -> por(valores, faltas, campo,
                        financeiro == null || financeiro.valorTotalCentavos() == null ? null : reais(financeiro.valorTotalCentavos()),
                        "Falta o valor total: escolha uma contratação de contrato fechado.");
                case PARCELAS -> por(valores, faltas, campo, financeiro == null ? null : parcelas(financeiro),
                        "Faltam as parcelas: escolha uma contratação de contrato parcelado.");
                case VIGENCIA_INICIO -> por(valores, faltas, campo,
                        financeiro == null || financeiro.inicio() == null ? null : financeiro.inicio().format(DATA),
                        "Falta o início da vigência: escolha uma contratação.");
                case VIGENCIA_FIM -> por(valores, faltas, campo,
                        financeiro == null || financeiro.fim() == null ? null : financeiro.fim().format(DATA),
                        "Falta o fim da vigência: escolha uma contratação de contrato fechado ou de parcela única.");
            }
        }
        return new Resultado(valores, List.copyOf(faltas));
    }

    private static void por(Map<Campo, String> valores, List<Falta> faltas, Campo campo, String valor, String falta) {
        if (valor == null || valor.isBlank()) {
            faltas.add(new Falta(campo.codigo(), falta));
        } else {
            valores.put(campo, valor);
        }
    }

    /** Logradouro, número, complemento, bairro, cidade/UF e CEP; só o que veio preenchido. */
    static String endereco(Endereco e) {
        if (e == null) {
            return null;
        }
        List<String> partes = new ArrayList<>();
        for (String p : new String[] {e.logradouro(), e.numero(), e.complemento(), e.bairro()}) {
            if (p != null && !p.isBlank()) {
                partes.add(p.strip());
            }
        }
        String local = (e.cidade() == null ? "" : e.cidade().strip()) + (e.uf() == null || e.uf().isBlank() ? "" : "/" + e.uf().strip());
        if (!local.isBlank()) {
            partes.add(local);
        }
        if (e.cep() != null && !e.cep().isBlank()) {
            partes.add("CEP " + e.cep().strip());
        }
        return partes.isEmpty() ? null : String.join(", ", partes);
    }

    /** "entrada de R$ 500,00 em 10/12/2026; parcela 1/2 de R$ 250,00 em 10/01/2027; ...". Sem parcelas vivas, nulo. */
    private static String parcelas(DadosParaContrato f) {
        if (f.parcelas().isEmpty()) {
            return null;
        }
        List<String> linhas = new ArrayList<>();
        if (f.entrada() != null) {
            linhas.add("entrada de " + reais(f.entrada().valorCentavos()) + " em " + f.entrada().vencimento().format(DATA));
        }
        int total = f.parcelas().size();
        for (int i = 0; i < total; i++) {
            ParcelaDoContrato p = f.parcelas().get(i);
            linhas.add("parcela " + (i + 1) + "/" + total + " de " + reais(p.valorCentavos()) + " em " + p.vencimento().format(DATA));
        }
        return linhas.stream().collect(Collectors.joining("; "));
    }

    /** {@code R$ 1.234,56}, com o separador de milhar ponto e sem espaço especial. */
    static String reais(long centavos) {
        long inteiros = centavos / 100;
        long resto = centavos % 100;
        return "R$ " + String.format(Locale.of("pt", "BR"), "%,d", inteiros) + "," + (resto < 10 ? "0" : "") + resto;
    }
}
