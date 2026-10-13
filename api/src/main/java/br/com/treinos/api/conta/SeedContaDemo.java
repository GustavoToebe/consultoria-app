package br.com.treinos.api.conta;

import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dados de demonstração da Minha conta (plano "Profissional", dados comerciais e seis cobranças), só para a consultoria
 * do seed. Tudo fictício: documento zerado, endereço genérico e contato inventado, nada de uma empresa real. Idempotente:
 * cada parte só é criada se a consultoria ainda não a tem, então pode rodar de novo sem duplicar.
 */
@Service
public class SeedContaDemo {

    public static final String DOCUMENTO_FICTICIO = "00.000.000/0001-00";
    public static final BigDecimal VALOR_MENSAL = new BigDecimal("150.00");
    private static final int DIA_VENCIMENTO = 10;

    private final ContaLocalRepositorio contas;

    public SeedContaDemo(ContaLocalRepositorio contas) {
        this.contas = contas;
    }

    public void semear(UUID consultoriaId, String nomeDaConsultoria) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        if (!contas.temDireitos(consultoriaId)) {
            contas.gravarDireitos(new DireitosLocais(consultoriaId, UUID.randomUUID(), 1, "ATIVA", true, null, null,
                    "PROFISSIONAL", "Profissional",
                    Map.of(RecursosDoApp.LIMITE_ALUNOS_ATIVOS, 150L, RecursosDoApp.LIMITE_MEMBROS_EQUIPE, 5L),
                    RecursosDoApp.FUNCIONALIDADES, Instant.now()));
        }
        if (!contas.temContaComercial(consultoriaId)) {
            contas.gravarContaComercial(consultoriaId, cliente(nomeDaConsultoria), contratacao(nomeDaConsultoria, hoje));
        }
        if (!contas.temCobrancas(consultoriaId)) {
            cobrancas(hoje).forEach(c -> contas.gravarCobranca(consultoriaId, c));
        }
    }

    private static Map<String, Object> cliente(String nome) {
        Map<String, Object> endereco = new LinkedHashMap<>();
        endereco.put("logradouro", "Rua Exemplo");
        endereco.put("numero", "100");
        endereco.put("complemento", null);
        endereco.put("bairro", "Centro");
        endereco.put("cidade", "Cidade");
        endereco.put("uf", "UF");
        endereco.put("cep", "00000-000");
        Map<String, Object> contato = new LinkedHashMap<>();
        contato.put("nome", "Contato Exemplo");
        contato.put("email", "contato@exemplo.invalid");
        contato.put("telefone", "(00) 90000-0000");
        contato.put("principal", true);
        Map<String, Object> cliente = new LinkedHashMap<>();
        cliente.put("nome", nome);
        cliente.put("documento", DOCUMENTO_FICTICIO);
        cliente.put("endereco", endereco);
        cliente.put("contatos", List.of(contato));
        return cliente;
    }

    private static Map<String, Object> contratacao(String nomeDaInstancia, LocalDate hoje) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("planoNome", "Profissional");
        c.put("periodicidade", "MENSAL");
        c.put("valor", VALOR_MENSAL);
        c.put("diaVencimento", DIA_VENCIMENTO);
        c.put("inicio", hoje.minusMonths(5).withDayOfMonth(1).toString());
        c.put("vigenteAte", null);
        c.put("situacaoComercial", "ATIVA");
        c.put("nomeInstancia", nomeDaInstancia);
        c.put("adicionais", List.of(Map.of("nome", "Membros extras da equipe", "quantidade", 1)));
        return c;
    }

    /** Seis meses até o atual: quatro pagas, a do mês anterior vencida e a do mês atual em aberto, ainda no prazo. */
    static List<CobrancaLocal> cobrancas(LocalDate hoje) {
        LocalDate mesAtual = hoje.withDayOfMonth(1);
        List<CobrancaLocal> lista = new ArrayList<>();
        for (int atras = 5; atras >= 0; atras--) {
            LocalDate inicio = mesAtual.minusMonths(atras);
            LocalDate fim = inicio.withDayOfMonth(inicio.lengthOfMonth());
            LocalDate vencimento = inicio.withDayOfMonth(DIA_VENCIMENTO);
            if (atras == 0) {
                lista.add(new CobrancaLocal(UUID.randomUUID(), inicio, fim, hoje.plusDays(3), VALOR_MENSAL,
                        CobrancaLocal.ABERTA, null));
            } else if (atras == 1) {
                lista.add(new CobrancaLocal(UUID.randomUUID(), inicio, fim, vencimento, VALOR_MENSAL,
                        CobrancaLocal.ABERTA, null));
            } else {
                lista.add(new CobrancaLocal(UUID.randomUUID(), inicio, fim, vencimento, VALOR_MENSAL,
                        CobrancaLocal.PAGA, vencimento.minusDays(2)));
            }
        }
        return lista;
    }
}
